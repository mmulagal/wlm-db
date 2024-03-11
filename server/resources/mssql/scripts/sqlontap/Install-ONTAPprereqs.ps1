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

#Check if private network
$isprivatesubnet = $True
$connection =  Test-Connection -ComputerName www.powershellgallery.com -Quiet
if($connection -eq $False) {
    $isprivatesubnet = $True
    }
else {
    $isprivatesubnet = $False
}

if ($isprivatesubnet -ne $True) {
    #Install Nuget provider
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted

    Install-Module -Name AWS.Tools.Installer -Force
    Install-Module -Name AWS.Tools.FSX -Force -AllowClobber
    Install-Module -Name AWS.Tools.EC2 -Force -AllowClobber
    Install-Module -Name AWS.Tools.CloudFormation -Force -AllowClobber
    Install-Module -Name AWS.Tools.SimpleSystemsManagement -AllowClobber
    Install-Module -Name SqlServer -Force -AllowClobber
    Install-Module -Name netapp.ontap
}

else {
    "Installing from packaged modules"
    Write-Output "Installing from packaged modules"
    Unblock-File -Path "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
    $destinationPath = "C:\Program Files\PackageManagement\ProviderAssemblies"
    $destinationPathExists = Test-Path -Path $destinationPath
    if($destinationPathExists -eq $False) {
        New-Item -ItemType Directory -Path $destinationPath -Force
    }
    Copy-Item "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll" -Destination $destinationPath -Recurse -Force
    $sourcelocation = 'C:\cfn\Installer\dependent-packages\aws'
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
}
 
