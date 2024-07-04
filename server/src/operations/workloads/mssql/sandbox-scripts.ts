// instances input instances = ['"computername\\instanceName"', '"DEFAULT_MSSQL_INSTANCE_NAME"']; "DEFAULT_MSSQL_INSTANCE_NAME" represents the default instance

import { DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME } from '../../../utils/consts';

// ('source', 'initialCreationDate', 'tag') are the extended properties saved during creation of sandbox
const GET_SANDBOX_DETAILS = (instances: string[]) => ` 
$instances = (${instances})
$results = @()

foreach ($instance in $instances) {
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
                SELECT database_name, JSON_QUERY((SELECT name, value FROM #properties AS p2 WHERE p2.database_name = p1.database_name AND p2.name IN ('source', 'createdAt', 'tag', 'updatedAt', 'cloned_by', 'accountId') FOR JSON PATH)) AS properties
                FROM #properties AS p1
            ) AS grouped_properties
            GROUP BY database_name, properties
            FOR JSON PATH;
"@

        $output = sqlcmd -S $instance -Q $query -y 0 2> $null

        if ($output) {
            $results += [PSCustomObject]@{
                Instance = $instance
                Output = $output
            }
        }
        else {
            $results += [PSCustomObject]@{
                Instance = $instance
                Output = "No sandboxes created for the instance"
            }
        }
    }
    catch {
        [PSCustomObject]@{
            Instance = $instance
            Error = "Error executing query on $instance $($_.Exception.Message)"
        } | ConvertTo-Json
    }
}

$results | ConvertTo-Json -Depth 5
`;

const checkDatabaseExists = (dbCloneName: string, instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME) => `
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
const ontapRestRequest = (skipCertificateCheck = false) => `
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
        $connection = ${
            skipCertificateCheck
                ? '$False'
                : 'Test-Connection -ComputerName fsx-aws-certificates.s3.amazonaws.com -Quiet'
        }
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

            Write-Information "Invoke ONTAP rest request $APIEndpoint $APIQueryFilter $ApiQueryFields $method $body"

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

const getVolumeIdFromPath = `
        Function Get-VolumeIdFromPath {
            param(
                [Parameter(Mandatory = $true)]
                [string]$absolutePath
            )

            $fullPath = [string](Resolve-Path $absolutePath)
            $bestMatch = ''
            $bestMatchObj = $null
            gwmi Win32_MountPoint | % {
                $_.Directory -match '="(.*)"' | Out-Null
                $mountDir = $matches[1].Replace('\\\\', '\\')
                If (!$mountDir.EndsWith('\\')) { $mountDir = $mountDir + '\\' }
                If ($fullPath.StartsWith($mountDir, 'InvariantCultureIgnoreCase') -and $bestMatch.Length -lt $mountDir.Length) { 
                    $bestMatch = $mountDir
                    $bestMatchObj = $_
                }
            }
            $bestMatchObj.Volume -match '{(.+?)}' | Out-Null
            return $matches[1]
        }
`;

const getDbMappedOntapVolumes = (
    fsxid: string,
    fsxregion: string,
    dbName: string,
    instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    logPrefix: string = ''
) => `
    $WarningPreference = 'SilentlyContinue';
    $FSxID = '${fsxid}'
    $FSxRegion = '${fsxregion}'
    $dbname = '${dbName}'
    $instanceName = "${instanceName}"
    $logPrefix = '${logPrefix}'

    Start-Transcript -Path "C:\\cfn\\log\\map_ontap_volumes_for_$dbname.log.txt" -Append | Out-Null

    $responseObject = @{}
    
    try {
        $sqlquery = @"
            SET NOCOUNT ON;
            SELECT DISTINCT vs.volume_id as volumeid, mf.physical_name as filename, mf.type FROM sys.master_files AS mf
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
                $vol = get-volume -Path $winvolume.volumeid | Get-Partition | get-disk | Select serialnumber, bustype

                if ($vol.bustype -ne 'iscsi') {
                    throw "Protocol Error: The database should be using iscsi protocol"
                }

                $object = @{
                    "fileName" = $winvolume.filename
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
    
        ${ontapRestRequest(true)}

        Function Get-LunFromSerialNumber($responseObject) {
            Write-Information "$logPrefix Get ONTAP lun name from serial numbers for: $responseObject"
    
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
                    if ($responseObject.data.lunSerialNumber -ceq $lunrecord.serial_number) {
                        $responseObject.data += @{
                            "lunPath" = $lunrecord.name
                            "volumeName" = $lunrecord.location.volume.name
                            "volumeUuid" = $lunrecord.location.volume.uuid
                        }
                    } elseif ($responseObject.log.lunSerialNumber -ceq $lunrecord.serial_number) {
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
            Write-Information "$logPrefix Get Volume Id from name: $($responseObject | ConvertTo-Json)"
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
                        $obj['parentVolumeUuid'] = $volrecord.clone.parent_volume.uuid
                        $obj['parentSnapshot'] = $volrecord.clone.parent_snapshot.name
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
        Write-Information "$logPrefix SQL response: $responseObject"
        if ([string]::IsNullOrEmpty($responseObject)) {
            if ($responseObject -eq $null) {
                $responseObject = @{}
            }
            $responseObject['error'] = "SqlServerError: Could not get volumes of database $dbname"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-SerialNumberOfWinVolumes $responseObject
        Write-Information "$logPrefix Serial numbers: $($responseObject | ConvertTo-Json)"
        if ($responseObject.data.lunSerialNumber -eq $null -or $responseObject.log.lunSerialNumber -eq $null) {
            if ($responseObject -eq $null) {
                $responseObject = @{}
            }
            $responseObject['error'] = "Could not get windows volume serial numbers"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-LunFromSerialNumber $responseObject
        Write-Information "$logPrefix Lun Names: $($responseObject | ConvertTo-Json)"
        if ([string]::IsNullOrEmpty($responseObject)) {
            if ($responseObject -eq $null) {
                $responseObject = @{}
            }
            $responseObject['error'] = "Could not get windows volume serial numbers"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-VolumeIdFromName $responseObject
        Write-Information "$logPrefix Volume Names: $($responseObject | ConvertTo-Json)"
    } catch {
        write-Error "$logPrefix $($_.Exception.Message)"
        if ($responseObject -eq $null) {
            $responseObject = @{}
        }
        $responseObject['error'] = $_.Exception.Message
    } finally {
        $responseObject | ConvertTo-Json -Depth 5
        Stop-Transcript | Out-Null
    }
`;

