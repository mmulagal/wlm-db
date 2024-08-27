// instances input instances = ['"computername\\instanceName"', '"DEFAULT_MSSQL_INSTANCE_NAME"']; "DEFAULT_MSSQL_INSTANCE_NAME" represents the default instance

import { DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME } from '../../../utils/consts';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';

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

$response = $results | ConvertTo-Json -Depth 5

${compressResponse}
return (Deflate-String $response)
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
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    logPrefix: string = '',
    sqlAuthEnabled: boolean = false
) => `
    $WarningPreference = 'SilentlyContinue';
    $FSxID = '${fsxid}'
    $FSxRegion = '${fsxregion}'
    $dbname = '${dbName}'
    $executableInstanceName = "${executableInstanceName}"
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    Start-Transcript -Path "C:\\cfn\\log\\map_ontap_volumes_for_$dbname.log.txt" -Append | Out-Null

    $responseObject = @{}
    $responseObject['data'] = @()
    $responseObject['log'] = @()
    
    try {
        $sqlquery = @"
            SET NOCOUNT ON;
            SELECT DISTINCT vs.volume_id as volumeid, mf.physical_name as filename, mf.type, mf.file_id as fileid FROM sys.master_files AS mf
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
            $responseObject['data'] = @()
            $responseObject['log'] = @()

            $winvolumes = $sqlresponse | foreach { $_ | ConvertFrom-Json }
            foreach ($winvolume in $winvolumes) {

                # check in winvolume volume id is null or empty string

                if ([string]::IsNullOrEmpty($winvolume.volumeid)) {
                    throw "Could not get volume id for database $dbname, please make sure the database is using iscsi protocol"
                }
                $vol = get-volume -Path $winvolume.volumeid | Get-Partition | get-disk | Select serialnumber, bustype

                if ($vol.bustype -ne 'iscsi') {
                    throw "Protocol Error: The database should be using iscsi protocol"
                }

                $object = @{
                    "fileName" = $winvolume.filename
                    "lunSerialNumber" = $vol.serialnumber
                    "fileId" = $winvolume.fileid
                    "fileType" = $winvolume.type
                }
                $type = 'data'
                if ($winvolume.type -ne 0) {
                    $type = 'log'
                }
                $responseObject[$type] += $object
            }

            return $responseObject
        }
    
        ${ontapRestRequest(true)}

        Function Get-LunFromSerialNumber($responseObject) {
            Write-Information "$logPrefix Get ONTAP lun name from serial numbers for: $responseObject"
    
            $QueryFilter = ''
            foreach ($vol in $responseObject.data) {
                $QueryFilter += $vol.lunSerialNumber + '|'
            }

            foreach ($vol in $responseObject.log) {
                $QueryFilter += $vol.lunSerialNumber + '|'
            }

            $QueryFilter = $QueryFilter.TrimEnd('|')

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
                    foreach ($dataVol in $responseObject.data) {
                        if ($dataVol.lunSerialNumber -ceq $lunrecord.serial_number) {
                            $dataVol.Add("lunPath", $lunrecord.name)
                            $dataVol.Add("volumeName", $lunrecord.location.volume.name)
                            $dataVol.Add("volumeUuid", $lunrecord.location.volume.uuid)
                        }
                    }

                    foreach ($logVol in $responseObject.log) {
                        if ($logVol.lunSerialNumber -ceq $lunrecord.serial_number) {
                            $logVol.Add("lunPath", $lunrecord.name)
                            $logVol.Add("volumeName", $lunrecord.location.volume.name)
                            $logVol.Add("volumeUuid", $lunrecord.location.volume.uuid)
                        }
                    }
                }
            } else {
                throw "Could not get lun names from serial numbers"
            }
            return $responseObject
        }
    
        Function Get-VolumeIdFromName($responseObject) {
            Write-Information "$logPrefix Get Volume Id from name: $($responseObject | ConvertTo-Json)"

            $QueryFilter = ''

            ($responseObject.data + $responseObject.log) | ForEach-Object {
                $QueryFilter += $_.volumeName + '|'
            }

            $QueryFilter = $QueryFilter.TrimEnd('|')
    
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
                        ($responseObject.data + $responseObject.log) | ForEach-Object {
                            if ($_.volumeName -eq $volrecord.name) {
                                $_.Add('parentSvm', $volrecord.clone.parent_svm.name)
                                $_.Add('parentVolume', $volrecord.clone.parent_volume.name)
                                $_.Add('parentVolumeUuid', $volrecord.clone.parent_volume.uuid)
                                $_.Add('parentSnapshot', $volrecord.clone.parent_snapshot.name)
                            }
                        }
                    }
                }
            }
            return $responseObject
        }

        $sqlCredential = @{'useSqlAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceName)}
        }

        ${slqcmdExecutionTemplate}

        $queryResponse =  Call-SqlCmd -SqlCredential $sqlCredential -Query "$sqlquery" -InstanceName "${executableInstanceName}"

        Write-Information "$logPrefix SQL response: $queryResponse"
        if ([string]::IsNullOrEmpty($queryResponse)) {
            if ($queryResponse -eq $null) {
                $queryResponse = @{}
            }
            $queryResponse['error'] = "SqlServerError: Could not get volumes of database $dbname"
            return $queryResponse | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-SerialNumberOfWinVolumes $queryResponse
        Write-Information "$logPrefix Serial numbers: $($responseObject | ConvertTo-Json)"
        if ($responseObject.data.Count -eq 0 -or $responseObject.log.Count -eq 0) {
            $responseObject['error'] = "Could not get windows volume serial numbers"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-LunFromSerialNumber $responseObject
        Write-Information "$logPrefix Lun Names: $($responseObject | ConvertTo-Json)"
    
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
    dataVolumes: string,
    logVolumes: string,
    tags: Array<string>,
    targetSvm: string,
    sandboxName: string,
    logPrefix?: string
) => `
    $fsxid = '${fsxid}'
    $fsxregion = '${fsxregion}'
    $sourceSvm = '${sourceSvm}'
    $targetSvm = '${targetSvm}'
    $dataVolumes = '${dataVolumes}' | convertFrom-json
    $logVolumes = '${logVolumes}' | convertFrom-json
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


            $cloneVolCreated = @()
            $volSnapshotCreated = @()
            @($dataVolumes, $logVolumes) | ForEach-Object {

                Write-Information "$logPrefix $cloneVolCreated, $volSnapshotCreated"
                $volume = $_

                Write-Information "$logPrefix Volume: $($volume | convertto-json)"
                $snapshot = $volume.snapshot
                if ([string]::IsNullOrEmpty($snapshot)) {
                    # Create snapshot

                    foreach ($volName in $volume.volumes) {
                        if ($volSnapshotCreated -notcontains $volName) {
                            $volSnapshotCreated += $volName
                            $job = New-Snapshot -volumeName $volName
                            if ($job.state -ne 'success') {
                                throw "Could not create snapshot for $($volume.name). Ontap error: $($job.error.message)"
                            }  
                        }
                    }

                    $snapshot = $defaultSnapshot
                }
                start-sleep 1
                $ApiEndpoint = "/storage/volumes"

                foreach ($volName in $volume.volumes) {
                    if ($cloneVolCreated -notcontains $volName) {
                        $cloneVolCreated += $volName

                        $body = @{
                            "name" = $volName + '_clone_' + $epoch
                            "svm.name" = $targetSvm
                            "clone" = @{
                                "is_flexclone" = $True
                                "parent_volume" = @{
                                    "name" = $volName
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
                            throw "Could not create clone for $($volume.name). Ontap error: $($job.error.message)"
                        }
                    }
                }
            }
    
            return $jobStatus
        }

        Function Add-ObjectTagsToVolume {
            Write-Information "$logPrefix Adding tags to the cloned volumes."
            $volumeProcessed = @()
            $ApiQueryFilter = 'location.volume.name='
            @($dataVolumes, $logVolumes) | ForEach-Object {
                foreach ($volName in $_.volumes) {
                    if ($volumeProcessed -notcontains $volName) {
                        $ApiQueryFilter += [System.Web.HttpUtility]::UrlEncode($volName) + '_clone_' + $epoch + '|'
                        $volumeProcessed += $volName
                    }
                }
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

            $responseObject['data'] = @()
            $responseObject['log'] = @()

            $response.records | ForEach-Object {
                $volume = @{
                    "volumeId" = $_.location.volume.uuid
                    "lunSerialNumber" = $_.serial_number
                    "volumeName" = $_.location.volume.name
                    "lunPath" = $_.name
                }

                foreach ($volName in $dataVolumes.volumes) {
                    if ($_.location.volume.name -match $volName) {
                        $responseObject['data'] += $volume
                    }
                }

                foreach ($volName in $logVolumes.volumes) {
                    if ($_.location.volume.name -match $volName) {
                        $responseObject['log'] += $volume
                    }
                }
            }

            $response.records | ForEach-Object {
                $volumeid = $_.location.volume.uuid
                $body = @"
                {
                    "tiering.object_tags": [${tags.map(tag => `"${tag}"`).join(',')}]
                }
"@
                $ApiEndpoint = '/storage/volumes/' + $volumeid
                $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -body $body -method "PATCH"
                $jobStatus = Get-OntapJobStatus -jobId $ontapResponse.job.uuid
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

                $CloneDataLuns = @()
                foreach ($vol in $responseObject['data']) {
                    $CloneDataLuns += $vol.lunPath
                }

                $CloneLogLuns = @()
                foreach ($vol in $responseObject['log']) {
                    $CloneLogLuns += $vol.lunPath
                }

                # $CloneDataLuns = $responseObject['data'] | ForEach-Object { $_.lunPath }
                # $CloneLogLuns = $responseObject['log'] | ForEach-Object { $_.lunPath }
                
                $ClonedLuns = $CloneDataLuns + $CloneLogLuns

                $lunPathProcessed = @()

                $message
                $ClonedLuns | ForEach-Object {
                    $lunPath = $_

                    if ($lunPathProcessed -notcontains $lunPath) {
                        $lunPathProcessed += $lunPath

                        $null = Set-NcLunSignature -Path $lunPath -Vserver $targetSvm -Confirm:$False
                        if (-not $?) {
                            $message += "Could not change LUN signature for $lunClonePath."
                        }
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
            
            $CloneDataLuns = @()
            foreach ($vol in $responseObject['data']) {
                $CloneDataLuns += $vol.lunPath
            }

            $CloneLogLuns = @()
            foreach ($vol in $responseObject['log']) {
                $CloneLogLuns += $vol.lunPath
            }

            $lunPaths = $CloneDataLuns + $CloneLogLuns


            $records = @()

            $recordsAdded = @()

            $lunPaths | ForEach-Object {
                if ($recordsAdded -notcontains $_) {
                    $recordsAdded += $_

                    $records += @{
                        "svm.name" = $targetSvm
                        "lun.name" = $_
                        "igroup.name" = $igroup
                    }
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
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    dataFileList: string[] = [],
    logFileList: string[] = [],
    logPrefix: string = '',
    fileSuffix = '',
    sqlAuthEnabled: boolean
) => `
    $WarningPreference = 'SilentlyContinue';
    $dbname = '${dbName}'
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    Start-Transcript -Path "C:\\cfn\\log\\sqlserver_create_db_$dbname.log.txt" -Append | Out-Null

    ${slqcmdExecutionTemplate}

    try {
        $sqlCredential = @{'useSqlAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceName)}
        }

        $selectquery = "SET NOCOUNT ON; SELECT name, state_desc FROM sys.databases where name = '$dbname' FOR JSON PATH;"
        $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$selectquery" -InstanceName "${executableInstanceName}"

        Write-Information "$logPrefix SQL response: $sqlresponse"
        [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }

        $selectresult = (Call-SqlCmd -SqlCredential $sqlCredential -Query "$selectquery" -InstanceName "${executableInstanceName}") |  ConvertFrom-Json

        if ($selectresult.count -gt 0) {
            Write-Error "$logPrefix Database $dbname already exists and is in $($selectresult[0].state_desc) state. Exiting..."
        }

        $createQuery = @"
            CREATE DATABASE $dbname ON
            ${dataFileList
                .map(file => {
                    const newFilePath = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                    const fileName = newFilePath.split('\\').pop();
                    return `(NAME = '${fileName}', FILENAME = '${newFilePath}')`;
                })
                .join(',\n')}
            LOG ON
            ${logFileList
                .map(file => {
                    const newFilePath = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                    const fileName = newFilePath.split('\\').pop();
                    return `(NAME = '${fileName}', FILENAME = '${newFilePath}')`;
                })
                .join(',\n')}
"@
        
        Call-SqlCmd -SqlCredential $sqlCredential -Query "$createQuery" -InstanceName "${executableInstanceName}"
        Call-SqlCmd -SqlCredential $sqlCredential -Query "ALTER DATABASE $dbname SET OFFLINE" -InstanceName "${executableInstanceName}"
        
        # Remove the actual files
        ${[...dataFileList, ...logFileList]
            .map(file => {
                // replace mdf, ndf, ldf with epoch.mdf etc
                const newFileName = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                return `Remove-Item -Path "${newFileName}" -Force`;
            })
            .join('\n')}

        # Rename the actual files to the new name
        ${[...dataFileList, ...logFileList]
            .map(file => {
                // replace mdf, ndf, ldf with epoch.mdf etc
                const newFileName = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                return `$newFiles += '${newFileName}'
                Rename-Item -Path "${file}" -NewName "${newFileName}"`;
            })
            .join('\n')}
        
        Call-SqlCmd -SqlCredential $sqlCredential -Query "ALTER DATABASE $dbname SET ONLINE" -InstanceName "${executableInstanceName}"
    } catch {
        Write-Error "$logPrefix $($_.Exception.Message)"
    }
`;

const addExtendedProperties = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    propObj: { [x: string]: string | number | boolean },
    sqlAuthEnabled: boolean
) => `
$dbname = '${dbName}'
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
$extProps = '${JSON.stringify(propObj)}' | ConvertFrom-Json

Start-Transcript -Path "C:\\cfn\\log\\add_extended_properties_$dbname.log.txt" -Append | Out-Null

${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

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
$response = $null
Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1

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
    logPrefix: string = '',
    sqlAuthEnabled: boolean
) => `
    $fsxid = '${fsxid}'
    $fsxregion = '${fsxregion}'
    $volumeIds = '${volumeIds}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $DBName = '${dbName}'
    $executableInstance = "${executableInstance}"
    $instanceName = '${instanceName}'
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    Start-Transcript -Path "C:\\cfn\\log\\cleanup_ontap_resources_$DBName.log.txt" -Append | Out-Null
    
    ${slqcmdExecutionTemplate}

    $sqlCredential = @{'useSqlAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        ${getVolumeIdFromPath}
        try {
            if ($filePaths.count -ne 0) {
                $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$DBName' GROUP BY dbid FOR JSON PATH"
                
                $sqlres = $null
                $sqlres = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstance}"

                if (-not [string]::IsNullOrEmpty($sqlres)) {
                    Write-Information "$logPrefix Database $dbname is in use"
                    $responseObject['error'] = "SQLServerError: Database $dbname is in use"
                    return $responseObject | ConvertTo-Json -Depth 5
                }

                $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status
                $resourceType = ${
                    instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'
                }
                $windowsVolumeIds = $filePaths | ForEach-Object {
                    Get-VolumeIdFromPath -absolutePath $_
                }

                Write-Information "$logPrefix Windows Volume Ids: $windowsVolumeIds"
                if ($clusterServiceStatus -eq 'Running' -and $windowsVolumeIds.count -ne 0) {
                    $sqlgroup = Get-ClusterResource | Where-Object Name -eq $resourceType
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
        } catch {
            Write-Information "$logPrefix $($_.Exception.Message)"
            throw $_.Exception.Message
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
                $sqlresponse = $null
                $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$deleteQuery" -InstanceName "${executableInstance}"
                
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

const mountPointQuery = (databaseName: string) =>
    `SET NOCOUNT ON;
    SELECT CASE WHEN mf.type != 0 THEN 'Log' ELSE 'Data' END AS filetype,
    vs.logical_volume_name AS volumename, mf.physical_name AS filepath
    FROM sys.master_files AS mf
    JOIN sys.databases AS db ON db.database_id = mf.database_id
    CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
    WHERE db.name = '${databaseName}'
    FOR JSON PATH;`;

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
    logPrefix: string = '',
    sqlAuthEnabled: boolean
) => `
    $dbname = '${dbName}'
    $serialNumbers = '${serialNumbers}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $executableInstance = "${executableInstance}"
    $instanceName = '${instanceName}'
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    Start-Transcript -Path "C:\\cfn\\log\\detachdb_remove_accesspath_$dbname.log.txt" -Append | Out-Null
    
    ${slqcmdExecutionTemplate}

    $sqlCredential = @{'useSqlAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    if ($null -eq $responseObject) {
        $responseObject = @{}
    }

    try {
        $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$dbname' GROUP BY dbid FOR JSON PATH"

        $sqlres = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstance}"
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
        $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstance}" -ExtraArguments -m1
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
        write-Information "$logPrefix Windows Volume Ids: $windowsVolumeIds"

        try {
            $detach = "EXEC sp_detach_db '$dbname', 'true'"
            $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$detach" -InstanceName "${executableInstance}"

            Write-Information "$logPrefix Detach response: $sqlresponse"

            if ($sqlresponse -ne $null) {
                Write-Information "$logPrefix Failed to detach the database $sqlresponse"
                throw "SQLServerError: Could not detach the database $dbname"
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
            $sqlgroup = Get-ClusterResource | Where-Object Name -eq $resourceType
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
        return $responseObject | ConvertTo-Json -Depth 5
    }

    return $responseObject | ConvertTo-Json -Depth 5
`;

const addAccessPathAndAttachDb = (
    dbName: string,
    datafiles: string,
    logfiles: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = '',
    sqlAuthEnabled: boolean
) => `
    $dbname = '${dbName}'
    $datafiles = '${datafiles}' | ConvertFrom-Json
    $logfiles = '${logfiles}' | ConvertFrom-Json
    $executableinstance = "${executableInstance}"
    $instanceName = '${instanceName}'
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

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

        $dataMountPoints = @()
        $dataSerials = @()
        $dataPaths = @()

        $datafiles | ForEach-Object {
            $dataMountPoints += Get-VirtualMountPoint -path $_.path
            $dataSerials += $_.serial
            $dataPaths += $_.path
        }
        
        $logMountPoints = @()
        $logSerials = @()
        $logPaths = @()

        $logfiles | ForEach-Object {
            $logMountPoints += Get-VirtualMountPoint -path $_.path
            $logSerials += $_.serial
            $logPaths += $_.path
        }

        Write-Information "$logPrefix Mount Points: $dataMountPoints $logMountPoints"
        Write-Information "$logPrefix Serial Numbers: $dataSerials $logSerials"

        if ($dbname.Length -gt 25) {
            $dbname = $dbname.Substring(0, 25)
        }
        $datalabel = $dbname + '-Data'
        $loglabel = $dbname + '-Log'

        $disklist = Get-disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $dataSerials.Contains($_.SerialNumber) -or $logSerials.Contains($_.SerialNumber) }
        write-Information "$logPrefix Disk List: $disklist"

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
        $datadisks = ($disklist | Where-Object { $dataSerials.Contains($_.SerialNumber) })
        $logdisks = ($disklist | Where-Object { $logSerials.Contains($_.SerialNumber) })

        $datadisknumbers = @()
        $dataPartitions = @()

        $logdisknumbers = @()
        $logPartitions = @()

        $datadisks | ForEach-Object {
            $datadisknumber = $_.Number
            
            $dataPartition = Get-Partition -DiskNumber $datadisknumber | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }

            $null = $dataPartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop

            Get-Partition -DiskNumber $datadisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $datalabel

            $datadisknumbers += $datadisknumber
            $dataPartitions += $dataPartition
        }

        $logdisks | ForEach-Object {
            $logdisknumber += $_.Number

            $logPartition = Get-Partition -DiskNumber $logdisknumber | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }

            $null = $logPartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop

            Get-Partition -DiskNumber $logdisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $loglabel

            $logdisknumbers += $logdisknumber
            $logPartitions += $logPartition
        }

        try {
            $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

            if ($clusterServiceStatus -eq 'Running') {
                # Add new disks to Cluster Storage
                #In some cases onlining disk and setting Filesystem label fails and volume returns empty in PS cmdlet. Fail check with diskpart

                foreach ($datadisk in $datadisks) {
                    if ($datadisk.IsOffline -ne $False) {
                        $null= (echo "select disk $datadisk.Number" "select partition 2" "select volume" "online vol" | diskpart)
                        Start-Sleep 20 
                    }
                }

                foreach ($logdisk in $logdisks) {
                    if ($logdisk.IsOffline -ne $False) {
                        $null= (echo "select disk $logdisk.Number" "select partition 2" "select volume" "online vol" | diskpart)
                        Start-Sleep 20 
                    }
                }

                $clusterdatadisks = Get-ClusterResource -Name $datalabel -ErrorAction SilentlyContinue
                $clusterlogdisks = Get-ClusterResource -Name $loglabel -ErrorAction SilentlyContinue

                if ([string]::IsNullOrEmpty($clusterdatadisks)) {
                    $availabledatadisks = Get-Disk | Where-Object { $datadisknumbers.Contains($_.Number) }
                    $clusterdatadisks = ($availabledatadisks | Add-ClusterDisk -ErrorAction stop)
                }

                if ([string]::IsNullOrEmpty($clusterlogdisks)) {
                    $availablelogdisks = Get-Disk | Where-Object { $logdisknumbers.Contains($_.Number) }
                    $clusterlogdisks = ($availablelogdisks | Add-ClusterDisk -ErrorAction stop)
                }
                write-information "$logPrefix ClusterDataDisks: $clusterdatadisks ClusterLogDisks: $clusterlogdisks"

                try {
                    $SQLRoleGroup = (Get-ClusterGroup).Name -eq ("SQL Server ($instanceName)")
                    $SQLGroup = $SQLRoleGroup[0]

                    foreach ($clusterdatadisk in $clusterdatadisks) {
                        if ($clusterdatadisk.OwnerGroup -ne $SQLGroup) {
                            $null = (Move-ClusterResource -Name $($clusterdatadisk.Name) -Group $SQLGroup)
                        }

                        $ClusterResourceName = ${
                            instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'
                        }

                        $null = (Add-ClusterResourceDependency -Resource $ClusterResourceName -Provider $($clusterdatadisk.Name))

                        (Get-ClusterResource -Name $($clusterdatadisk.Name)).name = $datalabel

                    }

                    foreach ($clusterlogdisk in $clusterlogdisks) {
                        if ($clusterlogdisk.OwnerGroup -ne $SQLGroup) {
                            $null = (Move-ClusterResource -Name $($clusterlogdisk.Name) -Group $SQLGroup)
                        }

                        $ClusterResourceName = ${
                            instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'
                        }

                        $null = (Add-ClusterResourceDependency -Resource $ClusterResourceName -Provider $($clusterlogdisk.Name))

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

        $dataMountPoints | Sort-Object -Unique | ForEach-Object {
            $dataMountPoint = $_
            foreach ($datapartition in $dataPartitions) { 
                if ($datapartition.AccessPaths -notcontains $dataMountPoint) {
                    $null = (New-Item -ItemType Directory -Path $dataMountPoint -Force)
                    $null = Add-PartitionAccessPath -DiskNumber $datapartition.DiskNumber -PartitionNumber ($datapartition).PartitionNumber -AccessPath $dataMountPoint -ErrorAction stop
                    $null = (Get-Partition -DiskNumber $datapartition.DiskNumber |  Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Set-Partition -NoDefaultDriveLetter $true)
                }
            }
        }

        $logMountPoints | Sort-Object -Unique | ForEach-Object {
            $logMountPoint = $_
            foreach ($logpartition in $logPartitions) {
                if ($logpartition.AccessPaths -notcontains $logMountPoint) {
                    $null = (New-Item -ItemType Directory -Path $logMountPoint -Force)
                    $null = Add-PartitionAccessPath -DiskNumber $logpartition.DiskNumber -PartitionNumber ($logpartition).PartitionNumber -AccessPath $logMountPoint -ErrorAction stop
                    $null = (Get-Partition -DiskNumber $logpartition.DiskNumber |  Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Set-Partition -NoDefaultDriveLetter $true)
                }
            }
        }

        try {
            Get-Partition | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Where-Object { $datadisknumbers.Contains($_.DiskNumber) -or $logdisknumbers.Contains($_.DiskNumber) } | ForEach-Object {
                $partition = $_
                $partition.AccessPaths | ForEach-Object {
                    $accessPath = $_
                    Write-Information "$LogPrefix AccessPath: $accessPath"
                    if ($accessPath) {
                        $matched = $accessPath -match '^[A-Z]:\\\\$'
                        Write-Information "$LogPrefix Matched: $matched"
                        if ($matched -eq $True -and $accessPath -notcontains $DataDriveLetter -and $accessPath -notcontains $logDriveLetter) {
                            $accessDrive = $matches[0]
                            $null = ($partition | Remove-PartitionAccessPath -AccessPath $accessDrive)
                        }
                    }
                }
            }

            $dataMountPoints | Sort-Object -Unique | ForEach-Object {
                Get-ChildItem -Path $_ -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
            }

            $logMountPoints | Sort-Object -Unique | ForEach-Object {
                Get-ChildItem -Path $_ -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
            }
        } catch {
            $errorMsg = "Failed to remove stale junction paths"
            Write-Information "$LogPrefix $errorMsg"
            throw $errorMsg
        }

        try {
            $DataFilePath = $dataPaths
            $LogFilePath = $logPaths

            $responseObject['dataPath'] = @()
            $responseObject['logPath'] = @()

            ($datafiles + $logfiles) | ForEach-Object {
                $path = $_.path
                $fileLeaf = Split-Path -Path $path -Leaf

                $mountPoint = Get-VirtualMountPoint -path $path

                $newFilePath = (Get-ChildItem -Path $mountPoint -Recurse -Filter $DataFileLeaf).FullName

                if (Test-Path $newFilePath) {
                    $pathType = 'logPath'
                    if ($path.Contains('\\data\\')) {
                        $pathType = 'dataPath'
                    }

                    $responseObject[$pathType] = $newFilePath
                    Write-Information "$LogPrefix NewFilePaths: $newDataFilePath $newLogFilePath"
                } else {
                    throw 
                }
            }
        } catch {
            $errorMsg = "Failed to validate newpaths $newDataFilePath $newLogFilePath"
            Write-Information "$LogPrefix $errorMsg"
            throw $errorMsg
        }
        
        ${slqcmdExecutionTemplate}
        $sqlCredential = @{'useSqlAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceName)}
        }

        $attachQuery = @"
            IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '$dbname')
            BEGIN
                CREATE DATABASE $dbname
                ${[...JSON.parse(datafiles), ...JSON.parse(logfiles)]
                    .map(file => (file ? `(FILENAME = '${file}')` : ''))
                    .join()}
                FOR ATTACH
            END;
"@
        
        $attachresponse = $null
        $attachresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$attachQuery" -InstanceName "${executableInstance}"
        if ($attachresponse -ne $null) {
            $errorMessage = "SQLServerError: Could not create and attach the database $dbname. $attachresponse"
            Write-Information "$logPrefix $errorMessag"
            throw $errorMessage
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
        return $responseObject | ConvertTo-Json -Depth 5
    }

    return $responseObject | ConvertTo-Json -Depth 5
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
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    props: Array<string>,
    sqlAuthEnabled: boolean
) => `
$dbname = '${dbName}'
$instanceName = "${instanceName}"
$extProps = '${JSON.stringify(props)}' | ConvertFrom-Json
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

Start-Transcript -Path "C:\\cfn\\log\\delete_extended_properties_$dbname.log.txt" -Append | Out-Null

${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

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

$response = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1

Stop-Transcript | Out-Null
`;

const checkDatabaseIntegrityScript = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = '.',
    logPrefix: string = '',
    sqlAuthEnabled: boolean
) => `
$dbname = '${dbName}'
$instanceName = "${instanceName}"
$logPrefix = '${logPrefix}'
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

Start-Transcript -Path "C:\\cfn\\log\\check_integrity_for_$dbname.log.txt" -Append | Out-Null

${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

Write-Information "$logPrefix Checking database integrity"

$query = @"
USE $dbname;
SET NOCOUNT ON;
DBCC CHECKDB($dbname) WITH NO_INFOMSGS, ALL_ERRORMSGS;
"@

$response = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1
`;

const readExtendedPropertiesOfSandbox = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    sqlAuthEnabled: boolean
) => `
    $dbname = '${dbName}'
    $instanceName = "${instanceName}"
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    $sqlCredential = @{'useSqlAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    ${slqcmdExecutionTemplate}

    $responseObject = @{}

    try {
        $query = @"
            SET NOCOUNT ON;
            USE $dbname;
            SELECT name, value
            FROM fn_listextendedproperty(default, default, default, default, default, default, default) FOR JSON PATH;
"@
        $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1
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

const getConnectionInfo = (instanceName: string, sqlAuthEnabled: boolean) => `

$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
$sqlCredential = @{'useSqlAuth' = $False}

${slqcmdExecutionTemplate}

if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}
$responseObject = @{}

try {
    $ip = (Invoke-WebRequest -URI http://169.254.169.254/latest/meta-data/local-ipv4 -UseBasicParsing).Content;
    $query = "SET NOCOUNT ON; SELECT DISTINCT local_tcp_port FROM sys.dm_exec_connections  WHERE local_tcp_port IS NOT NULL"
    $port = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "$ip\\${instanceName}"
    $responseObject['server'] = "$($ip):$($port)${instanceName ? `\\${instanceName}` : ''}"
} catch {
    $responseObject['error'] = "Failed to get connection info: $_.Exception.Message"
}

$responseObject | ConvertTo-Json -Depth 5
`;

const invokeVirtualMountScript = (
    dbName: string,
    dataFilePath: string,
    logFilePath: string,
    dataSerial: string,
    logSerial: string,
    dbInstanceName: string,
    isDefaultInstance: boolean,
    logPrefix: string = ''
) => `

$ErrorActionPreference = "Stop"

$DBName = '${dbName}'
$DataFilePath = '${dataFilePath}' | ConvertFrom-Json
$LogFilePath = '${logFilePath}' | ConvertFrom-Json
$DataSerial = '${dataSerial}' | ConvertFrom-Json
$LogSerial = '${logSerial}' | ConvertFrom-Json
$DbInstanceName = '${dbInstanceName}'
$IsDefaultInstance = [System.Convert]::ToBoolean('${isDefaultInstance}')
$LogPrefix = '${logPrefix}'

$null = (Start-Transcript -Path "C:\\cfn\\log\\invoke_virtualmount_$DBName.log.txt" -Append)

Write-Information "$LogPrefix DataFilePath: $DataFilePath LogFilePath: $LogFilePath DataSerial: $DataSerial LogSerial: $LogSerial"

try {
    $responseObject = [ordered]@{}

    if ($DataFilePath.Count -eq 0 -or $LogFilePath.Count -eq 0 -or $DataSerial.Count -eq 0) {
        Write-Information "$LogPrefix DataFilePath: $DataFilePath LogFilePath: $LogFilePath DataSerial: $DataSerial LogSerial: $LogSerial"
        throw "DataFilePath or LogFilePath or DataSerial is null"
    }

    $null = (echo "RESCAN" | diskpart )
    Start-Sleep 2

    if ($DBName.Length -gt 25) {
        $DBName = $DBName.Substring(0, 25)
    }
    $datalabel = $DBName + '-Data'
    $loglabel = $DBName + '-Log'

    $DataDriveLetter = $DataFilePath[0].Substring(0, 1)
    $LogDriveLetter = $LogFilePath[0].Substring(0, 1)
    $datafolder = $DataDriveLetter + ':\\' + $datalabel
    $logfolder = $LogDriveLetter + ':\\' + $loglabel

    $retry = 0
    do {
        $disklist = @()
        ($DataSerial + $LogSerial) | ForEach-Object {
            $serial = $_
            $disklist += (Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.SerialNumber -ceq $serial })
        }
        $diskcount = $disklist.Number.Count
        if ($retry -gt 0) {
            Start-Sleep 20
        }
        $retry++
    } until (($retry -eq 4) -Or ($diskcount -ge $2))

    Write-Information "$LogPrefix Disklist: $disklist"

    #Adding Silently Continue for Set-Disk as warning caused output to have the string an API considered failure despite success
    #If warning is indeed serious the next step to initialize will fail and that will be caught
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
}
catch {
    Write-Information "$LogPrefix Error: $($_.Exception)"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to modify disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
} 

try {
    if ((Get-Service -Name ShellHWDetection).Status -eq 'Running') {
        Stop-Service -Name ShellHWDetection
    }

    $null = (New-Item -ItemType Directory -Path $datafolder -Force)
    $null = (New-Item -ItemType Directory -Path $logfolder -Force)

    $datadisks = ($disklist | Where-Object { $DataSerial.Contains($_.SerialNumber) })
    $logdisks = ($disklist | Where-Object { $LogSerial.Contains($_.SerialNumber ) })

    $datadisknumbers = @()
    $dataPartitions = @()
    $logdisknumbers = @()
    $logPartitions = @()
    $datadisks | ForEach-Object {
        $datadisknumber = $_.Number
        $datadiskpartition = Get-Partition -DiskNumber $datadisknumber | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }
        $null = $datadiskpartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop

        Get-Partition -DiskNumber $datadisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $datalabel    
        $datadisknumbers += $datadisknumber
        $dataPartitions += $datadiskpartition
    }

    $logdisks | ForEach-Object {
        $logdisknumber = $_.Number
        $logdiskpartition = Get-Partition -DiskNumber $logdisknumber | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }
        $null = $logdiskpartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop

        Get-Partition -DiskNumber $logdisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $loglabel
        $logdisknumbers += $logdisknumber
        $logPartitions += $logdiskpartition
    }

    Write-Information "$LogPrefix DataFolder: $datafolder $logfolder"

}
catch {
    Write-Information "$LogPrefix Error: $($_.Exception)"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to initialize disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
    exit 1
}
finally {
    if ((Get-Service -Name ShellHWDetection).Status -ne 'Running') {
        Start-Service -Name ShellHWDetection
    }
}

try {
    $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

    if ($clusterServiceStatus -eq 'Running') {
        # Add new disks to Cluster Storage
        #In some cases onlining disk and setting Filesystem label fails and volume returns empty in PS cmdlet. Fail check with diskpart

        foreach ($datadisk in $datadisks) {
            if ($datadisk.IsOffline -ne $False) {
                $null= (echo "select disk $($datadisk.Number)" "select partition 2" "select volume" "online vol" | diskpart)
                Start-Sleep 20 
            }    
        }
        
        foreach ($logdisk in $logdisks) {
            if ($logdisk.IsOffline -ne $False) {
                $null= (echo "select disk $($logdisk.Number)" "select partition 2" "select volume" "online vol" | diskpart)
                Start-Sleep 20 
            }
        }

        $clusterdatadisks = Get-ClusterResource -Name $datalabel -ErrorAction SilentlyContinue
        $clusterlogdisks = Get-ClusterResource -Name $loglabel -ErrorAction SilentlyContinue

        if ([string]::IsNullOrEmpty($clusterdatadisks)) {
            $availabledatadisks = Get-Disk | Where-Object { $datadisknumbers.Contains($_.Number) }
            $clusterdatadisks = ($availabledatadisks | Add-ClusterDisk -ErrorAction stop)
        }

        if ([string]::IsNullOrEmpty($clusterlogdisks)) {
            $availablelogdisks = Get-Disk | Where-Object { $logdisknumbers.Contains($_.Number) }
            $clusterlogdisks = ($availablelogdisks | Add-ClusterDisk -ErrorAction stop)
        }

        Write-Debug "$LogPrefix ClusterDataDisks: $clusterdatadisks ClusterLogDisks: $clusterlogdisks"

        try {
            $SQLRoleGroup = (Get-ClusterGroup).Name -eq ("SQL Server ($DbInstanceName)")
            $SQLGroup = $SQLRoleGroup[0]
            
            foreach ($clusterdatadisk in $clusterdatadisks) {
                
                if ($clusterdatadisk.OwnerGroup -ne $SQLGroup) {
                    $null = (Move-ClusterResource -Name $($clusterdatadisk.Name) -Group $SQLGroup)
                }

                #     #Add dependency on new disks in SQL Server Resource
                if ($IsDefaultInstance -eq $True){
                    $ClusterResourceName = "SQL Server"
                }
                else {
                    $ClusterResourceName = "SQL Server ($DbInstanceName)"
                }

                $null = (Add-ClusterResourceDependency -Resource $ClusterResourceName -Provider $($clusterdatadisk.Name))

                #     #Rename new cluster disks to user friendly name
                (Get-ClusterResource -Name $($clusterdatadisk.Name)).name = $datalabel
            }

            foreach ($clusterlogdisk in $clusterlogdisks) {
                if ($clusterlogdisk.OwnerGroup -ne $SQLGroup) {
                    $null = (Move-ClusterResource -Name $($clusterlogdisk.Name) -Group $SQLGroup)
                }

                #     #Add dependency on new disks in SQL Server Resource
                if ($IsDefaultInstance -eq $True){
                    $ClusterResourceName = "SQL Server"
                }
                else {
                    $ClusterResourceName = "SQL Server ($DbInstanceName)"
                }

                $null = (Add-ClusterResourceDependency -Resource $ClusterResourceName -Provider $($clusterlogdisk.Name))

                #     #Rename new cluster disks to user friendly name
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

try {
    Start-Sleep 5
    foreach ($dataPartition in $dataPartitions) {
        if ($dataPartition.AccessPaths -notcontains $datafolder + '\\') {
            $null = Add-PartitionAccessPath -DiskNumber $dataPartition.DiskNumber -PartitionNumber ($dataPartition).PartitionNumber -AccessPath $datafolder -ErrorAction stop
            $null = (Get-Partition -DiskNumber $dataPartition.DiskNumber |  Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Set-Partition -NoDefaultDriveLetter $true)
        }
    }

    foreach ($logPartition in $logPartitions) {
        if ($logPartition.AccessPaths -notcontains $logfolder + '\\') {
            $null = Add-PartitionAccessPath -DiskNumber $logPartition.DiskNumber -PartitionNumber ($logPartition).PartitionNumber -AccessPath $logfolder -ErrorAction stop
            $null = (Get-Partition -DiskNumber $logPartition.DiskNumber |  Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Set-Partition -NoDefaultDriveLetter $true)
        }
    }
}catch {
        $responseObject['error'] = $_.Exception.Message
        $responseObject['message'] = 'Failed to add access path to disks'
        return ($responseObject | ConvertTo-Json -Depth 5)
        exit 1

    }

try {
    Get-Partition | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Where-Object { $datadisknumbers.Contains($_.DiskNumber) -or $logdisknumbers.Contains($_.DiskNumber) } | ForEach-Object {
        $partition = $_
        $partition.AccessPaths | ForEach-Object {
            $accessPath = $_
            Write-Information "$LogPrefix AccessPath: $accessPath"
            if ($accessPath) {
                $matched = $accessPath -match '^[A-Z]:\\\\$'
                Write-Information "$LogPrefix Matched: $matched"
                if ($matched -eq $True -and $accessPath -notcontains $DataDriveLetter -and $accessPath -notcontains $logDriveLetter) {
                    $accessDrive = $matches[0]
                    $null = ($partition | Remove-PartitionAccessPath -AccessPath $accessDrive)
                }
            }
        }
    }

    Get-ChildItem -Path $datafolder -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
    Get-ChildItem -Path $logfolder -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
} catch {
    Write-Information "$LogPrefix Failed to remove stale junction paths"
}

try {
    $responseObject['files'] = @()
    ($DataFilePath + $LogFilePath) | ForEach-Object {
        $path = $_
        $fileLeaf = Split-Path -Path $path -Leaf
        if ($path.Contains('\\data\\')) {
            $newFilePath = (Get-ChildItem -Path $datafolder -Recurse -Filter $fileLeaf).FullName
        } else {
            $newFilePath = (Get-ChildItem -Path $logfolder -Recurse -Filter $fileLeaf).FullName
        }

        if (Test-Path $newFilePath) {
            $responseObject['files'] += $newFilePath
        } else {
            throw
        }
        
    }

    Write-Information "$LogPrefix NewFilePaths: $($responseObject['dataPath']) $($responseObject['logPath'])"
} catch {
    $responseObject['error'] = "Failed to validate newpaths $($responseObject['dataPath']) $($responseObject['logPath'])"
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
    getConnectionInfo,
    invokeVirtualMountScript,
    getVolumeIdFromPath
};
