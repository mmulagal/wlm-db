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
            $connection = Test-Connection -ComputerName fsx-aws-certificates.s3.amazonaws.com -Quiet -Count 1
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
            $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
            $tempCertFile = (New-TemporaryFile).FullName
            Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile $tempCertFile
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

export {
    ontapRestRequest,
    ontapJobStatusTemplate,
    compressResponse,
    ontapRestRequestBootstrap,
    invokeOntapRequestTemplate,
    enableCredSSP,
    disableCredSSP,
    invokeCommandWithCredSSP
};
