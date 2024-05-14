[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]
    $DomainAdminUser,
    
    [Parameter(Mandatory=$true)]
    [string]
    $NetBIOSName,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)

try
{
    Start-Transcript -Path C:\cfn\log\setsqlinstancename.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $DomainNetBIOSName = $env:USERDOMAIN

    $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    #$DomainAdminPassword = (Get-SSMParameterValue -Names $DomainAdminPasswordKey -WithDecryption $True).Parameters[0].Value
    #$DomainAdminSecurePassword = ConvertTo-SecureString $DomainAdminPassword -AsPlainText -Force
    #$DomainAdminCreds = New-Object System.Management.Automation.PSCredential($DomainAdminFullUser, $DomainAdminSecurePassword)
    $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
    $DomainPassword = $SsmParameter.domain.password
    $pass = ConvertTo-SecureString $DomainPassword -AsPlainText -Force
    $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser,$pass))
    $renameinstance = {
        $query = "
DECLARE @InternalInstanceName sysname;
DECLARE @MachineInstanceName sysname;
SELECT @InternalInstanceName = @@SERVERNAME,
@MachineInstanceName = CAST(SERVERPROPERTY('MACHINENAME') AS VARCHAR(128)) + COALESCE('\' + CAST(SERVERPROPERTY('INSTANCENAME') AS VARCHAR(128)), '');
IF @InternalInstanceName <> @MachineInstanceName
BEGIN EXEC sp_dropserver @InternalInstanceName;
EXEC sp_addserver @MachineInstanceName,
'LOCAL';
END"
        Invoke-Sqlcmd -Query $query -TrustServerCertificate
    }
    Invoke-Command -Authentication Credssp -Scriptblock $renameinstance -ComputerName $NetBIOSName -Credential $DomainAdminCreds

    # Get SQL server instance name
    $SQLServiceList = Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}
    $SQLInstanceName = "MSSQLSERVER"
    $SQLInstanceNames = @()
    ForEach ($sqlService in $sqlServiceList) {
    $sqlServiceBinaryPath = $sqlService.PathName  -Replace "-s.*", ""
      If (Test-Path $sqlServiceBinaryPath.Replace('"', '')) {
        $SqlVersion = Invoke-Expression -Command "(dir $sqlServiceBinaryPath).VersionInfo"}
        $ValidSqlVersion = $SqlVersion.ProductVersion -match '^1[3-9]'
        If ($ValidSqlVersion -eq $true) {
        $SQLInstanceNames +=$sqlService.Name 
        }} 

    If ($SQLInstanceNames -NotContains "MSSQLSERVER") {
        $SQLInstanceName = $SQLInstanceNames[0]
    }
    
    try {
        # Custom ami may not have sql server agent installed
        Stop-Service SQLSERVERAGENT -Force
        Start-Service SQLSERVERAGENT
    }catch{
        Write-Host "Error while starting/stopping SQLSERVERAGENT. Error: $_"
    }
    Stop-Service $SQLInstanceName -Force
    Start-Service $SQLInstanceName
}
Catch
    {
        $_ | Write-AWSLaunchWizardException
    }
