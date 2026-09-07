[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$FSxID,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)

$awsToolsModule = 'AWS.Tools.SimpleSystemsManagement' 
if (Get-Module -ListAvailable -Name $awsToolsModule) {
    Import-Module -Name $awsToolsModule
}
elseif (Get-Module -ListAvailable -Name AWSPowerShell) {
    Import-Module -Name AWSPowerShell
}
else {
    throw "Neither $awsToolsModule nor AWSPowerShell is available."
} 

try {
    $ScriptsPath =  Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
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