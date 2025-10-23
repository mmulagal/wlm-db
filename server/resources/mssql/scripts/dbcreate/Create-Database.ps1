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

  [Parameter(Mandatory = $true)]
  [string]$Collation,

  [Parameter(Mandatory = $false)]
  [string]$InstanceName,

  [Parameter(Mandatory = $false)]
  [string]$ResourceID,

  [Parameter(Mandatory = $true)]
  [string]$SqlInstanceName
)

$createlog = (New-Item -ItemType Directory -Path C:\cfn\log -Force)
$silenttranscript = (Start-Transcript -Path C:\cfn\log\Create_Database.log.txt -Append)
$ErrorActionPreference = "Stop"
$result = [ordered]@{}
$DataPathExists = Test-Path -Path $DataPath
$LogPathExists = Test-Path -Path $LogPath

#Fetch Data and Log file names

$DataFile = Split-Path $DataPath -leaf
$LogFile = Split-Path $LogPath -leaf
$found1 = $DataFile -match '(.+?)\.'
if ($found1) { $DataLogicalName = $matches[1] }
$found2 = $LogFile -match '(.+?)\.'
if ($found2) { $LogLogicalName = $matches[1] }

#In the event of same logical name for log and data due to same OS file name
if ($DataLogicalName -eq $LogLogicalName) {
  $DataLogicalName = $DBName + "_DATA"
  $LogLogicalName = $DBName + "_LOG"
}