// Create clone
const createVolumeClone = (
    fsxid: string,
    fsxregion: string,
    sourceSvm: string,
    dataVolume: string,
    logVolume: string,
    tags: Array<string>,
    targetSvm: string,
    sandboxName: string,
    logPrefix?: string
) => `
    $fsxid = '${fsxid}'
    $fsxregion = '${fsxregion}'
    $sourceSvm = '${sourceSvm}'
    $targetSvm = '${targetSvm}'
    $dataVolume = '${dataVolume}' | convertFrom-json
    $logVolume = '${logVolume}' | convertFrom-json
    $sandboxName = '${sandboxName}'
    $logPrefix = '${logPrefix}'

    Start-Transcript -Path "C:\\cfn\\log\\create_ontap_flexclone_volumes_for_$sandboxName.log.txt" -Append | Out-Null


    $WarningPreference = "SilentlyContinue"
    $responseObject = @{}
    
    try {

        $epoch = (Get-Date -Date ((Get-Date).DateTime) -UFormat %s)
        $defaultSnapshot = 'netapp_wf_clone_' + $epoch
    
        ${ontapRestRequest()}

        Function Get-IgroupName {
            $nodeiqn = (Get-InitiatorPort).NodeAddress
            Write-Information "$logPrefix Local Node IQN: $nodeiqn"
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
            Write-Information "$logPrefix Creating snapshot for $volumeName"

            $ApiEndpoint = "/storage/volumes"
            $ApiQueryFilter = "name=$volumeName"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $ApiQueryFilter
            Write-Information "$logPrefix $($response | ConvertTo-Json)"

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

            @($dataVolume, $logVolume) | ForEach-Object {
                $volume = $_
                Write-Information "$logPrefix Volume: $($volume | convertto-json)"
                $snapshot = $volume.snapshot
                if ([string]::IsNullOrEmpty($snapshot)) {
                    # Create snapshot
                    $job = New-Snapshot -volumeName $volume.name
                    if ($job.state -ne 'success') {
                        throw "Could not create snapshot for $($volume.name). Ontap error: $($job.error.message)"
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
                $job = Get-OntapJobStatus -jobId $ontapResponse.job.uuid
                if ($job.state -ne 'success') {
                    throw "Could not create snapshot for $($volume.name). Ontap error: $($job.error.message)"
                }
            }
    
            return $jobStatus
        }

        Function Add-ObjectTagsToVolume {
            Write-Information "$logPrefix Adding tags to the cloned volumes."
            $ApiQueryFilter = 'location.volume.name='
            @($dataVolume, $logVolume) | ForEach-Object {
                $ApiQueryFilter += [System.Web.HttpUtility]::UrlEncode($_.name) + '_clone_' + $epoch + '|'
            }
    
            $ApiQueryFilter = $ApiQueryFilter.TrimEnd('|')
            $ApiQueryFields = 'fields=location.volume.uuid,serial_number'
            $ApiEndpoint = "/storage/luns"
            $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $ApiQueryFilter -ApiQueryFields $ApiQueryFields
            Write-Information "$logPrefix $($response | ConvertTo-Json)"
    
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

            $jobStatus = @()
            $response.records | ForEach-Object {
                $volumeid = $_.location.volume.uuid
                $body = @"
                {
                    "tiering.object_tags": [${tags.map(tag => `"${tag}"`).join(',')}]
                }
"@
                $ApiEndpoint = '/storage/volumes/' + $volumeid
                $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "PATCH"
                $jobStatus += Get-OntapJobStatus -jobId $ontapResponse.job.uuid
                if ($jobStatus.state -ne 'success') {
                    throw "Could not add tags to the cloned volumes. Ontap error: $($jobStatus.error.message)"
                }
            }
        }

        Function Set-LUNSignature {
            # Set the LUN signature only if the source and target SVMs are the same
            if ($sourceSvm -eq $targetSvm) {
                if (-not (Get-Module -ListAvailable -Name NetApp.ONTAP)) {
                    Write-Information "$logPrefix NetApp.ONTAP Module does not exist, installing it now"

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
        Write-Information "$logPrefix Igroup: $igroup"
        if ([string]::IsNullOrEmpty($igroup)) {
            $responseObject['error'] = "Could not find igroup for $targetSvm."
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        New-VolumeClone
    
        Add-ObjectTagsToVolume

        $errormessage = Set-LUNSignature
        if ($errormessage -ne $null) {
            $responseObject['error'] = "Could not set LUN signature. $($errormessage | convertto-json)"
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $result = Set-LunMap -igroup $igroup
        Write-Information "$logPrefix Map LUNs job: $($result | convertto-json)"
        if ($result.error -or $result.records.count -eq 0) {
            $responseObject['error'] = "Could not map LUNs. Ontap error: $($result.error)"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
    }
    
    $responseObject | ConvertTo-Json -Depth 5
`;

