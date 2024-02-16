    
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
  [string]$SQLPass,  

  [Parameter(Mandatory = $false)]
  [string]$SQLUser
)

New-Item -ItemType Directory -Path C:\cfn\log -Force
Start-Transcript -Path C:\cfn\log\Create_Database.log.txt -Append
$ErrorActionPreference = "Stop"

$FileExists1 = Test-Path -Path $DataPath
$FileExists2 = Test-Path -Path $LogPath

#Fetch Data and Log file names

$DataFile= Split-Path $DataPath -leaf
$LogFile= Split-Path $LogPath -leaf
$found1 = $DataFile -match '(.+?)\.'
if ($found1) {$DataFileName = $matches[1]}
$found2 = $LogFile -match '(.+?)\.'
if ($found2) {$LogFileName = $matches[1]}

#Decrypt SSM Parameter for SQL Username and password
if ($SQLUser -ne "" -And $SQLPass -ne "") { 
  $Dbuser = ( Get-SSMParameter -Name $SQLUser -WithDecryption $true).Value
  $Dbpass = ( Get-SSMParameter -Name $SQLPass -WithDecryption $true).Value

}

#In case of reusing existing drives check if data/log file name exists in path already

if ($FileExists1 -Or $FileExists2) {
    Write-Error "{Message:Data or Log file with provided name already exists,Exception:$_}"
}

#Check if database name already exists
if ($SQLUser -ne "" -And $SQLPass -ne "") { 
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
  
  if ($SQLUser -ne "" -And $SQLPass -ne "") {
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
     


  

 
 
 