#Decrypt SSM Parameter for SQL Username and password
if ($ResourceID) { 
  $SQLCredStore = "/netapp/wlmdb/$ResourceID"
  try {
    $credobject = (Get-SSMParameter -Name $SQLCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 
    if($credobject.domain -ne $null){
        $windowsAuth = $True
        $credentials = $credobject.domain


    }
    elseif($credobject.sql -ne $null) {
        $sqlAuth = $True
        $credentials = $credobject.sql

    }
    else { throw }
    $instancelist = $credentials.sqlinstancename
    $instancecount = $instancelist.Count
    if ($instancecount -eq 1) {
      $Dbuser = $credentials.username
      $Dbpass = $credentials.password 
    }
    else {
      $instance = $InstanceName.ToLower() 
      $index = $credentials.sqlinstancename.ToLower().IndexOf($instance) 
    
      $Dbuser = $credentials.username[$index] 
      $Dbpass = $credentials.password[$index] 
    }

  }
  catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to get SQL credentials from SSM Parameter')
    $result.Add('Exception', $_)
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
}
catch {
  $result.Add('Status', 'Failed')
  $result.Add('Message', 'Data or log file name already exists')
  $result.Add('Exception', $_)
  $resultjson = ($result | ConvertTo-Json) 
  $resultjson 
  exit 1
}

#Check if database name already exists
try {
    Function Is-CredSSPEnabled {
        try {
            $credsspStatus = Get-WSManCredSSP
            if ($credsspStatus -match "The machine is configured to allow delegating fresh credentials") {               
                return $true
            } else {
                return $false
            }
        } catch {
            Write-Host "Error checking CredSSP status: $($_.Exception.Message)"
            return $false
        }
    }
  $Dblisterrlog = 'C:\cfn\log\dblist_err.log'
  if ($ResourceID) { 
    if($sqlAuth){
    $dblist = (Sqlcmd -S "$SqlInstanceName" -U $Dbuser -P $Dbpass -Q "SET NOCOUNT ON;SELECT name FROM sys.databases" -l 20 -y 0 -r1 2> $Dblisterrlog)
    if (Get-Content $Dblisterrlog) { throw }
    }
    if($windowsAuth) {
    $DomainAdminCreds = (New-Object PSCredential($Dbuser,(ConvertTo-SecureString $Dbpass -AsPlainText -Force)))
       
    # Enable CredSSP
    if (-not (Is-CredSSPEnabled)) {
        try {
            $ServerName = '*'
            $isPartOfDomain = (Get-WmiObject Win32_ComputerSystem).PartofDomain
            if ($isPartOfDomain -eq $True) {
                $domain = (Get-WmiObject Win32_ComputerSystem).Domain
                $ServerName = "*.$domain"
            }
            Enable-WSManCredSSP -Role Client -DelegateComputer $ServerName -Force | Out-Null
            Enable-WSManCredSSP -Role Server -Force | Out-Null
            # Sometimes Enable-WSManCredSSP doesn't get it right, so we set some registry entries by hand
            $parentkey = "hklm:\SOFTWARE\Policies\Microsoft\Windows"
            $key = "$parentkey\CredentialsDelegation"
            $freshkey = "$key\AllowFreshCredentials"
            $ntlmkey = "$key\AllowFreshCredentialsWhenNTLMOnly"
            New-Item -Path $parentkey -Name 'CredentialsDelegation' -Force | Out-Null
            New-Item -Path $key -Name 'AllowFreshCredentials' -Force | Out-Null
            New-Item -Path $key -Name 'AllowFreshCredentialsWhenNTLMOnly' -Force | Out-Null
            New-ItemProperty -Path $key -Name AllowFreshCredentials -Value 1 -PropertyType Dword -Force | Out-Null
            New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFresh -Value 1 -PropertyType Dword -Force | Out-Null
            New-ItemProperty -Path $key -Name AllowFreshCredentialsWhenNTLMOnly -Value 1 -PropertyType Dword -Force | Out-Null
            New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFreshNTLMOnly -Value 1 -PropertyType Dword -Force | Out-Null
            New-ItemProperty -Path $freshkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force | Out-Null
            New-ItemProperty -Path $ntlmkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force | Out-Null

            # Verify CredSSP is enabled
            if (-not (Is-CredSSPEnabled)) {
                Write-Host "Enabling CredSSP failed"
                throw "Failed to enable CredSSP."
            }
        } catch {
            Write-Error "Error enabling CredSSP: $($_.Exception.Message)"
        }
    }
    $checkdb =  {
        $dblist = (Sqlcmd -S "$Using:SqlInstanceName" -Q "SET NOCOUNT ON;SELECT name FROM sys.databases" -l 20 -y 0 -r1 2> $Using:Dblisterrlog)
        return $dblist
    }
    $dblist = Invoke-Command -ScriptBlock $checkdb -ComputerName $ENV:ComputerName -Credential $DomainAdminCreds -Authentication Credssp
    }
  }
  else {
    $dblist = (Sqlcmd -S "$SqlInstanceName" -Q "SET NOCOUNT ON;SELECT name FROM sys.databases" -l 20 -y 0 -r1 2> $Dblisterrlog)
    if (Get-Content $Dblisterrlog) { throw }
  } 
}
catch {
  $conerror = 'Unable to connect to SQL Server' + $SQLServer
  $result.Add('Status', 'Failed')
  $result.Add('Message', $conerror)
  $result.Add('Exception', $_)
  $resultjson = ($result | ConvertTo-Json) 
  $resultjson 
  exit 1
}
try {
  if ($dblist -Contains $DBName) {
    throw
  } 
}
catch {
  $result.Add('Status', 'Failed')
  $result.Add('Message', 'Database name already exists on Server')
  $result.Add('Exception', $_)
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
  #Query to create database with required data and log path and collation if available
  $Query = 'SET NOCOUNT ON;CREATE DATABASE ' + $DBName + ' ON (NAME = ' + $DataLogicalName + ',FILENAME = ''' + $DataPath + ''') LOG ON (NAME = ' + $LogLogicalName + ',FILENAME = ''' + $LogPath + ''') COLLATE ' + $Collation + ';'
  $Dbcreatelog = 'C:\cfn\log\dbcreate.log'
  $Dbcreateerrlog = 'C:\cfn\log\dbcreate_err.log'
  if ($ResourceID) {
    if ($sqlAuth) {
    #Execute DB create query with SQL user authentication
    $invokecreate = (Sqlcmd  -S "$SqlInstanceName" -U $Dbuser -P $Dbpass -Q "$Query" -l 20 -y 0  -r1 2> $Dbcreateerrlog 1> $Dbcreatelog)
    $ErrorExists = Test-Path -Path C:\cfn\log\dblist_err.log
    }
    if ($windowsAuth) {
        $createquery = {
            $dbcreate = (Sqlcmd  -S "$Using:SqlInstanceName" -Q "$Using:Query" -l 20 -y 0  -r1 2> $Using:Dbcreateerrlog 1> $Using:Dbcreatelog)
            return $dbcreate
            }
        $invokecreate = Invoke-Command -ScriptBlock $createquery -ComputerName $ENV:ComputerName -Credential $DomainAdminCreds -Authentication Credssp
    
    }
    if (Get-Content $Dbcreateerrlog) { throw } 

  }
  else {
    #Execute DB create query with trusted connection(Windows authentication). If you omit the server, it will default to localhost.
    $invokecreate = (Sqlcmd -S "$SqlInstanceName" -Q "$Query" -l 20 -y 0 -r1 2> $Dbcreateerrlog 1> $Dbcreatelog)
    if (Get-Content $Dbcreateerrlog) { throw } 
  }
  
}
catch {
  $failerr = 'Database creation failed on Server ' + $SQLServer
  $result.Add('Status', 'Failed')
  $result.Add('Message', $failerr)
  $result.Add('Exception', $_)
  $resultjson = ($result | ConvertTo-Json) 
  $resultjson 
  exit 1
}

$success = 'Successfully created database on SQL Server ' + $SQLServer
$result.Add('Status', 'Complete')
$result.Add('Message', $success)
$resultjson = ($result | ConvertTo-Json) 
$resultjson  
