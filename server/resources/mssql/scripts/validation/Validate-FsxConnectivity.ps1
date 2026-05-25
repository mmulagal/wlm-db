[CmdletBinding()]

param(
    [Parameter(Mandatory = $true)]
    [string]$PerformFSxCheck,

    [Parameter(Mandatory = $true)]
    [string]$FSxFileSystemId,

    [Parameter(Mandatory = $true)]
    [string]$FSxRegion,

    [Parameter(Mandatory = $true)]
    [string]$Stackname,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,

    [Parameter(Mandatory = $true)]
    [string]$ResourceID,

    [Parameter(Mandatory = $true)]
    [string]$WaitHandler,
    
    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform
)

Start-Transcript -Path C:\cfn\log\Validate-FsxConnectivity.ps1.txt -Append

add-type @"
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

if (${PerformFSxCheck} -ne 'true' ) {
    Write-Output @{ status = "Skipped"; reason = "Deployment creates new FSx." } | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
    exit(0)
}

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$InstanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

$ProgressPreference = "SilentlyContinue"
$ErrorActionPreference = "Stop"
try {
    $ScriptsPath =  Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
    $SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }

    $Username = $SsmParameter.fsx.username
    $Password = $SsmParameter.fsx.password
}
catch {
    $Failed = $true
    $FailureReason = '"{0}"' -f "Unable to fetch SSM parameter, /netapp/wlmdb/$Parentstackname and access to SSM parameter store"
    Write-Output @{status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
    if ($IsTerraform) {
        throw $FailureReason
    }
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $InstanceId
    exit(1)
}
# Get region Certificate for FSx
$isprivatesubnet = $False
$certHost = $(if ($FSxRegion -like 'us-gov-*') { 'fsx-aws-us-gov-certificates.s3.us-gov-west-1.amazonaws.com' } else { 'fsx-aws-certificates.s3.amazonaws.com' })
$FSxCertificateificateUri = "https://$certHost/bundle-${FSxRegion}.pem"
try {
    Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\cfn\FSxCertificate.pem
    $Certificate = Import-Certificate -FilePath C:\cfn\FSxCertificate.pem -CertStoreLocation Cert:\LocalMachine\Root
    $regionCertificate = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like $Certificate.Subject }
}
catch {
    $isprivatesubnet = $True 
    $regionCertificate = $null     
}
$FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
$FSxHostName = "management.${FSxFileSystemId}.fsx.${FSxRegion}.amazonaws.com"
try {
    $FSxNHTTP_Request = [System.Net.WebRequest]::Create("https://$FSxHostName")
    $FSxNHTTP_Response = $FSxNHTTP_Request.GetResponse()
    $FSxNHTTP_Response.Close()
}
catch {
    write-Information "FSxNHTTP_Response: $($_.Exception.Message)"
    Write-Information "FSxN Management domain $FSxHostName is not resolved. Switching to management IP."
    $fslist = Get-FSXFileSystem -FileSystemId $FSxFileSystemId
    $FSxHostName = $fslist.ontapconfiguration.Endpoints.Management.IpAddresses
    if ($FSxHostName -is [array]) {
        $FSxHostName = $FSxHostName[0]
    }
    $isprivatesubnet = $True
    $regionCertificate = $null

}


$Params = @{
    "URI"         = "https://${FSxHostName}/api/cluster?fields=version"
    "Method"      = "GET"
    "Headers"     = @{"Authorization" = "Basic $FSxCredentialsInBase64" }
    "ContentType" = "application/json"
}

try {
    if ($isprivatesubnet -eq $False) {
        Invoke-RestMethod @Params -Certificate $regionCertificate
    }
    else {
        Invoke-RestMethod @Params 
    }
    Write-Output @{ status = "Completed"; reason = "Done." } | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
}
catch {
    $Failed = $true
    $FailureReason = '"{0}"' -f "Unable to reach storage. 1. Check storage credentials are valid 2. Check if routing table allows connection from the subnet 3. Check if storage security group allows HTTPS(443) and iSCSI(3260) tcp ports.   Exception: $_"
    Write-Output @{status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
    if ($IsTerraform) {
        throw $FailureReason
    }
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $InstanceId
    exit(1)
}
 
