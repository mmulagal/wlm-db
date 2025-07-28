import { SqlServerDeploymentModel } from '../../../utils/consts';
import { compressResponse, enableCredSSP, invokeCommandWithCredSSP } from './common-templates';
import { GOOGLE_DNS, DISCOVER_OPERATION_LOG_PATH } from './const';

const IS_DATABASE_CREATE_POSSIBLE: string = 'isDatabaseCreatePossible';
const IS_PS7_AVAILABLE: string = 'isPS7Available';
const UNAVAILABLE_PS_MODULES: string = 'unavailablePsModules';
const FAILURE_INFO: string = 'failureInfo';
const ACTIVE_DIRECTORY: string = 'activeDirectory';
const SQL_SERVER_DEPLOYMENT_TYPE: string = 'sqlServerDeploymentType';
const REQUIRED_PS_MODULES_FOR_MANAGEMENT: string = `
  'AWS.Tools.EC2',
  'AWS.Tools.FSx',
  'AWS.Tools.SimpleSystemsManagement',
  'NetApp.ONTAP',
  'AWS.Tools.BedrockRuntime',
  'AWS.Tools.CloudWatch'
`;

const SQL_PERMISSIONS: string = `
'VIEW ANY DEFINITION',
'ALTER ANY DATABASE',
'CONTROL SERVER',
'CREATE ANY DATABASE',
'VIEW SERVER STATE'
`;

const SQL_SERVER_VERSION_TO_YEAR = new Map<number, number>([
    // Ref: https://learn.microsoft.com/en-AU/troubleshoot/sql/releases/download-and-install-latest-updates#sql-server-2022
    [9, 2005],
    [10, 2008],
    [11, 2012],
    [12, 2014],
    [13, 2016],
    [14, 2017],
    [15, 2019],
    [16, 2022]
]);

const MINIMUM_PREPREQUISITES = {
    SQL_PERMISSIONS: ['VIEW ANY DEFINITION', 'VIEW SERVER STATE'],
    MODULES: ['AWS.Tools.SimpleSystemsManagement']
};
const FEATURE_PREPREQUISITES = {
    ASSESSMENT: {
        SQL_PERMISSIONS: [...MINIMUM_PREPREQUISITES.SQL_PERMISSIONS],
        MODULES: [...MINIMUM_PREPREQUISITES.MODULES, 'AWS.Tools.CloudWatch']
    },
    REMEDIATION: {
        SQL_PERMISSIONS: [...MINIMUM_PREPREQUISITES.SQL_PERMISSIONS, 'ALTER SETTINGS'],
        MODULES: [...MINIMUM_PREPREQUISITES.MODULES]
    },
    DBCREATION: {
        SQL_PERMISSIONS: [...MINIMUM_PREPREQUISITES.SQL_PERMISSIONS, 'CREATE ANY DATABASE'],
        MODULES: [...MINIMUM_PREPREQUISITES.MODULES, 'AWS.Tools.FSx', 'Powershell 7']
    },
    SANDBOX: {
        SQL_PERMISSIONS: [...MINIMUM_PREPREQUISITES.SQL_PERMISSIONS, 'CONTROL SERVER', 'ALTER ANY DATABASE'],
        MODULES: [...MINIMUM_PREPREQUISITES.MODULES, 'NetApp.ONTAP']
    },
    LOGSANALYZER: {
        SQL_PERMISSIONS: [...MINIMUM_PREPREQUISITES.SQL_PERMISSIONS],
        MODULES: [...MINIMUM_PREPREQUISITES.MODULES, 'AWS.Tools.BedrockRuntime']
    }
};

