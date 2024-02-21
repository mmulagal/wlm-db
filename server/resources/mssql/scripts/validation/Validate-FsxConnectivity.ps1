 [CmdletBinding()]

param(
    [Parameter(Mandatory=$true)]
    [string]$PerformFSxCheck,

    [Parameter(Mandatory=$true)]
    [string]$FSxFileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$FSxRegion,

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,

    [Parameter(Mandatory=$true)]
    [string]$WaitHandler 
)

Start-Transcript -Path C:\cfn\log\Validate-FsxConnectivity.ps1.txt -Append

if (${PerformFSxCheck} -ne 'true' ) {
    Write-Output @{ status= "Skipped"; reason= "Deployment creates new FSx." } | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
    exit(0)
}

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$InstanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

$ErrorActionPreference = "Stop"
try {
$SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | ConvertFrom-Json
$Username = $SsmParameter.fsx.username
$Password = $SsmParameter.fsx.password
}catch{
    $Failed = $true
    $FailureReason = '"{0}"' -f "Unable to fetch SSM parameter, /netapp/wlmdb/$Parentstackname and access to SSM parameter store"
    Write-Output @{status= "Failed"; reason=$FailureReason} | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $InstanceId
    exit(1)
}
$FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
$FSxHostName = "management.${FSxFileSystemId}.fsx.${FSxRegion}.amazonaws.com"

# Get region Certificateificate for FSx
$FSxCertificateificateUri = "https://fsx-aws-Certificates.s3.amazonaws.com/bundle-${FSxRegion}.pem"
Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\cfn\FSxCertificate.pem
$Certificate = Import-Certificate -FilePath C:\cfn\FSxCertificate.pem -CertStoreLocation Cert:\LocalMachine\Root
$regionCertificateificate = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like $Certificate.Subject }

$Params = @{
    "URI"         = "https://management.${FSxFileSystemId}.fsx.${FSxRegion}.amazonaws.com/api/cluster?fields=version"
    "Method"      = "GET"
    "Headers"     = @{"Authorization" = "Basic $FSxCredentialsInBase64" }
    "ContentType" = "application/json"
}

try {
Invoke-RestMethod @Params -Certificate $regionCertificateificate
Write-Output @{ status= "Completed"; reason= "Done." } | ConvertTo-Json -Compress
Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
}catch{
    $Failed = $true
    $FailureReason = '"{0}"' -f "Unable to reach storage. Check credentials and accessibility from the subnet. Exception: $_"
    Write-Output @{status= "Failed"; reason=$FailureReason} | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $InstanceId
    exit(1)
}
 
