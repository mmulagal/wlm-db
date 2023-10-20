[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$AdminSecret,

	[Parameter(Mandatory=$true)]
    [string]$SqlUserSecret,

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
    [string]$Stackname
)

try{
Start-Transcript -Path C:\cfn\log\preparefci.ps1.txt -Append
$ErrorActionPreference = "Stop"
$HostName = hostname

$DomainNetBIOSName = $env:USERDOMAIN
# Creating Credential Object for Administrator
$AdminUser = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $AdminSecret).SecretString
$ClusterAdminUser = $DomainNetBIOSName+'\'+$DomainAdminUser
$Credentials = (New-Object PSCredential($ClusterAdminUser,(ConvertTo-SecureString $AdminUser.Password -AsPlainText -Force)))

#Retrieving MSSQL service account
$SqlUserAccount = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $SqlUserSecret).SecretString
$SqlUserName = $DomainNetBIOSName + '\' + $SqlUser
$SqlUserPassword = $SqlUserAccount.Password

if((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002')
{
    #Acquiring MSSQL installation media from S3
Write-Output "Acquiring MSSQL installation media from S3 bucket and running PrepareFailoverCluster action"    
$mediaIsoPath = 'c:\cfn\mssql-setup-media\SQL_server.iso'
$mediaExtractPath = 'C:\SQLServerSetup'
    try{
        Copy-S3Object -BucketName $MSSQLMediaBucket -Key $MSSQLMediaKey -LocalFile $mediaIsoPath
    }catch{
        $_ | Write-AWSLaunchWizardException
    }
#Mounting and extracting installation media files
New-Item -Path $mediaExtractPath -ItemType Directory
$mountResult = Mount-DiskImage -ImagePath $mediaIsoPath -PassThru
$volumeInfo = $mountResult | Get-Volume
$driveInfo = Get-PSDrive -Name $volumeInfo.DriveLetter
Copy-Item -Path ( Join-Path -Path $driveInfo.Root -ChildPath '*' ) -Destination $mediaExtractPath -Recurse
Dismount-DiskImage -ImagePath $mediaIsoPath
    #Prepare FCI installation
$arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /SkipRules=Cluster_VerifyForErrors_Instance_Name /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
Invoke-Command -scriptblock {
    Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
} -Credential $Credentials -ComputerName $HostName -Authentication credssp
}
else {
Write-Output "Running PrepareFailoverCluster action"      
$arguments = '/ACTION="PrepareFailoverCluster" /SkipRules=Cluster_VerifyForErrors_Instance_Name /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /SkipRules=Cluster_VerifyForErrors_Instance_Name /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
Invoke-Command -scriptblock {
    Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 

} -Credential $Credentials -ComputerName $HostName -Authentication credssp
}
} catch {
        Write-Output "Failed to run prepare Failover cluster action for SQL installation"
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException
}
