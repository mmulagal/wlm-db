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
  [string]$ResourceID
)

New-Item -ItemType Directory -Path C:\cfn\log -Force
Start-Transcript -Path C:\cfn\log\Create_Database.log.txt -Append
$ErrorActionPreference = "Stop"
$result = @{}
$DataPathExists = Test-Path -Path $DataPath
$LogPathExists = Test-Path -Path $LogPath

#Fetch Data and Log file names

$DataFile= Split-Path $DataPath -leaf
$LogFile= Split-Path $LogPath -leaf
$found1 = $DataFile -match '(.+?)\.'
if ($found1) {$DataFileName = $matches[1]}
$found2 = $LogFile -match '(.+?)\.'
if ($found2) {$LogFileName = $matches[1]}

#Decrypt SSM Parameter for SQL Username and password
if ($ResourceID) { 
  $SQLCredStore = "/netapp/wlmdb/$ResourceID"
  try {
  $credobject =  (Get-SSMParameter -Name $SQLCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 
  $instance = $SQLServer.ToLower() 
  $index = $credobject.sql.sqlinstancename.ToLower().IndexOf($instance) 

  $Dbuser = $credobject.sql.username[$index] 
  $Dbpass = $credobject.sql.password[$index] 
  } catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to get SQL credentials from SSM Parameter')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1 
  }

}

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
if ($ResourceID) { 
  $dblist =(Invoke-Sqlcmd  -ServerInstance $SqlServer -Username $Dbuser -Password $Dbpass -Query "SELECT name FROM sys.databases").name
}
else {
  $dblist = (Invoke-Sqlcmd -ServerInstance $SqlServer -Query "SELECT name FROM sys.databases").name
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

New-Item -ItemType Directory -Path $DataDir -Force
New-Item -ItemType Directory -Path $LogDir -Force


try {
  #Query to create database with required data and log path
  $Query = 'CREATE DATABASE '+$DBName+' ON (NAME = '+$DataFileName+',FILENAME = '''+$DataPath+''') LOG ON (NAME = '+$LogFileName+',FILENAME = '''+$LogPath+''')'
  
  if ($ResourceID) {
    #Execute a query with SQL user authentication
    Invoke-Sqlcmd  -ServerInstance $SqlServer -Username $Dbuser -Password $Dbpass -Query "$Query"

  }
  else {
  #Execute a query with trusted connection(Windows authentication). If you omit the server, it will default to localhost.
  Invoke-Sqlcmd  -ServerInstance $SqlServer -Query "$Query"
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

  

 
 
 
 
 
