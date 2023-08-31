[CmdletBinding()]
param(
    [string]
    $DomainName,

    [string]
    $UserName,

    [string]
    $DomainAdminPasswordKey
)

try {
    $ErrorActionPreference = "Stop"

    $DomainAdminFullUser = $DomainName + '\' + $UserName
    #$secure = (Get-SSMParameterValue -Names $DomainAdminPasswordKey -WithDecryption $True).Parameters[0].Value
    #$pass = ConvertTo-SecureString $secure -AsPlainText -Force
    $AdminUser = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $DomainAdminPasswordKey).SecretString
    $pass = ConvertTo-SecureString $AdminUser.Password -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential -ArgumentList $DomainAdminFullUser,$pass

    Add-Computer -DomainName $DomainName -Credential $cred -ErrorAction Stop
}
catch {
    $_ | Write-AWSLaunchWizardException
}

# restart computer to make joining domain effective
C:\cfn\scripts\common\Restart-Computer.ps1
