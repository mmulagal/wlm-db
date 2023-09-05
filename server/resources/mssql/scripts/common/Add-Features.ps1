[CmdletBinding()]
param()

Start-Transcript -Path C:\cfn\log\Add-Features.ps1.txt -Append
$ErrorActionPreference = "Stop"

try {
    Add-WindowsFeature RSAT-ADDS-Tools
    Add-WindowsFeature RSAT-AD-PowerShell
}
catch {
    $_ | Write-AWSLaunchWizardException
}