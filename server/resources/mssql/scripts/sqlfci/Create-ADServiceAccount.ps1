[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$DomainDNSName,

    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountUser,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname,

    [Parameter(Mandatory=$false)]
    [string]$ADServerNetBIOSName=$env:COMPUTERNAME

)
    try {
        Start-Transcript -Path C:\cfn\log\Create-ADServiceAccount.ps1.txt -Append
        $ErrorActionPreference = "Stop"
        $DomainNetBIOSName = $env:USERDOMAIN
        $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
        $ServiceAccountFullUser = $DomainNetBIOSName + '\' + $ServiceAccountUser
        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $DomainAdminSecurePassword = $SsmParameter.domain.password
        $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser,(ConvertTo-SecureString $DomainAdminSecurePassword -AsPlainText -Force)))
        $ServiceAccountPassword = $SsmParameter.sql[0].password
        $ServiceAccountSecurePassword = ConvertTo-SecureString $ServiceAccountPassword -AsPlainText -Force
        $UserPrincipalName = $ServiceAccountUser + "@" + $DomainDNSName
       $createUserSB = {
            $ErrorActionPreference = "Stop"
            if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
                Install-WindowsFeature RSAT-AD-PowerShell
            }
            Write-Host "Searching for user $Using:ServiceAccountUser"
            if (Get-ADUser -Filter {sAMAccountName -eq $Using:ServiceAccountUser}) {
                Write-Host "User already exists."
                }
            else {
                Write-Host "Creating user $Using:ServiceAccountUser"
                New-ADUser -Name $Using:ServiceAccountUser -UserPrincipalName $Using:UserPrincipalName -AccountPassword $Using:ServiceAccountSecurePassword -Enabled $true -PasswordNeverExpires $true
            }
        }
        Write-Host "Invoking command on $ADServerNetBIOSName"
        Invoke-Command -ScriptBlock $createUserSB -ComputerName $ADServerNetBIOSName -Credential $DomainAdminCreds -Authentication Credssp
    }
catch {
    $_ | Write-AWSLaunchWizardException
}

