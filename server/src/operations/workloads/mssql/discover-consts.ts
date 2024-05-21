import { SqlServerDeploymentModel } from '../../../utils/consts';

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
  'NetApp.ONTAP'
`;

const REQUIRED_DATABASE_CREATE_FILE_LIST: string = `
  'C:\\SSM\\Cleanup-ONTAP.ps1',
  'C:\\SSM\\Configure-LUNs.ps1',
  'C:\\SSM\\Create-Database.ps1',
  'C:\\SSM\\Invoke-virtualmount.ps1',
  'C:\\SSM\\NewDB_Initialize-Iscsidisk.ps1'
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

    $DriveTargetMap = @{}
    ForEach ($item in $DriveLetteriScsiTargetAddress) {
      If ($item.DriveLetters -eq $null) {
        Continue
      }

      If ($item.TargetAddress -ne $null) {
        $item.DriveLetters | ForEach-Object {
          $DriveTargetMap.Add($_, $item.TargetAddress)
        }
      } ElseIf ($item.SerialNumber -ne $null) {
        $item.DriveLetters | ForEach-Object {
          $DriveTargetMap.Add($_, $item.SerialNumber)
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

  Function GetSQLInstanceDriveDetails($serverInstance) {

    $sqlInstancePaths = sqlcmd -Q " SET NOCOUNT ON; SELECT physical_name FROM sys.master_files " -h -1 -b -C -W -S $serverInstance
    if($sqlInstancePaths -eq $null) { 
      $sqlInstancePaths = sqlcmd -Q " SET NOCOUNT ON; SELECT filename as Path FROM sys.sysdatabases " -h -1 -b -C -W -S $serverInstance
    }

    $sqlInstanceDriveLetterOrPathList = @()
    ForEach ($path in $sqlInstancePaths) {
      $path = $path.TrimStart('\\')
      $driveOrPath = ($path -split '\\\\')[0]
      $sqlInstanceDriveLetterOrPathList += $driveOrPath
      }
    return ($sqlInstanceDriveLetterOrPathList | Select -Unique)

      }
  
  try {
    $responseObject = @{}
    $instanceSectionStartTime = Get-Date
    $sqlServiceList = Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}
    $DiskTargetInfoMap = GetDiskDriveDetails
    $MappedDrivesWithPath, $RegistryErrors = GetSMBMappedDrivesWithPath
    $SMBConnections = GetSMBConnections
  
    $instancesInfoList = ForEach ($sqlService in $sqlServiceList) {
      $responseObject = @{}
      $instanceSectionStartTime = Get-Date
  
      If ($DiskTargetInfoMap.Count -le 0) {
        $body['failureInfo'] += "Failed to get drive letter and disk target details\`n"
      }

      If ($RegistryErrors) {
        $responseObject['failureInfo'] += "Errors seen while reading Windows Registry: $RegistryErrors.\`n"
      }

      If ($MappedDrivesWithPath.Count -le 0) {
        $responseObject['failureInfo'] += "Failed to get network drives from Windows Registry.\`n"
      }
  
      $editionDBCountMachineInfo = @($null, $null, $null)
      $responseObject['windowsAuthentication'] = $False
      $sqlServerInstanceStorageInfo = $null
  
      $isDefaultInstance = -Not $sqlService.Name.Contains('$')
      $responseObject['isDefaultInstance'] = $isDefaultInstance
      $instanceName = $sqlService.Name -Replace "MSSQL\\$", ""
  
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

      $clusterServiceStatus = (Get-Service -Name ClusSvc -ErrorAction SilentlyContinue).Status
      if ($clusterServiceStatus -eq "Running") {
        $clusterName = (Get-Cluster -ErrorAction SilentlyContinue).Name
        If ($clusterName) {
          $responseObject['sqlServerNodes'] = (Get-ClusterOwnerNode -ResourceType "SQL Server Availability Group" -ErrorAction SilentlyContinue).OwnerNodes.NodeName
          $responseObject['nodeIpDetails'] =  (Get-ClusterOwnerNode -ResourceType "SQL Server Availability Group" -ErrorAction SilentlyContinue).OwnerNodes | ForEach-Object { $nodeName = $_.NodeName; $ipAddress = (Resolve-DnsName -Name $nodeName -Type A | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress; "$nodeName - $ipAddress" }
          
          If (Get-ClusterResource -ErrorAction SilentlyContinue | ? { $_.ResourceType -eq "SQL Server Availability Group" }) {
            $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_AOAG_SHORT}'
          } else {
            $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_FCI_SHORT}'
          }
        } Else {
          $responseObject['failureInfo'] += "\${instanceName}: Cluster details not available." +
          " If AOAG cluster, the remote server may be paused or is in the process of being started." +
          " If FCI cluster, make sure the cluster service is running on all nodes in the cluster.\`n"
        }
      } else {
        $responseObject['sqlServerNodes'] = hostname
        $responseObject['${SQL_SERVER_DEPLOYMENT_TYPE}'] = '${SqlServerDeploymentModel.SQL_STANDALONE_SHORT}'
      }
  
      if ($sqlService.State -eq "Running") {
        Get-Command -Type Application sqlcmd > $null 2> $null
        If ($? -eq $True) {
          $serverInstance = If ($isDefaultInstance) { "$Env:ComputerName" } Else { "$Env:ComputerName\\$instanceName" }
          $editionDBCountMachineInfo = sqlcmd -h -1 -C -W -l 3 -S $serverInstance -Q "SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition'); SELECT count(name) FROM sys.databases; SELECT SERVERPROPERTY('MachineName')" 2> $null
          $responseObject['windowsAuthentication'] = $?
  
          $responseObject['sqlServerEdition'] = $editionDBCountMachineInfo[0]
          $responseObject['databaseCount'] = $editionDBCountMachineInfo[1]
          $responseObject['sqlServerName'] = $editionDBCountMachineInfo[2]
  
          $sqlInstanceDriveLetterOrPathList = GetSQLInstanceDriveDetails($serverInstance)
          
          if ($? -eq $False) {
            $responseObject['failureInfo'] += "\${instanceName}: Failed to get drive letters of databases. Reason: $sqlInstanceDriveLetterList\`n"
          }
  
          $sqlServerInstanceStorageInfo = ForEach ($sqlInstanceDriveLetterOrPath in $sqlInstanceDriveLetterOrPathList) {
            
            if ($DiskTargetInfoMap.Keys -contains $sqlInstanceDriveLetterOrPath) {
            New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $DiskTargetInfoMap[$sqlInstanceDriveLetterOrPath] }}
            elseif ($SMBConnections -contains $sqlInstanceDriveLetterOrPath) {
            New-Object -TypeName PSObject -Property @{ SmbSharePath = $sqlInstanceDriveLetterOrPath }     
            }
            elseif($MappedDrivesWithPath.Keys -contains $sqlInstanceDriveLetterOrPath) { 

                  New-Object -TypeName PSObject -Property @{ SmbSharePath = $MappedDrivesWithPath[$sqlInstanceDriveLetterOrPath] }  
                  
            }
            }
          
        } else {
          $responseObject['failureInfo'] += "\${instanceName}: SQLCMD.EXE not available\`n"
        }
      }

      $responseObject['sqlServerInstanceStorageInfo'] = $sqlServerInstanceStorageInfo | ConvertTo-Json -Compress
      $instanceSectionEndTime = Get-Date
      $responseObject['scriptExecutionTime'] = (($instanceSectionEndTime - $instanceSectionStartTime).TotalMilliseconds)
      Echo $responseObject
    }
    Echo $instancesInfoList | ConvertTo-Json
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
  $ErrorActionPreference = "Stop"
  $responseObject = @{}
  $scriptStartTime = Get-Date
  $clusterNetworkIps = $null
  
  try {
    $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

    if ($clusterServiceStatus -eq "Running") {
      $clusterNetworkIps = (Get-ClusterNetworkInterface).Ipv4Addresses
      $responseObject['clusterNetworkIps'] = $clusterNetworkIps
    } else {
      $responseObject['clusterNetworkIps'] = @()
    }
  } catch {
    # Prevent any possible errors from clobbering JSON output
    $responseObject['failureInfo'] = $_.Exception.Message
  } finally {
    $scriptEndTime = Get-Date
    $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
    Echo $responseObject | ConvertTo-Json -Compress
  }
`
];

// For now, we copy only the scripts that are needed to create a database.
const COPY_SCIRPTS_TO_MANAGE_RESOURCE = (s3SignedUrl: string) => [
    `
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
  $isDatabaseCreatePossible = $False
  
  try {
    If (Get-Command -Name pwsh -ErrorAction SilentlyContinue) {
      $isPS7Available = $True
    }

    $databaseCreateFileList = @(${REQUIRED_DATABASE_CREATE_FILE_LIST})

    $isDatabaseCreatePossible = If ((Test-path -path $databaseCreateFileList -PathType Leaf) -contains $False) { $False } Else { $True }
    $requiredPsModuleList = @(${REQUIRED_PS_MODULES_FOR_MANAGEMENT})

    $availablePsModuleList = (Get-Module -ListAvailable -Name $requiredPsModuleList).Name
    $unavailablePsModuleList = $requiredPsModuleList | ? { $_ -NotIn $availablePsModuleList}

  } catch {
    # Prevent any possible errors from clobbering JSON output
    $responseObject['failureInfo'] = $_.Exception.Message
  } finally {
    $responseObject['${IS_PS7_AVAILABLE}'] = $isPS7Available
    $responseObject['${IS_DATABASE_CREATE_POSSIBLE}'] = $isDatabaseCreatePossible

    if ($unavailablePsModuleList.Count -gt 0) {
      $responseObject['${UNAVAILABLE_PS_MODULES}'] = $unavailablePsModuleList;
    }

    $scriptEndTime = Get-Date
    $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
    Echo $responseObject | ConvertTo-Json -Compress
  } 
`
];

const INSTALL_WF_POWERSHELL_PREREQS_PS1 = (requiredModules: string) => [
    `
  Set-Variable -Option Constant -Name MODULE_INSTALL_STATE_FILE -Value 'NtapPsModuleInstallInProgressFile'
  Set-Variable -Option Constant -Name NTAP_WF_MODULE_INSTALL_JOB -Value 'NtapWfModuleInstallJob'
  
  $ErrorActionPreference = "Stop"
  $responseObject = @{}
  $scriptStartTime = Get-Date
  $exceptionInfo = $null

  try {
    $requiredModuleList = @(${requiredModules})
    $availableModuleList = (Get-Module -ListAvailable -Name $requiredModuleList).Name
    $unavailableModuleList = $requiredModuleList | ? { $_ -NotIn $availableModuleList}

    If ($unavailableModuleList.Count -gt 0) {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
     
      If (-Not (Get-PSRepository -Name PSGallery -ErrorAction SilentlyContinue -WarningAction SilentlyContinue)) {
        Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
      }
      
      If (-Not (Find-PackageProvider -Name 'Nuget' -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -Force)) {
        If (-Not (Install-PackageProvider -Name 'NuGet' -MinimumVersion 2.8.5.201 -Force -WarningAction SilentlyContinue -ErrorAction SilentlyContinue)) {
          throw "Failed to install NuGet package provider. "
        }
      }

      ForEach ($moduleName in $unavailableModuleList) {
          Install-Module -Name $moduleName -SkipPublisherCheck -Force -AllowClobber -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
      }
    }
  } catch {
    $exceptionInfo = $_.Exception.Message
  } finally {
    if ($exceptionInfo) {
      $responseObject['${FAILURE_INFO}'] = $exceptionInfo
    } else {
      $finallyAvailableModuleList = (Get-Module -ListAvailable -Name $requiredModuleList).Name
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
    GET_ACTIVE_DIRECTORY_DETAILS
};
