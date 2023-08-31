#Install Powershell 7
    Start-Transcript -Path C:\cfn\log\installpowershell.ps1.txt -Append
    $ErrorActionPreference = "Stop"
try{
 msiexec.exe /package "C:\cfn\Installer\powershell\powershell7.msi" /quiet /forcerestart ADD_EXPLORER_CONTEXT_MENU_OPENPOWERSHELL=1 ENABLE_PSREMOTING=1 REGISTER_MANIFEST=1 USE_MU=1 ENABLE_MU=1
}catch{
    $_ | Write-AWSLaunchWizardException
}
