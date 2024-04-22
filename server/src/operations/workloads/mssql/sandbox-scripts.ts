// instances input instances = ['"computername\\instanceName"', '"."']; "." represents the default instance
// ('source', 'initialCreationDate', 'tag', 'baseSnapshot') are the extended properties saved during creation of sandbox
const GET_SANDBOX_DETAILS = (instances: string[]) => ` 
$instances = (${instances})

$results = foreach ($instance in $instances) {
    try {
        $query = @"
        SET NOCOUNT ON;
        DROP TABLE IF EXISTS #properties;
        
        CREATE TABLE #properties (
            database_name nvarchar(255),
            name nvarchar(255),
            value sql_variant
        );
        
        INSERT INTO #properties
        EXEC sp_MSforeachdb '
            USE [?];
            SELECT database_name = DB_NAME(), l.name, l.value
            FROM sys.databases d
            OUTER APPLY fn_listextendedproperty(default, default, default, default, default, default, default) l
            WHERE d.name = DB_NAME()
            AND database_id > 4
            AND l.name IS NOT NULL
            AND l.value IS NOT NULL ';
        
        SELECT database_name, JSON_QUERY(properties) AS sandbox_properties
        FROM (
            SELECT database_name, JSON_QUERY((SELECT name, value FROM #properties AS p2 WHERE p2.database_name = p1.database_name AND p2.name IN ('source', 'initialCreationDate', 'tag', 'baseSnapshot') FOR JSON PATH)) AS properties
            FROM #properties AS p1
            WHERE name = 'cloned_by' AND value = 'netapp'
        ) AS grouped_properties
        GROUP BY database_name, properties
        FOR JSON PATH; 
"@

        $output = sqlcmd -S $instance -Q $query -y 0 2> $null

        if ($output) {
            [PSCustomObject]@{
                Instance = $instance
                Output = $output
            } | ConvertTo-Json
        }
        else {
            [PSCustomObject]@{
                Instance = $instance
                Output = "No sandboxes created for the instance"
            } | ConvertTo-Json
        }
    }
    catch {
        [PSCustomObject]@{
            Instance = $instance
            Error = "Error executing query on $instance  $_.Exception.Message"
        } | ConvertTo-Json
    }
}

$results
`;

const checkDatabaseExists = (dbCloneName: string) => `
    $WarningPreference = 'SilentlyContinue';

    $dbCloneName = '${dbCloneName}'

    if ($responeObject -eq $null) {
        $responeObject = @{}
    }

    $sqlcmd = "SET NOCOUNT ON; SELECT name FROM sys.databases where name = '$dbCloneName' FOR JSON PATH;"
    $sqlresponse =  sqlcmd -Q $sqlcmd -y 0;

    [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }

    if ($ExistingDatabases.count -ne 0) {
        Write-Error "Database with name $dbCloneName already exists"
        $responeObject.add('dbCloneNameExists', $True)
    }

    $responeObject.add('dbCloneNameExists', $False)
`;