/*
The disks in an EC2 instance can be EBS, FSxN, FSxW or from CVO.
This script collects serial-number of EBS disks, and the iSCSI
connection IP for FSxN disks.  It returns a JSON object containing
below details:
- sqlServerInstance - Name of SQL Server instance, e.g., MSSQLSERVER.
- sqlServerState - The operational state of the SQL server instance.
- sqlServerVersion - Version of SQL Server instance, e.g., 16.0.4095.4.
- sqlServerMajorVersion  Edition of SQL Server instance, e.g., 2022.
- sqlServerInstanceStorageInfo - JSON object containing a list of serial
                               number and/or iSCSI targets
- sqlServerName: The computer name on which SQL Server instance is running.
               For a cluster, this value represents virtual server name.
- sqlServerEdition - SQL Server Product Edition, e.g., Standard Edition (64-bit)
- databaseCount - Number of databases in the SQL Server instance. Available
                only if SQL Server instance is running.


Example output:
{
  "sqlServerVersion":  "16.0.4095.4",
  "sqlServerMajorVersion": "16",
  "sqlServerInstanceStorageInfo":  "[\r\n    {\r\n        \"SerialNumberOrScsiTarget\":  \"vol05109452537b7ad57_00000001.\"\r\n    },\r\n    {\r\n        \"SerialNumberOrScsiTarget\":  \"172.31.11.195\"\r\n    }\r\n]",
  "sqlServerInstance":  "MSSQLSERVER",
  "sqlServerState":  "Running",
  "sqlServerEdition":  "Standard Edition (64-bit)",
  "sqlServerName": "EC2AMAZ-1MF7SUF"
  "windowsAuthentication":  true,
  "databaseCount" = 8,
}

About function GetSMBMappedDrivesWithPath
  SMB mapped drives are fetched from Windows registry HKEY_USERS and specifically at Network section.
  We will consider users starting with S-1-5-21- and do not have _Classes.
  Those starting with [S-1-5-21-12] are all local users and starting with [S-1-5-21-13] are all network users.
  From Network section, pick up DriveLetter and RemotePath.

Possible causes for unavailability of SQL Server details:
- Insufficient permissions on sys.master_files view.
  Because of this, we won't be able to get the database file locations,
  due to which the script won't  get/return SerialNumberOrScsiTargets.
  As a result, the storageType can't be determined while processing script
  output, which causes the API to return an empty  response for storageType.

  Note: As a failover, using sys.sysdatabases view to fetch database paths.
  However, this view does not list log paths.
- SQL Instance is not running.
  Because of this, we won't be able to get storagex details.
- No SQL authentication
  Because of this, we won't be able to get storage details.
*/
const HOST_AND_SQL_INFO_PS1 = [
    `
  $ErrorActionPreference = "Stop"
  $ProgressPreference = 'SilentlyContinue'

  Function TestIfInterfaceNameMatchesWithDriveId {
    param (
      [string]$interfaceNames,
      [string]$driveId
    )

    ForEach ($interfaceName in $interfaceNames) {
      If ($interfaceName -match $driveId) {
        return $True
      }
    }

    return $False
  }

  Function GetDiskDriveDetails() {
    $TARGET_ADDRESS_REGEX = '\\w+\\:\\*(?<targetAddress>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\s?\\w.+'

    $iScsiInitiatorSessionList = Get-CimInstance -Namespace root\\wmi -ClassName MSiSCSIInitiator_SessionClass |
                                   Where-object { $_.Devices -ne {} } |
                                     Sort-Object -Unique -Property TargetName |
                                       Select-Object Devices, TargetName
                                      

    $iScsiSessionList = ForEach ($iScsiInitiator in $iScsiInitiatorSessionList) {
      $interfaceNames = @()
      ForEach ($iScsiInitiatorDevice in $iScsiInitiator.Devices) {
        $iScsiInitiatorDeviceProperties = $iScsiInitiatorDevice.CimInstanceProperties
        if ($iScsiInitiatorDeviceProperties -ne $null) {
          $interfaceNames += $iScsiInitiatorDeviceProperties["DeviceInterfaceName"].Value
        }
      }

      @{
        "TargetName" = $iScsiInitiator.TargetName
        "InterfaceNames" = $interfaceNames
      }
    }

    $iScsiInitiatorTargetList = $null
    If ((Get-WmiObject win32_service | ?{$_.Name -like 'MSiSCSI'}).State -eq 'Running') {
      
      $iScsiInitiatorTargetList = Get-CimInstance -Namespace root\\wmi -ClassName MSIscsiInitiator_TargetClass |
                                    Sort-Object -Unique -Property TargetName |
                                      Select-Object TargetName, DiscoveryMechanism
                                      
    }

    $iScsiTargetList = ForEach ($iScsiInitiatorTarget in $iScsiInitiatorTargetList) {
      @{
        "TargetName" = $iScsiInitiatorTarget.TargetName
        "DiscoveryMechanism" = $iScsiInitiatorTarget.DiscoveryMechanism
      }
    }

    $DriveLetteriScsiTargetAddress = @()

    ForEach ($DiskDrive in Get-CimInstance -ClassName Win32_DiskDrive) {
      $object = New-Object PSObject -Property @{ "SerialNumber" = $DiskDrive.SerialNumber }

      $DiskDriveToPartitionList = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($DiskDrive.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"
      $DriveLetters = @()
      ForEach ($DiskDriveToPartition in $DiskDriveToPartitionList) {
        $LogicalDiskToPartitionList = get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($DiskDriveToPartition.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"
        ForEach ($LogicalDiskToPartition in $LogicalDiskToPartitionList) {
          $DriveLetters += $LogicalDiskToPartition.DeviceID
        }
      }
      $object | Add-Member -MemberType NoteProperty -Name "DriveLetters" -Value $DriveLetters
  
      $DriveId = $DiskDrive.PNPDeviceID.tolower() -replace '\\\\', '#'

      ForEach ($iScsiSession in $iScsiSessionList) {
        $iScsiSessionTarget = $iScsiSession.TargetName
        $deviceInterfaceNames = $iScsiSession.InterfaceNames

        if (TestIfInterfaceNameMatchesWithDriveId $deviceInterfaceNames $DriveId) {
          ForEach ($iscsiTarget in $iScsiTargetList) {
            if ($iscsiTarget.targetName -eq $iScsiSessionTarget) {
              $discoveryMech = $iscsiTarget.DiscoveryMechanism
              if ($discoveryMech -match $TARGET_ADDRESS_REGEX) {
                $object | Add-Member -MemberType NoteProperty -Name "TargetAddress" -Value $matches["targetAddress"]
              }
            }
          }
        }
      }

      $DriveLetteriScsiTargetAddress += $object
    }

    $SmbLogicalDiskList = Get-CimInstance  Win32_LogicalDisk | Where-Object { $_.ProviderName } | Select DeviceID, ProviderName
    ForEach ($SmbLogicalDisk in $SmbLogicalDiskList) {
      $object = New-Object PSObject -Property @{ "DriveLetter" = $SmbLogicalDisk.DeviceID }
      $object | Add-Member -MemberType NoteProperty -Name "TargetAddress" -Value $SmbLogicalDisk.ProviderName
      $DriveLetteriScsiTargetAddress += $object
    }

    $IscsciTargets = $DriveLetteriScsiTargetAddress | Where-Object { (-not([string]::IsNullOrEmpty($_.TargetAddress)))  } 
   
    $DriveTargetMap = @{}
    ForEach ($item in $DriveLetteriScsiTargetAddress) {
      If ($item.DriveLetters -eq $null) {
        Continue
      }

      $Target = $IscsciTargets |  Where-Object {$_.SerialNumber -ceq  $item.SerialNumber } 

      If ($Target.TargetAddress -ne $null) {
        $item.DriveLetters | ForEach-Object {
          if(-not $DriveTargetMap.ContainsKey($_)) {
            $DriveTargetMap.Add($_, @())
          } 
          $DriveTargetMap[$_] += ($Target.TargetAddress)
        }
    } ElseIf ($item.SerialNumber -ne $null) {
      $item.DriveLetters | ForEach-Object {
        if(-not $DriveTargetMap.ContainsKey($_)) {
          $DriveTargetMap.Add($_, @())
        } 
        $DriveTargetMap[$_] += ($item.SerialNumber)
        }
      }
    }

    return $DriveTargetMap
  }


  Function GetSMBMappedDrivesWithPath() {
    $DriveLetterPath = @{}
    $Errors = ''
    #User List
    $RootKey = [Microsoft.Win32.RegistryKey]::OpenRemoteBaseKey(“USERS”,$Computer)
    $SubKeyNames = $RootKey.GetSubKeyNames()
    ForEach ($SubKeyName in $SubKeyNames)
        {
            if (($SubKeyName.Contains(“_Classes”) -ne $True))
                {
                    #Drive List
                    try {
                    $NetworkKey = $RootKey.OpenSubKey($SubKeyName + “\\Network”)
                    } catch {$Errors += "$RootKey-$SubKeyName : $_."}
                    if ($NetworkKey -ne $Null)
                        {
                            $MappedDrives = $NetworkKey.GetSubKeyNames()
                           
                              ForEach ($MappedDrive in $MappedDrives)
                                {
                                  try {
                                  $DriveKey = $NetworkKey.OpenSubKey($MappedDrive)
                                  $DrivePath = ($DriveKey.GetValue(“RemotePath”) -split '\\share')[0].Trim('\\')
                                  if(! $DriveLetterPath.ContainsKey($MappedDrive.ToUpper()+':')) {
                                      $DriveLetterPath.Add($MappedDrive.ToUpper()+':', $DrivePath)            
                                  }  
                                }catch {$Errors += "$SubKeyName-$NetworkKey : $_."}     
                                }
                                
                        } 
                }
        }

    return $DriveLetterPath, $Errors
  }
  
  Function GetSMBConnections() {

   $SMBConnections = @()

   $smbshares = Get-SMBConnection | Select-Object ServerName
   ForEach($share in $smbshares) {
        $SMBConnections += $share.ServerName 
        }
   return $SMBConnections
  }

  Function GetSQLInstanceDriveDetails($serverInstance, $sqlUsername, $sqlPassword, $authType = 'sql') {
    $sqlInstancePaths = $null
    $sqlInstanceDriveLetterOrPathList = @()

    try {
      $sqlInstancePaths = sqlcmd -Q " SET NOCOUNT ON; SELECT physical_name FROM sys.master_files " -h -1 -b -C -W -S $serverInstance 2> $null
      if($sqlInstancePaths -eq $null) { 
        $sqlInstancePaths = sqlcmd -Q " SET NOCOUNT ON; SELECT filename as Path FROM sys.sysdatabases " -h -1 -b -C -W -S $serverInstance 2> $null
      }
    } catch {
      if (-Not [string]::IsNullOrEmpty($sqlUsername) -And -Not [string]::IsNullOrEmpty($sqlPassword)) {
        try {
          if ($authType -eq 'domain') {
            $sqlInstancePaths = Invoke-CommandWithCredSSP -sqlquery "SET NOCOUNT ON; SELECT physical_name FROM sys.master_files" -instanceName $serverInstance -extraArguments -h -1 -b -C -W 2> $null
            if($sqlInstancePaths -eq $null) { 
              $sqlInstancePaths = Invoke-CommandWithCredSSP -sqlquery "SET NOCOUNT ON; SELECT filename as Path FROM sys.sysdatabases" -instanceName $serverInstance -extraArguments -h -1 -b -C -W 2> $null
            }
          } else {
            $sqlInstancePaths = sqlcmd -U $sqlUsername -P $sqlPassword -Q " SET NOCOUNT ON; SELECT physical_name FROM sys.master_files " -h -1 -b -C -W -S $serverInstance 2> $null
            if($sqlInstancePaths -eq $null) { 
              $sqlInstancePaths = sqlcmd -U $sqlUsername -P $sqlPassword -Q " SET NOCOUNT ON; SELECT filename as Path FROM sys.sysdatabases " -h -1 -b -C -W -S $serverInstance 2> $null
            }
          }
        } catch {
          # Handle the case where the registry key does not exist
        }
      }
    }
    ForEach ($path in $sqlInstancePaths) {
      $path = $path.TrimStart('\\')
      $driveOrPath = ($path -split '\\\\')[0]
      $sqlInstanceDriveLetterOrPathList += $driveOrPath
    }
    return ($sqlInstanceDriveLetterOrPathList | Select -Unique)
  }
  
  Function GetClusterDetails {
    $clusterDetailsResponse = @{}

    $clusterDetailsResponse['isClustered'] = $False

    $clusterServiceStatus = (Get-Service -Name "ClusSvc" -ErrorAction SilentlyContinue).Status
    if ($clusterServiceStatus -eq "Running") {
      $clusterDetailsResponse['isClustered'] = $True
      $clusterName = (Get-Cluster -ErrorAction SilentlyContinue).Name
      If ($clusterName) {
        $clusterDetailsResponse['name'] = $clusterName
        $clusterNodes = Get-ClusterNetworkInterface | ForEach-Object {
          @{
            "Address" = $_.Address
            "Node" = $_.Node
          }
        }

        $windowsClusterNodes = $clusterNodes | ConvertTo-Json -Depth 1
        $clusterDetailsResponse['windowsClusterNodes'] = $windowsClusterNodes
                   
        If (Get-ClusterResource -ErrorAction SilentlyContinue | ? { $_.ResourceType -eq "SQL Server Availability Group" }) {
          $clusterDetailsResponse['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_AOAG_SHORT}'
        } else {
          $clusterDetailsResponse['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_FCI_SHORT}'
        }
      }
    }
    else {
      $clusterDetailsResponse['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_STANDALONE_SHORT}'
    }

    return $clusterDetailsResponse
  }

  Function FetchAllSQLInstancesFromRegistry {
    $sqlInstances = @()
    $registryPath = "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL"
    $instanceNames = Get-ItemProperty -Path $registryPath | Select-Object -Property * | ForEach-Object {
        $_.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | Select-Object -ExpandProperty Value
    }
    ForEach ($instanceName in $instanceNames) {
      $sqlInstances += $instanceName
    }
    return $sqlInstances
  }

  Function FetchSqlServerInfoFromRegistry($allSqlInstanceNamesFromRegistry, $instanceName) {
    $sqlServerInfo = @{}
    $instance = $allSqlInstanceNamesFromRegistry | Where-Object { $_ -like "*$instanceName*" } | Select-Object -First 1

    if (-not $instance) {
        Write-Information "Instance '$instanceName' not found in the registry."
        return $null
    }

    $instanceConfigPath = "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\$instance\\MSSQLServer"
    $instanceSetupConfigPath = "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\$instance\\Setup"

    # Fetch SQL Server Edition and Engine Edition
    $edition = (Get-ItemProperty -Path $instanceSetupConfigPath -Name "Edition" -ErrorAction SilentlyContinue).Edition
    if (-not ([string]::IsNullOrEmpty($edition))) {
        $sqlServerInfo['sqlServerEdition'] = $edition
        if ($edition.StartsWith("Standard")) { $sqlServerInfo['sqlServerEngineEdition'] = 2 }
        elseif ($edition.StartsWith("Enterprise")) { $sqlServerInfo['sqlServerEngineEdition'] = 3 }
        elseif ($edition.StartsWith("Express")) { $sqlServerInfo['sqlServerEngineEdition'] = 4 }
        else { $sqlServerInfo['sqlServerEngineEdition'] = 100 }
    }

    # Fetch SQL Server Version
    $sqlServerVersion = (Get-ItemProperty -Path $instanceSetupConfigPath -Name "Version" -ErrorAction SilentlyContinue).Version
    if (-not ([string]::IsNullOrEmpty($sqlServerVersion))) {
        $sqlServerInfo['sqlServerVersion'] = $sqlServerVersion
    }

    # Check if the instance is clustered
    $sqlServerInfo['isClustered'] = $False
    $isClustered = (Get-ItemProperty -Path $instanceSetupConfigPath -Name "SQLCluster" -ErrorAction SilentlyContinue).SQLCluster
    if (-not ([string]::IsNullOrEmpty($isClustered))) {
        $sqlServerInfo['isClustered'] = if ($isClustered -eq 1) { $True } else { $False }
    }
    
    # Fetch FCI Cluster Name
    if($sqlServerInfo['isClustered']) {
      try{
          $instanceClusterConfigPath = "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\$instance\\Cluster"
          $clusterName = (Get-ItemProperty -Path $instanceClusterConfigPath -Name "ClusterName" -ErrorAction SilentlyContinue).ClusterName
          $sqlServerInfo['clusterName'] = $clusterName
      }catch{ 
          Write-Warning "Failed to fetch cluster name for instance '$instanceName'."
        }
    }

    # Check if HADR (High Availability Disaster Recovery) is enabled
    $sqlServerInfo['hadrEnabled'] = $False
    $instanceHADRConfigPath = "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\$instance\\MSSQLServer\\HADR"
    $hadrEnabled = (Get-ItemProperty -Path $instanceHADRConfigPath -Name "HADR_Enabled" -ErrorAction SilentlyContinue).HADR_Enabled
    if (-not ([string]::IsNullOrEmpty($hadrEnabled))) {
        $sqlServerInfo['hadrEnabled'] = if ($hadrEnabled -eq 1) { $True } else { $False }
    }

    # Fetch Drive Details
    $sqlInstanceDriveLetterList = @()
    try {
        $defaultDataPath = (Get-ItemProperty -Path $instanceConfigPath -Name "DefaultData" -ErrorAction SilentlyContinue).DefaultData
        if (-not ([string]::IsNullOrEmpty($defaultDataPath))) {
            $sqlInstanceDriveLetterList += ($defaultDataPath -split '\\\\')[0]
        }

        $defaultLogPath = (Get-ItemProperty -Path $instanceConfigPath -Name "DefaultLog" -ErrorAction SilentlyContinue).DefaultLog
        if (-not ([string]::IsNullOrEmpty($defaultLogPath))) {
            $sqlInstanceDriveLetterList += ($defaultLogPath -split '\\\\')[0]
        }

        $rootDataPath = (Get-ItemProperty -Path $instanceSetupConfigPath -Name "SQLDataRoot" -ErrorAction SilentlyContinue).SQLDataRoot
        if (-not ([string]::IsNullOrEmpty($rootDataPath))) {
            $sqlInstanceDriveLetterList += ($rootDataPath -split '\\\\')[0]
        }
    } catch {
        Write-Warning "Failed to fetch drive details for instance '$instanceName'."
    }

    $sqlServerInfo['driveDetails'] = $sqlInstanceDriveLetterList | Select-Object -Unique

    return $sqlServerInfo
  }


    
  try {
    $responseObject = @{}
    ${enableCredSSP}
    ${invokeCommandWithCredSSP}
    $instanceSectionStartTime = Get-Date
    $sqlServiceList = Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}
    $DiskTargetInfoMap = GetDiskDriveDetails
    $MappedDrivesWithPath, $RegistryErrors = GetSMBMappedDrivesWithPath
    $clusterDetails = GetClusterDetails
    $SMBConnections = GetSMBConnections
    $allSqlInstanceNamesFromRegistry = FetchAllSQLInstancesFromRegistry
  
    $vcpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "60"} -Method PUT -Uri 'http://169.254.169.254/latest/api/token'
    $instanceType = (Invoke-WebRequest -Headers @{"X-aws-ec2-metadata-token" = $token} -Uri "http://169.254.169.254/latest/meta-data/instance-type" -ErrorAction Stop -UseBasicParsing).Content
    $ssmInstallationPath = (Get-Module -Name AWS.Tools.SimpleSystemsManagement -ListAvailable).Path

    if (($vcpus -ge 2) -and (-Not [string]::IsNullOrEmpty($ssmInstallationPath))) {
      $credsFromParameterStore = $null
      try {
        $connection = Test-Connection -ComputerName ${GOOGLE_DNS} -Quiet -Count 1
        if ($connection -eq $False) {
            # Set the registry key to disable certificate revocation check in case of private subnet
            Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\" -Name State -Value 146944 -Force | Out-Null
        }
        [string]$apiToken = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri http://169.254.169.254/latest/api/token
        $ec2InstanceId = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $apiToken} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
        $credsFromParameterStore = (Get-SSMParameter -WithDecryption 1 -Name /netapp/wlmdb/$ec2InstanceId).Value | ConvertFrom-Json
        $isAtleastOneCredentialIsOfDomain = $credsFromParameterStore.domain.Count -gt 0
        if ($isAtleastOneCredentialIsOfDomain) {
            Enable-CredSSP
        }
      } catch {
        $responseObject['failureInfo'] += $_
      }
    }

     # Check if Powershell 7 is available
    $isPS7Available = $False
    $availablePsModuleList = @()
    try {
        If (Get-Command -Name pwsh -ErrorAction SilentlyContinue) {
          $isPS7Available = $True
        } 

        If (($isPS7Available -eq $False) -and (Test-Path "C:\\Program Files\\PowerShell\\7")) {
          $isPS7Available = $True
        }

        $requiredPsModuleList = @(${REQUIRED_PS_MODULES_FOR_MANAGEMENT})

        $availablePsModuleList = (Get-Module -ListAvailable -Name $requiredPsModuleList).Name

    } catch {
        $responseObject['failureInfo'] += $_
    } 
  
  
    $instancesInfoList = ForEach ($sqlService in $sqlServiceList) {
      $responseObject = @{}
      $instanceSectionStartTime = Get-Date
      
  
      If ($DiskTargetInfoMap.Count -le 0) {
        $body['failureInfo'] += "Failed to get drive letter and disk target details\`n"
      }

      If ($RegistryErrors) {
        $responseObject['failureInfo'] += "Errors seen while reading Windows Registry: $RegistryErrors.\`n"
      }

      $editionDBCountMachineInfoGuid = @($null, $null, $null, $null, $null)
      $responseObject['windowsAuthentication'] = $False
      $sqlServerInstanceStorageInfo = $null
  
      $isDefaultInstance = -Not $sqlService.Name.Contains('$')
      $responseObject['isDefaultInstance'] = $isDefaultInstance
      $instanceName = $sqlService.Name -Replace "MSSQL\\$", ""


      $sqlServerInfoFromRegistry = FetchSqlServerInfoFromRegistry $allSqlInstanceNamesFromRegistry $instanceName
     
      $sqlServiceBinaryPath = $sqlService.PathName  -Replace "-s.*", ""
      If (Test-Path $sqlServiceBinaryPath.Replace('"', '')) {
        $info = Invoke-Expression -Command "(dir $sqlServiceBinaryPath).VersionInfo"
        $responseObject['sqlServerMajorVersion'] = $info.ProductMajorPart
        $responseObject['sqlServerVersion'] = $info.ProductVersion
      } Else {
        $responseObject['failureInfo'] += "\${instanceName}: Path $sqlServiceBinaryPath does not exist\`n"
      }
  
      $responseObject['sqlServerInstance'] = $instanceName
      $responseObject['sqlServerState'] = $sqlService.State
      $responseObject['windowsOsVersion'] = (Get-WmiObject -Class Win32_OperatingSystem).Caption
      $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = $clusterDetails['${SQL_SERVER_DEPLOYMENT_TYPE}']

      $sqlNodes = $null
      if ($clusterDetails['isClustered']) {
        $responseObject['windowsClusterName'] = $clusterDetails['name']
        $responseObject['windowsClusterNodes'] = $clusterDetails['windowsClusterNodes']
        $sqlNodes = (Get-ClusterOwnerNode -ResourceType "SQL Server Availability Group" -ErrorAction SilentlyContinue).OwnerNodes.NodeName
      }
        
      if ([string]::IsNullOrEmpty($sqlNodes)) {
        $responseObject['sqlServerNodes'] = hostname
      } else {
        $responseObject['sqlServerNodes'] =  $sqlNodes
      } 
      
      # Check if sqlcmd is available
      $isSqlCmdAvailable = $False
      if (Get-Command -Name sqlcmd -ErrorAction SilentlyContinue) {
        $isSqlCmdAvailable = $True
      }
      $responseObject['isSqlCmdAvailable'] = $isSqlCmdAvailable

      $responseObject['isPS7Available'] = $isPS7Available
      if($isPS7Available -eq $True) {
        $availablePsModuleList += 'Powershell 7'
      }
      $responseObject['availablePsModules'] = $availablePsModuleList

      if ($sqlService.State -eq "Running") {
          $deploymentTypeCheckQuery = "SET NOCOUNT ON; SELECT SERVERPROPERTY('IsHadrEnabled') AS IsHadrEnabled, SERVERPROPERTY('IsClustered') AS IsClustered, (SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.dm_hadr_availability_replica_states ars WHERE ars.is_local = 1) THEN 'True' ELSE 'False' END) AS isReadReplicaCreated FOR JSON PATH"
          $editionDBCountMachineInfoGuid = $null
          $existingPermissions = $null
          $sqlInstanceDriveLetterOrPathList = $null
          $serverInstance = If ($isDefaultInstance) { "$Env:ComputerName" } Else { "$Env:ComputerName\\$instanceName" } 
          try {
            $editionDBCountMachineInfoGuid = sqlcmd -h -1 -C -W -l 3 -S $serverInstance -Q "SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition');SELECT SERVERPROPERTY('EngineEdition'); SELECT count(name) FROM sys.databases; SELECT SERVERPROPERTY('MachineName'); SELECT service_broker_guid AS serverGuid FROM sys.databases WHERE name = 'msdb';"  2> $null
            $responseObject['windowsAuthentication'] = $?
            $existingPermissions = sqlcmd -S $serverInstance -Q "SET NOCOUNT ON; SELECT permission_name FROM fn_my_permissions(NULL, 'SERVER') FOR JSON PATH" -y 0
            $deploymentTypeCheck = sqlcmd -h -1 -C -W -l 3 -S $serverInstance -Q $deploymentTypeCheckQuery 2> $null
            $sqlInstanceDriveLetterOrPathList = GetSQLInstanceDriveDetails $serverInstance 
          } catch {
            $responseObject['windowsAuthentication'] = $False
            try {           
              # Although this is 'domain', we are assigning to 'sqlCredential', as Invoke-CommandWithCredSSP will use this variable to run the query
              $sqlCredential = $credsFromParameterStore.domain.Where({$_.sqlInstanceName -eq $instanceName -or $_.sqlInstanceName -eq 'MSSQLSERVER'})[0]
              if (-Not [string]::IsNullOrEmpty($sqlCredential) -And -Not [string]::IsNullOrEmpty($sqlCredential.username) -And -Not [string]::IsNullOrEmpty($sqlCredential.password)) {
                  $editionDBCountMachineInfoGuid = Invoke-CommandWithCredSSP -sqlquery "SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition');SELECT SERVERPROPERTY('EngineEdition'); SELECT count(name) FROM sys.databases; SELECT SERVERPROPERTY('MachineName'); SELECT service_broker_guid AS serverGuid FROM sys.databases WHERE name = 'msdb';" -instanceName $serverInstance -IsMultiQuery $True 2> $null
                  $deploymentTypeCheck = Invoke-CommandWithCredSSP -sqlquery $deploymentTypeCheckQuery -instanceName $serverInstance 2> $null
                  $existingPermissions = Invoke-CommandWithCredSSP -sqlquery "SET NOCOUNT ON; SELECT permission_name FROM fn_my_permissions(NULL, 'SERVER') FOR JSON PATH" -instanceName $serverInstance 2> $null
                  $sqlInstanceDriveLetterOrPathList = GetSQLInstanceDriveDetails $serverInstance $sqlCredential.username $sqlCredential.password 'domain'
              } else {
                $sqlCredential = $credsFromParameterStore.sql.Where({$_.sqlInstanceName -eq $instanceName})[0]
                if (-Not [string]::IsNullOrEmpty($sqlCredential) -And -Not [string]::IsNullOrEmpty($sqlCredential.username) -And -Not [string]::IsNullOrEmpty($sqlCredential.password)) {
                    $editionDBCountMachineInfoGuid = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -h -1 -C -W -l 3 -S $serverInstance -Q "SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition');SELECT SERVERPROPERTY('EngineEdition'); SELECT count(name) FROM sys.databases; SELECT SERVERPROPERTY('MachineName'); SELECT service_broker_guid AS serverGuid FROM sys.databases WHERE name = 'msdb';" 2> $null
                    $deploymentTypeCheck = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -h -1 -C -W -l 3 -S $serverInstance -Q $deploymentTypeCheckQuery  2> $null
                    $existingPermissions = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $serverInstance -Q "SET NOCOUNT ON; SELECT permission_name FROM fn_my_permissions(NULL, 'SERVER') FOR JSON PATH" -y 0
                    $sqlInstanceDriveLetterOrPathList = GetSQLInstanceDriveDetails $serverInstance $sqlCredential.username $sqlCredential.password
                    }
                  }
                }
                catch {
                  $responseObject['failureInfo'] += $_
                }
            }
          
          if ($editionDBCountMachineInfoGuid -or $sqlServerInfoFromRegistry) {

            if( -Not ([string]::IsNullOrEmpty($editionDBCountMachineInfoGuid)))
            {
              $responseObject['sqlServerEdition'] = $editionDBCountMachineInfoGuid[0]
              $responseObject['sqlServerEngineEdition'] = $editionDBCountMachineInfoGuid[1]
              $responseObject['databaseCount'] = $editionDBCountMachineInfoGuid[2]
              $responseObject['serverGuid'] = $editionDBCountMachineInfoGuid[4]
            }

            elseif( -Not ([string]::IsNullOrEmpty($sqlServerInfoFromRegistry))) 
            {
              if($sqlServerInfoFromRegistry.ContainsKey('sqlServerEdition')) {
                $responseObject['sqlServerEdition'] = $sqlServerInfoFromRegistry['sqlServerEdition']
                $responseObject['sqlServerEngineEdition'] = $sqlServerInfoFromRegistry['sqlServerEngineEdition']
              }
              if($sqlServerInfoFromRegistry.ContainsKey('sqlServerVersion')) {
                $responseObject['sqlServerVersion'] = $sqlServerInfoFromRegistry['sqlServerVersion']
              }
              $isHadrEnabled = $sqlServerInfoFromRegistry['hadrEnabled']
              $isClustered = $sqlServerInfoFromRegistry['isClustered']
            }
            $responseObject['sqlServerName'] = (Get-WmiObject -Class Win32_ComputerSystem).Name
            
            try {
              if($deploymentTypeCheck) {
                $deploymentTypeCheckParsed = $deploymentTypeCheck | ConvertFrom-Json
                $isHadrEnabled = $deploymentTypeCheckParsed.IsHadrEnabled
                $isClustered = $deploymentTypeCheckParsed.IsClustered
                $isReadReplicaCreated = $deploymentTypeCheckParsed.isReadReplicaCreated
              }
            }
            catch {
              Write-Information "SQL query for deployment type failed.Continuing with registry values for deployment type."
              $responseObject['failureInfo'] += "SQL query for deployment type failed: $_\`n"
            }
            if($isHadrEnabled -eq $True ) {
              if($isReadReplicaCreated -eq $True) {
                $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_AOAG_SHORT}'
              } else{
               $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_STANDALONE_SHORT}'
               $responseObject['sqlServerNodes'] = hostname
              }
            }
            elseif($isClustered -eq $True) {
              $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_FCI_SHORT}'
              $responseObject['sqlServerName'] = if ($sqlServerInfoFromRegistry.ContainsKey('clusterName') -and $sqlServerInfoFromRegistry['clusterName']) {
                $sqlServerInfoFromRegistry['clusterName']
              } elseif ($clusterDetails.ContainsKey('name') -and $clusterDetails['name']) {
                $clusterDetails['name']
              } else {
                (Get-WmiObject -Class Win32_ComputerSystem).Name
              }
            }
            else{
              $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_STANDALONE_SHORT}'
              $responseObject['sqlServerNodes'] = hostname
            }
            

            if( -Not ([string]::IsNullOrEmpty($existingPermissions))) {
              $existingPermissionsAsList = $existingPermissions | ConvertFrom-Json | ForEach-Object { $_.permission_name }
              $responseObject['sqlPermissions'] = $existingPermissionsAsList
            }
            else {
              $responseObject['sqlPermissions'] = @()
            }

            if(($sqlInstanceDriveLetterOrPathList.Count -eq 0) -and (-Not [string]::IsNullOrEmpty($sqlServerInfoFromRegistry)) -and $sqlServerInfoFromRegistry.ContainsKey('driveDetails')) {
              $sqlInstanceDriveLetterOrPathList = $sqlServerInfoFromRegistry['driveDetails']
            }

            $sqlServerInstanceStorageInfo = ForEach ($sqlInstanceDriveLetterOrPath in $sqlInstanceDriveLetterOrPathList) {
              if ($DiskTargetInfoMap.Keys -contains $sqlInstanceDriveLetterOrPath) {
                $DiskTargetInfoMap[$sqlInstanceDriveLetterOrPath] | ForEach-Object {
                  New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $_ }
                }
              } elseif ($SMBConnections -contains $sqlInstanceDriveLetterOrPath) {
                New-Object -TypeName PSObject -Property @{ SmbSharePath = $sqlInstanceDriveLetterOrPath }     
              } elseif ($MappedDrivesWithPath.Keys -contains $sqlInstanceDriveLetterOrPath) { 
                New-Object -TypeName PSObject -Property @{ SmbSharePath = $MappedDrivesWithPath[$sqlInstanceDriveLetterOrPath] }  
              }
            }
            $responseObject['sqlServerInstanceStorageInfo'] = $sqlServerInstanceStorageInfo | ConvertTo-Json -Compress
          }
      }
      
      $instanceSectionEndTime = Get-Date
      $responseObject['scriptExecutionTime'] = (($instanceSectionEndTime - $instanceSectionStartTime).TotalMilliseconds)
      Echo $responseObject
    }

    $response = $instancesInfoList | ConvertTo-Json
    if([string]::IsNullOrEmpty($response)) {
      Write-Information "Failed to compress the response because the response is either null or empty. $response"
      return $response
    }
    # disableCredSSP is removed as most of the machines are part of the domain, and we are enabling CredSSP at the domain level.
    ${compressResponse}
    return (Deflate-String $response)
  } catch {
    # Prevent any possible errors from clobbering JSON output
    $responseObject['failureInfo'] += "Exception: $_\`n"
    $instanceSectionEndTime = Get-Date
    $responseObject['scriptExecutionTime'] = (($instanceSectionEndTime - $instanceSectionStartTime).TotalMilliseconds)
    Echo $responseObject | ConvertTo-Json
  }
`
];

