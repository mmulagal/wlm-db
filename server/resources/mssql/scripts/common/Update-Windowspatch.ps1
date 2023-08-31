
[CmdletBinding()]

$ErrorActionPreference = "Stop"
Start-Transcript -Path C:\cfn\log\Update-WindowsPatch.ps1.txt -Append

try{
    $version = Get-ComputerInfo
    If ($version.WindowsProductName -like '*2019*')
    {
        Import-Module WindowsUpdateProvider
        $updatestoinstall = Start-WUScan -SearchCriteria "Type='Software' AND IsInstalled=0"
        $updatestoinstall | Out-File C:\cfn\log\availablewindowsupdates.txt
        Install-WUUpdates -Updates $updatestoinstall
        Get-HotFix | Out-File C:\cfn\log\installedupdates.txt

    } else 
    {    
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
        Install-PackageProvider -Name "NuGet" -RequiredVersion "2.8.5.208" -Force -Confirm:$false
        Install-Module PSWindowsUpdate -Force -Confirm:$false 
        Get-WindowsUpdate | Out-File C:\cfn\log\availablewindowsupdates.txt
        Install-WindowsUpdate -WindowsUpdate -AcceptAll -AutoReboot
    }
}catch {
    Write-Output "Windows updates Install failed"
    exit 0
}

#restart computer for patching
C:\cfn\scripts\common\Restart-Computer.ps1