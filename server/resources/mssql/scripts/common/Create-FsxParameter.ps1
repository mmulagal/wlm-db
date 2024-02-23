[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$FSxID,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)
Import-Module -Name AWSPowerShell
try {
    $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
    $FSxUserName = $SsmParameter.fsx.username
    $FSxPassword = $SsmParameter.fsx.password
    Write-SSMParameter -Name "/netapp/wlmdb/$FSxID" -Value "{fsx:{username:'$FSxUserName',password:'$FSxPassword'}}" -Type SecureString -Overwrite $true
}
catch {
    Write-Output @{ status = "Failed"; reason = $_ } | ConvertTo-Json -Compress
}