const CLUSTER_NETWORK_IP_INFO_PS1 = [
    `
  Start-Transcript -Path ${DISCOVER_OPERATION_LOG_PATH} -Append | Out-Null
  
  $ErrorActionPreference = "Stop"
  $responseObject = @{}
  $scriptStartTime = Get-Date
  $clusterNetworkIps = $null
  
  try {
    Write-Information "Discovering cluster network IPs"
    $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

    if ($clusterServiceStatus -eq "Running") {
      $clusterNetworkIps = (Get-ClusterNetworkInterface).Ipv4Addresses
      $responseObject['clusterNetworkIps'] = $clusterNetworkIps
      Write-Information "Cluster network IPs: $clusterNetworkIps"
    } else {
      Write-Information "No running clusters found"
      $responseObject['clusterNetworkIps'] = @()
    }
  } catch {
    # Prevent any possible errors from clobbering JSON output
    $responseObject['failureInfo'] = $_.Exception.Message
  } finally {
    Stop-Transcript | Out-Null
    $scriptEndTime = Get-Date
    $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
    Echo $responseObject | ConvertTo-Json -Compress
  }
`
];

// For now, we copy only the scripts that are needed to create a database.
const COPY_SCIRPTS_TO_MANAGE_RESOURCE = (s3SignedUrl: string) => [
    `
    $ProgressPreference = 'SilentlyContinue'
    $ErrorActionPreference = "Stop"
    $responseObject = @{}
    $scriptStartTime = Get-Date
    $s3SignedUrl = '${s3SignedUrl}'

    $SsmFolderPath = "C:\\SSM"
    $DBCreatePath = "C:\\SSM\\dbcreate"

    try {
      # Create cfn folder if it doesn't exist. Might be needed for some scripts.
      $cfnpath = "C:\\cfn"
      if (-not (Test-Path $cfnpath)) {
          $null = New-Item -ItemType Directory -Path $cfnpath
      }
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $Null = Invoke-WebRequest -Uri $s3SignedUrl -OutFile $Env:Temp\\dbcreate.zip
      $Null = Expand-Archive -Path $Env:Temp\\dbcreate.zip -DestinationPath $SsmFolderPath -Force
      
      # Move extracted dbcreate scripts from C:\\SSM\\dbcreate to C:\\SSM
      Copy-Item -Path "C:\\SSM\\dbcreate\\*" -Destination $SsmFolderPath -Recurse -Force
      
      # Delete C:\\SSM\\dbcreate, there is no complain about existing files/folders on re-download
      Remove-Item $DBCreatePath -Force  -Recurse -ErrorAction SilentlyContinue
    
      Get-ChildItem -path $SsmFolderPath -Recurse -Force | ForEach {
        $_.Attributes = $_.Attributes -bor [System.IO.FileAttributes]::Hidden -bor [System.IO.FileAttributes]::ReadOnly
      }

      (Get-Item $SsmFolderPath -Force).Attributes = [System.IO.FileAttributes]::Hidden
    } catch {
      $responseObject['failureInfo'] = $_.Exception.Message
    } finally {
      $scriptEndTime = Get-Date
      $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
      Echo $responseObject | ConvertTo-Json -Compress
    } 
`
];

