 [CmdletBinding()]
param()
    Start-Transcript -Path C:\cfn\log\installontapwindowsfeatures.ps1.txt -Append
    $ErrorActionPreference = "Stop"

try{
    Install-WindowsFeature Multipath-IO, Failover-Clustering,RSAT-DNS-Server -IncludeManagementTools
}catch{
    $_ | Write-AWSLaunchWizardException
}

#Start iSCSI initiator
try{
    Start-Service MSiSCSI
    If ((Get-Service -Name MSiSCSI).StartType -ne "Automatic")
    {
    Set-Service -Name MSiSCSI -StartupType Automatic
    }
}catch{
    $_ | Write-AWSLaunchWizardException
}

$NugetFileLoc = "C:\Program Files\PackageManagement\ProviderAssemblies\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$statuscode = 0
try {
     $response = Invoke-WebRequest https://www.powershellgallery.com/api/v2 -UseBasicParsing 
     $statuscode = $response.StatusCode
}catch {
     $statuscode = 0
}

if ($statuscode -eq 200) {
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
    Install-Module -Name AWS.Tools.Installer -Force
    $sourcelocation = 'C:\Users\Administrator\Downloads\Installers'
}

else {
    "Installing from packaged modules"
    Write-Output "Installing from packaged modules"
    Unblock-File -Path "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
    Copy-Item "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll" -Destination "C:\Program Files\PackageManagement\ProviderAssemblies" -Recurse -Force
    $sourcelocation = 'C:\cfn\Installer\dependent-packages\aws'
}

#Install Nuget provider
try {
Import-PackageProvider -Name NuGet


Register-PSRepository -Name 'AWS' -SourceLocation $sourcelocation -InstallationPolicy Trusted

Install-Module -Name AWS.Tools.FSX -Force -AllowClobber -Repository 'AWS'
Install-Module -Name AWS.Tools.EC2 -Force -AllowClobber -Repository 'AWS'
Install-Module -Name AWS.Tools.CloudFormation -Force -AllowClobber -Repository 'AWS'
Install-Module -Name AWS.Tools.SimpleSystemsManagement -AllowClobber -Repository 'AWS'
Install-Module -Name SqlServer -Force -AllowClobber -Repository 'AWS'
Install-Module -Name netapp.ontap -SkipPublisherCheck -Repository 'AWS'
}catch {
Write-output $_}
 
