// instances input instances = ['"computername\\instanceName"', '"."']; "." represents the default instance
// ('source', 'initialCreationDate', 'tag', 'baseSnapshot') are the extended properties saved during creation of sandbox
const GET_SANDBOX_DETAILS = (instances: string[], accountId: string) => ` 
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
            SELECT database_name, JSON_QUERY((SELECT name, value FROM #properties AS p2 WHERE p2.database_name = p1.database_name AND p2.name IN ('source', 'createdAt', 'tag', 'baseSnapshot', 'updatedAt') FOR JSON PATH)) AS properties
            FROM #properties AS p1
            WHERE name = 'cloned_by' AND value = 'netapp_wf'
        ) AS grouped_properties
        WHERE database_name IN (
            SELECT database_name
            FROM #properties
            WHERE name = 'accountId' AND value = '${accountId}'
        )
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

const checkDatabaseExists = (dbCloneName: string, instanceName: string = '.') => `
    $WarningPreference = 'SilentlyContinue';

    $dbCloneName = '${dbCloneName}'

    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    $sqlcmd = "SET NOCOUNT ON; SELECT name FROM sys.databases where name = '$dbCloneName' FOR JSON PATH;"
    $sqlresponse =  sqlcmd  -S "${instanceName}" -Q $sqlcmd -y 0;

    [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }

    if ($ExistingDatabases.count -ne 0) {
        Write-Error "Database with name $dbCloneName already exists"
        $responseObject.add('dbCloneNameExists', $True)
    }

    $responseObject.add('dbCloneNameExists', $False)
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
            $regionCertificate = ''
        } else {
            $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
            Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile $Env:Temp\\FSxCertificate.pem
            $Certificate = Import-Certificate -FilePath $Env:Temp\\FSxCertificate.pem -CertStoreLocation Cert:\\LocalMachine\\Root
            $regionCertificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
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

            if ($isprivatesubnet -eq $False -and $regionCertificate -ne $null) {
                return Invoke-RestMethod @Params -Certificate $regionCertificate
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

const getDbMappedOntapVolumes = (fsxid: string, fsxregion: string, dbName: string, instanceName: string = '.') => `
    $WarningPreference = 'SilentlyContinue';
    $FSxID = '${fsxid}'
    $FSxRegion = '${fsxregion}'
    $dbname = '${dbName}'
    $instanceName = '${instanceName}'

    Start-Transcript -Path "C:\\cfn\\log\\map_ontap_volumes_$dbname.log.txt" -Append | Out-Null

    $responseObject = @{}
    
    try {
        $sqlquery = @"
            SET NOCOUNT ON;
            SELECT DISTINCT vs.logical_volume_name as volumename, mf.physical_name as filename, mf.type FROM sys.master_files AS mf
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

            $responseObject = [ordered]@{}
            $winvolumes = $sqlresponse | foreach { $_ | ConvertFrom-Json }
            foreach ($winvolume in $winvolumes) {
                $filename = $winvolume.filename
                $winvolumename = $winvolume.volumename
                $vol = get-volume -FileSystemLabel $winvolumename | Get-Partition | get-disk | Select serialnumber
                $object = @{
                    "windowsVolumeName" = $winvolumename
                    "fileName" = $filename
                    "lunSerialNumber" = $vol.serialnumber
                }
                $type = 'data'
                if ($winvolume.type -ne 0) {
                    $type = 'log'
                }
                $responseObject[$type] = $object
            }

            return $responseObject
        }
    
        ${ontapRestRequest}

        Function Get-LunFromSerialNumber($responseObject) {
            Write-debug "Get ONTAP lun name from serial numbers for: $responseObject"
    
            $QueryFilter = $responseObject.data.lunSerialNumber + '|' + $responseObject.log.lunSerialNumber
            $Params = @{
                "ApiEndPoint" = "/storage/luns"
            }
    
            if ($QueryFilter -ne '') {
                $QueryFilter = [System.Web.HttpUtility]::UrlEncode($QueryFilter)
                $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter"}
            }
    
            $params += @{"ApiQueryFields" = "fields=svm.name,location.volume.*"}
    
            $Response = Invoke-ONTAPRequest @Params
    
            $LunRecords = $Response.records
    
            if ($LunRecords.count -gt 0) {
                $responseObject['svm'] = $LunRecords[0].svm.name
                $LunRecords | ForEach-Object {
                    $lunrecord = $_
                    if ($responseObject.data.lunSerialNumber -eq $lunrecord.serial_number) {
                        $responseObject.data += @{
                            "lunPath" = $lunrecord.name
                            "volumeName" = $lunrecord.location.volume.name
                            "volumeUuid" = $lunrecord.location.volume.uuid
                        }
                    } elseif ($responseObject.log.lunSerialNumber -eq $lunrecord.serial_number) {
                        $responseObject.log += @{
                            "lunPath" = $lunrecord.name
                            "volumeName" = $lunrecord.location.volume.name
                            "volumeUuid" = $lunrecord.location.volume.uuid
                        }
                    }
                }
            }
            return $responseObject
        }
    
        Function Get-VolumeIdFromName($responseObject) {
            Write-Debug "Get Volume Id from name: $($responseObject | ConvertTo-Json)"
            $QueryFilter = $responseObject.data.volumename + '|' + $responseObject.log.volumename
    
            $Params = @{
                "ApiEndPoint" = "/storage/volumes"
            }
    
            if ($QueryFilter -ne '') {
                $QueryFilter = [System.Web.HttpUtility]::UrlEncode($QueryFilter)
                $Params += @{"ApiQueryFilter" = "name=$QueryFilter"}
            }
    
            $params += @{"ApiQueryFields" = "fields=clone.*"}
    
            $Response = Invoke-ONTAPRequest @Params
    
            $volumeRecords = $Response.records
    
            if ($volumeRecords.count -gt 0) {
                $volumeRecords | ForEach-Object {
                    $volrecord = $_
                    if ($volrecord.clone.is_flexclone -eq $true) {
                        $obj = @{}
                        $obj['parentSvm'] = $volrecord.clone.parent_svm.name
                        $obj['parentVolume'] = $volrecord.clone.parent_volume.name
                        if ($responseObject.data.volumename -eq $volrecord.name) {
                            $responseObject.data += $obj
                        } elseif ($responseObject.log.volumename -eq $volrecord.name) {
                            $responseObject.log += $obj
                        }
                    }
                }
            }
            return $responseObject
        }
    
        $responseObject =  sqlcmd -S $instanceName -Q $sqlquery -y 0;
        write-debug "SQL response: $responseObject"
        if ([string]::IsNullOrEmpty($responseObject)) {
            if ($responseObject -eq $null) {
                $responseObject = @{}
            }
            $responseObject['error'] = "Couldn't get database windows volumes from db $dbname"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-SerialNumberOfWinVolumes $responseObject
        write-debug "Serial numbers: $($responseObject | ConvertTo-Json)"
        if ([string]::IsNullOrEmpty($responseObject)) {
            if ($responseObject -eq $null) {
                $responseObject = @{}
            }
            $responseObject['error'] = "Couldn't get windows volume serial numbers"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-LunFromSerialNumber $responseObject
        write-debug "Lun Names: $($responseObject | ConvertTo-Json)"
        if ([string]::IsNullOrEmpty($responseObject)) {
            if ($responseObject -eq $null) {
                $responseObject = @{}
            }
            $responseObject['error'] = "Couldn't get associated Ontap LUN volume names"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-VolumeIdFromName $responseObject
        write-debug "Volume Names: $($responseObject | ConvertTo-Json)"
    } catch {
        write-Error $_.Exception.Message
        if ($responseObject -eq $null) {
            $responseObject = @{}
        }
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json -Depth 5
`;

// Create clone
const createVolumeClone = (
    fsxid: string,
    fsxregion: string,
    sourceSvm: string,
    dataVolume: string,
    logVolume: string,
    resourceId: string,
    clonedByTagValue: string,
    targetSvm?: string
) => `
    $fsxid = '${fsxid}'
    $fsxregion = '${fsxregion}'
    $sourceSvm = '${sourceSvm}'
    $targetSvm = '${targetSvm}'
    $dataVolume = '${dataVolume}' | convertFrom-json
    $logVolume = '${logVolume}' | convertFrom-json
    $resourceId = '${resourceId}'
    $clonedByTagValue = '${clonedByTagValue}'

    Start-Transcript -Path "C:\\cfn\\log\\create_ontap_flexclone_$($dataVolume.name).log.txt" -Append | Out-Null


    $WarningPreference = "SilentlyContinue"
    $responseObject = @{}
    
    try {

        $epoch = (Get-Date -Date ((Get-Date).DateTime) -UFormat %s)
        $defaultSnapshot = 'netapp_wf_clone_' + $epoch
    
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

        Function New-Snapshot {
            param(
                [Parameter(Mandatory = $true)]
                [string]$volumeName
            )
            write-debug "Creating snapshot for $volumeName"

            $ApiEndpoint = "/storage/volumes"
            $ApiQueryFilter = "name=$volumeName"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $ApiQueryFilter
            write-debug ($response | ConvertTo-Json)

            if ($response.records.count -eq 0) {
                $responseObject['error'] = "Could not find the cloned volumes to create snapshot."
                return $responseObject
            }

            $volumeid = $response.records[0].uuid
            $ApiEndpoint = '/storage/volumes/' + $volumeid + '/snapshots'
            $body = @{
                "name" = $defaultSnapshot
            } | ConvertTo-Json

            $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "POST"
            return Get-OntapJobStatus -jobId $ontapResponse.job.uuid
        }

        Function New-VolumeClone {
            $parentsvm = $sourceSvm

            $jobStatus = @()
            @($dataVolume, $logVolume) | ForEach-Object {
                $volume = $_
                write-debug "Volume: $($volume | convertto-json)"
                $snapshot = $volume.snapshot
                if ([string]::IsNullOrEmpty($snapshot)) {
                    # Create snapshot
                    $job = New-Snapshot -volumeName $volume.name
                    if ($job.state -ne 'success') {
                        $responseObject['error'] = "Could not create snapshot for $($volume.name). Ontap error: $($job.message)"
                        return $responseObject
                    }
                    $snapshot = $defaultSnapshot
                }
                start-sleep 1
                $ApiEndpoint = "/storage/volumes"
                $body = @{
                    "name" = $volume.name + '_clone_' + $epoch
                    "svm.name" = $targetSvm
                    "clone" = @{
                        "is_flexclone" = $True
                        "parent_volume" = @{
                            "name" = $volume.name
                        }
                        "parent_svm" = @{
                            "name" = $parentsvm
                        }
                        "parent_snapshot" = @{
                            "name" = $snapshot
                        }
                    }
                } | ConvertTo-Json
    
                $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "POST"
                $jobStatus += Get-OntapJobStatus -jobId $ontapResponse.job.uuid
            }
    
            return $jobStatus
        }
    
        Function Get-OntapVolumes {
            write-debug "Getting cloned volumes"
            $ApiQueryFilter = 'name='
            @($dataVolume, $logVolume) | ForEach-Object {
                $ApiQueryFilter += [System.Web.HttpUtility]::UrlEncode($_.name) + '_clone_' + $epoch + '|'
            }

            $ApiQueryFilter = $ApiQueryFilter.TrimEnd('|')
            $ApiQueryFields = 'fields=clone.*'
            $ApiEndpoint = "/storage/volumes"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $ApiQueryFilter -ApiQueryFields $ApiQueryFields
            write-debug "/volumes $($response | ConvertTo-Json)"

            if ($response.records.count -eq 0) {
                $responseObject['error'] = "Could not find the cloned volumes."
            } else {
                return $response.records
            }
        }

        Function Add-ObjectTagsToVolume {
            write-debug "Adding tags to the cloned volumes."
            $ApiQueryFilter = 'location.volume.name='
            @($dataVolume, $logVolume) | ForEach-Object {
                $ApiQueryFilter += [System.Web.HttpUtility]::UrlEncode($_.name) + '_clone_' + $epoch + '|'
            }
    
            $ApiQueryFilter = $ApiQueryFilter.TrimEnd('|')
            $ApiQueryFields = 'fields=location.volume.uuid,serial_number'
            $ApiEndpoint = "/storage/luns"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $ApiQueryFilter -ApiQueryFields $ApiQueryFields
            write-debug ($response | ConvertTo-Json)
    
            if ($response.records.count -eq 0) {
                $responseObject['error'] = "Could not find the cloned volumes to create tags."
                return $responseObject | ConvertTo-Json -Depth 5
            }

            $response.records | ForEach-Object {
                $volume = @{
                    "volumeId" = $_.location.volume.uuid
                    "lunSerialNumber" = $_.serial_number
                    "volumeName" = $_.location.volume.name
                    "lunPath" = $_.name
                }
                if ($_.location.volume.name -match $dataVolume.name) {
                    $responseObject['data'] = $volume
                } else {
                    $responseObject['log'] = $volume
                }
            }

            $volresponse = Get-OntapVolumes
            if ($volresponse.count -gt 0) {
                $volresponse | ForEach-Object {
                    $volume = $_
                    if ($volume.name -match $dataVolume.name) {
                        $responseObject['data'] += @{
                            "parentSnapshot" = $volume.clone.parent_snapshot.name
                        }
                    } else {
                        $responseObject['log'] += @{
                            "parentSnapshot" = $volume.clone.parent_snapshot.name
                        }
                    }
                }
            }

            $jobStatus = @()
            $response.records | ForEach-Object {
                $volumeid = $_.location.volume.uuid
                $body = @"
                {
                    "tiering.object_tags": [
                        "cloned_by=$clonedByTagValue",
                        "resource_id=$resourceId"
                    ]
                }
"@
                $ApiEndpoint = '/storage/volumes/' + $volumeid
                $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "PATCH"
                $jobStatus += Get-OntapJobStatus -jobId $ontapResponse.job.uuid
            }
    
            return @{
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
                $CloneDataLuns = $responseObject['data'] | ForEach-Object { $_.lunPath }
                $CloneLogLuns = $responseObject['log'] | ForEach-Object { $_.lunPath }
                if ($CloneDataLuns -is [array] -or $CloneLogLuns -is [array]) {
                    $ClonedLuns = $CloneDataLuns + $CloneLogLuns
                } else {
                    $ClonedLuns = @($CloneDataLuns, $CloneLogLuns)
                }
                $message
                $ClonedLuns | ForEach-Object {
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
            $CloneDataLuns = $responseObject['data'] | ForEach-Object { $_.lunPath }
            $CloneLogLuns = $responseObject['log'] | ForEach-Object { $_.lunPath }
            if ($CloneDataLuns -is [array] -or $CloneLogLuns -is [array]) {
                $lunPaths = $CloneDataLuns + $CloneLogLuns
            } else {
                $lunPaths = @($CloneDataLuns, $CloneLogLuns)
            }
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
            $responseObject['error'] = "Could not find igroup for $targetSvm."
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $jobStatusList = New-VolumeClone
        write-debug "Clone job status: $($jobStatusList | convertto-json)"
        $failedjob = $jobStatusList | Where-Object { $_.state -ne 'success' } | Select-Object -First 1
        write-debug "Clone volumes job: $($failedjob | convertto-json)"
        if ($failedjob) {
            $responseObject['error'] = "Could not clone volume. Ontap error: $($failedjob.message)"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $response = Add-ObjectTagsToVolume
        write-debug "Modify volumes job: $($jobStatusList | convertto-json)"
        $failedjob = $jobStatusList | Where-Object { $_.state -ne 'success' } | Select-Object -First 1
        if ($failedjob) {
            $responseObject['error'] = "Could not add tags to the cloned volumes. Ontap error: $($failedjob.message)"
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $result = Set-LunMap -igroup $igroup
        write-debug "Map LUNs job: $($result | convertto-json)"
        if ($result.error -or $result.records.count -eq 0) {
            $responseObject['error'] = "Could not map LUNs. Ontap error: $($result.error)"
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $errormessage = Set-LUNSignature
        if ($errormessage -ne $null) {
            $responseObject['error'] = "Could not set LUN signature. $($errormessage | convertto-json)"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    } catch {
        write-Debug $_.Exception.Message
        $responseObject['error'] = $_.Exception.Message
    }
    
    $responseObject | ConvertTo-Json -Depth 5
`;

const createClonedDb = (dbName: string, instanceName: string = '.', fileList: string[] = []) => `
    $WarningPreference = 'SilentlyContinue';
    $dbname = '${dbName}'

    Start-Transcript -Path "C:\\cfn\\log\\sqlserver_create_db_$dbname.log.txt" -Append | Out-Null

    try {
        $selectquery = "SET NOCOUNT ON; SELECT name, state_desc FROM sys.databases where name = '$dbname' FOR JSON PATH;"
        $sqlresponse =  sqlcmd -S "${instanceName}" -Q $selectquery -y 0;

        write-debug "SQL response: $sqlresponse"
        [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }
        $selectresult = (sqlcmd -S "${instanceName}" -Q $selectquery -y 0) | ConvertFrom-Json
        if ($selectresult.count -gt 0) {
            Write-Error "Database $dbname already exists and is in $($selectresult[0].state_desc) state. Exiting..."
        }

        # SQL script to attach a database
        $attachQuery = @"
            CREATE DATABASE $dbname ON  
            ${fileList.map(file => (file ? `(FILENAME = '${file}')` : '')).join()}
            FOR ATTACH;
"@
        sqlcmd -S "${instanceName}"  -Q $attachQuery
    } catch {
        Write-Error $_.Exception.Message
    }
`;

const addExtendedProperties = (
    dbName: string,
    instanceName: string = '.',
    propObj: { [x: string]: string | number | boolean }
) => `
$dbname = '${dbName}'

Start-Transcript -Path "C:\\cfn\\log\\add_extended_properties_$dbname.log.txt" -Append | Out-Null

$query = @"
USE $dbname;
SET NOCOUNT ON;

${Object.keys(propObj)
    .map(
        k =>
            `IF NOT EXISTS (SELECT name, value FROM fn_listextendedproperty(default, default, default, default, default, default, default) WHERE name = N'${k}') 
                EXEC sp_addextendedproperty @name = N'${k}', @value = ${
                typeof propObj[k] === 'string' ? `'${propObj[k]}'` : propObj[k]
            }
            ELSE
                EXEC sp_updateextendedproperty @name = N'${k}', @value = ${
                typeof propObj[k] === 'string' ? `'${propObj[k]}'` : propObj[k]
            };`
    )
    .join('\n')}

"@

Sqlcmd -S "${instanceName}"  -Q $query -m 1
`;

const cleanUpOntapResources = (
    fsxid: string,
    fsxregion: string,
    volumeIds: string,
    filePaths: string,
    dbName: string,
    instanceName: string = '.'
) => `
    $fsxid = '${fsxid}'
    $fsxregion = '${fsxregion}'
    $volumeIds = '${volumeIds}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $DBName = '${dbName}'
    $instanceName = '${instanceName}'

    Start-Transcript -Path "C:\\cfn\\log\\cleanup_ontap_resources_$DBName.log.txt" -Append | Out-Null

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        if ($filePaths.count -ne 0) {
            $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$DBName' GROUP BY dbid FOR JSON PATH"

            $sqlres = sqlcmd -Q $query -y 0

            if (-not [string]::IsNullOrEmpty($sqlres)) {
                Write-Debug "Database $dbname is in use"
                $responseObject['error'] = 'SQLServerError: Database $dbname is in use'
                return $responseObject | ConvertTo-Json -Depth 5
            }
        }

        ${ontapRestRequest}
        ${ontapJobStatusTemplate}

        $volumeIds | ForEach-Object {
            $volumeId = [system.web.httputility]::UrlEncode($_)
            $ApiEndpoint = "/storage/volumes/$volumeId"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -method "DELETE"
            $jobStatus = Get-OntapJobStatus -jobId $response.job.uuid
            if ($jobStatus.state -ne 'success') {
                throw "Ontap error: Could not delete volume $volumeId. $($jobStatus.message)"
            }
        }

        if ($filePaths.count -ne 0) {
            try {
                $deleteQuery = "SET NOCOUNT ON; DROP DATABASE $DBName;"
                $sqlresponse =  sqlcmd -S $instanceName -Q $deleteQuery -y 0;
                if (-not [string]::IsNullOrEmpty($sqlresponse)) {
                    throw "SQLServerError: Could not drop database $DBName. $sqlresponse"
                }
            } catch {
                Write-Debug $_.Exception.Message
                throw $_.Exception.Message
            }

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
                $datafound = $dependencylist -match $datalabel
                $logfound =  $dependencylist -match $loglabel

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
        }
    } catch {
        Write-Debug $_.Exception.Message
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json
`;

const mountPointQuery = (instanceName: string = '.', databaseName: string) =>
    ` sqlcmd -S '${instanceName}' -Q "SET NOCOUNT ON;
    SELECT 
        CASE WHEN mf.type != 0 THEN 'Log' ELSE 'Data' END AS filetype,
        vs.logical_volume_name AS volumename,
        mf.physical_name AS filepath
    FROM sys.master_files AS mf
    JOIN sys.databases AS db ON db.database_id = mf.database_id
    CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
    WHERE db.name = '${databaseName}'
    FOR JSON PATH;" -y 0 `;

const getStorageSavingsFromOntap = (fsxId: string, fsxRegion: string, clonedBy: string) => `
    $WarningPreference = 'SilentlyContinue';
    if ($responseObject -eq $null) {
        $responseObject = @{
            savedStorage = 0;
            consumedStorage = 0;
        }
    }

    try {
        #Requires -Module AWS.Tools.SimpleSystemsManagement

        $FSxID = '${fsxId}'
        $FSxRegion = '${fsxRegion}'
        $clonedByTagVal = '${clonedBy}'


        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $FSxUserName = $SsmParameter.fsx.username
        $FSxPassword = $SsmParameter.fsx.password
        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"
        
        $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
        $tempfileObject = New-TemporaryFile
        $tempfile = $tempfileObject.FullName
        Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile $tempfile
        $Certificate = Import-Certificate -FilePath $tempfile -CertStoreLocation Cert:\\LocalMachine\\Root
        $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
        Remove-Item -Path $tempfile -Force -ErrorAction SilentlyContinue
     
        Function Invoke-ONTAPGetRequest {
            param(
                [Parameter(Mandatory = $true)]
                [string]$ApiEndpoint
            )

            $Params = @{
                "URI"     = 'https://' + $FSxHostName + $ApiEndpoint
                "Method"  = "GET"
                "Headers" =@{"Authorization" = "Basic $FSxCredentialsInBase64"}
                "ContentType" = "application/json"
            }
     
            return Invoke-RestMethod @Params -Certificate $regionCertificateificate
        }

        $nextToken = $null
        
        Do {
            if ($null -eq $nextToken) {
                $resp = Invoke-ONTAPGetRequest -ApiEndpoint "/api/storage/volumes?tiering.object_tags=cloned_by=$clonedByTagVal&fields=space.used_by_afs,space.physical_used,clone.*"
            } else {
                $resp = Invoke-ONTAPGetRequest -ApiEndpoint $nextToken
            }

            $cloneVolumes = $resp.records

            foreach ($cloneVolume in $cloneVolumes) {
                if ($cloneVolume.clone.is_flexclone) {
                    $responseObject.savedStorage += $cloneVolume.clone.split_estimate
                    $responseObject.consumedStorage += $cloneVolume.space.physical_used
                }
            }

            $nextToken = $resp._links.next.href

        } While ($null -ne $nextToken)
    } catch {
        $responseObject = @{
            error = $_.Exception.Message
        }
    }
    $responseObject | ConvertTo-Json -Depth 5
`;

const detachDbAndRemoveAccessPath = (
    dbName: string,
    serialNumbers: string,
    filePaths: string,
    instanceName: string = '.'
) => `
    $dbname = '${dbName}'
    $serialNumbers = '${serialNumbers}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $instanceName = '${instanceName}'

    Start-Transcript -Path "C:\\cfn\\log\\detachdb_remove_accesspath_$dbname.log.txt" -Append | Out-Null

    if ($null -eq $responseObject) {
        $responseObject = @{}
    }

    try {
        $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$dbname' GROUP BY dbid FOR JSON PATH"

        $sqlres = sqlcmd -Q $query -y 0
        
        if ($sqlres -ne $null) {
            Write-Debug "Database $dbname is in use"
            $responseObject['error'] = 'Database $dbname is in use'
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $query = @"
            SET NOCOUNT ON;
            USE $dbname;
            SELECT name, value
            FROM fn_listextendedproperty(default, default, default, default, default, default, default) FOR JSON PATH;
"@
        $sqlresponse = Sqlcmd -S $instanceName -Q $query -y 0 -m 1
        $sqlresponse = $sqlresponse | ConvertFrom-JSON

        $sqlresponse | ForEach-Object {
            $responseObject | Add-Member -MemberType NoteProperty -Name $_.name -Value $_.value
        }

        $detach = "EXEC sp_detach_db '$dbname', 'true'"
        $sqlresponse =  sqlcmd -S $instanceName -Q $detach -y 0;

        Write-Debug "Detach response: $sqlresponse"

        if ($sqlresponse -ne $null) {
            Write-Debug "Failed to detach the database $sqlresponse"
            $responseObject['error'] = $sqlresponse
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $disklist = Get-disk | Where-Object { $serialNumbers -contains $_.SerialNumber }

        $mountPoints = $filePaths | ForEach-Object {
            $splits = $_.Split('\\')
            $splits[0] + '\\' + $splits[1] + '\\'
        }
        write-debug "Mount Points: $($mountPoints | ConvertTo-Json)"

        $disklist | ForEach-Object {
            $disk = $_
            $partition = Get-Partition -DiskNumber $disk.Number -PartitionNumber 2
            write-debug "Partition: $($partition.PartitionNumber) $($partition.AccessPaths)"
            $partition.AccessPaths | ForEach-Object {
                $accesspath = $_
                if ($accesspath -and ($mountPoints -contains $accesspath) -and ($accesspath -notmatch 'Volume')) {
                    Remove-PartitionAccessPath -DiskNumber $disk.Number -PartitionNumber $partition.PartitionNumber -AccessPath $accesspath
                }
            }
        }
    } catch {
        Write-Debug $_.Exception.Message
        $responseObject['error'] = $_.Exception.Message
    }

    return $responseObject | ConvertTo-Json -Depth 5
`;

const addAccessPathAndAttachDb = (
    dbName: string,
    datafile: { serial: string; path: string },
    logfile: { serial: string; path: string },
    instanceName: string = '.'
) => `
    $dbname = '${dbName}'
    $serialNumbers = '${JSON.stringify(datafile)}' | ConvertFrom-Json
    $filePaths = '${JSON.stringify(logfile)}' | ConvertFrom-Json
    $instanceName = '${instanceName}'

    Start-Transcript -Path "C:\\cfn\\log\\add_accesspath_attachdb_$dbname.log.txt" -Append | Out-Null

    $responseObject = @{}
    try {
        Function Get-VirtualMountPoint {
            param (
                [string]$path
            )

            $splits = $path.Split('\\')
            return $splits[0] + '\\' + $splits[1] + '\\'
        }
        
        $dataMountPoint = Get-VirtualMountPoint -path $datafile.path
        $logMountPoint = Get-VirtualMountPoint -path $logfile.path

        Get-Partition | ForEach-Object {
            $partition = $_
            if ($partition.AccessPaths -contains $dataMountPoint -or $partition.AccessPaths -contains $logMountPoint) {
                Write-Debug "Access path already exists for $dataMountPoint or $logMountPoint"
                $accessPathExists = $true
            }
        }

        # If access path does not exist, only then add the access path
        if ($accessPathExists -ne $true) {
            $datadisk = Get-disk | Where-Object { $_.SerialNumber -eq $datafile.serial }
            $logdisk = Get-disk | Where-Object { $_.SerialNumber -eq $logfile.serial }

            write-debug "Mount Points: $dataMountPoint $logMountPoint"

            $datapartition = Get-Partition -DiskNumber $datadisk.Number -PartitionNumber 2
            $logpartition = Get-Partition -DiskNumber $logdisk.Number -PartitionNumber 2
            write-debug "Partition accesspaths: $($datapartition.AccessPaths) $($logpartition.AccessPaths)"

            if ($datapartition.AccessPaths -notcontains $dataMountPoint) {
                Add-PartitionAccessPath -DiskNumber $datadisk.Number -PartitionNumber $partition.PartitionNumber -AccessPath $dataMountPoint
            }
            
            if ($logpartition.AccessPaths -notcontains $logMountPoint) {
                Add-PartitionAccessPath -DiskNumber $logdisk.Number -PartitionNumber $partition.PartitionNumber -AccessPath $logMountPoint
            }
        }

        $selectquery = "SET NOCOUNT ON; SELECT name FROM sys.databases where name = '$dbname' FOR JSON PATH;"
        $sqlresponse =  sqlcmd -S $instanceName -Q $selectquery -y 0;

        if ($sqlresponse -ne $null) {
            Write-Debug "Database $dbname already exists"
            $responseObject['info'] = 'Database $dbname already exists'
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $attachQuery = @"
            CREATE DATABASE $dbname ON  
            ${[datafile.path, logfile.path].map(file => (file ? `(FILENAME = '${file}')` : '')).join()}
            FOR ATTACH;
"@
        $attachresponse =  sqlcmd -S $instanceName -Q $attachQuery -y 0;
        if ($attachresponse -ne $null) {
            Write-Debug "Failed to attach the database $attachresponse"
            $responseObject['error'] = $attachresponse
            return $responseObject | ConvertTo-Json -Depth 5
        }
    } catch {
        Write-Debug $_.Exception.Message
        $responseObject['error'] = $_.Exception.Message
        return $responseObject | ConvertTo-Json -Depth 5
    }
`;

const splitFlexCloneVolumes = (fsxId: string, fsxRegion: string, volumeIds: string, instance = '.') => `
    $fsxid = '${fsxId}'
    $fsxregion = '${fsxRegion}'
    $volumeIds = '${volumeIds}' | ConvertFrom-Json
    $instance = '${instance}'

    Start-Transcript -Path "C:\\cfn\\log\\split_volumes.log.txt" -Append | Out-Null

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        ${ontapRestRequest}
        ${ontapJobStatusTemplate}

        Function Invoke-VolumeSplit {
            write-debug "Invoking volume split"
    
            $volumeIds | ForEach-Object {
                $volumeId = [system.web.httputility]::UrlEncode($_)
                $ApiEndpoint = "/storage/volumes/$volumeId"
                $body = '{ "clone": { "split_initiated": true } }'
    
                $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -method "PATCH" -body $body
    
                $jobStatus = Get-OntapJobStatus -jobId $response.job.uuid
                if ($jobStatus.state -ne 'success') {
                    if ($jobStatus.message -match 'Volume is not a clone') {
                        Write-Debug "Volume $volumeId is not a clone"
                        $responseObject['error'] = "Volume $volumeId is not a clone"
                    } elseif ($jobStatus.message -match 'Volume has locked snapshots') {
                        Write-Debug "Volume $volumeId has locked snapshots"
                        $responseObject['error'] = "Volume $volumeId has locked snapshots"
                    } else {
                        Write-Debug "Could not split volume $volumeId. Ontap error: $($jobStatus.message)"
                        $responseObject['error'] = "Could not split volume $volumeId. Ontap error: $($jobStatus.message)"
                    }
                }
            }
        }
    
        Function Remove-VolumeObjectTags {
            write-debug "Removing volume object tags"
    
            $volumeIds | ForEach-Object {
                $volumeId = [system.web.httputility]::UrlEncode($_)
                $ApiEndpoint = "/storage/volumes/$volumeId"
                $body = '{ "tiering.object_tags": [] }'
    
                $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -method "PATCH" -body $body
    
                $jobStatus = Get-OntapJobStatus -jobId $response.job.uuid
                if ($jobStatus.state -ne 'success') {
                    Write-Debug "Could not remove tags from volume $volumeId. Ontap error: $($jobStatus.message)"
                    $responseObject['error'] = "Could not remove tags from volume $volumeId. Ontap error: $($jobStatus.message)"
                }
            }
        }
    
        Invoke-VolumeSplit
        Remove-VolumeObjectTags
    } catch {
        Write-Debug $_.Exception.Message
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json
`;

const deleteExtendedPropertiesScript = (dbName: string, instanceName: string = '.', props: Array<string>) => `
$dbname = '${dbName}'
$instanceName = '${instanceName}'

Start-Transcript -Path "C:\\cfn\\log\\delete_extended_properties_$dbname.log.txt" -Append | Out-Null

$query = @"
USE $dbname;
SET NOCOUNT ON;
${props
    .map(
        k => `
IF EXISTS (SELECT name, value FROM fn_listextendedproperty(default, default, default, default, default, default, default) WHERE name = N'${k}')
    EXEC sp_dropextendedproperty @name = N'${k}';
`
    )
    .join('\n')}
"@

Sqlcmd -S $instanceName -Q $query -m 1
`;

export {
    GET_SANDBOX_DETAILS,
    checkDatabaseExists,
    getDbMappedOntapVolumes,
    addExtendedProperties,
    createVolumeClone,
    createClonedDb,
    cleanUpOntapResources,
    mountPointQuery,
    getStorageSavingsFromOntap,
    detachDbAndRemoveAccessPath,
    addAccessPathAndAttachDb,
    splitFlexCloneVolumes,
    deleteExtendedPropertiesScript
};
