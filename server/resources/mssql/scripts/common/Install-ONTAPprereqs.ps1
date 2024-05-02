[CmdletBinding()]
param()
    Start-Transcript -Path C:\cfn\log\installontapwindowsfeatures.ps1.txt -Append
    $ErrorActionPreference = "Stop"

#Install Nuget provider
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
Set-PSRepository -Name PSGallery -InstallationPolicy Trusted

Install-Module -Name AWS.Tools.Installer -Force
Install-Module -Name AWS.Tools.FSX -Force -AllowClobber
Install-Module -Name AWS.Tools.EC2 -Force -AllowClobber
Install-Module -Name AWS.Tools.SimpleSystemsManagement -AllowClobber
Install-Module -Name netapp.ontap

