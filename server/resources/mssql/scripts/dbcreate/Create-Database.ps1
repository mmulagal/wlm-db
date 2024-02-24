 #Requires -Module AWS.Tools.SimpleSystemsManagement 
     
param(
  [Parameter(Mandatory = $true)]
  [string]$SQLServer,

  [Parameter(Mandatory = $true)]
  [string]$DBName,

  [Parameter(Mandatory = $true)]
  [string]$DataPath,  

  [Parameter(Mandatory = $true)]
  [string]$LogPath,

  [Parameter(Mandatory = $false)]
  [string]$InstanceName,

  [Parameter(Mandatory = $false)]
  [string]$ResourceID
)

$createlog = (New-Item -ItemType Directory -Path C:\cfn\log -Force)
$silenttranscript = (Start-Transcript -Path C:\cfn\log\Create_Database.log.txt -Append)
$ErrorActionPreference = "Stop"
$result = @{}
$DataPathExists = Test-Path -Path $DataPath
$LogPathExists = Test-Path -Path $LogPath

#Fetch Data and Log file names

$DataFile= Split-Path $DataPath -leaf
$LogFile= Split-Path $LogPath -leaf
$found1 = $DataFile -match '(.+?)\.'
if ($found1) {$DataLogicalName = $matches[1]}
$found2 = $LogFile -match '(.+?)\.'
if ($found2) {$LogLogicalName = $matches[1]}

#In the event of same logical name for log and data due to same OS file name
if ($DataLogicalName -eq $LogLogicalName) {
   $DataLogicalName = $DBName + "_DATA"
   $LogLogicalName = $DBName + "_LOG"
}

#Decrypt SSM Parameter for SQL Username and password
if ($ResourceID) { 
  $SQLCredStore = "/netapp/wlmdb/$ResourceID"
  try {
  $credobject =  (Get-SSMParameter -Name $SQLCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 
  $instancelist = $credobject.sql.sqlinstancename
  $instancecount = $instancelist.Count
  if($instancecount -eq 1) {
    $Dbuser = $credobject.sql.username
    $Dbpass = $credobject.sql.password 
  } else {
    $instance = $InstanceName.ToLower() 
    $index = $credobject.sql.sqlinstancename.ToLower().IndexOf($instance) 
    
    $Dbuser = $credobject.sql.username[$index] 
    $Dbpass = $credobject.sql.password[$index] 
  }

  } catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to get SQL credentials from SSM Parameter')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1 
  }

}

#Moved from Invoke-Sqlcmd to Sqlcmd as Invoke-Sqlcmd required ConnectionString parameter to pass trusted connection and trust certificate for version > 2016
#The parameter is not supported in 2016 and without that works in 2016 but not higher versions
#Unlike Invoke-Sqlcmd, Sqlcmd NEVER returns error on failure back to shell. Hence the roundabout work to redirect to error file and capture
#In case of reusing existing drives check if data/log file name exists in path already
try {
if ($DataPathExists -Or $LogPathExists) { throw }  
} catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Data or Log file with provided name already exists')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
}

#Check if database name already exists
try {

  $Dblisterrlog = 'C:\cfn\log\dblist_err.log'
if ($ResourceID) { 
  $dblist =(Sqlcmd  -S $SQLServer -U $Dbuser -P $Dbpass -Q "SET NOCOUNT ON;SELECT name FROM sys.databases" -y 0 -r1 2> $Dblisterrlog)
  if (Get-Content $Dblisterrlog) {throw}
}
else {
  $dblist = (Sqlcmd -S $SQLServer -Q "SET NOCOUNT ON;SELECT name FROM sys.databases" -y 0 -r1 2> $Dblisterrlog)
  if (Get-Content $Dblisterrlog) {throw}
} }
catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Unable to connect to SQL Server')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
}
try {
if ($dblist -Contains $DBName) {
    throw
} } catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Database name already exists on Server')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
}
#create directory structure required
$DataDir = [System.IO.Path]::GetDirectoryName($DataPath) 
$LogDir = [System.IO.Path]::GetDirectoryName($LogPath) 

$datadircreate = (New-Item -ItemType Directory -Path $DataDir -Force)
$logdircreate = (New-Item -ItemType Directory -Path $LogDir -Force)


try {
  #Query to create database with required data and log path
  $Query = 'SET NOCOUNT ON;CREATE DATABASE '+$DBName+' ON (NAME = '+$DataLogicalName+',FILENAME = '''+$DataPath+''') LOG ON (NAME = '+$LogLogicalName+',FILENAME = '''+$LogPath+''')'
  $Dbcreatelog = 'C:\cfn\log\dbcreate.log'
  $Dbcreateerrlog = 'C:\cfn\log\dbcreate_err.log'
  if ($ResourceID) {
    #Execute DB create query with SQL user authentication
    $invokecreate = (Sqlcmd  -S $SqlServer -U $Dbuser -P $Dbpass -Q "$Query" -y 0  -r1 2> $Dbcreateerrlog 1> $Dbcreatelog)
    $ErrorExists = Test-Path -Path C:\cfn\log\dblist_err.log
    if (Get-Content $Dbcreateerrlog) {throw} 

  }
  else {
  #Execute DB create query with trusted connection(Windows authentication). If you omit the server, it will default to localhost.
  $invokecreate = (Sqlcmd  -S $SqlServer -Q "$Query" -y 0  -r1 2> $Dbcreateerrlog 1> $Dbcreatelog)
  if (Get-Content $Dbcreateerrlog) {throw} 
  }
  
    }
catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to create database on Server')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
      }
     
$result.Add('Status','Complete')
$result.Add('Message','Successfully created database on SQL Server')
$resultjson = ($result | ConvertTo-Json) 
$resultjson 