// Template for ONTAP REST request
// Assumes that the following variables are defined in the script:
//  - $FSxID: FSx ID
//  - $FSxRegion: FSx region
const ontapRestRequest = `
        Add-Type @"
            using System.Net;
            using System.Security.Cryptography.X509Certificates;
            public class TrustAllCertsPolicy : ICertificatePolicy {
                public bool CheckValidationResult(
                ServicePoint srvPoint, X509Certificate certificate,
                WebRequest request, int certificateProblem) {
                    return true;
                }
            }
"@
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $FSxUserName = $SsmParameter.fsx.username
        $FSxPassword = $SsmParameter.fsx.password
        $FSxPasswordSecureString = ConvertTo-SecureString $FSxPassword -AsPlainText -Force
        $FSxCredentials = New-Object System.Management.Automation.PSCredential($FSxUserName, $FSxPasswordSecureString)
        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"

        $isprivatesubnet = $False
        $connection =  Test-Connection -ComputerName fsx-aws-certificates.s3.amazonaws.com -Quiet
        if ($connection -eq $False) {
            $isprivatesubnet = $True
            $regionCertificateificate = ''
        } else {
            $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
            Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile $Env:Temp\\FSxCertificate.pem
            $Certificate = Import-Certificate -FilePath $Env:Temp\\FSxCertificate.pem -CertStoreLocation Cert:\\LocalMachine\\Root
            $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
        }

        Function Invoke-ONTAPRequest {
            param(
                [Parameter(Mandatory = $true)]
                [string]$ApiEndpoint,

                [Parameter(Mandatory = $false)]
                [string]$ApiQueryFilter = '',

                [Parameter(Mandatory = $false)]
                [string]$ApiQueryFields = '',

                [Parameter(Mandatory = $false)]
                [string]$method = 'GET',

                [Parameter(Mandatory = $false)]
                [string]$body
            )

            Write-debug "Invoke ONTAP rest request $APIEndpoint $APIQueryFilter $ApiQueryFields $method $body"

            $QuestionSymbol = ''
            if ($ApiQueryFields -ne '' -or $ApiQueryFilter -ne '') {
                $QuestionSymbol = '?';
            }

            $Ampersand = ''
            if ($ApiQueryFields -ne '' -and $ApiQueryFilter -ne '') {
                $Ampersand = '&';
            }

            $Params = @{
                "URI"     = 'https://' + $FSxHostName + '/api' + $ApiEndpoint + $QuestionSymbol + $ApiQueryFilter + $Ampersand + $ApiQueryFields
                "Method"  = $method
                "Headers" =@{"Authorization" = "Basic $FSxCredentialsInBase64"}
                "ContentType" = "application/json"
            }

            if (-not ([string]::IsNullOrEmpty($body))) {
                $Params.Add("Body", $body)
            }

            if ($isprivatesubnet -eq $False -and $regionCertificateificate -ne $null) {
                return Invoke-RestMethod @Params -Certificate $regionCertificateificate
            } else {
                return Invoke-RestMethod @Params
            }
        }
`;

const ontapJobStatusTemplate = `
        Function Get-OntapJobStatus {
            param(
                [Parameter(Mandatory = $true)]
                [string]$jobId,
                [Parameter(Mandatory = $false)]
                [string]$timeInterval = 1000
            )

            $ApiEndpoint = "/cluster/jobs/$jobId"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint
            while($response.state -ne 'success' -and $response.state -ne 'failure') {
                start-sleep -Milliseconds $timeInterval
                $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint
            }

            return $response
        }
`;

