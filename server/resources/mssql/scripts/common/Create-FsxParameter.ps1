[CmdletBinding()]
param(

    [Parameter(Mandatory=$false)]
    [string]$FSxID,

    [Parameter(Mandatory=$false)]
    [string]$Parentstackname
)
Import-Module -Name AWSPowerShell
try {
    $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | ConvertFrom-Json
    $FSxUserName = $SsmParameter.fsx.username
    $FSxPassword = $SsmParameter.fsx.password
    Write-SSMParameter -Name "/netapp/wlmdb/$FSxID" -Value "{fsx:{username:'$FSxUserName',password:'$FSxPassword'}}" -Type SecureString -Overwrite $true
}
catch {
    $_ | Write-AWSLaunchWizardException
}