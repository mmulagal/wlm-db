[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]
    $NetBIOSName,

    [Parameter(Mandatory=$true)]
    [string]
    $DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname,

    [Parameter(Mandatory=$false)]
    [string]
    $dop="4"

)

try {
    Start-Transcript -Path C:\cfn\log\SetMaxDOP.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $DomainNetBIOSName = $env:USERDOMAIN
    #$DomainAdminPassword = (Get-SSMParameterValue -Names $DomainAdminPasswordKey -WithDecryption $True).Parameters[0].Value
    #$DomainAdminSecurePassword = ConvertTo-SecureString $DomainAdminPassword -AsPlainText -Force
    #$DomainAdminCreds = New-Object System.Management.Automation.PSCredential($DomainAdminFullUser, $DomainAdminSecurePassword)
    $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
    $DomainPassword = $SsmParameter.domain.password
    $pass = ConvertTo-SecureString $DomainPassword -AsPlainText -Force
    $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser,$pass))

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
            $InstanceName =  $sqlService.Name.Replace("MSSQL$", "") 
            $SQLInstanceNames += $InstanceName
        }} 

    If ($SQLInstanceNames -NotContains "MSSQLSERVER") {
        $SQLInstanceName = $SQLInstanceNames[0]
    }
    Write-Output "SQL instance name $SQLInstanceName."

    # Instance name to be passed to Invoke-sqlcmd
    $ServerInstanceName = "$env:COMPUTERNAME"
    If($SQLInstanceName -ne "MSSQLSERVER") {
         $ServerInstanceName = "$env:COMPUTERNAME\$SQLInstanceName"
         
    }
    Write-Output "Sql server name $ServerInstanceName."

    $SetupMaxDOPPs={
        $sql = "EXEC sp_configure 'show advanced options', 1; RECONFIGURE WITH OVERRIDE; EXEC sp_configure 'max degree of parallelism', " + $Using:dop + "; RECONFIGURE WITH OVERRIDE; "
        Import-Module SQLPS
        Invoke-Sqlcmd -AbortOnError -ErrorAction Stop -Query $sql -ServerInstance $Using:ServerInstanceName
    }

    Invoke-Command -Authentication Credssp -Scriptblock $SetupMaxDOPPs -ComputerName $NetBIOSName -Credential $DomainAdminCreds

}
catch {
    $_ | Write-AWSLaunchWizardException
}
