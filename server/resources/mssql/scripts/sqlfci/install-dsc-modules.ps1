   [CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname
)

Start-Transcript -Path C:\cfn\log\InstallDscModules.ps1.txt -Append

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

$NugetFileLoc = "C:\Program Files\PackageManagement\ProviderAssemblies\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#Check if private network
$isprivatesubnet = $True
$connection =  Test-Connection -ComputerName  www.powershellgallery.com -Quiet
if($connection -eq $False) {
    $isprivatesubnet = $True
    }
else {
    $isprivatesubnet = $False
}

# If PS modules installation fails, retry again. We have seen success on retry. 
$modulesInstalled = $False
$installPSModulesTries = 1
while($installPSModulesTries -le 2) {
    if ($isprivatesubnet -ne $True) {
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force

        # https://learn.microsoft.com/bs-latn-ba/powershell/module/powershellget/register-psrepository?view=powershellget-2.x
        # Possible fix for Set-PSRepository: No repository with PSGallery found. 
        try {
            Register-PSRepository -Default
        }catch{ 
            Write-Output "PSGallery registered."
        }

        Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
        Install-Module -Name AWS.Tools.Installer -Force
        $sourcelocation = 'C:\Users\Administrator\Downloads\Installers'
        try { 
                Import-PackageProvider -Name NuGet
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
                
                $modulesInstalled = $True
                break
    } catch {
                Write-Output "Failed to install DSC modules. PowerShell Gallery unavailable could happen due to Microsoft updating site certificate. Please retry after sometime"
                $installPSModulesTries++
        }
    }
    else {
            "Installing from packaged modules downloaded from s3"
            Write-Output "Installing from packaged modules downloaded from s3"
            Unblock-File -Path "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
            $destinationPath = "C:\Program Files\PackageManagement\ProviderAssemblies"
            $destinationPathExists = Test-Path -Path $destinationPath
            if($destinationPathExists -eq $False) {
                New-Item -ItemType Directory -Path $destinationPath -Force
            }
            Copy-Item "C:\cfn\Installer\dependent-packages\powershell\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll" -Destination $destinationPath -Recurse -Force
            $sourcelocation = 'C:\cfn\Installer\dependent-packages\powershell'
            try { 
            Import-PackageProvider -Name NuGet

            "Installing the needed Powershell DSC modules for this Quick Start"
            Register-PSRepository -Name 'Modules' -SourceLocation $sourcelocation -InstallationPolicy Trusted

            Install-Module -Name ComputerManagementDsc -Repository 'Modules'
            Install-Module -Name "xFailOverCluster" -Repository 'Modules'
            Install-Module -Name PSDscResources -Repository 'Modules'
            Install-Module -Name xSmbShare -Repository 'Modules'
            Install-Module -Name "xActiveDirectory" -Repository 'Modules'
            Install-Module -Name "xDnsServer" -Repository 'Modules'
            Install-Module -Name 'NetworkingDsc' -Repository 'Modules'

            "Disabling Windows Firewall"
            Get-NetFirewallProfile | Set-NetFirewallProfile -Enabled False

            "Creating Directory for DSC Public Cert"
            New-Item -Path C:\cfn\dsc\publickeys -ItemType directory

            "Setting up DSC Certificate to Encrypt Credentials in MOF File"
            $cert = New-SelfSignedCertificate -Type DocumentEncryptionCertLegacyCsp -DnsName 'AWSLWDscEncryptCert' -HashAlgorithm SHA256
            # Exporting the public key certificate
            $cert | Export-Certificate -FilePath "C:\cfn\dsc\publickeys\AWSLWDscPublicKey.cer" -Force

            $modulesInstalled = $True
            break
    } catch {
            Write-Output "Failed to install DSC modules. PowerShell Galllery unavailable could happen due to Microsoft updating site certificate. Please retry after sometime"
            $installPSModulesTries++
        }
    }
    }

if($modulesInstalled -eq $False) {
    Write-Output "Failed to install DSC modules after a couple of attempts. PowerShell Galllery unavailable could happen due to Microsoft updating site certificate. Please retry after sometime"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId    
    $_ | Write-AWSLaunchWizardException
}
 
 
