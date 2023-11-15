[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname
)

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

try{
    "Setting up Powershell Gallery to Install DSC Modules"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
#Register-PSRepository -Default -Verbose
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
Set-PSRepository -Name PSGallery -InstallationPolicy Trusted

"Installing the needed Powershell DSC modules for this Quick Start"
Install-Module -Name ComputerManagementDsc
Install-Module -Name "xFailOverCluster"
Install-Module -Name PSDscResources
Install-Module -Name xSmbShare
Install-Module -Name "xActiveDirectory"
Install-Module -Name "xDnsServer"
Install-Module -Name 'NetworkingDsc'

"Disabling Windows Firewall"
Get-NetFirewallProfile | Set-NetFirewallProfile -Enabled False

"Creating Directory for DSC Public Cert"
New-Item -Path C:\cfn\dsc\publickeys -ItemType directory

"Setting up DSC Certificate to Encrypt Credentials in MOF File"
$cert = New-SelfSignedCertificate -Type DocumentEncryptionCertLegacyCsp -DnsName 'AWSLWDscEncryptCert' -HashAlgorithm SHA256
# Exporting the public key certificate
$cert | Export-Certificate -FilePath "C:\cfn\dsc\publickeys\AWSLWDscPublicKey.cer" -Force
} catch {
    Write-Output "Failed to install DSC modules. PowerShell Galllery unavailable could happen due to Microsoft updating site certificate. Please retry after sometime"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId    
    $_ | Write-AWSLaunchWizardException
}


