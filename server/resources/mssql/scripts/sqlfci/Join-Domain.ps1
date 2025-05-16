[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DomainDNSName,

    [Parameter(Mandatory = $false)]
    [string]$DCName,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)

try {
$ErrorActionPreference = "Stop"
Start-Transcript -Path C:\cfn\log\$($MyInvocation.MyCommand.Name).log -Append

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
if([string]::IsNullOrEmpty($DCName)) {
        #If not able to fetch with Get-ADDomainController join domain directly without passing Domain server
        Add-Computer -DomainName $DomainDNSName -Credential $Credentials -ErrorAction Stop
} else {
        Add-Computer -DomainName $DomainDNSName -Server $DCName -Credential $Credentials -ErrorAction Stop 
 }
}
catch {
    $_ | Write-AWSLaunchWizardException
}

# restart computer to make joining domain effective
C:\cfn\scripts\common\Restart-Computer.ps1
