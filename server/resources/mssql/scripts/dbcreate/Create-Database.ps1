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
  $credobject =  (Get-SSMParameter -Name $SQLCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 
  $instance = $SQLServer.ToLower() 
  $index = $credobject.sql.instancename.ToLower().IndexOf($instance) 

  $Dbuser = $credobject.sql.username[$index] 
  $Dbpass = $credobject.sql.password[$index] 

}

#In case of reusing existing drives check if data/log file name exists in path already

if ($DataPathExists -Or $LogPathExists) {
    Write-Error "{Message:Data or Log file with provided name already exists,Exception:$_}"
}

#Check if database name already exists
if ($ResourceID) { 
  $dblist =(Invoke-Sqlcmd  -ConnectionString "Data Source=$SqlServer; User Id=$Dbuser; Password =$Dbpass;TrustServerCertificate=True" -Query "SELECT name FROM sys.databases").name
}
else {
  $dblist = (Invoke-Sqlcmd -ConnectionString "Data Source=$SQLServer; Integrated Security=True; TrustServerCertificate=True" -Query "SELECT name FROM sys.databases").name
}

if ($dblist -Contains $DBName) {
    Write-Error "{Message: Database name $DBName already exists on Server,Exception:$_}"
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
    Write-Output "Connecting with SQL User Authentication"
    #Execute a query with SQL credentials
    Invoke-Sqlcmd  -ConnectionString "Data Source=$SqlServer; User Id=$Dbuser; Password =$Dbpass;TrustServerCertificate=True" -Query "$Query"
    Write-Output "Created database $DBName with SQL user credentials"

  }
  else {
  Write-Output "Connecting with Windows Authentication"
  #Execute a query with trusted connection. If you omit the server, it will default to localhost.
  Invoke-Sqlcmd -ConnectionString "Data Source=$SQLServer; Integrated Security=True; TrustServerCertificate=True" -Query "$Query"
  Write-Output "Created database $DBName with Windows credentials" 
  }
  
    }
catch {
  Write-Error "{Message:A network-related or instance-specific error occurred while creating database in SQL Server, Error: $_ }"
      }
     


  

 
 
 
 
