[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$DNSIpAddresses,

    [Parameter(Mandatory = $true)]
    [string]$Stackname,

    [Parameter(Mandatory = $true)]
    [string]$ResourceID,

    [Parameter(Mandatory = $true)]
    [string]$WaitHandler   
)

try {
    $ErrorActionPreference = "Stop"

    Start-Transcript -Path C:\cfn\log\$($MyInvocation.MyCommand.Name).log -Append

    #get Instance ID
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
    $instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

    #Check if DNS server is reachable   
    $Failed = $false           
    $connection = Test-Connection -ComputerName $DNSIpAddresses -Quiet
    if (-Not($True -in $connection))
        {
            Failed = $true
            $FailureReason = '"{0}"' -f "Unable to reach DNS Servers $DNSIpAddresses"
            Write-Output @{status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
            Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
            Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
            exit(1)
        }

    $ADServersPrivateIPs = $DNSIpAddresses.split(",")
    $netIPConfiguration = Get-NetIPConfiguration
    Set-DnsClientServerAddress -InterfaceIndex $netIPConfiguration.InterfaceIndex -ServerAddresses $DNSIpAddresses
    if ($Failed -ne $true) 
        {
            Write-Output @{ status = "Completed"; reason = "Done." } | ConvertTo-Json -Compress
            Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
        }
}
catch {
    $_ | Write-AWSLaunchWizardException
}