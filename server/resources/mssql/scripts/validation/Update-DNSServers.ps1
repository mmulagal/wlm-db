[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$DNSIpAddresses
)

try {
    $ErrorActionPreference = "Stop"

    Start-Transcript -Path C:\cfn\log\$($MyInvocation.MyCommand.Name).log -Append

    $ADServersPrivateIPs = $DNSIpAddresses.split(",")
    $netIPConfiguration = Get-NetIPConfiguration
    Set-DnsClientServerAddress -InterfaceIndex $netIPConfiguration.InterfaceIndex -ServerAddresses $DNSIpAddresses
}
catch {
    $_ | Write-AWSLaunchWizardException
}