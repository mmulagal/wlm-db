[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$FSxID,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)
Import-Module -Name AWSPowerShell
try {
    $SsmParameter = C:\cfn\scripts\common\FetchCredFromSSM.ps1 -ResourceName $Parentstackname
    $FSxUserName = $SsmParameter.fsx.username
    $FSxPassword = $SsmParameter.fsx.password
    try {
    Write-SSMParameter -Name "/netapp/wlmdb/$FSxID" -Value "{fsx:{username:'$FSxUserName',password:'$FSxPassword'}}" -Type SecureString -Overwrite $true
    } catch {
        Write-Output $_.Exception.Message
        if($_.Exception.Message -match "Rate Limit exceeded") {
            Write-Output "Encountered Rate Limit exceeded while creating SSM parameter. Reattempting after 5 seconds..."
            Start-Sleep 5
            Write-SSMParameter -Name "/netapp/wlmdb/$FSxID" -Value "{fsx:{username:'$FSxUserName',password:'$FSxPassword'}}" -Type SecureString -Overwrite $true
        }
    }
}
catch {
    Write-Output @{ status = "Failed"; reason = $_ } | ConvertTo-Json -Compress
}