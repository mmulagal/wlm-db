[CmdletBinding()]
param(
)
Import-Module -Name AWSPowerShell
try {
    . .\InvokeRetryCommand.ps1
    $SsmParameter = Invoke-WithRetry -Command {
        (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
    }
    $FSxUserName = $SsmParameter.fsx.username
    $FSxPassword = $SsmParameter.fsx.password
    Invoke-WithRetry -Command {
        Write-SSMParameter -Name "/netapp/wlmdb/$FSxID" -Value "{fsx:{username:'$FSxUserName',password:'$FSxPassword'}}" -Type SecureString -Overwrite $true
    }
}
catch {
    Write-Output @{ status = "Failed"; reason = $_ } | ConvertTo-Json -Compress
}