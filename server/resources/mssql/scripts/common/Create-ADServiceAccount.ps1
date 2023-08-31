[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminPasswordKey,

    [Parameter(Mandatory=$true)]
    [string]$DomainDNSName,

    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountUser,

    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountPasswordKey,

    [Parameter(Mandatory=$false)]
    [string]$ADServerNetBIOSName=$env:COMPUTERNAME

)

try {
    Start-Transcript -Path C:\cfn\log\Create-ADServiceAccount.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $DomainNetBIOSName = $env:USERDOMAIN

    $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $ServiceAccountFullUser = $DomainNetBIOSName + '\' + $ServiceAccountUser
    #$DomainAdminSecurePassword = (Get-SSMParameterValue -Names $DomainAdminPasswordKey -WithDecryption $True).Parameters[0].Value | ConvertTo-SecureString -AsPlainText -Force
    #$DomainAdminCreds = New-Object System.Management.Automation.PSCredential($DomainAdminFullUser, $DomainAdminSecurePassword)
    $AdminUser = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $DomainAdminPasswordKey).SecretString
    $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser,(ConvertTo-SecureString $AdminUser.Password -AsPlainText -Force)))
    #$ServiceAccountPassword = (Get-SSMParameterValue -Names $ServiceAccountPasswordKey -WithDecryption $True).Parameters[0].Value
    $ServiceAccountPassword = (ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $ServiceAccountPasswordKey).SecretString).password
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
            # Ensure that password is correct for the user
            if ((New-Object System.DirectoryServices.DirectoryEntry "", $Using:ServiceAccountFullUser, $Using:ServiceAccountPassword).PSBase.Name -eq $null) {
                throw "The password for $Using:ServiceAccountUser is incorrect"
            }
        } else {
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
