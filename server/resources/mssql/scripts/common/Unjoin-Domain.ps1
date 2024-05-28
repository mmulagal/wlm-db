[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)
try {
    # Getting Password from Secrets Manager for AD Admin User
    $Hostname = hostname
    $DomainNetBIOSName = $env:USERDOMAIN
    $IsPartOfDomain = (Get-CimInstance win32_computersystem).PartOfDomain  
    Write-Host "Hostname $Hostname. User domain  $DomainNetBIOSName. IsPartOfDomain $IsPartOfDomain."  
    if($IsPartOfDomain -eq $True) {
        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $AdminUsername = $SsmParameter.domain.username
        $AdminPassword = $SsmParameter.domain.password
        $pass = ConvertTo-SecureString $AdminPassword -AsPlainText -Force
        $cred = New-Object System.Management.Automation.PSCredential -ArgumentList $AdminUsername, $pass
        $pc = hostname
        Remove-Computer -ComputerName $pc -Credential $cred -PassThru -Verbose -Force
    }
}
catch
{
    $_ | Write-AWSLaunchWizardException

}