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
            }
            catch {
                write-Information "FSxNHTTP_Response: $($_.Exception.Message)"
                Write-Information "FSxN Management domain $FSxHostName is not resolved. Switching to management IP."
                $FileSystemDetails = Get-FSXFileSystem -FileSystemId $fsxId
                $FSxHostName = $FileSystemDetails.ontapconfiguration.Endpoints.Management.IpAddresses
                if ($FSxHostName -is [array]) {
                    $FSxHostName = $FSxHostName[0]
                }
            }
            return @{
                FSxCredentialsInBase64 = $FSxCredentialsInBase64
                FSxHostName = $FSxHostName
                FSxCredentials= $FSxCredentials
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
try {
    $ServerName = '*'
    Start-Transcript -Path C:\\cfn\\log\\EnableCredSsp.ps1.txt -Append
    $ErrorActionPreference = "Stop"

    Enable-WSManCredSSP Client -DelegateComputer $ServerName -Force
    if ($DomainNetBIOSName) {
        Enable-WSManCredSSP Client -DelegateComputer *.$DomainNetBIOSName -Force
    }
    if ($DomainDNSName) {
        Enable-WSManCredSSP Client -DelegateComputer *.$DomainDNSName -Force
    }
    Enable-WSManCredSSP Server -Force

    # Sometimes Enable-WSManCredSSP doesn't get it right, so we set some registry entries by hand
    $parentkey = "hklm:\\SOFTWARE\\Policies\\Microsoft\\Windows"
    $key = "$parentkey\\CredentialsDelegation"
    $freshkey = "$key\\AllowFreshCredentials"
    $ntlmkey = "$key\\AllowFreshCredentialsWhenNTLMOnly"
    New-Item -Path $parentkey -Name 'CredentialsDelegation' -Force
    New-Item -Path $key -Name 'AllowFreshCredentials' -Force
    New-Item -Path $key -Name 'AllowFreshCredentialsWhenNTLMOnly' -Force
    New-ItemProperty -Path $key -Name AllowFreshCredentials -Value 1 -PropertyType Dword -Force
    New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFresh -Value 1 -PropertyType Dword -Force
    New-ItemProperty -Path $key -Name AllowFreshCredentialsWhenNTLMOnly -Value 1 -PropertyType Dword -Force
    New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFreshNTLMOnly -Value 1 -PropertyType Dword -Force
    New-ItemProperty -Path $freshkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force
    New-ItemProperty -Path $ntlmkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force
} catch {
    Write-Information "Error in EnableCredSSP: $($_.Exception.Message)"
}
`;

const disableCredSSP = `
try {
    # Disable CredSSP
    Start-Transcript -Path C:\\cfn\\log\\DisableCredSSP.ps1.txt -Append
    $ErrorActionPreference = "Stop"

    Disable-WSManCredSSP Client
    Disable-WSManCredSSP Server

    Remove-Item -Path 'hklm:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CredentialsDelegation\\AllowFreshCredentials' -ErrorAction Ignore
    Remove-ItemProperty -Path 'hklm:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CredentialsDelegation' -Name 'AllowFreshCredentials' -ErrorAction Ignore
    Remove-Item -Path 'hklm:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CredentialsDelegation\\AllowFreshCredentialsWhenNTLMOnly' -ErrorAction Ignore
    Remove-ItemProperty -Path 'hklm:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CredentialsDelegation' -Name 'AllowFreshCredentialsWhenNTLMOnly' -ErrorAction Ignore
} catch {
    Write-Information "Error in DisableCredSSP: $($_.Exception.Message)"
}
`;

export {
    ontapRestRequest,
    ontapJobStatusTemplate,
    compressResponse,
    ontapRestRequestBootstrap,
    invokeOntapRequestTemplate,
    enableCredSSP,
    disableCredSSP
};