const createClonedDb = (
    dbName: string,
    instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    fileList: string[] = [],
    logPrefix: string = ''
) => `
    $WarningPreference = 'SilentlyContinue';
    $dbname = '${dbName}'
    $logPrefix = '${logPrefix}'

    Start-Transcript -Path "C:\\cfn\\log\\sqlserver_create_db_$dbname.log.txt" -Append | Out-Null

    try {
        $selectquery = "SET NOCOUNT ON; SELECT name, state_desc FROM sys.databases where name = '$dbname' FOR JSON PATH;"
        $sqlresponse =  sqlcmd -S "${instanceName}" -Q $selectquery -y 0;

        Write-Information "$logPrefix SQL response: $sqlresponse"
        [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }
        $selectresult = (sqlcmd -S "${instanceName}" -Q $selectquery -y 0) | ConvertFrom-Json
        if ($selectresult.count -gt 0) {
            Write-Error "$logPrefix Database $dbname already exists and is in $($selectresult[0].state_desc) state. Exiting..."
        }

        # SQL script to attach a database
        $attachQuery = @"
            CREATE DATABASE $dbname ON  
            ${fileList.map(file => (file ? `(FILENAME = '${file}')` : '')).join()}
            FOR ATTACH;
"@
        sqlcmd -S "${instanceName}"  -Q $attachQuery
    } catch {
        Write-Error "$logPrefix $($_.Exception.Message)"
    }
`;

const addExtendedProperties = (
    dbName: string,
    instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    propObj: { [x: string]: string | number | boolean }
) => `
$dbname = '${dbName}'
$extProps = '${JSON.stringify(propObj)}' | ConvertFrom-Json

Start-Transcript -Path "C:\\cfn\\log\\add_extended_properties_$dbname.log.txt" -Append | Out-Null

Write-Information "Sandbox:$($dbname): Adding extended properties $extProps"

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
Stop-Transcript | Out-Null
`;

const cleanUpOntapResources = (
    fsxid: string,
    fsxregion: string,
    volumeIds: string,
    filePaths: string,
    dbName: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = ''
) => `
    $fsxid = '${fsxid}'
    $fsxregion = '${fsxregion}'
    $volumeIds = '${volumeIds}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $DBName = '${dbName}'
    $executableInstance = "${executableInstance}"
    $instanceName = '${instanceName}'
    $logPrefix = '${logPrefix}'

    Start-Transcript -Path "C:\\cfn\\log\\cleanup_ontap_resources_$DBName.log.txt" -Append | Out-Null

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        ${getVolumeIdFromPath}

        if ($filePaths.count -ne 0) {
            $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$DBName' GROUP BY dbid FOR JSON PATH"

            $sqlres = sqlcmd -S $executableInstance -Q $query -y 0

            if (-not [string]::IsNullOrEmpty($sqlres)) {
                Write-Information "$logPrefix Database $dbname is in use"
                $responseObject['error'] = "SQLServerError: Database $dbname is in use"
                return $responseObject | ConvertTo-Json -Depth 5
            }

            $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status
            $resourceType = ${instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'}
            $windowsVolumeIds = $filePaths | ForEach-Object {
                Get-VolumeIdFromPath -absolutePath $_
            }

            Write-Information "$logPrefix Windows Volume Ids: $windowsVolumeIds"
            if ($clusterServiceStatus -eq 'Running' -and $windowsVolumeIds.count -ne 0) {
                $sqlgroup = Get-ClusterResource | Where-Object ResourceType -eq $resourceType
                $sqlserver = Get-WmiObject -namespace root\\MSCluster MSCluster_Resource -filter "Name='$sqlgroup'"
                $resourcegroup = $sqlserver.GetRelated() | Where Type -eq 'Physical Disk'

                $clusterdisksToRemove = @()
                foreach ($resource in $resourcegroup) {
                    $disks = $resource.GetRelated("MSCluster_Disk")
                    foreach ($disk in $disks) {
                        $diskpart = $disk.GetRelated("MSCluster_DiskPartition")
                        $clusterdisk = ($resource.name).replace('\\r\\n','')
                        $diskdrive = $diskpart.path
                        $disklabel = $diskpart.volumelabel
                        $diskvolume = $diskpart.VolumeGuid
                        write-debug "Cluster Disk $diskvolume"
                        if ($windowsVolumeIds -contains $diskpart.VolumeGuid) {
                            $clusterdisksToRemove += $clusterdisk
                        }
                    }
                }
                write-Information "$logPrefix Cluster Disks to remove $clusterdisksToRemove"
                if ($clusterdisksToRemove.count -ne 0) {
                    $clusterdisksToRemove | ForEach-Object {
                        $diskToRemove = $_
                        $diskToRemove = $diskToRemove.ToString()
                        write-Information "$logPrefix Removing disk $diskToRemove"
                        $null = (Remove-ClusterResourceDependency -Resource $resourceType -Provider $diskToRemove)
                        $null = (Remove-ClusterSharedVolume -Name $diskToRemove -ErrorAction SilentlyContinue)
                        $null = (Remove-ClusterResource -Name $diskToRemove -Force -ErrorAction SilentlyContinue)
                    }
                }
            }
        }

        ${ontapRestRequest()}
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

        # If the cluster resource are not removed in the earlier step, remove them now
        if ($filePaths.count -ne 0) {
            if ($clusterdisksToRemove.count -ne 0) {
                $clusterdisksToRemove | ForEach-Object {
                    $diskToRemove = $_
                    $diskToRemove = $diskToRemove.ToString()
                    write-Information "$logPrefix Removing disk $diskToRemove"
                    $null = (Remove-ClusterResource -Name $diskToRemove -Force -ErrorAction SilentlyContinue)
                }
            }

            try {
                $deleteQuery = "SET NOCOUNT ON; DROP DATABASE IF EXISTS $DBName;"
                $sqlresponse =  sqlcmd -S $executableInstance -Q $deleteQuery -y 0;
                if (-not [string]::IsNullOrEmpty($sqlresponse)) {
                    throw "SQLServerError: Could not drop database $DBName. $sqlresponse"
                }
            } catch {
                Write-Information "$logPrefix $($_.Exception.Message)"
                throw $_.Exception.Message
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
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json
`;

