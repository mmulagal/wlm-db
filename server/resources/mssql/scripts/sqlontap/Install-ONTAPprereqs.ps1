[CmdletBinding()]
param()
Start-Transcript -Path C:\cfn\log\installontapwindowsfeatures.ps1.txt -Append
$ErrorActionPreference = "Stop"

try {
    Install-WindowsFeature Multipath-IO, Failover-Clustering, RSAT-DNS-Server -IncludeManagementTools
}
catch {
    $_ | Write-AWSLaunchWizardException
}

#Start iSCSI initiator
try {
    Start-Service MSiSCSI
    If ((Get-Service -Name MSiSCSI).StartType -ne "Automatic") {
        Set-Service -Name MSiSCSI -StartupType Automatic
    }
}
catch {
    $_ | Write-AWSLaunchWizardException
}

$NugetFileLoc = "C:\Program Files\PackageManagement\ProviderAssemblies\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#Check if private network
$isprivatesubnet = $True
try{
    $connection =  Invoke-WebRequest www.powershellgallery.com -UseBasicParsing 
    if($connection.StatusCode -ne "200") {
        $isprivatesubnet = $True
        }
    else {
        $isprivatesubnet = $False
    }
}catch{
    Write-Output "Private network determination: Error while invoking webrequest to www.powershellgallery.com. $_"
}

# Remove the list of PS modules before installing them
$moduleList = @(
    'netapp.ontap',
    'sqlserver',
    'AWS.Tools.SimpleSystemsManagement',
    'AWS.Tools.CloudFormation',
    'AWS.Tools.EC2',
    'AWS.Tools.FSX',
    'AWS.Tools.Common',
    'AWS.Tools.Installer'
)

foreach ($module in $moduleList) {
    try {
        Write-Host "Attempting to remove the module: $module"
        Get-Module -Name $module -ListAvailable | Select-Object -ExpandProperty ModuleBase | Remove-Item -Recurse -Force
        Write-Host "Successfully removed module: $module"
    }
    catch {
        Write-Host "Error removing module: $module"
        Write-Host $_.Exception.Message
    }
}

# If PS modules installation fails, retry again. We have seen success on retry. 
$modulesInstalled = $False
$installPSModulesTries = 1
while ($installPSModulesTries -le 2) {
    if ($isprivatesubnet -ne $True) {
        #Install Nuget provider
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force

        # https://learn.microsoft.com/bs-latn-ba/powershell/module/powershellget/register-psrepository?view=powershellget-2.x
        # Possible fix for Set-PSRepository: No repository with PSGallery found. 
        try {
            Register-PSRepository -Default
        }
        catch { 
            Write-Output "PSGallery registered."
        }

        Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
        try {
            Install-Module -Name AWS.Tools.Installer -Force
            Install-Module -Name AWS.Tools.FSX -Force -AllowClobber
            Install-Module -Name AWS.Tools.EC2 -Force -AllowClobber
            Install-Module -Name AWS.Tools.CloudFormation -Force -AllowClobber
            Install-Module -Name AWS.Tools.SimpleSystemsManagement -AllowClobber
            Install-Module -Name SqlServer -Force -AllowClobber
            Install-Module -Name netapp.ontap

            $modulesInstalled = $True
            break
        }
        catch {
            Write-Output "Failed to ONTAP Powershell modules. PowerShell Gallery unavailable could happen due to Microsoft updating site certificate. Please retry after sometime. $_"
            $installPSModulesTries++
        }
    }
    else {
        "Installing from packaged modules"
        Write-Output "Installing from packaged modules"
        Unblock-File -Path "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
        $destinationPath = "C:\Program Files\PackageManagement\ProviderAssemblies"
        $destinationPathExists = Test-Path -Path $destinationPath
        if ($destinationPathExists -eq $False) {
            New-Item -ItemType Directory -Path $destinationPath -Force
        }
        try {
            Copy-Item "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll" -Destination $destinationPath -Recurse -Force
        }
        catch {
            Write-Host "Error while copying NuGetProvider. $_"
        }
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

            $modulesInstalled = $True
            break

        }
        catch {
            Write-Output "Failed to ONTAP Powershell modules. PowerShell Gallery unavailable could happen due to Microsoft updating site certificate. Please retry after sometime. $_"
            $installPSModulesTries++
        }
    }
}

if ($modulesInstalled -eq $False) {
    Write-Output "Failed to ONTAP Powershell modules. PowerShell Gallery unavailable could happen due to Microsoft updating site certificate. Please retry after sometime."
}
 
 