const GET_MISSING_RESOURCE_DETAILS = [
    `
  $ErrorActionPreference = "Stop"
  $responseObject = @{}
  $scriptStartTime = Get-Date
  $isPS7Available = $False
  
  try {
    If (Get-Command -Name pwsh -ErrorAction SilentlyContinue) {
      $isPS7Available = $True
    }

    $requiredPsModuleList = @(${REQUIRED_PS_MODULES_FOR_MANAGEMENT})

    $availablePsModuleList = (Get-Module -ListAvailable -Name $requiredPsModuleList).Name
    $unavailablePsModuleList = $requiredPsModuleList | ? { $_ -NotIn $availablePsModuleList}

  } catch {
    # Prevent any possible errors from clobbering JSON output
    $responseObject['failureInfo'] = $_.Exception.Message
  } finally {
    $responseObject['${IS_PS7_AVAILABLE}'] = $isPS7Available

    if ($unavailablePsModuleList.Count -gt 0) {
      $responseObject['${UNAVAILABLE_PS_MODULES}'] = $unavailablePsModuleList;
    }

    $scriptEndTime = Get-Date
    $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
    Echo $responseObject | ConvertTo-Json -Compress
  } 
`
];

const INSTALL_WF_POWERSHELL_PREREQS_PS1 = (requiredModules: string, s3SignedURL: string) => [
    `
    $ProgressPreference = 'SilentlyContinue'
    Set-Variable -Option Constant -Name MODULE_INSTALL_STATE_FILE -Value 'NtapPsModuleInstallInProgressFile'
    Set-Variable -Option Constant -Name NTAP_WF_MODULE_INSTALL_JOB -Value 'NtapWfModuleInstallJob'
    
    $ErrorActionPreference = "Stop"
    $responseObject = @{}
    $scriptStartTime = Get-Date
    $exceptionInfo = $null
  
    function Install-ModulesFromS3 {
      param (
          [string]$s3SignedUrl,
          [array]$unavailableModuleList
      )
      if($unavailableModuleList.Count -gt 0) {
        $Null = Invoke-WebRequest -Uri $s3SignedUrl -OutFile "$Env:Temp\\dependent-packages.zip"
        $Null = Expand-Archive -Path "$Env:Temp\\dependent-packages.zip" -DestinationPath $Env:Temp -Force
        Unblock-File -Path "$Env:Temp\\dependent-packages\\powershell\\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
    
        $destinationPath = "C:\\Program Files\\PackageManagement\\ProviderAssemblies"
        $destinationPathExists = Test-Path -Path $destinationPath
        if ($destinationPathExists -eq $False) {
            New-Item -ItemType Directory -Path $destinationPath -Force
        }

        $nugetDestinationPath = Join-Path -Path $destinationPath -ChildPath "Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll"
        $nugetDestinationPathExists = Test-Path -Path $nugetDestinationPath
        if ($nugetDestinationPathExists -eq $False) {
            Copy-Item "$Env:Temp\\dependent-packages\\powershell\\Microsoft.PackageManagement.NuGetProvider-2.8.5.208.dll" -Destination $destinationPath -Recurse -Force
        }
    
        $sourcelocation = "$Env:Temp\\dependent-packages\\aws"
        Import-PackageProvider -Name NuGet
        try {
            Unregister-PSRepository -Name 'AWS'
        } catch {}
        Register-PSRepository -Name 'AWS' -SourceLocation $sourcelocation -InstallationPolicy Trusted
    
        ForEach ($moduleName in $unavailableModuleList) {
            Install-Module -Name $moduleName -Repository 'AWS' -SkipPublisherCheck -Force -AllowClobber -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        }
    
        try {
            Remove-Item -LiteralPath "$Env:Temp\\dependent-packages" -Force -Recurse
            Remove-Item -LiteralPath "$Env:Temp\\dependent-packages.zip" -Force -Recurse
        } catch {}
      }
    }
  
    try {
      $requiredModuleList = @(${requiredModules})
      $s3SignedUrl = '${s3SignedURL}'
      $PSToolkitRequiredVersion = '9.15.1.2407'

      $availableModuleList = (Get-Module -ListAvailable -Name $requiredModuleList).Name
      $unavailableModuleList = $requiredModuleList | ? { $_ -NotIn $availableModuleList}
      
      If ($unavailableModuleList.Count -gt 0) {
  
        #Check if private network
        $isprivatesubnet = $True
        try {
          $connection =  Invoke-WebRequest www.powershellgallery.com -UseBasicParsing 
          if($connection.StatusCode -ne "200") {
            $isprivatesubnet = $True}
          else {
            $isprivatesubnet = $False} 
        } catch {
         $isprivatesubnet = $True
         }
        $responseObject['isprivatesubnet'] =  $isprivatesubnet
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  
        If($isprivatesubnet -eq $False){
          try {
       
            If (-Not (Get-PSRepository -Name PSGallery -ErrorAction SilentlyContinue -WarningAction SilentlyContinue)) {
              Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
            }
            If (-Not (Find-PackageProvider -Name 'Nuget' -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -Force)) {
              If (-Not (Install-PackageProvider -Name 'NuGet' -MinimumVersion 2.8.5.201 -Force -ForceBootstrap -WarningAction SilentlyContinue -ErrorAction SilentlyContinue)) {
                throw "Failed to install NuGet package provider, Error: $($Error[0].Exception.Message)"
              }
            }
            If ((Get-PackageProvider -Name NuGet).version -lt [System.version]"2.8.5.201") {
              If (-Not (Install-PackageProvider -Name 'NuGet' -MinimumVersion 2.8.5.201 -Force -ForceBootstrap -WarningAction SilentlyContinue -ErrorAction SilentlyContinue)) {
                throw "Failed to install NuGet package provider, Error: $($Error[0].Exception.Message)"
              }
            }
  
            ForEach ($moduleName in $unavailableModuleList) {
                if($moduleName -eq 'NetApp.ONTAP') {
                  Install-Module -Name netapp.ontap -Force -AllowClobber -SkipPublisherCheck -RequiredVersion $PSToolkitRequiredVersion -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
                }
                else {
                  Install-Module -Name $moduleName -Force -AllowClobber -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
                }
            }
          } catch {
            $availableModuleList = (Get-Module -ListAvailable -Name $requiredModuleList).Name
            $unavailableModuleList = $requiredModuleList | ? { $_ -NotIn $availableModuleList}
            Install-ModulesFromS3 -s3SignedUrl $s3SignedUrl -unavailableModuleList $unavailableModuleList
          }
        }Else{
          Install-ModulesFromS3 -s3SignedUrl $s3SignedUrl -unavailableModuleList $unavailableModuleList
        }
      }
    } catch {
      $exceptionInfo = $_.Exception.Message
    } finally {
      $finallyAvailableModuleList = (Get-Module -ListAvailable -Name $requiredModuleList).Name
      $responseObject['availablePSModules'] = $finallyAvailableModuleList
      if ($exceptionInfo) {
        $responseObject['${FAILURE_INFO}'] = $exceptionInfo
      } else {
        $finallyUnavailableModuleList = $requiredModuleList | ? { $_ -NotIn $finallyAvailableModuleList}
        if ($finallyUnavailableModuleList.Count -gt 0) {
          $responseObject['${FAILURE_INFO}'] = 'PowerShell module(s) "{0}" could not be installed.' -f $finallyUnavailableModuleList
        }
      }
  
      $scriptEndTime = Get-Date
      $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
      Echo $responseObject | ConvertTo-Json -Compress
    }
  `
];