const getDbMappedOntapVolumes = (fsxid: string, fsxregion: string, dbName: string) => `
    $WarningPreference = 'SilentlyContinue';
    $FSxID = '${fsxid}'
    $FSxRegion = '${fsxregion}'
    $dbname = '${dbName}'

    if ($responeObject -eq $null) {
        $responeObject = @{}
    }
    
    try {
        $sqlquery = @"
            SET NOCOUNT ON;
            SELECT DISTINCT vs.logical_volume_name as volumename, mf.physical_name as filename, collation_name FROM sys.master_files AS mf
            join sys.databases db
            on db.database_id = mf.database_id
            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
            where db.name = '$dbname'
            FOR JSON PATH;
"@

        Function Get-SerialNumberOfWinVolumes {
            param(
                [Parameter(Mandatory = $true)]
                [string[]]$sqlresponse
            )
    
            $winvolumes = $sqlresponse | foreach { $_ | ConvertFrom-Json }
            $dataVolume = $WinVolumes | Where-Object { $_.filename -match '\\.mdf$' } | Select-Object -ExpandProperty volumename
            $logVolume = $WinVolumes | Where-Object { $_.filename -match '\\.ldf$' } | Select-Object -ExpandProperty volumename
    
            $volumes = Get-CimInstance -Query "SELECT DeviceID, VolumeName FROM Win32_LogicalDisk where VolumeName = '$dataVolume' or VolumeName = '$logVolume'"
            $results = @()
            foreach ($volume in $volumes) {
                $object = New-Object PSObject -Property @{
                    "DriveLetter" = $volume.DeviceID
                    "VolumeName" = $volume.VolumeName
                    "FileName" = $WinVolumes | Where-Object { $_.volumename -eq $volume.VolumeName } | Select-Object -ExpandProperty filename
                    "Collation" = $WinVolumes | Where-Object { $_.volumename -eq $volume.VolumeName } | Select-Object -ExpandProperty collation_name
                }
                $partitions = Get-CimInstance -Query "ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='$($volume.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"
                foreach ($partition in $partitions) {
                    $diskdrives = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"
                    foreach ($diskdrive in $diskdrives) {
                        $object | Add-Member -MemberType NoteProperty -Name "LUNSerialNumber" -Value $diskdrives.SerialNumber
                    }
                }
                $results += $object
            }
    
            return $results
        }
    
        ${ontapRestRequest}

        Function Get-LunFromSerialNumber($SerialNumbers) {
            Write-debug "Get ONTAP lun name from serial numbers for: $SerialNumbers"
    
            $lunObjects = @()
            foreach ($SerialNumber in $SerialNumbers) {
                if ($SerialNumber.LUNSerialNumber -eq '') {
                    continue
                }
    
                $QueryFilter = $SerialNumber.LunSerialNumber
                $Params = @{
                    "ApiEndPoint" = "/storage/luns"
                }
    
                if ($QueryFilter -ne '') {
                    $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter&fields=svm.name"}
                }
    
                $Response = Invoke-ONTAPRequest @Params
    
                $LunRecords = $Response.records
    
                if ($LunRecords.count -gt 0) {
                    $lunObject = @{
                        "lunpath" = $LunRecords[0].name
                        "svm" = $LunRecords[0].svm.name
                        "windowsVolumeName" = $SerialNumber.VolumeName
                        "filename" = $SerialNumber.filename
                        "collation" = $SerialNumber.collation
                    }
    
                    $lunObjects += $lunObject
                }
            }
        
            return $lunObjects
        }
    
        Function Get-VolumeIdFromName($lunObjects) {
            Write-debug "Get Volume Id from name: $lunObjects"
    
            $volumes = @()
            foreach ($lunObject in $lunObjects) {
                if ($lunObject.lunpath -eq '') {
                    continue
                }
                $QueryFilter = $lunObject.lunpath
                $Params = @{
                    "ApiEndPoint" = "/storage/volumes"
                }
    
                if ($QueryFilter -ne '') {
                    $Params += @{"ApiQueryFilter" = "name=$QueryFilter"}
                }
    
                $Response = Invoke-ONTAPRequest @Params
    
                $VolumeRecords = $Response.records
                if ($VolumeRecords.count -gt 0) {
                    $volume = @{
                        "volumeId" = $VolumeRecords[0].uuid
                        "lunpath" = $lunObject.lunpath
                        "windowsVolumeName" = $lunObject.windowsVolumeName
                        "filename" = $lunObject.filename
                        "svm" = $lunObject.svm
                        "collation" = $lunObject.collation
                        "volumeName" = $VolumeRecords[0].name
                    }

                    $volumes += $volume
                }
            }
    
            return $volumes
        }
    
        $sqlresponse =  sqlcmd -Q $sqlquery -y 0;
        write-debug "SQL response: $sqlresponse"
        if ([string]::IsNullOrEmpty($sqlresponse) -or $sqlresponse.count -eq 0) {
            $responeObject['error'] = "Couldn't get database windows volumes from db $dbname"
            return $responeObject
        }
    
        $SerialNumbers = Get-SerialNumberOfWinVolumes $sqlresponse
        write-debug "Serial numbers: $($SerialNumbers | ConvertTo-Json)"
        if ([string]::IsNullOrEmpty($SerialNumbers) -or $SerialNumbers.count -eq 0) {
            $responeObject['error'] = "Couldn't get windows volume serial numbers"
            return $responeObject
        }
    
        $LunNames = Get-LunFromSerialNumber $SerialNumbers
        write-debug "Lun Names: $($LunNames | ConvertTo-Json)"
        if ([string]::IsNullOrEmpty($LunNames) -or $LunNames.count -eq 0) {
            $responeObject['error'] = "Couldn't get associated Ontap LUN volume names"
            return $responeObject
        }
    
        $volumes = Get-VolumeIdFromName $LunNames
        write-debug "Volumes: $($volumes | ConvertTo-Json)"
        if ([string]::IsNullOrEmpty($volumes) -or $volumes.count -eq 0) {
            $responeObject['error'] = "Couldn't get volumes from lun paths"
            return $responeObject
        }
    
        $responeObject = $volumes
    } catch {
        write-Error $_.Exception.Message
        $responeObject['error'] = $_.Exception.Message
    }
    
    $responeObject | ConvertTo-Json -Depth 5
`;

