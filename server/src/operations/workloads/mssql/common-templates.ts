// Template for ONTAP REST request
// Assumes that the following variables are defined in the script:
//  - $FSxID: FSx ID
//  - $FSxRegion: FSx region
const invokeOntapRequestTemplate = `
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

        # If network type is determined in the upstream script, then it is not necessary to check the connection again
        if ($connection -eq $null) {
            $certHost = $(if ($FSxRegion -like 'us-gov-*') { 'fsx-aws-us-gov-certificates.s3.us-gov-west-1.amazonaws.com' } else { 'fsx-aws-certificates.s3.amazonaws.com' })
            $connection = Test-Connection -ComputerName $certHost -Quiet -Count 1
        }
        if ($connection -eq $False) {
            # Set the registry key to disable certificate revocation check in case of private subnet
            Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\" -Name State -Value 146944 -Force | Out-Null
        }
        $ProgressPreference = 'SilentlyContinue'

        $isprivatesubnet = $False
        if ($connection -eq $False) {
            $isprivatesubnet = $True
            $regionCertificate = ''
        } else {
            $certHost = $(if ($FSxRegion -like 'us-gov-*') { 'fsx-aws-us-gov-certificates.s3.us-gov-west-1.amazonaws.com' } else { 'fsx-aws-Certificates.s3.amazonaws.com' })
            $FSxCertificateUri = 'https://' + $certHost + '/bundle-' + $FSxRegion + '.pem'
            $tempCertFile = (New-TemporaryFile).FullName
            Invoke-WebRequest -Uri $FSxCertificateUri -OutFile $tempCertFile
            $Certificate = Import-Certificate -FilePath $tempCertFile -CertStoreLocation Cert:\\LocalMachine\\Root
            $regionCertificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
            Remove-Item -Path $tempCertFile -Force -ErrorAction SilentlyContinue
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
                [string]$body,

                [Parameter(Mandatory = $false)]
                [string]$FSxCredentialsInBase64 = $FSxCredentialsInBase64,

                [Parameter(Mandatory = $false)]
                [string]$FSxHostName = $FSxHostName
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

const ontapRestRequestBootstrap = `
        Function Get-FSxNDetails {
            param(
                [Parameter(Mandatory = $false)]
                [string]$fsxId = $FSxID
            )
            write-debug "fsxId to get ontap creds: $fsxId"
            $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$fsxId" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
            $FSxUserName = $SsmParameter.fsx.username
            $FSxPassword = $SsmParameter.fsx.password
            $FSxPasswordSecureString = ConvertTo-SecureString $FSxPassword -AsPlainText -Force
            $FSxCredentials = New-Object System.Management.Automation.PSCredential($FSxUserName, $FSxPasswordSecureString)
            $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
            $FSxHostName = "management.$fsxId.fsx.$FSxRegion.amazonaws.com"
            try {
                $FSxNHTTP_Request = [System.Net.WebRequest]::Create("https://$FSxHostName")
                $FSxNHTTP_Response = $FSxNHTTP_Request.GetResponse()
                $FSxNHTTP_Response.Close()
                $FSxIPUsed = $False
            }
            catch {
                write-Information "FSxNHTTP_Response: $($_.Exception.Message)"
                if ($_.Exception.Message -like "*remote server returned an error*") {
                    Write-Information "Server connection works, returned error for 0 arguments"
                    $FSxIPUsed = $False
                }
                else {
                    Write-Information "FSxN Management domain $FSxHostName is not resolved. Switching to management IP."
                    $FileSystemDetails = Get-FSXFileSystem -FileSystemId $fsxId
                    $FSxHostName = $FileSystemDetails.ontapconfiguration.Endpoints.Management.IpAddresses
                    if ($FSxHostName -is [array]) {
                        $FSxHostName = $FSxHostName[0]
                        }
                $FSxIPUsed = $True
                }
            }
            return @{
                FSxCredentialsInBase64 = $FSxCredentialsInBase64
                FSxHostName = $FSxHostName
                FSxCredentials= $FSxCredentials
                FSxIPUsed = $FSxIPUsed
            }
        }