const GET_ACTIVE_DIRECTORY_DETAILS = [
    `
  $ErrorActionPreference = "Stop"
  $responseObject = @{}
  $scriptStartTime = Get-Date
  $responseObject['${ACTIVE_DIRECTORY}'] = ""

  try {
    $adDomainName = (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue -WarningAction SilentlyContinue).Domain
    If ($adDomainName -ne "WORKGROUP") {
      $adIpList = ([System.Net.Dns]::GetHostEntry($adDomainName)).AddressList.IpAddressToString
      if ($adIpList -IsNot [System.Array]) {
        $adIpList = @($adIpList)
      }

      $adObject = New-Object PSObject -Property @{ "domainName" = $adDomainName }
      $adObject | Add-Member -MemberType NoteProperty -Name "ipAddresses" -Value $adIpList
      $responseObject['${ACTIVE_DIRECTORY}'] = $adObject
    }
  } catch {
    $responseObject['${FAILURE_INFO}'] = $_.Exception.Message
  } finally {
    $scriptEndTime = Get-Date
    $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
    Echo $responseObject | ConvertTo-Json -Compress
  } 
`
];

/**
 * Generates a PowerShell script to download and install PowerShell 7 from a given S3 signed URL.
 *
 * The script performs the following steps:
 * 1. Downloads a ZIP file containing the PowerShell 7 installer from the provided S3 signed URL.
 * 2. Extracts the ZIP file to a temporary directory.
 * 3. Executes the MSI installer with specific options to install PowerShell 7.
 * 4. Adds the installation path to the system's environment PATH variable if the installation is successful.
 * 5. Above step adds path to the registry. $env:path will not be updated until reboot.
 * 6. Captures and logs any errors encountered during the process.
 * 7. Outputs the script execution time and any failure information as a JSON object.
 *
 * @param s3SignedURL - The signed URL to the S3 location of the PowerShell 7 ZIP file.
 * @returns A PowerShell script as a string array that performs the installation.
 */
