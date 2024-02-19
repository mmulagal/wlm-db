[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DomainDNSName,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)

try {
$ErrorActionPreference = "Stop"
Start-Transcript -Path C:\cfn\log\$($MyInvocation.MyCommand.Name).log -Append

# Getting Password from SSM parameter store for AD Admin User
$ADAdminPassword = (Get-SSMParameter -Name "/$Parentstackname/domain/password" -WithDecryption $True).Value
# Creating Credential Object for Administrator
$AdminUserName = $DomainNetBIOSName+"\"+$DomainAdminUser
$AdminUserPW = ConvertTo-SecureString ($ADAdminPassword.Password) -AsPlainText -Force
$Credentials = New-Object -TypeName 'System.Management.Automation.PSCredential' ($AdminUserName, $AdminUserPW)
Add-Computer -DomainName $DomainDNSName -Credential $Credentials -ErrorAction Stop
}
catch {
    $_ | Write-AWSLaunchWizardException
}

# restart computer to make joining domain effective
C:\cfn\scripts\common\Restart-Computer.ps1