// Create clone
const createVolumeClone = (
    fsxid: string,
    fsxregion: string,
    sourceSvm: string,
    dataVolumeName: string,
    dataLunPath: string,
    logVolumeName: string,
    logLunPath: string,
    targetSvm?: string
) => `
    $fsxid = ${fsxid}
    $fsxregion = ${fsxregion}
    $sourceSvm = ${sourceSvm}
    $targetSvm = ${targetSvm}
    $dataVolume = ${dataVolumeName}
    $logVolume = ${logVolumeName}
    $dataLunPath = ${dataLunPath}
    $logLunPath = ${logLunPath}


    $WarningPreference = "SilentlyContinue"
    $responeObject = @{}
    
    try {
        $epoch = (Get-Date -Date ((Get-Date).DateTime) -UFormat %s)
    
        $DataLunLeaf = Split-Path -Path $dataLunPath -Leaf
        $LogLunLeaf = Split-Path -Path $logLunPath -Leaf
    
        $CloneDataVolumeName =  $dataVolume + '_clone_' + $epoch
        $CloneLogVolumeName =  $logVolume + '_clone_' + $epoch
    
        $CloneDataLunPath = "/vol/$CloneDataVolumeName/$DataLunLeaf"
        $CloneLogLunPath = "/vol/$CloneLogVolumeName/$LogLunLeaf"
    
        if ($sourceSvm -ne $targetSvm) {
            $parentVserver = $sourceSvm
        } else {
            $parentVserver = $targetSvm
        }
    
        ${ontapRestRequest}

        Function Get-IgroupName {
            $nodeiqn = (Get-InitiatorPort).NodeAddress
            write-debug "Local Node IQN: $nodeiqn"
            if (-not ($nodeiqn -match '(.*\\:.+?)\\.')) {
                $initiators = $nodeiqn
            } else {
                $initiators = $nodeiqn + '|' + $matches[1]
            }
            
            $ApiEndpoint = "/protocols/san/igroups"
            $ApiQueryFilter = 'svm.name=' + $targetSvm + '&initiators.name=' + $initiators + '&protocol=iscsi'
    
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $ApiQueryFilter
    
            if ($response.records.count -eq 0) {
                return $null
            }
            return $response.records[0].name
        }

        ${ontapJobStatusTemplate}

        Function New-VolumeClone {
            if ($sourceSvm -ne $targetSvm) {
                $parentsvm = $sourceSvm
            } else {
                $parentsvm = $targetSvm
            }
    
            $jobStatus = @()
            @($dataVolume, $logVolume) | ForEach-Object {
                $parentvolume = $_
                $ApiEndpoint = "/storage/volumes"
                $body = @{
                    "name" = $parentvolume + '_clone_' + $epoch
                    "svm.name" = $targetSvm
                    "clone" = @{
                        "is_flexclone" = $True
                        "parent_volume" = @{
                            "name" = $parentvolume
                        }
                        "parent_svm" = @{
                            "name" = $parentsvm
                        }
                    }
                } | ConvertTo-Json
    
                $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "POST"
                $jobStatus += Get-OntapJobStatus -jobId $ontapResponse.job.uuid
            }
    
            return $jobStatus
        }
    
        Function Add-ObjectTagsToVolume {
            $ApiQueryFilter = 'location.volume.name='
            @($dataVolume, $logVolume) | ForEach-Object {
                $ApiQueryFilter += $_ + '_clone_' + $epoch + '|'
            }
    
            $ApiQueryFilter = $ApiQueryFilter.TrimEnd('|')
            $ApiQueryFields = 'fields=location.volume.uuid,serial_number'
            $ApiEndpoint = "/storage/luns"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $ApiQueryFilter -ApiQueryFields $ApiQueryFields
            write-debug ($response | ConvertTo-Json)
    
            if ($response.records.count -eq 0) {
                $responeObject['error'] = "Could not find the cloned volumes to create tags."
                return $responeObject
            }

            $volumes = @()
            $jobStatus = @()
            $response.records | ForEach-Object {
                $volumeid = $_.location.volume.uuid
                $volumes += @{
                    "volumeid" = $volumeid
                    "lun_serial_number" = $_.serial_number
                    "volume_name" = $_.location.volume.name
                }
                $body = @{
                    "tiering" = @{
                        "object_tags" = @("cloned_by=netapp_wlmdb", "resource_id=$resourceId")
                    }
                } | ConvertTo-Json
    
                $ApiEndpoint = '/storage/volumes/' + $volumeid
                $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "PATCH"
                $jobStatus += Get-OntapJobStatus -jobId $ontapResponse.job.uuid
            }
    
            return @{
                "records" = $volumes
                "jobstatus" = $jobStatus
            }
        }

        Function Set-LUNSignature {
            # Set the LUN signature only if the source and target SVMs are the same
            if ($sourceSvm -eq $targetSvm) {
                if (-not (Get-Module -ListAvailable -Name NetApp.ONTAP)) {
                    Write-Debug "NetApp.ONTAP Module does not exist, installing it now"
    
                    Install-Module -Name NetApp.ONTAP -Force -AllowClobber
                }
    
                $null = Connect-NcController -Credential $FSxCredentials -Name $FSxHostName
    
                $message
                @($dataLunPath, $logLunPath) | ForEach-Object {
                    $lunPath = $_
    
                    $null = Set-NcLunSignature -Path $lunPath -Vserver $targetSvm -Confirm:$False
                    if (-not $?) {
                        $message += "Could not change LUN signature for $lunClonePath."
                    }
                }
    
                return $message
            }
        }

        Function Set-LunMap {
            param(
                [Parameter(Mandatory = $true)]
                [string]$igroup
            )
    
            $ApiEndpoint = '/protocols/san/lun-maps'
            $lunPaths = @($CloneDataLunPath, $CloneLogLunPath)
            $records = @()
            $lunPaths | ForEach-Object {
                $records += @{
                    "svm.name" = $targetSvm
                    "lun.name" = $_
                    "igroup.name" = $igroup
                }
            }
    
            $body = @{'records' = $records} | ConvertTo-Json
    
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "POST" -ApiQueryFilter 'return_timeout=5'
            $result = @{}
            $jobId = $response.job.uuid
            if ($response.job._links.results) {
                $queryFilter = $response.job._links.results.href.split('?')[1]
                $result['records'] = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -apiQueryFilter "job_results_uuid=$jobId"
            } else {
                $jobStatus = Get-OntapJobStatus -jobId $jobId
                if ($jobStatus.state -ne 'success') {
                    $result['error'] = $jobStatus.message
                }
            }
    
            return $result
        }

        $igroup = Get-IgroupName
        write-debug "Igroup: $igroup"
        if ([string]::IsNullOrEmpty($igroup)) {
            $responeObject['error'] = "Could not find igroup for $targetSvm."
            return $responeObject
        }
    
        $jobStatusList = New-VolumeClone
        write-debug "Clone job status: $($jobStatusList | convertto-json)"
        $failedjob = $jobStatusList | Where-Object { $_.state -ne 'success' } | Select-Object -First 1
        write-debug "Clone volumes job: $($failedjob | convertto-json)"
        if ($failedjob) {
            $responeObject['error'] = "Could not clone volume. Ontap error: $($failedjob.message)"
            return $responeObject
        }
    
        $response = Add-ObjectTagsToVolume
        write-debug "Modify volumes job: $($jobStatusList | convertto-json)"
        $failedjob = $jobStatusList | Where-Object { $_.state -ne 'success' } | Select-Object -First 1
        if ($failedjob) {
            $responeObject['error'] = "Could not add tags to the cloned volumes. Ontap error: $($failedjob.message)"
            return $responeObject
        }
        $responeObject['volumeids'] = $response.records

        $errormessage = Set-LUNSignature
        if ($errormessage -ne $null) {
            $responeObject['error'] = "Could not set LUN signature. $($errormessage | convertto-json)"
            return $responeObject
        }
    
        $result = Set-LunMap -igroup $igroup
        write-debug "Map LUNs job: $($result | convertto-json)"
        if ($result.error -or $result.records.count -eq 0) {
            $responeObject['error'] = "Could not map LUNs. Ontap error: $($result.error)"
            return $responeObject
        }
    } catch {
        $responeObject['error'] = $_.Exception.Message
        return $responeObject
    }
    
    $responeObject | ConvertTo-Json -Depth 5
`;

