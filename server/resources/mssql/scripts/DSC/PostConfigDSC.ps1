 [CmdletBinding()]
param()

try {
    $ErrorActionPreference = "SilentlyContinue"
    #Set Powershell connection encryption to TLS 1.2
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    # Allow Powershell to download resources from PSGallery

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
       $sourcelocation = 'C:\Users\Administrator\Downloads\Installers'

       # Install necessary PowerShell modules
       Install-Module -Name SqlServerDsc
    }
    else {
        "Installing from packaged modules downloaded from s3"
        Write-Output "Installing from packaged modules downloaded from s3"
        Unblock-File -Path "C:\cfn\Installer\powershell\modules\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
        Copy-Item "C:\cfn\Installer\powershell\modules\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll" -Destination "C:\Program Files\PackageManagement\ProviderAssemblies" -Recurse -Force
        $sourcelocation = 'C:\cfn\Installer\dependent-packages\dsc'

        Register-PSRepository -Name 'DSC' -SourceLocation $sourcelocation -InstallationPolicy Trusted

        # Install necessary PowerShell modules
        Install-Module -Name SqlServerDsc -Repository 'DSC'
    }

    # Configure SQLAddAdmins
    $AddAdminPath = 'C:\cfn\DSC\SQLAddAdmins'
    C:\cfn\DSC\BuildCompositeResources.ps1 -ModuleName SQLAddAdmins -InputPath "$AddAdminPath\Scripts\"
    . $AddAdminPath\SQLAddAdmins.ps1 ; SQLAddAdmins -Computername $env:COMPUTERNAME -OutputPath $AddAdminPath
    Start-DscConfiguration -Path $AddAdminPath -Computername $env:COMPUTERNAME -Wait -Force

}
catch {
    # Write-AWSLaunchWizardException along with writing to log sends failure signal to cfn, remove call to Write-AWSLaunchWizardException
    # Log failures but do not fail on it
    return 0
} 