const mountPointQuery = (instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME, databaseName: string) =>
    ` sqlcmd -S "${instanceName}" -Q "SET NOCOUNT ON;
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

/*
    Order of the events plays an important role in the detachDbAndRemoveAccessPath script.
    1. Check if the database is in use.
    2. Get the extended properties of the database.
    3. Get the volume id of the windows volumes from file path.
    4. Detach the database, so that db files are retained.
    5. Remove the access path of the partitions.
    6. Remove the cluster disks.
*/
const detachDbAndRemoveAccessPath = (
    dbName: string,
    serialNumbers: string,
    filePaths: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = ''
) => `
    $dbname = '${dbName}'
    $serialNumbers = '${serialNumbers}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $executableInstance = "${executableInstance}"
    $instanceName = '${instanceName}'
    $logPrefix = '${logPrefix}'

    Start-Transcript -Path "C:\\cfn\\log\\detachdb_remove_accesspath_$dbname.log.txt" -Append | Out-Null

    if ($null -eq $responseObject) {
        $responseObject = @{}
    }

    try {
        $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$dbname' GROUP BY dbid FOR JSON PATH"

        $sqlres = sqlcmd -Q $query -y 0
        
        if ($sqlres -ne $null) {
            Write-Information "$logPrefix Database $dbname is in use"
            $responseObject['error'] = "Database $dbname is in use"
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $query = @"
            SET NOCOUNT ON;
            USE $dbname;
            SELECT name, value
            FROM fn_listextendedproperty(default, default, default, default, default, default, default) FOR JSON PATH;
"@
        $sqlresponse = Sqlcmd -S $executableInstance -Q $query -y 0 -m 1
        $sqlresponse = $sqlresponse | ConvertFrom-JSON

        $sqlresponse | ForEach-Object {
            $responseObject | Add-Member -MemberType NoteProperty -Name $_.name -Value $_.value
        }

        ${getVolumeIdFromPath}

        $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status
        $resourceType = ${instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'}
        $windowsVolumeIds = $filePaths | ForEach-Object {
            Get-VolumeIdFromPath -absolutePath $_
        }
        write-Information "Windows Volume Ids: $windowsVolumeIds"

        try {
            $detach = "EXEC sp_detach_db '$dbname', 'true'"
            $sqlresponse =  sqlcmd -S $executableInstance -Q $detach -y 0;

            Write-Information "$logPrefix Detach response: $sqlresponse"

            if ($sqlresponse -ne $null) {
                Write-Information "$logPrefix Failed to detach the database $sqlresponse"
                $responseObject['error'] = $sqlresponse
                return $responseObject | ConvertTo-Json -Depth 5
            }
        } catch {
            Write-Information "$logPrefix $($_.Exception.Message)"
            throw $_.Exception.Message
        }

        write-Information "$logPrefix Serial Numbers: $serialNumbers"
        $disklist = Get-disk | Where-Object { $serialNumbers -contains $_.SerialNumber }
        write-Information "$logPrefix Disk List: $disklist"
        $mountPoints = $filePaths | ForEach-Object {
            $splits = $_.Split('\\')
            $splits[0] + '\\' + $splits[1] + '\\'
        }
        Write-Information "$logPrefix Mount Points: $($mountPoints | ConvertTo-Json)"

        $disklist | ForEach-Object {
            $disk = $_
            $partition = Get-Partition -DiskNumber $disk.Number -PartitionNumber 2
            Write-Information "$logPrefix Partition: $($partition.PartitionNumber) $($partition.AccessPaths)"
            $partition.AccessPaths | ForEach-Object {
                $accesspath = $_
                if ($accesspath -and ($mountPoints -contains $accesspath) -and ($accesspath -notmatch 'Volume')) {
                    Remove-PartitionAccessPath -DiskNumber $disk.Number -PartitionNumber $partition.PartitionNumber -AccessPath $accesspath
                }
            }
        }

        if ($clusterServiceStatus -eq 'Running' -and $windowsVolumeIds.count -ne 0) {
            $sqlgroup = Get-ClusterResource | Where-Object ResourceType -eq $resourceType
            $sqlserver = Get-WmiObject -namespace root\\MSCluster MSCluster_Resource -filter "Name='$sqlgroup'"
            $resourcegroup = $sqlserver.GetRelated() | Where Type -eq 'Physical Disk'

            $clusterdisksToRemove = @()
            foreach ($resource in $resourcegroup) {
                $disks = $resource.GetRelated("MSCluster_Disk")
                foreach ($disk in $disks) {
                    $diskpart = $disk.GetRelated("MSCluster_DiskPartition")
                    $clusterdisk = ($resource.name).replace('\\r\\n','')
                    $diskdrive = $diskpart.path
                    $disklabel = $diskpart.volumelabel
                    $diskvolume = $diskpart.VolumeGuid
                    write-debug "Cluster Disk $diskvolume"
                    if ($windowsVolumeIds -contains $diskpart.VolumeGuid) {
                        $clusterdisksToRemove += $clusterdisk
                    }
                }
            }
            write-Information "$logPrefix Cluster Disks to remove $clusterdisksToRemove"
            if ($clusterdisksToRemove.count -ne 0) {
                $clusterdisksToRemove | ForEach-Object {
                    $diskToRemove = $_
                    $diskToRemove = $diskToRemove.ToString()
                    write-Information "$logPrefix Removing disk $diskToRemove"
                    $null = (Remove-ClusterResourceDependency -Resource $resourceType -Provider $diskToRemove)
                    $null = (Remove-ClusterSharedVolume -Name $diskToRemove -ErrorAction SilentlyContinue)
                    $null = (Remove-ClusterResource -Name $diskToRemove -Force -ErrorAction SilentlyContinue)
                }
            }
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
    }

    return $responseObject | ConvertTo-Json -Depth 5
`;

const addAccessPathAndAttachDb = (
    dbName: string,
    datafile: string,
    logfile: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = ''
) => `
    $dbname = '${dbName}'
    $datafile = '${datafile}' | ConvertFrom-Json
    $logfile = '${logfile}' | ConvertFrom-Json
    $executableinstance = "${executableInstance}"
    $instanceName = '${instanceName}'
    $logPrefix = '${logPrefix}'

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
        Write-Information "$logPrefix Mount Points: $dataMountPoint $logMountPoint"

        if ($dbname.Length -gt 25) {
            $dbname = $dbname.Substring(0, 25)
        }
        $datalabel = $dbname + '-Data'
        $loglabel = $dbname + '-Log'

        $disklist = Get-disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.SerialNumber -ceq $datafile.serial -and $_.SerialNumber -ceq $logfile.serial }

        $disklist | ForEach-Object {
            $disk = $_
            $disknumber = $disk.Number
            $null= (echo "select disk $disknumber" "attributes disk clear readonly" | diskpart)
            if ($disk.IsReadOnly -ne $False) {
                Set-Disk -Number $disk.Number -IsReadOnly $False -ErrorAction SilentlyContinue
                Start-Sleep 2
            }
            
            if ($disk.IsOffline -ne $False) {
                Set-Disk -Number $disk.Number -IsOffline $False -ErrorAction SilentlyContinue
                Start-Sleep 2
            }
            
            if ($disk.PartitionStyle -eq 'RAW') {
                Set-Disk -Number $disk.Number -PartitionStyle GPT -ErrorAction SilentlyContinue
                Start-Sleep 2
            }
        }

        # If access path does not exist, only then add the access path
        $datadisk = ($disklist | Where-Object { $_.SerialNumber -ceq $datafile.serial })
        $logdisk = ($disklist | Where-Object { $_.SerialNumber -ceq $logfile.serial })
        $datadisknumber = $datadisk.Number
        $logdisknumber = $logdisk.Number

        $dataPartition = Get-Partition -DiskNumber $datadisknumber | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }
        $logPartition = Get-Partition -DiskNumber $logdisknumber | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }

        $null = $dataPartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop
        $null = $logPartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop

        Get-Partition -DiskNumber $datadisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $datalabel
        Get-Partition -DiskNumber $logdisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $loglabel

        try {
            $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

            if ($clusterServiceStatus -eq 'Running') {
                # Add new disks to Cluster Storage
                #In some cases onlining disk and setting Filesystem label fails and volume returns empty in PS cmdlet. Fail check with diskpart

                if ($datadisk.IsOffline -ne $False) {
                    $null= (echo "select disk $datadisknumber" "select partition 2" "select volume" "online vol" | diskpart)
                    Start-Sleep 20 
                }

                if ($logdisk.IsOffline -ne $False) {
                    $null= (echo "select disk $logdisknumber" "select partition 2" "select volume" "online vol" | diskpart)
                    Start-Sleep 20 
                }

                $clusterdatadisk = Get-ClusterResource -Name $datalabel -ErrorAction SilentlyContinue
                $clusterlogdisk = Get-ClusterResource -Name $loglabel -ErrorAction SilentlyContinue

                if ([string]::IsNullOrEmpty($clusterdatadisk)) {
                    $availabledatadisk = Get-Disk | Where-Object { $_.Number -eq $datadisknumber }
                    $clusterdatadisk = ($availabledatadisk | Add-ClusterDisk -ErrorAction stop)
                    }
                if ([string]::IsNullOrEmpty($clusterlogdisk)) {
                    $availablelogdisk = Get-Disk | Where-Object { $_.Number -eq $logdisknumber }
                    $clusterlogdisk = ($availablelogdisk | Add-ClusterDisk -ErrorAction stop)
                }
                write-information "$logPrefix ClusterDataDisk: $clusterdatadisk ClusterLogDisk: $clusterlogdisk"

                try {
                    $SQLRoleGroup = (Get-ClusterGroup).Name -eq ("SQL Server ($instanceName)")
                    $SQLGroup = $SQLRoleGroup[0]

                    if (($clusterdatadisk.OwnerGroup -ne $SQLGroup) -or ($clusterlogdisk.OwnerGroup -ne $SQLGroup)) {
                        $null = (Move-ClusterResource -Name $($clusterdatadisk.Name) -Group $SQLGroup)
                        $null = (Move-ClusterResource -Name $($clusterlogdisk.Name) -Group $SQLGroup)

                        #Add dependency on new disks in SQL Server Resource
                        $ClusterResourceName = ${
                            instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'
                        }
                        $null = (Add-ClusterResourceDependency -Resource $ClusterResourceName -Provider $($clusterdatadisk.Name))
                        $null = (Add-ClusterResourceDependency -Resource $ClusterResourceName -Provider $($clusterlogdisk.Name))

                        #Rename new cluster disks to user friendly name
                        (Get-ClusterResource -Name $($clusterdatadisk.Name)).name = $datalabel
                        (Get-ClusterResource -Name $($clusterlogdisk.Name)).name = $loglabel
                    }
                }
                catch {
                    $responseObject['error'] = $_.Exception.Message
                    $responseObject['message'] = "Failed to add disks to SQL Server Role dependency in cluster"
                    return ($responseObject | ConvertTo-Json -Depth 5)
                    exit 1
                }
            }
        }
        catch {
            $responseObject['error'] = $_.Exception.Message
            $responseObject['message'] = 'Failed to add disks to cluster storage'
            return ($responseObject | ConvertTo-Json -Depth 5)
            exit 1
        }
        Write-Information "$logPrefix Partition accesspaths: $($datapartition.AccessPaths) $($logpartition.AccessPaths)"

        if ($datapartition.AccessPaths -notcontains $dataMountPoint) {
            $null = (New-Item -ItemType Directory -Path $dataMountPoint -Force)
            $null = Add-PartitionAccessPath -DiskNumber $datadisknumber -PartitionNumber ($dataPartition).PartitionNumber -AccessPath $dataMountPoint -ErrorAction stop
            $null = (Get-Partition -DiskNumber $datadisknumber |  Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Set-Partition -NoDefaultDriveLetter $true)
        }

        if ($logpartition.AccessPaths -notcontains $logMountPoint) {
            $null = (New-Item -ItemType Directory -Path $logMountPoint -Force)
            $null = Add-PartitionAccessPath -DiskNumber $logdisknumber -PartitionNumber ($logPartition).PartitionNumber -AccessPath $logMountPoint -ErrorAction stop
            $null = (Get-Partition -DiskNumber $logdisknumber |  Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Set-Partition -NoDefaultDriveLetter $true)
        }

        try {
            Get-Partition | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Where-Object { $_.DiskNumber -eq $datadisknumber -or $_.DiskNumber -eq $logdisknumber } | ForEach-Object {
                $partition = $_
                $partition.AccessPaths | ForEach-Object {
                    $accessPath = $_
                    Write-Information "$LogPrefix AccessPath: $accessPath"
                    if ($accessPath) {
                        $matched = $accessPath -match '^[A-Z]:\\$'
                        Write-Information "$LogPrefix Matched: $matched"
                        if ($matched -eq $True -and $accessPath -notcontains $DataDriveLetter -and $accessPath -notcontains $logDriveLetter) {
                            $accessDrive = $matches[0]
                            $null = ($partition | Remove-PartitionAccessPath -AccessPath $accessDrive)
                        }
                    }
                }
            }

            Get-ChildItem -Path $dataMountPoint -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
            Get-ChildItem -Path $logMountPoint -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
        } catch {
            Write-Information "$LogPrefix Failed to remove stale junction paths"
        }

        try {
            $DataFilePath = $datafile.path
            $LogFilePath = $logfile.path
            $DataFileLeaf = Split-Path -Path $DataFilePath -Leaf
            $LogFileLeaf = Split-Path -Path $LogFilePath -Leaf
            $newDataFilePath = (Get-ChildItem -Path $dataMountPoint -Recurse -Filter $DataFileLeaf).FullName
            $newLogFilePath = (Get-ChildItem -Path $logMountPoint -Recurse -Filter $LogFileLeaf).FullName
            if ((Test-Path $newDataFilePath) -and (Test-Path $newLogFilePath)) {
                $responseObject['dataPath'] = $newDataFilePath
                $responseObject['logPath'] = $newLogFilePath
                Write-Information "$LogPrefix NewFilePaths: $newDataFilePath $newLogFilePath"
            }
            else {
                throw 
            }
        } catch {
            $responseObject['error'] = "Failed to validate newpaths $newDataFilePath $newLogFilePath"
        }

        $selectquery = "SET NOCOUNT ON; SELECT name FROM sys.databases where name = '$dbname' FOR JSON PATH;"
        $sqlresponse =  sqlcmd -S $executableinstance -Q $selectquery -y 0;

        if ($sqlresponse -ne $null) {
            Write-Information "$logPrefix Database $dbname already exists"
            $responseObject['info'] = 'Database $dbname already exists'
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $attachQuery = @"
            CREATE DATABASE $dbname
            ON (FILENAME = '$($datafile.path)'),(FILENAME = '$($logfile.path)')
            FOR ATTACH;
"@
        $attachresponse =  sqlcmd -S $executableinstance -Q $attachQuery -y 0;
        if ($attachresponse -ne $null) {
            Write-Information "$logPrefix Failed to attach the database $attachresponse"
            $responseObject['error'] = $attachresponse
            return $responseObject | ConvertTo-Json -Depth 5
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
        return $responseObject | ConvertTo-Json -Depth 5
    }
`;

const splitFlexCloneVolumes = (
    fsxId: string,
    fsxRegion: string,
    volumes: string,
    instance = DEFAULT_MSSQL_INSTANCE_NAME,
    logPrefix: string = ''
) => `
    $fsxid = '${fsxId}'
    $fsxregion = '${fsxRegion}'
    $volumes = '${volumes}' | ConvertFrom-Json
    $instance = '${instance}'
    $logPrefix = '${logPrefix}'

    Start-Transcript -Path "C:\\cfn\\log\\split_volumes.log.txt" -Append | Out-Null

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        ${ontapRestRequest()}
        ${ontapJobStatusTemplate}

        Function Invoke-VolumeSplit {
            Write-Information "$logPrefix Invoking volume split"
    
            $volumes | ForEach-Object {
                $volumeId = [system.web.httputility]::UrlEncode($_.volumeId)
                $volumeName = $_.volumeName
                $ApiEndpoint = "/storage/volumes/$volumeId"
                $body = '{ "clone": { "split_initiated": true } }'
    
                $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -method "PATCH" -body $body
    
                $jobStatus = Get-OntapJobStatus -jobId $response.job.uuid
                if ($jobStatus.state -ne 'success') {
                    if ($jobStatus.message -match 'Volume is not a clone') {
                        Write-Information "$logPrefix Volume $volumeName is not a clone"
                        $responseObject['error'] = "Volume $volumeName is not a clone"
                    } elseif ($jobStatus.message -match 'Volume has locked snapshots') {
                        Write-Information "$logPrefix Volume $volumeName has locked snapshots"
                        $responseObject['error'] = "Volume $volumeName has locked snapshots"
                    } else {
                        Write-Information "$logPrefix Could not split volume $volumeName. Ontap error: $($jobStatus.message)"
                        $responseObject['error'] = "Could not split volume $volumeName. Ontap error: $($jobStatus.message)"
                    }
                }
            }
        }
    
        Function Remove-VolumeObjectTags {
            Write-Information "$logPrefix Removing volume object tags"
    
            $volumes | ForEach-Object {
                $volumeId = [system.web.httputility]::UrlEncode($_.volumeId)
                $volumeName = $_.volumeName
                $ApiEndpoint = "/storage/volumes/$volumeId"
                $body = '{ "tiering.object_tags": [] }'
    
                $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -method "PATCH" -body $body
    
                $jobStatus = Get-OntapJobStatus -jobId $response.job.uuid
                if ($jobStatus.state -ne 'success') {
                    Write-Information "$logPrefix Could not remove tags from volume $volumeName. Ontap error: $($jobStatus.message)"
                    $responseObject['error'] = "Could not remove tags from volume $volumeName. Ontap error: $($jobStatus.message)"
                }
            }
        }
    
        Invoke-VolumeSplit
        Remove-VolumeObjectTags
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json
`;

const deleteExtendedPropertiesScript = (
    dbName: string,
    instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    props: Array<string>
) => `
$dbname = '${dbName}'
$instanceName = "${instanceName}"
$extProps = '${JSON.stringify(props)}' | ConvertFrom-Json

Start-Transcript -Path "C:\\cfn\\log\\delete_extended_properties_$dbname.log.txt" -Append | Out-Null

Write-Information "Sandbox:$($dbname): Deleting extended properties $extProps"

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
Stop-Transcript | Out-Null
`;

const checkDatabaseIntegrityScript = (dbName: string, instanceName: string = '.', logPrefix: string = '') => `
$dbname = '${dbName}'
$instanceName = "${instanceName}"
$logPrefix = '${logPrefix}'

Start-Transcript -Path "C:\\cfn\\log\\check_integrity_for_$dbname.log.txt" -Append | Out-Null

Write-Information "$logPrefix Checking database integrity"

$query = @"
USE $dbname;
SET NOCOUNT ON;
DBCC CHECKDB($dbname) WITH NO_INFOMSGS, ALL_ERRORMSGS;
"@
Sqlcmd -S $instanceName -Q $query -m 1
`;

const readExtendedPropertiesOfSandbox = (dbName: string, instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME) => `
    $dbname = '${dbName}'
    $instanceName = "${instanceName}"

    $responseObject = @{}

    try {
        $query = @"
            SET NOCOUNT ON;
            USE $dbname;
            SELECT name, value
            FROM fn_listextendedproperty(default, default, default, default, default, default, default) FOR JSON PATH;
"@
        $sqlresponse = Sqlcmd -S $instanceName -Q $query -y 0 -m 1
        $sqlresponse = $sqlresponse | ConvertFrom-JSON

        $sqlresponse | ForEach-Object {
            $responseObject[$_.name] = $_.value
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = "sqlerror: $($_.Exception.Message)"
    }

    $responseObject | ConvertTo-Json -Depth 5
`;

const getSnapshotsToClone = (
    fsxId: string,
    fsxRegion: string,
    volumeids: string,
    dataVolume: string,
    sandboxName: string,
    window = 60
) => `
    $fsxid = '${fsxId}'
    $fsxregion = '${fsxRegion}'
    $volumeids = '${volumeids}' | ConvertFrom-Json
    $dataVolume = '${dataVolume}'
    $sandboxName = '${sandboxName}'
    $timeWindow = ${window}
    $logPrefix = "Sandbox:$($sandboxName):"

    Start-Transcript -Path "C:\\cfn\\log\\get_snapshots_to_clone_$sandboxName.log.txt" -Append | Out-Null
    Write-Information "$logPrefix Getting snapshots to clone"

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        ${ontapRestRequest(true)}

        Function Get-VolumeSnapshots {
            write-Information "$logPrefix Getting volume snapshots"

            $snapshotRecords = @()
            $volumeids | ForEach-Object {
                $volumeid = $_
                $ApiEndpoint = "/storage/volumes/$volumeid/snapshots"
                $ApiQueryFields = 'fields=create_time'
    
                $response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFields $ApiQueryFields
                if ($volumeid -eq $dataVolume) {
                    $response | Add-Member -MemberType NoteProperty -Name primary -Value $True
                }
                $snapshotRecords += $response
            }

            $snapshotRecords | ForEach-Object {
                if ($_.num_records -eq 0) {
                    throw "No snapshots found for one or more volumes."
                }
            }

            $snapshots = @()
            $primarySnapshots = $snapshotRecords | Where-Object { $_.primary -eq $True } | Select-Object -ExpandProperty records
            $snapshotRecords | Where-Object { $_.primary -ne $True } | ForEach-Object {
                $secondarySnapshots = $_.records
                $primarySnapshots | ForEach-Object {
                    $primarySnapshot = $_
                    $secondarySnapshot = $secondarySnapshots | Where-Object { $_.name -eq $primarySnapshot.name } | Select-Object -First 1
                    $minTime = [int](Get-Date $primarySnapshot.create_time -UFormat %s) - $timewindow
                    $maxTime = [int](Get-Date $primarySnapshot.create_time -UFormat %s) + $timewindow
                    if ($secondarySnapshot -ne $null) {
                        $snapshotCreateTime = [int](Get-Date $secondarySnapshot.create_time -UFormat %s)
                        if ($snapshotCreateTime -ge $minTime -and $snapshotCreateTime -le $maxTime) {
                            $snapshots += @{
                                'name' = $primarySnapshot.name
                                'created' = $primarySnapshot.create_time
                            }
                        }
                    }
                }
            }
            Write-Information "$logPrefix Snapshots to clone $($snapshots | ConvertTo-Json)"
            $responseObject['snapshots'] = $snapshots
        }

        Get-VolumeSnapshots
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
        return $responseObject | ConvertTo-Json -Depth 5
    }

    $responseObject | ConvertTo-Json -Depth 5
`;

const getConnectionInfo = (instanceName: string) => `

$responseObject = @{}

try {
    $ip = (Invoke-WebRequest -URI http://169.254.169.254/latest/meta-data/local-ipv4 -UseBasicParsing).Content;
    $port = SQLCMD -S "$ip\\${instanceName}" -Q "SET NOCOUNT ON; SELECT DISTINCT local_tcp_port FROM sys.dm_exec_connections  WHERE local_tcp_port IS NOT NULL" -y 0;
    $responseObject['server'] = "$($ip):$($port)${instanceName ? `\\${instanceName}` : ''}"
} catch {
    $responseObject['error'] = "Failed to get connection info: $_.Exception.Message"
}

$responseObject | ConvertTo-Json -Depth 5
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
    deleteExtendedPropertiesScript,
    checkDatabaseIntegrityScript,
    readExtendedPropertiesOfSandbox,
    getSnapshotsToClone,
    getConnectionInfo
};