const createClonedDb = (dbName: string, fileList: string[] = [], collation?: string) => `
    $WarningPreference = 'SilentlyContinue';
    $dbname = '${dbName}'

    try {
        $selectquery = "SET NOCOUNT ON; SELECT name, state_desc FROM sys.databases where name = '$dbname' FOR JSON PATH;"
        $sqlresponse =  sqlcmd -Q $selectquery -y 0;

        write-debug "SQL response: $sqlresponse"
        [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }
        $selectresult = (sqlcmd -Q $selectquery -y 0) | ConvertFrom-Json
        if ($selectresult.count -gt 0) {
            Write-Error "Database $dbname already exists and is in $($selectresult[0].state_desc) state. Exiting..."
        }

        # SQL script to attach a database
        $attachQuery = @"
            CREATE DATABASE $dbname ON  
            ${fileList.map(file => (file ? `(FILENAME = '${file}')` : '')).join()}
            ${collation ? `COLLATE '${collation}'` : ''}
            FOR ATTACH;
"@
        sqlcmd -Q $attachQuery
    } catch {
        Write-Error $_.Exception.Message
    }
`;

const addExtendedProperties = (dbName: string, propObj: { [x: string]: string | number }) => `
$dbname = '${dbName}'

$query = @"
USE $dbname;
SET NOCOUNT ON;

${Object.keys(propObj)
    .map(
        k =>
            `EXEC sp_addextendedproperty @name = N'${k}', @value = ${
                typeof propObj[k] === 'string' ? `'${propObj[k]}'` : propObj[k]
            };`
    )
    .join('\n')}

"@

Sqlcmd -Q $query -y 0
`;