const INSTALL_POWERSHELL_7 = (s3SignedURL: string) => [
    `
  function Add-EnvPath {
      param([string] $Path)

      $envPaths = [Environment]::GetEnvironmentVariable('Path', [EnvironmentVariableTarget]::Machine) -split ';'
      if ($envPaths -notcontains $Path) {
        [Environment]::SetEnvironmentVariable('Path', ($envPaths + $Path) -join ';', [EnvironmentVariableTarget]::Machine)
        }
      }

  $ProgressPreference = 'SilentlyContinue'
  $ErrorActionPreference = "Stop"
  $responseObject = @{}
  $scriptStartTime = Get-Date



  try {
    $isPS7Available = [bool](Get-Command -Name pwsh -ErrorAction SilentlyContinue)
    if ($isPS7Available -eq $True) {
      throw "PowerShell 7 is already installed"
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri '${s3SignedURL}' -OutFile "$Env:Temp\\powershell.zip"
    Expand-Archive -Path "$Env:Temp\\powershell.zip" -DestinationPath $Env:Temp -Force
    msiexec.exe /package "$Env:Temp\\powershell\\powershell7.msi"  /quiet ADD_EXPLORER_CONTEXT_MENU_OPENPOWERSHELL=1 ADD_FILE_CONTEXT_MENU_RUNPOWERSHELL=1 ENABLE_PSREMOTING=1 REGISTER_MANIFEST=1 USE_MU=1 ENABLE_MU=1 ADD_PATH=1
    Start-Sleep -Seconds 5
    if (Test-Path "C:\\Program Files\\PowerShell\\7") {
      Add-EnvPath -Path "C:\\Program Files\\PowerShell\\7"
    } else {
      throw "Failed to install PowerShell 7.5.0"
      }
    $responseObject['status'] = "success"
  } catch {
    $responseObject['${FAILURE_INFO}'] = $_.Exception.Message
    $responseObject['status'] = "failed"
    if($_.Exception.Message -like "*PowerShell 7 is already installed*") {
      $responseObject['status'] = "warning"
    }
  } finally {
    $responseObject['scriptExecutionTime'] = ((Get-Date) - $scriptStartTime).TotalMilliseconds
    Echo $responseObject | ConvertTo-Json -Compress
  }
`
];

