 [CmdletBinding()]
param(
	[Parameter(Mandatory=$true)]
    [string]$MSSQLMediaBucket,

	[Parameter(Mandatory=$true)]
    [string]$MSSQLMediaKey,

	[Parameter(Mandatory=$true)]
    [string]$AMIID,

    [Parameter(Mandatory=$true)]
    [string]$SqlUser,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname
)

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

try{
Start-Transcript -Path C:\cfn\log\preparefci.ps1.txt -Append
$ErrorActionPreference = "Stop"
$HostName = hostname

$DomainNetBIOSName = $env:USERDOMAIN
# Creating Credential Object for Administrator
$SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
$AdminPassword = $SsmParameter.domain.password
$ClusterAdminUser = $DomainNetBIOSName+'\'+$DomainAdminUser
$Credentials = (New-Object PSCredential($ClusterAdminUser,(ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))

#Retrieving MSSQL service account
$SqlUserName = $DomainNetBIOSName + '\' + $SqlUser
$SqlUserPassword = $SsmParameter.sql[0].password

Write-Output "Running PrepareFailoverCluster action" 

Write-Output "https://learn.microsoft.com/en-us/answers/questions/1276441/invok-command-on-localhost-not-working"
Write-Output "DBS-2299/2709: Enable PSRemoting Service to Start Automatic and Enable PSREmoting on both host" 
Set-Service winrm -StartupType Automatic
Start-Service winrm
Enable-PSRemoting -Force 

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
If(!$SQLInstanceName) {
    $SQLInstanceName = "MSSQLSERVER"
    }
Write-Output "SQL instance name $SQLInstanceName."

# Instance name to be passed to sqlcmd
$ServerInstanceName = "$env:COMPUTERNAME"
If($SQLInstanceName -ne "MSSQLSERVER") {
    $ServerInstanceName = "$env:COMPUTERNAME\$SQLInstanceName"
    
}
Write-Output "Sql server name $ServerInstanceName."

# Get service name
$ServiceName = 'MSSQLSERVER'
If($SQLInstanceName -ne "MSSQLSERVER") {
    $ServiceName =  'MSSQL${0}' -f $SQLInstanceName
        
}
Write-Host "SQL service name $ServiceName."

# Find path to SQL Installer media, if not found then pick installer hosted in S3.
if (Test-Path -Path "C:\SQLServerSetup\setup.exe") {
    $SQLMediaPath = "C:\SQLServerSetup\setup.exe"
}
else {
    $SQLMediaPath = 'C:\cfn\Installer\SQLServerSetup\setup.exe'
    If (Test-Path -path "C:\SQL*") {
        $SQLInstallerPaths = (Get-ChildItem "C:\SQL*" -Recurse | where {$_.name -eq "setup.exe"} ).fullname
        If($SQLInstallerPaths -is 'string')
        {
        $SQLMediaPath = $SQLInstallerPaths
        }
        Else {
        $SQLMediaPath = $SQLInstallerPaths[0]
        }
    } 
}

Write-Output "SQL Installer path $SQLMediaPath."
# Find path to SQL Installer media, if not found then pick installer hosted in S3.
if((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002')
{
    Write-Output "Base Windows ami: Running prepare fci from available or s3 downloaded sql installer."
    #Prepare FCI installation
    $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="'+ $SQLInstanceName +'" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="' + $SQLInstanceName +'" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
    try {
        Invoke-Command -scriptblock {
            Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
        } -Credential $Credentials -ComputerName $HostName -Authentication credssp
    }catch {
        $Service = Get-Service -Name "$Using:ServiceName" -ErrorAction SilentlyContinue
        if ([string]::IsNullOrEmpty($Service)) {
            Start-Sleep -Seconds 15
            Write-Output "Re-attempting PrepareFailoverCluster"
            Invoke-Command -scriptblock {
            Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
            } -Credential $Credentials -ComputerName $HostName -Authentication credssp
    }

    }
}
else {    
    try {
        $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="'+ $SQLInstanceName +'" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="' + $SQLInstanceName + '" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
        Invoke-Command -scriptblock {
            Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 

        } -Credential $Credentials -ComputerName $HostName -Authentication credssp
    }catch 
    {
        $Service = Get-Service -Name "$Using:ServiceName" -ErrorAction SilentlyContinue
        if ([string]::IsNullOrEmpty($Service)) {
            Start-Sleep -Seconds 15
            Write-Output "Re-attempting PrepareFailoverCluster"
            $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="' + $SQLInstanceName + '" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="' + $SQLInstanceName + '" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
            Invoke-Command -scriptblock {
            Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
            } -Credential $Credentials -ComputerName $HostName -Authentication credssp
        }
    }
}

Start-Sleep -Seconds 15
$Service = Get-Service -Name "$ServiceName" -ErrorAction SilentlyContinue
if ([string]::IsNullOrEmpty($Service)) {
    Start-Sleep -Seconds 180
    Write-Output "Configuring SQLServer($SQLInstanceName) service by skipping Cluster verify errors. Validation of cluster and SQL service will be done at completion of configuration"
    Write-Output "https://learn.microsoft.com/en-us/answers/questions/1276441/invok-command-on-localhost-not-working"
    Write-Output "DBS-2299: Enable PSRemoting Service to Start Automatic and Enable PSREmoting on both host" 
    Set-Service winrm -StartupType Automatic
    Start-Service winrm
    Enable-PSRemoting -Force 
    
    if((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002') {
        Write-Output "Base Windows ami: Re-attemting prepare fci from available or s3 downloaded sql installer."
        $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="' + $SQLInstanceName + '" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="' + $SQLInstanceName + '" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
    }
    else {
        $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="' + $SQLInstanceName + '" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="' + $SQLInstanceName + '" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
    }

    Invoke-Command -scriptblock {
    Start-Service -Name 'Remote Registry'
    Start-Sleep -Seconds 180
    Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
    Stop-Service -Name 'Remote Registry'

} -Credential $Credentials -ComputerName $HostName -Authentication credssp
try {
$Service = Get-Service -Name "$ServiceName" 
}
catch {
        Write-Output "Failed to create SQLServer($ServiceName) service"
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException  
}
}
else {
    Write-Output "Configured SQL Server($ServiceName) successfully"
 }

} catch {
        Write-Output "Failed to run prepare Failover cluster action for SQL installation"
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException
}
 