const cleanUpOntapResources = (fsxid: string, fsxregion: string, volumeIds: string[], filePaths: string[]) => `
    $fsxid = '${fsxid}'
    $fsxregion = '${fsxregion}'
    $volumeIds = '${volumeIds}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json

    $WarningPreference = 'SilentlyContinue';
    $responeObject = @{}

    try {
        $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status
        if ($clusterServiceStatus -eq 'Running') {
            #Cleanup drives from SQL dependency in case of clustered configuration
            if ($DBName.Length -gt 25) {
                $DBName = $DBName.Substring(0,25)
            }
            $datalabel = $DBName+"-Data"
            $loglabel = $DBName+"-Log"

            #Check if disks are in dependency list before cleaning up
            $dependencylist = (Get-ClusterResourceDependency -Resource "SQL Server" -ErrorAction SilentlyContinue).DependencyExpression
            $datafound = $dependencylist -match '\\(\\['+$datalabel+'\\]\\)'
            $logfound =  $dependencylist -match '\\(\\['+$loglabel+'\\]\\)'

            if ($datafound) {
                $null = (Remove-ClusterResourceDependency -Resource "SQL Server" -Provider $datalabel)
                Remove-ClusterResource -Name $datalabel -Force
            }

            if ($logfound) {
                $null = (Remove-ClusterResourceDependency -Resource "SQL Server" -Provider $loglabel)
                Remove-ClusterResource -Name $loglabel -Force
            }
        }

        $virtualDrives = $filePaths | ForEach-Object {
            $splits = $_.Split('\\')
            $splits[0] + '\\' + $splits[1]
        }

        $virtualDrives | ForEach-Object {
            $null = (Remove-Item -Path $_ -Force -Recurse -ErrorAction SilentlyContinue)
        }

        ${ontapRestRequest}
        ${ontapJobStatusTemplate}

        $volumeIds | ForEach-Object {
            $volumeId = $_
            $ApiEndpoint = "/storage/volumes/$volumeId"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -method "DELETE"
            $jobStatus = Get-OntapJobStatus -jobId $response.job.uuid
            if ($jobStatus.state -ne 'success') {
                Write-Debug "Could not delete volume $volumeId. Ontap error: $($jobStatus.message)"
            }
        }
    } catch {
        Write-Debug $_.Exception.Message
        $responeObject['error'] = $_.Exception.Message
    }

    $responeObject | ConvertTo-Json
`;

export {
    GET_SANDBOX_DETAILS,
    checkDatabaseExists,
    getDbMappedOntapVolumes,
    addExtendedProperties,
    createVolumeClone,
    createClonedDb,
    cleanUpOntapResources
};