/**
 * A PowerShell script embedded as a string array to check the availability of PowerShell 7 (pwsh).
 *
 * The script performs the following actions:
 * - Appends the PowerShell 7 installation path (`C:\Program Files\PowerShell\7`) to the system's PATH environment variable.
 * - Checks if the `pwsh` command is available using `Get-Command`.
 * - Captures the result in a response object with the key `${IS_PS7_AVAILABLE}` indicating the availability of PowerShell 7.
 * - Handles any exceptions by storing the failure information in the response object.
 * - Measures the script execution time and includes it in the response object.
 * - Outputs the response object as a compressed JSON string.
 *
 * This script is useful for environments where the presence of PowerShell 7 needs to be programmatically verified.
 */
const CHECK_POWERSHELL7_AVAILABLE = [
    `
  $ErrorActionPreference = "Stop"
  $responseObject = @{}
  $scriptStartTime = Get-Date

  try {
  $env:path = $env:path + ";C:\\Program Files\\PowerShell\\7"
  $isPS7Available = [bool](Get-Command -Name pwsh -ErrorAction SilentlyContinue)
  $responseObject['${IS_PS7_AVAILABLE}'] = $isPS7Available
  } catch {
  $responseObject['failureInfo'] = $_.Exception.Message
  $responseObject['status'] = "failed"
  } finally {
  $responseObject['scriptExecutionTime'] = ((Get-Date) - $scriptStartTime).TotalMilliseconds
  $responseObject['status'] = "success"
  Echo $responseObject | ConvertTo-Json -Compress
  }
`
];

export {
    HOST_AND_SQL_INFO_PS1,
    SQL_SERVER_VERSION_TO_YEAR,
    CLUSTER_NETWORK_IP_INFO_PS1,
    COPY_SCIRPTS_TO_MANAGE_RESOURCE,
    GET_MISSING_RESOURCE_DETAILS,
    IS_PS7_AVAILABLE,
    UNAVAILABLE_PS_MODULES,
    IS_DATABASE_CREATE_POSSIBLE,
    REQUIRED_PS_MODULES_FOR_MANAGEMENT,
    INSTALL_WF_POWERSHELL_PREREQS_PS1,
    FAILURE_INFO,
    ACTIVE_DIRECTORY,
    GET_ACTIVE_DIRECTORY_DETAILS,
    INSTALL_POWERSHELL_7,
    CHECK_POWERSHELL7_AVAILABLE,
    FEATURE_PREPREQUISITES,
    SQL_PERMISSIONS
};
