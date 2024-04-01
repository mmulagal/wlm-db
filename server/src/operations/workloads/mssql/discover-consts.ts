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



Possible causes for unavailability of SQL Server details:
- Insufficient permissions on sys.master_files view.
Because of this, we won't be able to get the database file locations, due
to which the script won't  get/return SerialNumberOrScsiTargets.  As a
result, the storageType can't be determined while processing script output,
which causes the API to return an empty  response for storageType.
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
  
  try {
    $body = @{}
    $instanceSectionStartTime = Get-Date
    $sqlServiceList = Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}
    $DiskTargetInfoMap = GetDiskDriveDetails
  
    ForEach ($sqlService in $sqlServiceList) {
      $body = @{}
      $instanceSectionStartTime = Get-Date
  
      If ($DiskTargetInfoMap.Count -le 0) {
        $body['failureInfo'] += "Failed to get drive letter and disk target details\`n"
      }
  
      $editionDBCountMachineInfo = @($null, $null, $null)
      $body['windowsAuthentication'] = $False
      $sqlServerInstanceStorageInfo = $null
  
      $isDefaultInstance = -Not $sqlService.Name.Contains('$')
      $body['isDefaultInstance'] = $isDefaultInstance
      $instanceName = $sqlService.Name -Replace "MSSQL\\$", ""
  
      $sqlServiceBinaryPath = $sqlService.PathName  -Replace "-s.*", ""
      if (Test-Path $sqlServiceBinaryPath.Replace('"', '')) {
        $info = Invoke-Expression -Command "(dir $sqlServiceBinaryPath).VersionInfo"
        $body['sqlServerMajorVersion'] = $info.ProductMajorPart
        $body['sqlServerVersion'] = $info.ProductVersion
      } else {
        $body['failureInfo'] += "\${instanceName}: Path $sqlServiceBinaryPath does not exist\`n"
      }
  
      $body['sqlServerInstance'] = $instanceName
      $body['sqlServerState'] = $sqlService.State
  
      if ((Get-Service -Name ClusSvc -ErrorAction SilentlyContinue) -And (Get-Cluster -ErrorAction SilentlyContinue)) {
        $body['sqlServerNodes'] = (Get-ClusterOwnerNode -Resource "SQL Server").OwnerNodes.NodeName
      } else {
        $body['sqlServerNodes'] = hostname
      }
  
      if ($sqlService.State -eq "Running") {
        Get-Command -Type Application sqlcmd > $null 2> $null
        If ($? -eq $True) {
          $serverInstance = If ($isDefaultInstance) { "$Env:ComputerName" } Else { "$Env:ComputerName\\$instanceName" }
          $editionDBCountMachineInfo = sqlcmd -h -1 -C -W -l 3 -S $serverInstance -Q "SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition'); SELECT count(name) FROM sys.databases; SELECT SERVERPROPERTY('MachineName')" 2> $null
          $body['windowsAuthentication'] = $?
  
          $body['sqlServerEdition'] = $editionDBCountMachineInfo[0]
          $body['databaseCount'] = $editionDBCountMachineInfo[1]
          $body['sqlServerName'] = $editionDBCountMachineInfo[2]
  
          $sqlInstanceDriveLetterList = sqlcmd -Q " SET NOCOUNT ON; SELECT DISTINCT LEFT(physical_name, 2) AS DriveLetter FROM sys.master_files " -h -1 -b -C -W -S $serverInstance
          if ($? -eq $False) {
            $body['failureInfo'] += "\${instanceName}: Failed to get drive letters of databases. Reason: $sqlInstanceDriveLetterList\`n"
          }
  
          $sqlServerInstanceStorageInfo = ForEach ($sqlInstanceDriveLetter in $sqlInstanceDriveLetterList) {
            New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $DiskTargetInfoMap[$sqlInstanceDriveLetter] }
          }
        } else {
          $body['failureInfo'] += "\${instanceName}: SQLCMD.EXE not available\`n"
        }
      }

      $body['sqlServerInstanceStorageInfo'] = $sqlServerInstanceStorageInfo | ConvertTo-Json -Compress
      $instanceSectionEndTime = Get-Date
      $body['scriptExecutionTime'] = (($instanceSectionEndTime - $instanceSectionStartTime).TotalMilliseconds)
      Echo $body | ConvertTo-Json
    }
  } catch {
    # Prevent any possible errors from clobbering JSON output
    $body['failureInfo'] += "Exception: $_\`n"
    $instanceSectionEndTime = Get-Date
    $body['scriptExecutionTime'] = (($instanceSectionEndTime - $instanceSectionStartTime).TotalMilliseconds)
    Echo $body | ConvertTo-Json
  }
`
];

const CLUSTER_NETWORK_IP_INFO_PS1 = [
    `
  $ErrorActionPreference = "Stop"
  $body = @{}
  $scriptStartTime = Get-Date
  $clusterNetworkIps = $null
  
  try {
    $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

    if ($clusterServiceStatus -eq "Running") {
      $clusterNetworkIps = (Get-ClusterNetworkInterface).Ipv4Addresses
      $body['clusterNetworkIps'] = $clusterNetworkIps
    } else {
      $body['clusterNetworkIps'] = @()
    }
  } catch {
    # Prevent any possible errors from clobbering JSON output
    $body['failureInfo'] = $_.Exception.Message
  } finally {
    $scriptEndTime = Get-Date
    $body['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
    Echo $body | ConvertTo-Json -Compress
  }
`
];

// For now, we copy only the scripts that are needed to create a database.
const COPY_SCIRPTS_TO_MANAGE_RESOURCE = (s3SignedUrl: string) => [
    `
    $ErrorActionPreference = "Stop"
    $body = @{}
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
      $body['failureInfo'] = $_.Exception.Message
    } finally {
      $scriptEndTime = Get-Date
      $body['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)
      Echo $body | ConvertTo-Json -Compress
    } 
`
];

export {
    HOST_AND_SQL_INFO_PS1,
    SQL_SERVER_VERSION_TO_YEAR,
    CLUSTER_NETWORK_IP_INFO_PS1,
    COPY_SCIRPTS_TO_MANAGE_RESOURCE
};