`;

const ontapRestRequest = `
        ${invokeOntapRequestTemplate}
        ${ontapRestRequestBootstrap}
        $FSxNDetails = Get-FSxNDetails
        $FSxCredentialsInBase64 = $FSxNDetails.FSxCredentialsInBase64
        $FSxHostName = $FSxNDetails.FSxHostName
        $FSxCredentials= $FSxNDetails.FSxCredentials
        $FSxIPUsed = $FSxNDetails.FSxIPUsed
        if ($FSxIPUsed -eq $True) {
            $isprivatesubnet = $True
            $regionCertificate = ''
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

const compressResponse = `
    Function Deflate-String([string]$stringToCompress) {

        if ([string]::IsNullOrEmpty($stringToCompress)) {
            Write-Information "The string to compress is either null or empty."
            return $null
        }

        $encoder = New-Object System.Text.UTF8Encoding
        $memoryStream = New-Object System.IO.MemoryStream
        $deflateStream = New-Object System.IO.Compression.DeflateStream($memoryStream, [System.IO.Compression.CompressionMode]::Compress)

        $buffer = $encoder.GetBytes($stringToCompress)
        $deflateStream.Write($buffer, 0, $buffer.Length)
        $memoryStream.Position = 0
        $deflateStream.Dispose()

        $bytes = $memoryStream.ToArray()
        $encodedString = [Convert]::ToBase64String($bytes)

        if ($encodedString.length -ge 24000) {
            return $stringToCompress
        }
        return $encodedString
    }
`;

const enableCredSSP = `
    Function Is-CredSSPEnabled {
        try {
            $credsspStatus = Get-WSManCredSSP
            if ($credsspStatus -match "The machine is configured to allow delegating fresh credentials") {
                return $true
            } else {
                return $false
            }
        } catch {
            Write-Information "Error checking CredSSP status: $($_.Exception.Message)"
            return $false
        }
    }

    Function Enable-CredSSP {
        if (-not (Is-CredSSPEnabled)) {
            try {
                $ServerName = '*'
                $isPartOfDomain = (Get-WmiObject Win32_ComputerSystem).PartofDomain
                if ($isPartOfDomain -eq $True) {
                    $domain = (Get-WmiObject Win32_ComputerSystem).Domain
                    $ServerName = "*.$domain"
                }
                Start-Transcript -Path C:\\cfn\\log\\EnableCredSSP-ManageOps.txt -Append | Out-Null
                Enable-WSManCredSSP -Role Client -DelegateComputer $ServerName -Force | Out-Null
                Enable-WSManCredSSP -Role Server -Force | Out-Null

                # Enable-WSManCredSSP is unreliable, so setting from registry.
                $parentkey = "hklm:\\SOFTWARE\\Policies\\Microsoft\\Windows"
                $key = "$parentkey\\CredentialsDelegation"
                $freshkey = "$key\\AllowFreshCredentials"
                $ntlmkey = "$key\\AllowFreshCredentialsWhenNTLMOnly"
                New-Item -Path $parentkey -Name 'CredentialsDelegation' -Force | Out-Null
                New-Item -Path $key -Name 'AllowFreshCredentials' -Force | Out-Null
                New-Item -Path $key -Name 'AllowFreshCredentialsWhenNTLMOnly' -Force | Out-Null
                New-ItemProperty -Path $key -Name AllowFreshCredentials -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFresh -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $key -Name AllowFreshCredentialsWhenNTLMOnly -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFreshNTLMOnly -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $freshkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force | Out-Null 
                New-ItemProperty -Path $ntlmkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force | Out-Null 


                # Verify CredSSP is enabled
                if (-not (Is-CredSSPEnabled)) {
                    throw "Failed to enable CredSSP."
                }
            } catch {
                Write-Error "Error enabling CredSSP: $($_.Exception.Message)"
            }
        }
    }
`;

const disableCredSSP = `
    try {
        # Disable CredSSP
        Start-Transcript -Path C:\\cfn\\log\\DisableCredSSP-ManageOps.txt -Append | Out-Null
        $ErrorActionPreference = "Stop"

        Disable-WSManCredSSP Client | Out-Null
        Disable-WSManCredSSP Server | Out-Null
        # Verify CredSSP is disabled
        if (Is-CredSSPEnabled) {
            throw "Failed to disable CredSSP."
        }
    } catch {
        Write-Information "Error in DisableCredSSP: $($_.Exception.Message)"
    }
`;

const invokeCommandWithCredSSP = `
    Function Invoke-CommandWithCredSSP {
        param (
            [Parameter(Mandatory = $true)]
            [string]$sqlquery,
            [Parameter(Mandatory = $false)]
            [string]$instanceName,
            [Parameter(Mandatory = $false)]
            [string]$extraArguments,
            [Parameter(Mandatory = $false)]
            [boolean]$IsMultiQuery = $false
        )

        if ($extraArguments -ne $null) {
            $extraArguments = $extraArguments
        } else {
            $extraArguments = ''
        }

        if ($instanceName -ne $null) {
            $serverInstanceName = $instanceName
        }

        $securePassword = ConvertTo-SecureString -String $sqlCredential.password -AsPlainText -Force
        $Credential = New-Object Management.Automation.PSCredential ($sqlCredential.username, $securePassword)

        $scriptblock = {
            param ($sqlquery, $extraArguments)
            Sqlcmd -S $using:serverInstanceName -Q $sqlquery -y 0 $extraArguments 2> $null
        }

        $output = Invoke-Command -ScriptBlock $scriptblock -ArgumentList $sqlquery, $extraArguments -Credential $Credential -ComputerName $env:computername -Authentication credssp -ErrorAction Stop

        if ($IsMultiQuery) {
            return $output | ForEach-Object {
                # Split the output on two or more spaces to isolate the desired part of the string.
                $_ -split '\\s{2,}' | Select-Object -Last 1
            }
        }
        return $output
    }
`;

// Shared helper functions for mapped volumes operations
// These functions are used by both getMappedOntapVolumesScript and MSSQL_ONE_TIME_WAD
const mappedVolumesHelperFunctions = `
    Function Get-VolumeIdsList($sqlqueryresponse) {
        $sqlJsonResponse = $sqlqueryresponse | ConvertFrom-Json
        $volumeIds = @()
        foreach ($record in $sqlJsonResponse) {
            if ($null -ne $record.volumeId) {
                $cleanVolumeId = $record.volumeId.Replace(" ", "").Replace("\`r","").Replace("\`n","")
                if ($volumeIds -notcontains $cleanVolumeId) {
                    $volumeIds += $cleanVolumeId
                }
            }
        }
        $volumeIds
    }

    Function Get-SerialNumberOfWinVolumes($winvolumes) {
        try {
            $Lunserialnumbers = @()
            $VolumeSerialMapping = @{}
            $BusTypes = @()
            Write-Debug "win volumes: $($winvolumes | ConvertTo-Json)"
            $allDisks = Get-Disk | Select SerialNumber, Number, BusType
            foreach ($volumeid in $winvolumes) {
                if ($null -eq $volumeid) {
                    Write-Debug "Skipping volume with null volumeid"
                    continue
                }
                $vol = Get-Volume -Path $volumeid | Get-Partition | Where-Object DiskNumber -in $allDisks.Number
                $serialNumber = $allDisks | Where-Object Number -eq $vol.DiskNumber | Select -ExpandProperty SerialNumber
                $BusType = $allDisks | Where-Object Number -eq $vol.DiskNumber | Select -ExpandProperty BusType
                $VolumeSerialMapping[$volumeid] = $serialNumber
                $Lunserialnumbers += $serialNumber
                $BusTypes += $BusType
            }
            $Lunserialnumbers = $Lunserialnumbers | Where-Object { -not $_.StartsWith('vol') } | Select-Object -Unique
            if ($Lunserialnumbers.count -eq 0 -and $BusTypes.Count -gt 0 -and $BusTypes -notcontains 'iSCSI') {
                throw "We support only iSCSI volumes"
            }
            return @{
                Lunserialnumbers = $Lunserialnumbers | Select-Object -Unique
                VolumeSerialMapping = $VolumeSerialMapping
            }
        } catch {
            throw "An error occurred while getting the serial numbers of Windows volumes: $_"
        }
    }

    Function Get-LunFromSerialNumber($SerialNumbers, $VolumeSerialMapping, $visitedFilesystems, $instanceLevelFsxnId) {
        Write-Debug "Get ONTAP lun name from serial numbers for: $VolumeSerialMapping"
        $QueryFilter = ''
        foreach ($SerialNumber in $SerialNumbers) {
            if ($SerialNumber -ne '') {
                $QueryFilter += [System.Web.HttpUtility]::UrlEncode($SerialNumber) + '|'
            }
        }
        $QueryFilter = $QueryFilter.TrimEnd('|')
        if ($svmOntapUuid -ne '') {
            $QueryFilter += "&svm.uuid=$svmOntapUuid"
        }
        $Params = @{ "ApiEndPoint" = "/storage/luns" }
        [string[]]$LunNames = @()
        $VolumeLunMapping = @{}
        $LunDetails = @()
        if ($QueryFilter -ne '') {
            $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter"}
            $Params += @{
                "FSxCredentialsInBase64" = $($visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64);
                "FSxHostName" = $($visitedFilesystems.$instanceLevelFsxnId.FSxHostName);
            }
            $Response = Invoke-ONTAPRequest @Params
            $LunRecords = $Response.records
            Write-Debug "Lun Records Mapping: $($LunRecords | ConvertTo-Json)"
            foreach ($record in $LunRecords) {
                $LunNames += $record.name
                $LunDetails += @{
                    "uuid" = $record.uuid
                    "name" = $record.name
                    "serial_number" = $record.serial_number
                }
                foreach ($volumeId in $VolumeSerialMapping.Keys) {
                    if ($VolumeSerialMapping[$volumeId] -eq $record.serial_number) {
                        $lunName = $record.name -replace '^\\/vol\\/(.*?)\\/.*$', '$1'
                        $VolumeLunMapping[$volumeId] = $lunName
                    }
                }
            }
        }
        Write-Debug "Lun volume Mapping: $($VolumeLunMapping | ConvertTo-Json)"
        Write-Debug "Lun names: $LunNames"
        return @{
            LunNames = $LunNames
            VolumeLunMapping = $VolumeLunMapping
            LunDetails = $LunDetails
        }
    }

    Function Get-VolumeIdFromName($Names, $volumeLunMapping, $visitedFilesystems, $instanceLevelFsxnId, $serverInstanceName) {
        Write-Debug "Get Volume Id from name: $Names"
        $QueryFilter = ''
        foreach ($Name in $Names) {
            if ($Name -ne '') {
                $QueryFilter += [System.Web.HttpUtility]::UrlEncode($Name) + '|'
            }
        }
        $QueryFilter = $QueryFilter.TrimEnd('|')
        if (-not [string]::IsNullOrEmpty($($instanceLevelFsxnIds.$serverInstanceName.svmUuid))) {
            $QueryFilter += "&svm.uuid=$($instanceLevelFsxnIds.$serverInstanceName.svmUuid)"
        } elseif ($svmOntapUuid -ne '') {
            $QueryFilter += "&svm.uuid=$svmOntapUuid"
        }
        $Params = @{ "ApiEndPoint" = "/storage/volumes" }
        $VolumeNameMapping = @{}
        if ($QueryFilter -ne '') {
            $Params += @{"ApiQueryFilter" = "name=$QueryFilter" + "&fields=snapshot_count,$additionalFields"}
            $Params += @{
                "FSxCredentialsInBase64" = $($visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64);
                "FSxHostName" = $($visitedFilesystems.$instanceLevelFsxnId.FSxHostName);
            }
            $Response = Invoke-ONTAPRequest @Params
            foreach ($record in $Response.records) {
                foreach ($volumeId in $VolumeLunMapping.Keys) {
                    if ($VolumeLunMapping[$volumeId] -eq $record.name) {
                        $VolumeNameMapping[$volumeId] = @{
                            "uuid" = $record.uuid
                            "name" = $record.name
                        }
                    }
                }
            }
        }
        Write-Debug "final Mapping: $($VolumeLunMapping | ConvertTo-Json)"
        return @{
            Response = $Response
            volumeNameMapping = $VolumeNameMapping
        }
    }

    Function Process-Records($inputObject) {
        $output = @()
        if ($null -ne $inputObject.records) {
            foreach ($record in $inputObject.records) {
                $newRecord = New-Object PSObject
                $record.PSObject.Properties | Where-Object { $_.Name -ne '_links' } | ForEach-Object {
                    $newRecord | Add-Member -NotePropertyName $_.Name -NotePropertyValue $_.Value
                }
                $output += $newRecord
            }
        }
        return @{ "records" = $output }
    }
`;

// Template for volume details assessment - fetches ONTAP volume configuration
// Expects: $MappedVolumeUuids (array), $visitedFileSystems, $instanceLevelFsxnId, $DriftAssessmentData
const volumeDetailsAssessmentTemplate = `
    # Volume details assessment
    if ($MappedVolumeUuids.Count -gt 0) {
        $APIEndpoint = '/storage/volumes'
        $APIQueryFilter = "uuid=" + ($MappedVolumeUuids -join '|')
        $ApiQueryFields = "fields=svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee"

        try {
            $VolumeParams = @{
                "ApiEndPoint" = $APIEndpoint
                "ApiQueryFilter" = $APIQueryFilter
                "ApiQueryFields" = $ApiQueryFields
                "FSxCredentialsInBase64" = $($visitedFileSystems.$instanceLevelFsxnId.FSxCredentialsInBase64)
                "FSxHostName" = $($visitedFileSystems.$instanceLevelFsxnId.FSxHostName)
            }
            $Response = Invoke-ONTAPRequest @VolumeParams
            $Volumes = $Response.records

            $VolumeList = @()
            $SvmNames = @()
            foreach ($perVolumeData in $Volumes) {
                $perVolRow = [PSCustomObject]@{
                    name = $perVolumeData.name
                    'uuid' = $perVolumeData.uuid
                    'thin-provision' = $perVolumeData.guarantee.honored
                    'space-guarantee' = $perVolumeData.guarantee.type
                    'autosize-mode' = $perVolumeData.autosize.mode
                    'fractional-reserve' = $perVolumeData.space.fractional_reserve
                    'snapshot-copy-reserve' = $perVolumeData.space.snapshot.reserve_percent
                    'snapshot-autodelete' = $perVolumeData.space.snapshot.autodelete.enabled
                    'snapshot-policy' = $perVolumeData.snapshot_policy.name
                    'tiering-policy' = $perVolumeData.tiering.policy
                    'tiering-min-cooling-days' = $perVolumeData.tiering.min_cooling_days
                }
                if($perVolumeData.autosize.mode -ne 'off') {
                    $perVolRow | Add-Member -Name 'autosize' -Type NoteProperty -Value "on"
                } else {
                    $perVolRow | Add-Member -Name 'autosize' -Type NoteProperty -Value "off"
                }
                $VolumeList += $perVolRow
                $SvmNames += $perVolumeData.svm.name
            }
            $DriftAssessmentData['volumes'] = @($VolumeList)
        } catch {
            $DriftAssessmentData['errors']['volumes'] = $_.Exception.Message
        }

        # Volume footprint details for sizing
        try {
            $FootprintParams = @{
                "ApiEndPoint" = '/private/cli/volume/show-footprint'
                "ApiQueryFields" = "fields=volume-blocks-footprint-bin0-percent"
                "FSxCredentialsInBase64" = $($visitedFileSystems.$instanceLevelFsxnId.FSxCredentialsInBase64)
                "FSxHostName" = $($visitedFileSystems.$instanceLevelFsxnId.FSxHostName)
            }
            $Response = Invoke-ONTAPRequest @FootprintParams
            $FootprintVolumes = $Response.records

            $PerformanceTierDetails = @()
            foreach ($perVolumeData in $FootprintVolumes) {
                if ($MappedVolumeNames -contains $perVolumeData.volume) {
                    $object = @{
                        "volumeName" = $perVolumeData.volume
                        "performanceTierPercent" = $perVolumeData.volume_blocks_footprint_bin0_percent
                    }
                    $PerformanceTierDetails += $object
                }
            }
            $DriftAssessmentData['sizing'] = @{}
            $DriftAssessmentData['sizing']['performance-tier'] = @($PerformanceTierDetails)
        } catch {
            $DriftAssessmentData['errors']['sizing'] = $_.Exception.Message
        }
    }
`;

// Template for LUN details assessment - fetches ONTAP LUN configuration
// Expects: $MappedLunNames (array), $visitedFileSystems, $instanceLevelFsxnId, $DriftAssessmentData
const lunDetailsAssessmentTemplate = `
    # LUN details assessment
    if ($MappedLunNames.Count -gt 0) {
        $APIEndpoint = '/storage/luns'
        $APIQueryFilter = "name=" + ($MappedLunNames -join '|')
        $ApiQueryFields = "fields=space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type"

        try {
            $LunParams = @{
                "ApiEndPoint" = $APIEndpoint
                "ApiQueryFilter" = $APIQueryFilter
                "ApiQueryFields" = $ApiQueryFields
                "FSxCredentialsInBase64" = $($visitedFileSystems.$instanceLevelFsxnId.FSxCredentialsInBase64)
                "FSxHostName" = $($visitedFileSystems.$instanceLevelFsxnId.FSxHostName)
            }
            $Response = Invoke-ONTAPRequest @LunParams
            $Luns = $Response.records

            $LunsList = @()
            foreach ($perLunData in $Luns) {
                $perLunRow = [PSCustomObject]@{
                    name = $perLunData.name
                    'os-type' = $perLunData.os_type
                    'space-reservation-enabled' = $perLunData.space.guarantee.requested
                    'space-allocation-allocated' = $perLunData.space.scsi_thin_provisioning_support_enabled
                }
                $LunsList += $perLunRow
            }
            $DriftAssessmentData['luns'] = @($LunsList)
        } catch {
            $DriftAssessmentData['errors']['luns'] = $_.Exception.Message
        }
    }
`;

// Template for OS configuration assessment - MPIO and iSCSI
// Expects: $DriftAssessmentData, Test-IscsiSessions function defined
const osConfigAssessmentTemplate = `
    # OS configuration assessment
    $DriftAssessmentData['os'] = @{}
    try {
        $MpioResponse = Get-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9 -ErrorAction SilentlyContinue | Select ProductId,VendorId

        $MpioStatus = $false
        if (-not ([string]::IsNullOrEmpty($MpioResponse))) {
            if (($MpioResponse.VendorId -eq "MSFT2005") -and ($MpioResponse.ProductId -eq "iSCSIBusType_0x9")) {
                $MpioStatus = $true
            }
        }
        $DriftAssessmentData['os']['mpio-enabled'] = $MpioStatus

        try {
            $output = Get-MPIOSetting | Format-List * | Out-String
            $MatchString = 'DiskTimeoutValue\\s+:\\s+(\\d+)'
            if ($output -match $MatchString) {
                $MpioTimeout = $Matches[1]
            } else {
                $MpioTimeout = $null
            }
        } catch {
            $MpioTimeout = $null
        }
        $DriftAssessmentData['os']['mpio-timeout'] = $MpioTimeout
    } catch {
        $DriftAssessmentData['errors']['mpio-policy'] = $_.Exception.Message
    }

    # iSCSI session count
    try {
        $SessionCount = Test-IscsiSessions
        $DriftAssessmentData['os']['mpio-iscsi-count'] = "$SessionCount"
    } catch {
        $DriftAssessmentData['errors']['iscsi-sessions'] = $_.Exception.Message
    }
`;

// Template for storage layout assessment - gathers drive details, file locations, and user database layout
// Expects: $executableInstance, $sqlCredential, $DriftAssessmentData, $lunResult, Invoke-CommandWithCredSSP function defined
const storageLayoutAssessmentTemplate = `
    # Storage Layout Assessment
    Write-Information "Gathering storage layout data for instance: $serverInstanceName"
    
    Function Get-MappedDrives {
        param(
            [Parameter(Mandatory = $true)]
            [string[]]$drives
        )

        $disks = Get-WmiObject -Query "SELECT DeviceID, Model FROM Win32_DiskDrive"
        $results = New-Object System.Collections.ArrayList

        foreach ($disk in $disks) {
            $partitions = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"
            foreach ($partition in $partitions) {
                $logicalDisks = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"
                    foreach ($logicalDisk in $logicalDisks) {
                        if(($drives -contains $logicalDisk.DeviceID) -and ($disk.Model -like '*NETAPP*')) {
                            $results += $logicalDisk.DeviceID
                        }
                    }
                }
            }
        return $results
    }
    
    Function Test-ValidJson {
        param (
            [Parameter(Mandatory = $true)]
            [object]$JsonString
        )
        try {
            $JsonString = [string]$JsonString
            $null = $JsonString | ConvertFrom-Json
            return $true
        } catch {
            return $false
        }
    }

    Function Execute-SqlQuery {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Query,
            [Parameter(Mandatory = $true)]
            [string]$InstanceName,
            [Parameter(Mandatory = $true)]
            [hashtable]$SqlCredential
        )
        
        if ($SqlCredential.useDomainAuth -eq $True) {
            return Invoke-CommandWithCredSSP -sqlquery $Query -instanceName $InstanceName
        } elseif ($SqlCredential.useSqlAuth -eq $True) {
            return sqlcmd -U $SqlCredential.username -P $SqlCredential.password -S $InstanceName -Q $Query -y 0
        } else {
            return sqlcmd -S $InstanceName -Q $Query -y 0
        }
    }
    
    
    $driveDetailsErrors = @{}
    $DriftAssessmentData['layout'] = @{}
    
    try {
        # Get all data drives
        $instanceDataDrivesQuery = "SET NOCOUNT ON; select (select distinct LEFT(physical_name, 2) as drives from sys.master_files where type_desc collate SQL_Latin1_General_CP1_CI_AS = 'ROWS' FOR JSON AUTO) as dataDrives"
        $instanceAllDataDrives = Execute-SqlQuery -Query $instanceDataDrivesQuery -InstanceName $executableInstance -SqlCredential $sqlCredential
        
        if (-Not ([string]::IsNullOrEmpty($instanceAllDataDrives)) -and (Test-ValidJson -JsonString $instanceAllDataDrives)) {
            $instanceAllDataDrives = $instanceAllDataDrives | ConvertFrom-Json
        } else {
            $driveDetailsErrors["instanceDataDrivesError"] = $instanceAllDataDrives -join ' ,'
            $instanceAllDataDrives = @()
        }
        
        $instanceDrivesList = @()
        $instanceAllDataDrives | ForEach-Object -Process { $instanceDrivesList += $_.drives }
        $netappDataDrives = Get-MappedDrives $instanceDrivesList
        
        # Get all log drives
        $instanceLogDrivesQuery = "SET NOCOUNT ON; select (select distinct LEFT(physical_name, 2) as drives from sys.master_files where type_desc collate SQL_Latin1_General_CP1_CI_AS = 'LOG' FOR JSON AUTO) as logDrives"
        $instanceAllLogDrives = Execute-SqlQuery -Query $instanceLogDrivesQuery -InstanceName $executableInstance -SqlCredential $sqlCredential
        
        if (-Not ([string]::IsNullOrEmpty($instanceAllLogDrives)) -and (Test-ValidJson -JsonString $instanceAllLogDrives)) {
            $instanceAllLogDrives = $instanceAllLogDrives | ConvertFrom-Json
        } else {
            $driveDetailsErrors["instanceLogDrivesError"] = $instanceAllLogDrives -join ' ,'
            $instanceAllLogDrives = @()
        }
        
        $instanceDrivesList = @()
        $instanceAllLogDrives | ForEach-Object -Process { $instanceDrivesList += $_.drives }
        $netappLogDrives = Get-MappedDrives $instanceDrivesList
        
        # Get user database data drive sizes
        $userDbDriveSizesQuery = @"
SET NOCOUNT ON;
SELECT (SELECT 
    d.name AS databaseName,
    d.collation_name AS collationName,
    LEFT(mf.physical_name, 2) AS dataDriveLetter,
    mf.size * 8.0 / 1024.0 AS sizeInMb,
    vs.total_bytes / 1048576.0 AS driveTotalSizeMB,
    vs.volume_id AS volumeid
FROM 
    sys.databases d
JOIN 
    sys.master_files mf ON d.database_id = mf.database_id AND mf.type = 0
CROSS APPLY 
    sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
WHERE 
    d.database_id > 4 or d.name collate SQL_Latin1_General_CP1_CI_AS like '%msdb%'
ORDER BY 
    d.name FOR JSON PATH) as userDatabasesDriveSizes
"@
        $instanceAllDataDrivesSizes = Execute-SqlQuery -Query $userDbDriveSizesQuery -InstanceName $executableInstance -SqlCredential $sqlCredential
        
        if (-Not ([string]::IsNullOrEmpty($instanceAllDataDrivesSizes)) -and (Test-ValidJson -JsonString $instanceAllDataDrivesSizes)) {
            $instanceAllDataDrivesSizes = $instanceAllDataDrivesSizes | ConvertFrom-Json
        } else {
            $driveDetailsErrors["instanceDataDriveSizeError"] = $instanceAllDataDrivesSizes -join ' ,'
            $instanceAllDataDrivesSizes = @()
        }
        
        # Get user database log drive sizes
        $userDbLogDriveSizesQuery = @"
SET NOCOUNT ON;
SELECT (SELECT 
    d.name AS databaseName,
    d.collation_name AS collationName,
    LEFT(mf.physical_name, 2) AS logDriveLetter,
    mf.physical_name AS logDrivePath,
    mf.size * 8.0 / 1024.0 AS sizeInMb,
    vs.total_bytes / 1048576.0 AS driveTotalSizeMB,
    vs.volume_id AS volumeid
FROM 
    sys.databases d
JOIN 
    sys.master_files mf ON d.database_id = mf.database_id AND mf.type = 1
CROSS APPLY 
    sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
WHERE 
    d.database_id > 4 or d.name collate SQL_Latin1_General_CP1_CI_AS like '%msdb%'
ORDER BY 
    d.name FOR JSON PATH) as userDatabasesLogDriveSizes
"@
        $instanceAllLogDrivesSizes = Execute-SqlQuery -Query $userDbLogDriveSizesQuery -InstanceName $executableInstance -SqlCredential $sqlCredential
        
        if (-Not ([string]::IsNullOrEmpty($instanceAllLogDrivesSizes)) -and (Test-ValidJson -JsonString $instanceAllLogDrivesSizes)) {
            $instanceAllLogDrivesSizes = $instanceAllLogDrivesSizes | ConvertFrom-Json
        } else {
            $driveDetailsErrors["instanceLogDriveSizeError"] = $instanceAllLogDrivesSizes -join ' ,'
            $instanceAllLogDrivesSizes = @()
        }
        
        # Get tempdb drive size
        $tempdbDriveSizeQuery = @"
SET NOCOUNT ON;
SELECT 
    LEFT(d.filename, 2) AS tempdbDriveLetter,
    mf.physical_name AS tempdbDrivePath,
    ISNULL(vs.total_bytes / 1048576, 0) AS tempdbDriveTotalSizeMB,
    vs.volume_id AS volumeid
FROM 
    tempdb.sys.sysfiles d
JOIN
    sys.master_files mf ON d.name = mf.name AND d.name = 'tempdev'
CROSS APPLY 
    sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
ORDER BY 
    tempdbDriveLetter FOR JSON PATH
"@
        $defaultTempDBDriveDetails = Execute-SqlQuery -Query $tempdbDriveSizeQuery -InstanceName $executableInstance -SqlCredential $sqlCredential
        
        if (-Not ([string]::IsNullOrEmpty($defaultTempDBDriveDetails)) -and (Test-ValidJson -JsonString $defaultTempDBDriveDetails)) {
            $defaultTempDBDriveDetails = $defaultTempDBDriveDetails | ConvertFrom-Json
        } else {
            $driveDetailsErrors["instanceTempDBDriveError"] = $defaultTempDBDriveDetails -join ' ,'
            $defaultTempDBDriveDetails = @()
        }
        
        # Get default data and log drive details from msdb
        $defaultDataDriveDetails = $instanceAllDataDrivesSizes | Where-Object { $_.databaseName -eq 'msdb' }
        $defaultLogDriveDetails = $instanceAllLogDrivesSizes | Where-Object { $_.databaseName -eq 'msdb' }
        
        # Filter out msdb from user database lists (msdb is only used for default file locations, not in user-database-layout)
        $userDataDrivesSizes = $instanceAllDataDrivesSizes | Where-Object { $_.databaseName -ne 'msdb' }
        $userLogDrivesSizes = $instanceAllLogDrivesSizes | Where-Object { $_.databaseName -ne 'msdb' }
        
        # Determine default file locations
        $defaultDataDrive = 'shared-drive'
        if ($netappDataDrives -notcontains $defaultDataDriveDetails.dataDriveLetter) {
            $driveDetailsErrors["instanceDataDrivesError"] = "Data drive is not a NetApp drive."
        } else {
            if (($defaultDataDriveDetails.dataDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter) -and ($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultDataDriveDetails)) {
                $defaultDataDrive = 'separate-drive'
            }
        }
        
        $defaultLogDrive = 'shared-drive'
        if ($netappLogDrives -notcontains $defaultLogDriveDetails.logDriveLetter) {
            $driveDetailsErrors["instanceLogDrivesError"] = "Log drive is not a NetApp drive."
        } else {
            if (($defaultDataDriveDetails.dataDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter) -and ($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter)) {
                $defaultLogDrive = 'separate-drive'
            }
        }
        
        $tempdbDrive = 'shared-drive'
        if ($netappDataDrives -notcontains $defaultTempDBDriveDetails.tempdbDriveLetter) {
            $driveDetailsErrors["instanceTempDBDriveError"] = "TempDB drive is not a NetApp drive."
        } else {
            if (($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultDataDriveDetails.dataDriveLetter) -and ($defaultTempDBDriveDetails -notcontains $defaultLogDriveDetails.logDriveLetter)) {
                $tempdbDrive = 'separate-drive'
            }
        }
        
        # Set layout information
        if (-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceTempDBDriveError"]))) {
            $DriftAssessmentData['errors']['tempdb-files-location'] = $driveDetailsErrors["instanceTempDBDriveError"]
        } else {
            $DriftAssessmentData['layout']['tempdb-files-location'] = $tempdbDrive
        }
        
        if (-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceDataDrivesError"]))) {
            $DriftAssessmentData['errors']['default-data-files-location'] = $driveDetailsErrors["instanceDataDrivesError"]
        } else {
            $DriftAssessmentData['layout']['default-data-files-location'] = $defaultDataDrive
        }
        
        if (-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceLogDrivesError"]))) {
            $DriftAssessmentData['errors']['default-log-files-location'] = $driveDetailsErrors["instanceLogDrivesError"]
        } else {
            $DriftAssessmentData['layout']['default-log-files-location'] = $defaultLogDrive
        }
        
        # Build enriched user database layout with ONTAP volume/lun details from Part 1
        Write-Information "Caching volume, partition, and disk information for performance..."
        
        # Collect volume IDs from SQL query results
        $sqlVolumes = @()
        foreach ($drive in $instanceAllDataDrivesSizes) {
            if ($drive.volumeid) {
                $sqlVolumes += [PSCustomObject]@{ volumeid = $drive.volumeid; driveLetter = $drive.dataDriveLetter }
            }
        }
        foreach ($drive in $instanceAllLogDrivesSizes) {
            if ($drive.volumeid) {
                $sqlVolumes += [PSCustomObject]@{ volumeid = $drive.volumeid; driveLetter = $drive.logDriveLetter }
            }
        }
        foreach ($drive in $defaultTempDBDriveDetails) {
            if ($drive.volumeid) {
                $sqlVolumes += [PSCustomObject]@{ volumeid = $drive.volumeid; driveLetter = $drive.tempdbDriveLetter }
            }
        }
        # Get unique volume IDs
        $uniqueVolumeIds = $sqlVolumes | Select-Object -Property volumeid, driveLetter -Unique
        
        # Cache all disks once
        $allDisksCache = Get-Disk -ErrorAction SilentlyContinue
        
        # Build a lookup table by drive letter for fast access
        # Note: DriveLetter from Get-Volume is a [char], convert to string for consistent hashtable lookups
        $driveLetterCache = @{}
        $partitionmap = @{}
        foreach ($winvolume in $uniqueVolumeIds) {
            if ([string]::IsNullOrEmpty($winvolume.volumeid) -or [string]::IsNullOrEmpty($winvolume.driveLetter)) {
                continue
            }
            
            # Cache partition data by volume ID 
            if (-not $partitionmap.Contains($winvolume.volumeid)) {
                $vol = Get-Volume -Path $winvolume.volumeid -ErrorAction SilentlyContinue
                $partition = $vol | Get-Partition -ErrorAction SilentlyContinue
                if ($vol -and $partition) {
                    $disk = $allDisksCache | Where-Object { $_.Number -eq $partition.DiskNumber } | Select-Object -First 1
                    $partitionmap[$winvolume.volumeid] = @{
                        "volume" = $vol
                        "partition" = $partition
                        "disk" = $disk
                    }
                }
            }
            
            # Build drive letter cache from cached partition data
            $cachedData = $partitionmap[$winvolume.volumeid]
            if ($cachedData) {
                $driveLetterKey = [string]$winvolume.driveLetter.TrimEnd(':')
                if (-not $driveLetterCache.ContainsKey($driveLetterKey)) {
                    $driveLetterCache[$driveLetterKey] = @{
                        Volume = $cachedData.volume
                        Partition = $cachedData.partition
                        Disk = $cachedData.disk
                        AccessPaths = if ($cachedData.partition.AccessPaths) { $cachedData.partition.AccessPaths } else { @() }
                    }
                }
            }
        }
        
        # Build serial number to disk lookup for fast access
        $serialNumberToDisk = @{}
        foreach ($disk in $allDisksCache) {
            if ($disk.SerialNumber) {
                $serialNumberToDisk[$disk.SerialNumber] = $disk
            }
        }
        
        Write-Information "Cached $($driveLetterCache.Count) drive letters and $($serialNumberToDisk.Count) disk serial numbers"
        
        # Helper function to get volume/lun details by drive letter (uses cached data)
        Function Get-VolumeDetailsByDriveLetterCached {
            param(
                [string]$DriveLetter,
                [hashtable]$VolumeNameMapping,
                [array]$LunDetails,
                [array]$VolumeRecords,
                [hashtable]$DriveLetterCache,
                [hashtable]$SerialNumberToDisk
            )
            $result = @{}
            
            # Get the Windows volume ID for this drive letter from cache
            $driveLetter = $DriveLetter.TrimEnd(':')
            $cachedDrive = $DriveLetterCache[$driveLetter]
            if (-not $cachedDrive) {
                return $result
            }
            
            $volume = $cachedDrive.Volume
            $partition = $cachedDrive.Partition
            $disk = $cachedDrive.Disk
            
            if (-not $volume -or -not $partition) {
                return $result
            }
            
            # Get the volume path (volume ID) that matches the volumeNameMapping keys
            # AccessPaths contain paths like Volume{GUID} - need to escape the ? in the pattern
            $volumePath = $cachedDrive.AccessPaths | Where-Object { $_ -like '*Volume{*' } | Select-Object -First 1
            
            # Find volume info from mapping using the volume path
            $volumeInfo = $null
            if ($volumePath -and $VolumeNameMapping) {
                foreach ($key in $VolumeNameMapping.Keys) {
                    $cleanKey = $key.Replace(" ", "").Replace("\`r", "").Replace("\`n", "")
                    $cleanVolumePath = $volumePath.Replace(" ", "")
                    if ($cleanKey -eq $cleanVolumePath) {
                        $volumeInfo = $VolumeNameMapping[$key]
                        break
                    }
                }
            }
            
            if ($volumeInfo) {
                $result['ontapVolumeUuid'] = $volumeInfo.uuid
                $result['ontapVolumeName'] = $volumeInfo.name
                if ($disk) {
                    $result['diskNumber'] = $disk.Number
                    $result['lunSerialNumber'] = $disk.SerialNumber
                    foreach ($lun in $LunDetails) {
                        if ($lun.serial_number -eq $disk.SerialNumber) {
                            $result['lunUuid'] = $lun.uuid
                            $result['lunPath'] = $lun.name
                            break
                        }
                    }
                } else {
                    # Fallback if disk info not available: try matching by volume name only
                    foreach ($lun in $LunDetails) {
                        $lunVolName = $lun.name -replace '^\\/vol\\/(.*?)\\/.*$', '$1'
                        if ($lunVolName -eq $volumeInfo.name) {
                            $result['lunUuid'] = $lun.uuid
                            $result['lunPath'] = $lun.name
                            $result['lunSerialNumber'] = $lun.serial_number
                            break
                        }
                    }
                }
                
                # Get SVM name from volume records
                $volumeRec = $VolumeRecords | Where-Object { $_.name -eq $volumeInfo.name } | Select-Object -First 1
                if ($volumeRec -and $volumeRec.svm) {
                    $result['svmName'] = $volumeRec.svm.name
                }
            }
            
            return $result
        }
        
        Write-Information "Building ONTAP details cache by drive letter..."
        $ontapDetailsByDriveLetter = @{}
        
        # Get all unique drive letters from data, log, and tempdb
        $allDriveLetters = @()
        $instanceAllDataDrivesSizes | ForEach-Object { $allDriveLetters += $_.dataDriveLetter }
        $instanceAllLogDrivesSizes | ForEach-Object { $allDriveLetters += $_.logDriveLetter }
        $defaultTempDBDriveDetails | ForEach-Object { $allDriveLetters += $_.tempdbDriveLetter }
        $uniqueDriveLetters = $allDriveLetters | Select-Object -Unique
        
        foreach ($dl in $uniqueDriveLetters) {
            if (-not $ontapDetailsByDriveLetter.ContainsKey($dl)) {
                $details = Get-VolumeDetailsByDriveLetterCached -DriveLetter $dl -VolumeNameMapping $volumeNameMapping -LunDetails $lunResult.LunDetails -VolumeRecords $processedRecords.records -DriveLetterCache $driveLetterCache -SerialNumberToDisk $serialNumberToDisk
                $ontapDetailsByDriveLetter[$dl] = $details
            }
        }
        Write-Information "Cached ONTAP details for $($ontapDetailsByDriveLetter.Count) unique drive letters"
        
        # Build enriched data drives with ONTAP details (using pre-cached ONTAP lookups)
        # Use ArrayList for O(1) append instead of += which is O(n)
        $enrichedDataDrives = [System.Collections.ArrayList]::new()
        foreach ($dataDb in $userDataDrivesSizes) {
            $driveDetails = $ontapDetailsByDriveLetter[$dataDb.dataDriveLetter]
            if (-not $driveDetails) { $driveDetails = @{} }
            
            $driveLetter = $dataDb.dataDriveLetter.TrimEnd(':')
            $cachedDrive = $driveLetterCache[$driveLetter]
            $accessPaths = if ($cachedDrive) { $cachedDrive.AccessPaths } else { @() }
            
            $enrichedDrive = [PSCustomObject]@{
                name = $dataDb.databaseName
                collationName = $dataDb.collationName
                driveLetter = $dataDb.dataDriveLetter
                sizeInMb = $dataDb.sizeInMb
                accessPaths = $accessPaths
                lunSerialNumber = $driveDetails['lunSerialNumber']
                diskNumber = $driveDetails['diskNumber']
                ontapVolumeUuid = $driveDetails['ontapVolumeUuid']
                ontapVolumeName = $driveDetails['ontapVolumeName']
                lunUuid = $driveDetails['lunUuid']
                lunPath = $driveDetails['lunPath']
                svmName = $driveDetails['svmName']
            }
            
            [void]$enrichedDataDrives.Add($enrichedDrive)
        }
        
        # Simplify data drives by grouping by diskNumber using hashtable for O(1) lookup
        # When a database has multiple data files on the same disk, sum their sizes into a single entry
        $dataGroupByDisk = @{}
        foreach ($drive in $enrichedDataDrives) {
            $key = if ($null -ne $drive.diskNumber) { $drive.diskNumber.ToString() } else { "null_$($drive.driveLetter)" }
            if (-not $dataGroupByDisk.ContainsKey($key)) {
                $dataGroupByDisk[$key] = [PSCustomObject]@{
                    driveLetter = $drive.driveLetter
                    accessPaths = $drive.accessPaths
                    diskNumber = $drive.diskNumber
                    lunSerialNumber = $drive.lunSerialNumber
                    ontapVolumeUuid = $drive.ontapVolumeUuid
                    ontapVolumeName = $drive.ontapVolumeName
                    lunUuid = $drive.lunUuid
                    lunPath = $drive.lunPath
                    svmName = $drive.svmName
                    databaseDetails = [System.Collections.ArrayList]::new()
                }
            }
            # Check if database already exists in databaseDetails and sum sizes
            $existingDb = $dataGroupByDisk[$key].databaseDetails | Where-Object { $_.name -eq $drive.name } | Select-Object -First 1
            if ($existingDb) {
                $existingDb.sizeInMb += $drive.sizeInMb
            } else {
                $dbObject = @{
                    "name" = $drive.name
                    "sizeInMb" = $drive.sizeInMb
                    "collationName" = $drive.collationName
                }
                [void]$dataGroupByDisk[$key].databaseDetails.Add($dbObject)
            }
        }
        $SimplifiedDataDriveDetails = @($dataGroupByDisk.Values)
        
        # Build enriched log drives with ONTAP details (using pre-cached ONTAP lookups)
        $enrichedLogDrives = [System.Collections.ArrayList]::new()
        foreach ($logDb in $userLogDrivesSizes) {
            $driveDetails = $ontapDetailsByDriveLetter[$logDb.logDriveLetter]
            if (-not $driveDetails) { $driveDetails = @{} }
            
            $driveLetter = $logDb.logDriveLetter.TrimEnd(':')
            $cachedDrive = $driveLetterCache[$driveLetter]
            $accessPaths = if ($cachedDrive) { $cachedDrive.AccessPaths } else { @() }
            
            $enrichedDrive = [PSCustomObject]@{
                name = $logDb.databaseName
                collationName = $logDb.collationName
                driveLetter = $logDb.logDriveLetter
                sizeInMb = $logDb.sizeInMb
                accessPaths = $accessPaths
                lunSerialNumber = $driveDetails['lunSerialNumber']
                diskNumber = $driveDetails['diskNumber']
                ontapVolumeUuid = $driveDetails['ontapVolumeUuid']
                ontapVolumeName = $driveDetails['ontapVolumeName']
                lunUuid = $driveDetails['lunUuid']
                lunPath = $driveDetails['lunPath']
                svmName = $driveDetails['svmName']
            }
            
            [void]$enrichedLogDrives.Add($enrichedDrive)
        }
        
        # Simplify log drives by grouping by diskNumber using hashtable for O(1) lookup
        # When a database has multiple log files on the same disk, sum their sizes into a single entry
        $logGroupByDisk = @{}
        foreach ($drive in $enrichedLogDrives) {
            $key = if ($null -ne $drive.diskNumber) { $drive.diskNumber.ToString() } else { "null_$($drive.driveLetter)" }
            if (-not $logGroupByDisk.ContainsKey($key)) {
                $logGroupByDisk[$key] = [PSCustomObject]@{
                    driveLetter = $drive.driveLetter
                    accessPaths = $drive.accessPaths
                    diskNumber = $drive.diskNumber
                    lunSerialNumber = $drive.lunSerialNumber
                    ontapVolumeUuid = $drive.ontapVolumeUuid
                    ontapVolumeName = $drive.ontapVolumeName
                    lunUuid = $drive.lunUuid
                    lunPath = $drive.lunPath
                    svmName = $drive.svmName
                    databaseDetails = [System.Collections.ArrayList]::new()
                }
            }
            # Check if database already exists in databaseDetails and sum sizes
            $existingDb = $logGroupByDisk[$key].databaseDetails | Where-Object { $_.name -eq $drive.name } | Select-Object -First 1
            if ($existingDb) {
                $existingDb.sizeInMb += $drive.sizeInMb
            } else {
                $dbObject = @{
                    "name" = $drive.name
                    "sizeInMb" = $drive.sizeInMb
                    "collationName" = $drive.collationName
                }
                [void]$logGroupByDisk[$key].databaseDetails.Add($dbObject)
            }
        }
        $SimplifiedLogDriveDetails = @($logGroupByDisk.Values)
        
        # Build enriched tempdb details (using pre-cached ONTAP lookups)
        # Only build if tempdb is on a NetApp drive, otherwise set to empty array
        $enrichedTempDbDetails = [System.Collections.ArrayList]::new()
        if ([string]::IsNullOrEmpty($driveDetailsErrors["instanceTempDBDriveError"])) {
            foreach ($tempDb in $defaultTempDBDriveDetails) {
                $driveDetails = $ontapDetailsByDriveLetter[$tempDb.tempdbDriveLetter]
                if (-not $driveDetails) { $driveDetails = @{} }
                
                $driveLetter = $tempDb.tempdbDriveLetter.TrimEnd(':')
                $cachedDrive = $driveLetterCache[$driveLetter]
                $accessPaths = if ($cachedDrive) { $cachedDrive.AccessPaths } else { @() }
                
                $enrichedDrive = [PSCustomObject]@{
                    name = "tempdev"
                    driveLetter = $tempDb.tempdbDriveLetter
                    sizeInMb = $tempDb.tempdbDriveTotalSizeMB
                    accessPaths = $accessPaths
                    lunSerialNumber = $driveDetails['lunSerialNumber']
                    diskNumber = $driveDetails['diskNumber']
                    ontapVolumeUuid = $driveDetails['ontapVolumeUuid']
                    ontapVolumeName = $driveDetails['ontapVolumeName']
                    lunUuid = $driveDetails['lunUuid']
                    lunPath = $driveDetails['lunPath']
                    svmName = $driveDetails['svmName']
                }
                
                [void]$enrichedTempDbDetails.Add($enrichedDrive)
            }
        }
        
        # Build user database layout with enriched details
        $userDatabaseLayout = @{
            "data" = @($SimplifiedDataDriveDetails)
            "log" = @($SimplifiedLogDriveDetails)
            "tempDb" = @($enrichedTempDbDetails)
        }
        $DriftAssessmentData['layout']['user-database-layout'] = $userDatabaseLayout
        
        # Add tempdb drive details to sizing
        if (-not $DriftAssessmentData.ContainsKey('sizing')) {
            $DriftAssessmentData['sizing'] = @{}
        }
        
        if (-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceTempDBDriveError"]))) {
            $DriftAssessmentData['errors']['data-tempdb-drive-details'] = $driveDetailsErrors["instanceTempDBDriveError"]
        } else {
            # Build data-tempdb-drive-details using the enriched tempdb details
            $sizingTempDBDriveDetails = [System.Collections.ArrayList]::new()
            foreach ($tempDb in $enrichedTempDbDetails) {
                $tempDbDetail = [PSCustomObject]@{
                    tempdbDriveLetter = $tempDb.driveLetter
                    tempdbDrivePath = $defaultTempDBDriveDetails[0].tempdbDrivePath
                    tempdbDriveTotalSizeMB = $tempDb.sizeInMb
                    dataDriveLetter = $defaultDataDriveDetails.dataDriveLetter
                    dataDriveTotalSizeMB = $defaultDataDriveDetails.driveTotalSizeMB
                    ontapVolumeUuid = $tempDb.ontapVolumeUuid
                    ontapVolumeName = $tempDb.ontapVolumeName
                    lunUuid = $tempDb.lunUuid
                    diskSerialNumber = $tempDb.lunSerialNumber
                    diskNumber = $tempDb.diskNumber
                    svmName = $tempDb.svmName
                }
                [void]$sizingTempDBDriveDetails.Add($tempDbDetail)
            }
            $DriftAssessmentData['sizing']['data-tempdb-drive-details'] = @($sizingTempDBDriveDetails)
        }
        
        # Build data-log-drive-details by combining data and log drive information with ONTAP details
        # PERFORMANCE: Build lookup table for log databases by name for O(1) access instead of O(n) Where-Object
        $logDbByName = @{}
        foreach ($logDb in $userLogDrivesSizes) {
            $logDbByName[$logDb.databaseName] = $logDb
        }
        
        $consolidatedDriveDetails = [System.Collections.ArrayList]::new()
        foreach ($dataDb in $userDataDrivesSizes) {
            $logDb = $logDbByName[$dataDb.databaseName]
            if ($logDb) {
                # Get ONTAP details from pre-cached lookup
                $logDriveDetails = $ontapDetailsByDriveLetter[$logDb.logDriveLetter]
                if (-not $logDriveDetails) { $logDriveDetails = @{} }
                
                # Get access paths from cache
                $dataLetter = $dataDb.dataDriveLetter.TrimEnd(':')
                $dataCached = $driveLetterCache[$dataLetter]
                $dataAccessPath = if ($dataCached -and $dataCached.AccessPaths -and $dataCached.AccessPaths.Count -gt 0) { $dataCached.AccessPaths[0] } else { $null }
                
                $logLetter = $logDb.logDriveLetter.TrimEnd(':')
                $logCached = $driveLetterCache[$logLetter]
                $logAccessPath = if ($logCached -and $logCached.AccessPaths -and $logCached.AccessPaths.Count -gt 0) { $logCached.AccessPaths[0] } else { $null }
                
                $driveDetail = [PSCustomObject]@{
                    databaseName = $dataDb.databaseName
                    dataDriveLetter = $dataDb.dataDriveLetter
                    dataDriveTotalSizeMB = $dataDb.driveTotalSizeMB
                    logDriveLetter = $logDb.logDriveLetter
                    logDrivePath = $logDb.logDrivePath
                    logDriveTotalSizeMB = $logDb.driveTotalSizeMB
                    ontapVolumeUuid = $logDriveDetails['ontapVolumeUuid']
                    ontapVolumeName = $logDriveDetails['ontapVolumeName']
                    lunUuid = $logDriveDetails['lunUuid']
                    diskSerialNumber = $logDriveDetails['lunSerialNumber']
                    diskNumber = $logDriveDetails['diskNumber']
                    svmName = $logDriveDetails['svmName']
                    dataAccessPath = $dataAccessPath
                    logAccessPath = $logAccessPath
                }
                
                [void]$consolidatedDriveDetails.Add($driveDetail)
            }
        }
        
        # Simplify by combining databases with same access paths using hashtable for O(1) lookup
        $accessPathGroups = @{}
        foreach ($drive in $consolidatedDriveDetails) {
            $key = "$($drive.logAccessPath)|$($drive.dataAccessPath)"
            if (-not $accessPathGroups.ContainsKey($key)) {
                $accessPathGroups[$key] = $drive
            } else {
                $accessPathGroups[$key].databaseName = $accessPathGroups[$key].databaseName + ',' + $drive.databaseName
            }
        }
        $SimplifiedDriveDetails = @($accessPathGroups.Values)
        $DriftAssessmentData['sizing']['data-log-drive-details'] = @($SimplifiedDriveDetails)
        
        # NTFS allocation unit details
        $filteredDataDrives = $instanceAllDataDrivesSizes | Where-Object { $netappDataDrives -contains $_.dataDriveLetter }  | ForEach-Object -MemberName dataDriveLetter
        $filteredLogDrives = $instanceAllLogDrivesSizes  | Where-Object { $netappLogDrives -contains $_.logDriveLetter } | ForEach-Object -MemberName logDriveLetter
        $filteredTempDbDrives = $defaultTempDBDriveDetails | Where-Object { $netappDataDrives -contains $_.tempdbDriveLetter  }  | ForEach-Object -MemberName tempdbDriveLetter
        $AllDrives = @($filteredDataDrives; $filteredLogDrives; $filteredTempDbDrives) | Select-Object -Unique
        
        $ntfsAllocationUnit = Get-CimInstance -ClassName Win32_Volume | Where-Object { $AllDrives -contains $_.DriveLetter } | Select-Object DriveLetter, BlockSize
        $ntfsUnitSize = 65536
        $ntfsAllocationUnit | ForEach-Object -Process { if ($_.BlockSize -ne 65536) { $ntfsUnitSize = $_.BlockSize } }
        $DriftAssessmentData['os']['ntfs-allocation-details'] = @($ntfsAllocationUnit)
        $DriftAssessmentData['os']['ntfs-allocation-unit-size'] = $ntfsUnitSize
        
        # MPIO load balancing policy details
        try {
            $AllNetappDisks = Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' } | Select-Object -Property Number
            $MpioLBDetails = mpclaim -s -d
            $LoadBalancingPolicy = 'RR'
            $ValidPolicies = @('RR', 'RRWS')
            $LoadBalancingPolicyDetails = @()
            
            foreach ($disk in $AllNetappDisks) {
                $MatchString = ".*Disk\\s+" + $disk.Number + "\\s+(\\S+)"
                $MatchGroup = [regex]::match($MpioLBDetails, $MatchString).Groups[1]
                if ($MatchGroup.Success -eq 'True') {
                    $object = [PSCustomObject]@{
                        "disk" = "Disk " + $disk.Number
                        "policy" = $MatchGroup.Value
                    }
                    if ($ValidPolicies -notcontains $MatchGroup.Value) {
                        $LoadBalancingPolicy = 'Other'
                    }
                    $LoadBalancingPolicyDetails += $object
                }
            }
            $DriftAssessmentData['os']['mpio-load-balance-policy'] = "$LoadBalancingPolicy"
            $DriftAssessmentData['os']['mpio-load-balance-policy-details'] = @($LoadBalancingPolicyDetails)
        } catch {
            $DriftAssessmentData['errors']['mpio-load-balance-policy'] = $_.Exception.Message
        }
        
    } catch {
        $DriftAssessmentData['errors']['layout'] = $_.Exception.Message
    }
`;

// Template for RSS (Receive Side Scaling) configuration assessment
// This is a host-level configuration, not per-instance
const rssConfigAssessmentTemplate = `
    # RSS Configuration Assessment (Host Level)
    Write-Information "Getting RSS configuration..."
    try {
        $rssAdaptersRaw = Get-NetAdapterRss -ErrorAction SilentlyContinue
        $rssConfigAdapters = @()

        foreach ($adapter in $rssAdaptersRaw) {
            $rssConfigAdapters += [PSCustomObject]@{
                adapterName = $adapter.Name
                rssEnabled = $adapter.Enabled
                rssProfile = $adapter.Profile -as [string]
                baseProcessorNumber = $adapter.BaseProcessorNumber
                numberOfReceiveQueues = $adapter.NumberOfReceiveQueues
            }
        }

        $vcpuCount = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
        $tcpOffloadState = (Get-NetOffloadGlobalSetting -ErrorAction SilentlyContinue).Chimney -as [string]

        # Calculate recommended settings based on vCPU count
        $recommendedReceiveQueues = if ($vcpuCount -gt 8) { 8 } else { $vcpuCount }
        $recommendedBaseProcessorNumber = if ($vcpuCount -ge 4) { 2 } else { 0 }

        # Analyze each adapter to find non-optimized ones
        $isAtleastOneAdapterWithBaseProcessorNumber2 = $false
        $rssAdaptersNotOptimized = @()
        $rssConfigOptimizedStatus = 'optimized'

        foreach ($rssConfigAdapter in $rssConfigAdapters) {
            $adapterName = $rssConfigAdapter.adapterName
            $rssEnabled = $rssConfigAdapter.rssEnabled
            $rssProfile = $rssConfigAdapter.rssProfile
            $baseProcessorNumber = $rssConfigAdapter.baseProcessorNumber
            $numberOfReceiveQueues = $rssConfigAdapter.numberOfReceiveQueues

            $expectedBaseProcessorNumber = if ($vcpuCount -ge 4) { 2 } else { $baseProcessorNumber }

            if ($baseProcessorNumber -eq 2) {
                $isAtleastOneAdapterWithBaseProcessorNumber2 = $true
            }

            # Best Practices: RSS enabled, profile = NUMAStatic, correct base processor, correct receive queues
            if (-not $rssEnabled -or 
                $rssProfile -ne 'NUMAStatic' -or 
                $baseProcessorNumber -ne $expectedBaseProcessorNumber -or 
                $numberOfReceiveQueues -ne $recommendedReceiveQueues) {
                $rssAdaptersNotOptimized += [PSCustomObject]@{
                    adapterName = $adapterName
                    rssEnabled = $rssEnabled
                    rssProfile = $rssProfile
                    baseProcessorNumber = $baseProcessorNumber
                    numberOfReceiveQueues = $numberOfReceiveQueues
                }
            }
        }

        # Special case: if multiple adapters and at least one has baseProcessorNumber=2,
        # remove adapters from unoptimized list if only baseProcessorNumber differs
        $adaptersToRemove = @()
        if ($vcpuCount -ge 4 -and $rssAdaptersNotOptimized.Count -gt 0 -and $rssConfigAdapters.Count -gt 1 -and $isAtleastOneAdapterWithBaseProcessorNumber2) {
            foreach ($adapter in $rssAdaptersNotOptimized) {
                if ($adapter.rssEnabled -and 
                    $adapter.rssProfile -eq 'NUMAStatic' -and 
                    $adapter.numberOfReceiveQueues -eq $recommendedReceiveQueues -and 
                    $adapter.baseProcessorNumber -ne 2) {
                    $adaptersToRemove += $adapter.adapterName
                }
            }
        }

        $rssAdaptersNotOptimized = @($rssAdaptersNotOptimized | Where-Object { $adaptersToRemove -notcontains $_.adapterName })

        # Determine overall status
        if ($rssAdaptersNotOptimized.Count -gt 0 -or $tcpOffloadState -ne 'Disabled') {
            $rssConfigOptimizedStatus = 'not-optimized'
        }

        # Build result object - only include recommendedAdapterSettings if not optimized
        $rssConfigResult = @{
            rssConfigFinding = $rssConfigOptimizedStatus
            rssAdapters = $rssAdaptersNotOptimized
            tcpOffloadState = $tcpOffloadState
            totalObjectsInViolation = $rssAdaptersNotOptimized.Count
            totalObjectsAssessed = $rssConfigAdapters.Count
        }

        # Only add recommendedAdapterSettings if not optimized
        if ($rssConfigOptimizedStatus -eq 'not-optimized') {
            $rssConfigResult['recommendedAdapterSettings'] = @{
                recommendedRssProfile = 'NUMAStatic'
                recommendedBaseProcessorNumber = $recommendedBaseProcessorNumber
                recommendedReceiveQueues = $recommendedReceiveQueues
            }
        }

        $FinalResponse['rssConfig'] = $rssConfigResult
    } catch {
        $FinalResponse['errors']['rssConfig'] = $_.Exception.Message
    }
`;

// Template for MTU alignment assessment
// This is a host-level configuration, not per-instance
const mtuAlignmentAssessmentTemplate = `
    # MTU Alignment Assessment (Host Level)
    Write-Information "Getting MTU alignment configuration..."
    try {
        $netAdapters = Get-NetAdapter -ErrorAction SilentlyContinue
        $mtuResult = @()

        foreach ($adapter in $netAdapters) {
            $mtuSize = $null
            $advancedProperty = Get-NetAdapterAdvancedProperty -Name $adapter.Name -RegistryKeyword "*JumboPacket" -ErrorAction SilentlyContinue
            if ($advancedProperty) {
                $mtuSize = $advancedProperty.RegistryValue
            } else {
                # Fallback to getting MTU from interface
                $netIpInterface = Get-NetIPInterface -InterfaceAlias $adapter.Name -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($netIpInterface) {
                    $mtuSize = $netIpInterface.NlMtu
                }
            }

            $mtuResult += [PSCustomObject]@{
                adapterName = $adapter.Name
                interfaceDescription = $adapter.InterfaceDescription
                status = $adapter.Status -as [string]
                mtuSize = $mtuSize
            }
        }

        # Get MTU alignment status - check if all adapters have the same MTU
        $mtuValues = $mtuResult | Where-Object { $_.mtuSize -ne $null } | ForEach-Object { $_.mtuSize } | Select-Object -Unique
        $mtuAligned = ($mtuValues | Measure-Object).Count -le 1
        $recommendedMtu = 9000  # Jumbo frames recommended for iSCSI

        $FinalResponse['mtuAlignment'] = @{
            adapters = $mtuResult
            aligned = $mtuAligned
            uniqueMtuValues = @($mtuValues)
            recommendedMtu = $recommendedMtu
        }
    } catch {
        $FinalResponse['errors']['mtuAlignment'] = $_.Exception.Message
    }
`;

// Template for MAXDOP (Maximum Degree of Parallelism) assessment
// This is per SQL Server instance configuration - reuses pattern from GET_VCPU_AND_MAXDOP_DETAILS
const maxDopAssessmentTemplate = `
    # MAXDOP Assessment (Per Instance)
    Write-Information "Getting MAXDOP configuration for instance: $serverInstanceName..."
    try {
        $vcpus = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
        $maxDopResult = Call-SqlCmd -SqlCredential $sqlCredential -Query "sp_configure 'max degree of parallelism'" -InstanceName "$executableInstance"

        # Initialize maxDop to 0
        $maxDop = "0"

        # Check if maxDopResult is not empty and parse the result to extract the run_value
        if ($maxDopResult) {
            $maxDop = $maxDopResult | Select-String -Pattern 'max degree of parallelism' | ForEach-Object {
                if ($_ -match '(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)') {
                    $matches[4]
                }
            } | Select-Object -First 1
        }

        # Check if maxDop is empty or null, set to 0 if it is
        if (-not $maxDop) {
            $maxDop = "0"
        }

        $DriftAssessmentData['maxDop'] = @{
            current = $maxDop
            vcpuCount = $vcpus
        }
    } catch {
        $DriftAssessmentData['errors']['maxDop'] = $_.Exception.Message
    }
`;

// Template for High Availability Assessment (FCI and AOAG)
// This includes cluster quorum, heartbeat settings, and SQL Server service configuration
/**
 * Host-level High Availability Assessment Template (clusterQuorum and heartbeat)
 * These are host-level settings that apply to the Windows Cluster, not individual SQL instances
 * Should be placed under hostLevelDetails.highAvailability
 */
const hostLevelHighAvailabilityAssessmentTemplate = `
    # ========================================
    # Host-Level High Availability Assessment (FCI and AOAG)
    # Cluster Quorum and Heartbeat Settings
    # ========================================
    if ($deploymentType -eq 'FCI' -or $deploymentType -eq 'AOAG') {
        Write-Information "Getting host-level high availability assessment..."
        
        if ($null -eq $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']) {
            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability'] = @{}
            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']['errors'] = @{}
        }

        # Recommended heartbeat settings for cloud deployments
        $recommendedHeartbeatSettings = @{
            SameSubnetDelay = 1000
            SameSubnetThreshold = 40
            CrossSubnetDelay = 1000
            CrossSubnetThreshold = 40
            CrossSiteDelay = 1000
            CrossSiteThreshold = 40
        }

        # ----------------------------------------
        # Cluster Quorum Assessment (Host Level)
        # ----------------------------------------
        Write-Information "Checking cluster quorum configuration..."
        try {
            $quorumInfo = Get-ClusterQuorum -ErrorAction Stop
            $quorumResourceName = [string]$quorumInfo.QuorumResource
            $quorumType = $quorumInfo.QuorumType

            # Get all cluster resources of type 'Physical Disk'
            $physicalDisks = Get-ClusterResource | Where-Object { $_.ResourceType -eq "Physical Disk" }

            # Check if the quorum resource matches any physical disk resource
            $quorumResource = $physicalDisks | Where-Object { $_.Name -eq $quorumResourceName }

            # IsPhysicalDiskAndMajority means NodeAndDiskMajority (recommended for 2-node FCI)
            $isPhysicalDiskAndMajority = (!!$quorumResource) -and ($quorumType -eq "Majority")

            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']['clusterQuorum'] = @{
                status = if ($isPhysicalDiskAndMajority) { 'optimized' } else { 'not-optimized' }
                details = @{
                    quorumResourceName = $quorumResourceName
                    quorumType = $quorumType
                    isPhysicalDisk = !!$quorumResource
                    isMajority = $quorumType -eq "Majority"
                    isPhysicalDiskAndMajority = $isPhysicalDiskAndMajority
                }
            }
        } catch {
            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']['clusterQuorum'] = @{
                status = 'not-optimized'
                details = $null
                error = $_.Exception.Message
            }
            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']['errors']['clusterQuorum'] = $_.Exception.Message
        }

        # ----------------------------------------
        # Heartbeat Settings Assessment (Host Level)
        # ----------------------------------------
        Write-Information "Checking cluster heartbeat settings..."
        try {
            $cluster = Get-Cluster -ErrorAction Stop
            $currentHeartbeatSettings = @{
                CrossSiteDelay = $cluster.CrossSiteDelay
                SameSubnetDelay = $cluster.SameSubnetDelay
                CrossSubnetDelay = $cluster.CrossSubnetDelay
                CrossSiteThreshold = $cluster.CrossSiteThreshold
                SameSubnetThreshold = $cluster.SameSubnetThreshold
                CrossSubnetThreshold = $cluster.CrossSubnetThreshold
            }

            $heartbeatDetails = @{}
            $allOptimized = $true

            foreach ($key in $recommendedHeartbeatSettings.Keys) {
                $currentValue = $currentHeartbeatSettings[$key]
                $recommendedValue = $recommendedHeartbeatSettings[$key]
                $isOptimized = $currentValue -eq $recommendedValue

                $heartbeatDetails[$key] = @{
                    current = $currentValue
                    recommended = $recommendedValue
                    status = if ($isOptimized) { 'optimized' } else { 'not-optimized' }
                }

                if (-not $isOptimized) {
                    $allOptimized = $false
                }
            }

            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']['heartbeat'] = @{
                status = if ($allOptimized) { 'optimized' } else { 'not-optimized' }
                details = $heartbeatDetails
            }
        } catch {
            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']['heartbeat'] = @{
                status = 'not-optimized'
                details = $null
                error = $_.Exception.Message
            }
            $FinalResponse['rawdata']['hostLevelDetails']['highAvailability']['errors']['heartbeat'] = $_.Exception.Message
        }
    }
`;

/**
 * Instance-level High Availability Assessment Template (sqlServerServices only)
 * This is instance-specific and should stay under instanceLevelDetails[instance].assessment.highAvailability
 */
const highAvailabilityAssessmentTemplate = `
    # ========================================
    # Instance-Level High Availability Assessment (FCI, AOAG Standalone, and AOAG FCI)
    # SQL Server Service Startup Type
    # ========================================
    if ($deploymentType -eq 'FCI' -or $deploymentType -eq 'AOAG') {
        Write-Information "Getting instance-level high availability assessment for FCI instance: $serverInstanceName..."
        $DriftAssessmentData['highAvailability'] = @{}
        $DriftAssessmentData['highAvailability']['errors'] = @{}

        # ----------------------------------------
        # SQL Server Service Startup Type Assessment
        # ----------------------------------------
        Write-Information "Checking SQL Server service configuration..."
        try {
            $serviceName = if ($serverInstanceName -and $serverInstanceName.ToUpper() -ne "MSSQLSERVER") { 
                "MSSQL\`$$serverInstanceName" 
            } else { 
                "MSSQLSERVER" 
            }

            $sqlService = Get-Service -Name $serviceName -ErrorAction Stop
            $startupType = $sqlService.StartType.ToString()
            
            # FCI and AOAG FCI require Manual (cluster manages it); AOAG Standalone requires Automatic
            $isClustered = $deploymentType -eq 'FCI' -or ($deploymentType -eq 'AOAG' -and $baseDeploymentType -eq 'FCI')
            if ($isClustered) {
                $isOptimized = $startupType -eq 'Manual'
                $recommendedStartupType = 'Manual'
            } else {
                $isOptimized = $startupType -eq 'Automatic'
                $recommendedStartupType = 'Automatic'
            }
            
            # Build nodesInViolation array (current host is in violation if not optimized)
            $nodesInViolation = @()
            if (-not $isOptimized) {
                $nodesInViolation += $env:COMPUTERNAME
            }

            $DriftAssessmentData['highAvailability']['sqlServerServices'] = @{
                status = if ($isOptimized) { 'optimized' } else { 'not-optimized' }
                nodesInViolation = $nodesInViolation
                details = @(
                    @{
                        serviceName = $sqlService.Name
                        displayName = $sqlService.DisplayName
                        currentStartupType = $startupType
                        recommendedStartupType = $recommendedStartupType
                        serviceStatus = $sqlService.Status.ToString()
                        instanceId = $ec2InstanceId
                    }
                )
            }
        } catch {
            $DriftAssessmentData['highAvailability']['sqlServerServices'] = @{
                status = 'not-optimized'
                nodesInViolation = @()
                details = $null
                error = $_.Exception.Message
            }
            $DriftAssessmentData['highAvailability']['errors']['sqlServerServices'] = $_.Exception.Message
        }
    }
`;
// PowerShell decompression script template - decompresses gzipped base64 payload and executes
const POWERSHELL_DECOMPRESS_TEMPLATE = (base64Data: string) => `$ErrorActionPreference="Stop"
$d=@"
${base64Data}
"@
$b=[Convert]::FromBase64String($d)
$m=New-Object IO.MemoryStream
$m.Write($b,0,$b.Length)
$m.Position=0
$g=New-Object IO.Compression.GzipStream($m,[IO.Compression.CompressionMode]::Decompress)
$r=New-Object IO.StreamReader($g)
$s=$r.ReadToEnd()
$r.Close();$g.Close();$m.Close()
Invoke-Expression $s`;

export {
    ontapRestRequest,
    ontapJobStatusTemplate,
    compressResponse,
    ontapRestRequestBootstrap,
    invokeOntapRequestTemplate,
    enableCredSSP,
    disableCredSSP,
    invokeCommandWithCredSSP,
    mappedVolumesHelperFunctions,
    volumeDetailsAssessmentTemplate,
    lunDetailsAssessmentTemplate,
    osConfigAssessmentTemplate,
    storageLayoutAssessmentTemplate,
    rssConfigAssessmentTemplate,
    mtuAlignmentAssessmentTemplate,
    maxDopAssessmentTemplate,
    highAvailabilityAssessmentTemplate,
    hostLevelHighAvailabilityAssessmentTemplate,
    POWERSHELL_DECOMPRESS_TEMPLATE
};
