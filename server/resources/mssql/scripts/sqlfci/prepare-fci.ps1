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
    [string]$Parentstackname,

    [Parameter(Mandatory=$true)]
    [string]$SqlCollation
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

# if((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002')
# {
#     #Acquiring MSSQL installation media from S3
# Write-Output "Acquiring MSSQL installation media from S3 bucket and running PrepareFailoverCluster action"    
# $mediaIsoPath = 'c:\cfn\mssql-setup-media\SQL_server.iso'
# $mediaExtractPath = 'C:\SQLServerSetup'
#     try{
#         Copy-S3Object -BucketName $MSSQLMediaBucket -Key $MSSQLMediaKey -LocalFile $mediaIsoPath
#     }catch{
#         $_ | Write-AWSLaunchWizardException
#     }
# #Mounting and extracting installation media files
# New-Item -Path $mediaExtractPath -ItemType Directory
# $mountResult = Mount-DiskImage -ImagePath $mediaIsoPath -PassThru
# $volumeInfo = $mountResult | Get-Volume
# $driveInfo = Get-PSDrive -Name $volumeInfo.DriveLetter
# Copy-Item -Path ( Join-Path -Path $driveInfo.Root -ChildPath '*' ) -Destination $mediaExtractPath -Recurse
# Dismount-DiskImage -ImagePath $mediaIsoPath
#     #Prepare FCI installation
# $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
# Invoke-Command -scriptblock {
#     Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
# } -Credential $Credentials -ComputerName $HostName -Authentication credssp
# }
# else {
Write-Output "Running PrepareFailoverCluster action" 

Write-Output "https://learn.microsoft.com/en-us/answers/questions/1276441/invok-command-on-localhost-not-working"
Write-Output "DBS-2299: Enable PSRemoting Service to Start Automatic and Enable PSREmoting on both host" 
Set-Service winrm -StartupType Automatic
Start-Service winrm
Enable-PSRemoting -Force     

$arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
Invoke-Command -scriptblock {
    Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 

} -Credential $Credentials -ComputerName $HostName -Authentication credssp


Start-Sleep -Seconds 15
$Service = Get-Service -Name 'MSSQLSERVER' -ErrorAction SilentlyContinue
if ([string]::IsNullOrEmpty($Service)) {
    Start-Sleep -Seconds 180
    Write-Output "Configuring SQLServer(MSSQLSERVER) service by skipping Cluster verify errors. Validation of cluster and SQL service will be done at completion of configuration"
    # if((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002') {
    #     $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
    # }
    # else {
    #     $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
    # }

    Write-Output "https://learn.microsoft.com/en-us/answers/questions/1276441/invok-command-on-localhost-not-working"
    Write-Output "DBS-2299: Enable PSRemoting Service to Start Automatic and Enable PSREmoting on both host" 
    Set-Service winrm -StartupType Automatic
    Start-Service winrm
    Enable-PSRemoting -Force 

    $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
    Invoke-Command -scriptblock {
    Start-Service -Name 'Remote Registry'
    Start-Sleep -Seconds 180
    Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
    Stop-Service -Name 'Remote Registry'

} -Credential $Credentials -ComputerName $HostName -Authentication credssp
try {
$Service = Get-Service -Name 'MSSQLSERVER' 
}
catch {
        Write-Output "Failed to create SQLServer(MSSQLSERVER) service"
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException  
}
}
else {
    Write-Output "Configured SQL Server(MSSQLSERVER) successfully"
 }

 try {
    $rebuildarguments ='/QUIET /ACTION="REBUILDDATABASE" /INSTANCENAME="MSSQLSERVER" /SQLSYSADMINACCOUNTS="' + $ClusterAdminUser + '" /SAPWD="' + $AdminPassword + '" /SQLCOLLATION="' + $SqlCollation + '"'
    Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:rebuildarguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\rebuild_collation.txt 
    
 } catch {
    Write-Output "Failed to set collation on SQLServer(MSSQLSERVER)"
 }

} catch {
        Write-Output "Failed to run prepare Failover cluster action for SQL installation"
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException
}
 
