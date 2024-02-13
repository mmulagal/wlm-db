   
param(
  [Parameter(Mandatory = $true)]
  [string]$SQLServer,

  [Parameter(Mandatory = $true)]
  [string]$DBName,

  [Parameter(Mandatory = $true)]
  [string]$DataPath,  

  [Parameter(Mandatory = $true)]
  [string]$LogPath,

  [Parameter(Mandatory = $true)]
  [string]$DataFileName,  

  [Parameter(Mandatory = $true)]
  [string]$LogFileName,

  [Parameter(Mandatory = $false)]
  [string]$SQLPass,  

  [Parameter(Mandatory = $false)]
  [string]$SQLUser
)

Start-Transcript -Path C:\cfn\log\Create_Database.log.txt -Append
$ErrorActionPreference = "Stop"

$FileExists1 = Test-Path -Path $DataPath
$FileExists2 = Test-Path -Path $LogPath

#In case of reusing existing drives check if data/log file name exists in path already

if ($FileExists1 -Or $FileExists2) {
    Write-Error "Data or Log file with provided name already exists"
}

#Check if database name already exists
if ($SQLUser -ne "" -And $SQLPass -ne "") { 
  $dblist =(Invoke-Sqlcmd  -ConnectionString "Data Source=$SqlServer; User Id=$SQLUser; Password =$SQLPass;TrustServerCertificate=True" -Query "SELECT name FROM sys. databases").name
}
else {
  $dblist = (Invoke-Sqlcmd -ConnectionString "Data Source=$SQLServer; Integrated Security=True; TrustServerCertificate=True" -Query "SELECT name FROM sys. databases").name
}

if ($dblist -Contains $DBName) {
    Write-Error "Database name $DBName already exists on Server"
}
#create directory structure required
$DataDir = [System.IO.Path]::GetDirectoryName($DataPath) 
$LogDir = [System.IO.Path]::GetDirectoryName($LogPath) 

New-Item -ItemType Directory -Path $DataDir -Force
New-Item -ItemType Directory -Path $LogDir -Force


try {
  #Query to create database with required data and log path
  $Query = 'CREATE DATABASE '+$DBName+' ON (NAME = '+$DataFileName+',FILENAME = '''+$DataPath+''') LOG ON (NAME = '+$LogFileName+',FILENAME = '''+$LogPath+''')'
  
  if ($SQLUser -ne "" -And $SQLPass -ne "") {
    Write-Output "Connecting with SQL User Authentication"
    #Execute a query with SQL credentials
    Invoke-Sqlcmd  -ConnectionString "Data Source=$SqlServer; User Id=$SQLUser; Password =$SQLPass;TrustServerCertificate=True" -Query "$Query"
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
  Write-Error "A network-related or instance-specific error occurred while establishing a connection to SQL Server. The server was not 
        found or was not accessible. Verify that the instance name is correct and that SQL Server is configured to allow connections. "
      }
     


  

 
 
