[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DomainDNSName,

    [Parameter(Mandatory = $false)]
    [string]$DCName,

    [Parameter(Mandatory = $false)]
    [string]$OUPath,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)

try {
$ErrorActionPreference = "Stop"
Start-Transcript -Path C:\cfn\log\$($MyInvocation.MyCommand.Name).log -Append

$env:PSModulePath += ';C:\Windows\system32\WindowsPowerShell\v1.0\Modules\aws_ssm'
    if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
        Install-WindowsFeature RSAT-AD-PowerShell -ErrorAction SilentlyContinue *>$null
    } 


# Getting Password from SSM parameter store for AD Admin User
$ScriptsPath =  Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
. "$ScriptsPath\common\InvokeRetryCommand.ps1" 
$SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
$ADAdminPassword = $SsmParameter.domain.password
# Creating Credential Object for Administrator
$AdminUserName = $DomainNetBIOSName+"\"+$DomainAdminUser
$AdminUserPW = ConvertTo-SecureString ($ADAdminPassword) -AsPlainText -Force
$Credentials = New-Object -TypeName 'System.Management.Automation.PSCredential' ($AdminUserName, $AdminUserPW)
Import-Module ActiveDirectory *>$null

if([string]::IsNullOrEmpty($DCName)) {
    #Try to fetch a Domain Controller name that can connect to the directory service if preferred DC is not passed 
    $DCName = (Get-ADDomainController -Discover -Domain $DomainName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty HostName)
    }
if ([string]::IsNullOrEmpty($DCName) -and [string]::IsNullOrEmpty($OUPath)) {
    # Join the computer to default OU 
    Add-Computer -DomainName $DomainDNSName -Credential $Credentials -ErrorAction Stop
}
elseif ([string]::IsNullOrEmpty($DCName) -and -not [string]::IsNullOrEmpty($OUPath)) {
    # Join the computer to the specified OU 
    Add-Computer -DomainName $DomainDNSName -OUPath $OUPath -Credential $Credentials -ErrorAction Stop
}
elseif (-not [string]::IsNullOrEmpty($DCName) -and [string]::IsNullOrEmpty($OUPath)) {
    # Join the computer to default OU using the preferred Domain Controller
    Add-Computer -DomainName $DomainDNSName -Server $DCName -Credential $Credentials -ErrorAction Stop 
}
else {
    # Join the computer to the specified OU using the preferred Domain Controller
    Add-Computer -DomainName $DomainDNSName -Server $DCName -OUPath $OUPath -Credential $Credentials -ErrorAction Stop
}
}
catch {
    $_ | Write-AWSLaunchWizardException
}

# restart computer to make joining domain effective
C:\cfn\scripts\common\Restart-Computer.ps1
