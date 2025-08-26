[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$DomainDNSName,

    [Parameter(Mandatory = $false)]
    [string]$DCName,

    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountUser,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname,

    [Parameter(Mandatory=$false)]
    [string]$ADServerNetBIOSName=$env:COMPUTERNAME

)

if($DCName -eq "default" -or $DCName -eq "no-value") {
        $DCName = ''
}

    try {
        Start-Transcript -Path C:\cfn\log\Create-ADServiceAccount.ps1.txt -Append
        $ErrorActionPreference = "Stop"
        $DomainNetBIOSName = $env:USERDOMAIN
        $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
        $ServiceAccountFullUser = $DomainNetBIOSName + '\' + $ServiceAccountUser
        $ScriptsPath =  Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
        . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
        $SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
        $DomainAdminSecurePassword = $SsmParameter.domain.password
        $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser,(ConvertTo-SecureString $DomainAdminSecurePassword -AsPlainText -Force)))
        $ServiceAccountPassword = $SsmParameter.sql[0].password
        $ServiceAccountSecurePassword = ConvertTo-SecureString $ServiceAccountPassword -AsPlainText -Force
        $UserPrincipalName = $ServiceAccountUser + "@" + $DomainDNSName

       $createUserSB = {
            $ErrorActionPreference = "Stop"
            if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
                Install-WindowsFeature RSAT-AD-PowerShell -ErrorAction SilentlyContinue *>$null
            }
            Write-Host "Searching for user $Using:ServiceAccountUser"
            $adUserParams = @{
                Filter = {sAMAccountName -eq $Using:ServiceAccountUser}
            }
            if (-not [string]::IsNullOrEmpty($Using:DCName)) {
                $adUserParams.Server = $Using:DCName
            }

            $userExists = Get-ADUser @adUserParams -ErrorAction SilentlyContinue

            if ($userExists) {
                Write-Host "User already exists."
            } else {
                Write-Host "Creating user $Using:ServiceAccountUser"
                $newUserParams = @{
                    Name               = $Using:ServiceAccountUser
                    UserPrincipalName  = $Using:UserPrincipalName
                    AccountPassword    = $Using:ServiceAccountSecurePassword
                    Enabled            = $true
                    PasswordNeverExpires = $true
                }
                if (-not [string]::IsNullOrEmpty($Using:DCName)) {
                    try {
                        New-ADUser -Server $Using:DCName @newUserParams
                    } catch {
                        Write-Host "Failed to create user $Using:ServiceAccountUser with $Using:DCName. Falling back to default DC."
                        New-ADUser @newUserParams
                    }
                } else {
                    New-ADUser @newUserParams
                }
            }
        }
        Write-Host "Invoking command on $ADServerNetBIOSName"
        Invoke-Command -ScriptBlock $createUserSB -ComputerName $ADServerNetBIOSName -Credential $DomainAdminCreds -Authentication Credssp
    }
catch {
    $_ | Write-AWSLaunchWizardException
}

