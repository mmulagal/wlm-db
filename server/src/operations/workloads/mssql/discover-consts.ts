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
    (Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}) | SELECT Name, State, PathName | ForEach {
      $body = @{}
      $instanceSectionStartTime = (Get-Date)
      $instance = $_.Name -Replace "MSSQL\\$", ""
      $state = $_.State
      $path = $_.PathName  -Replace "-s.*",""
      $body['windowsAuthentication'] = $False
      $sqlServerNodes = hostname
      $editionDBCountMachineInfo = @($null, $null, $null)
      $sqlServerInstanceStorageInfo = $null

      try {
        if ( (Get-Service -Name ClusSvc -ErrorAction SilentlyContinue) -AND (Get-Cluster -ErrorAction SilentlyContinue) ) {
            $sqlServerNodes = Get-ClusterResource -Name "SQL Server"  | Get-ClusterOwnerNode | Select OwnerNodes  | forEach  { $_.OwnerNodes.NodeName }
          }

        if ($state -eq "Running") {
          Get-Command sqlcmd > Out-Null
          $serverInstance = If ($instance -ne "MSSQLSERVER" -And $instance -ne "SQLEXPRESS") { "$Env:ComputerName\\$instance" } Else { "$Env:ComputerName" }
          $editionDBCountMachineInfo = sqlcmd -h -1 -C -W -l 3 -S $serverInstance -Q "SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition'); SELECT count(name) FROM sys.databases; SELECT SERVERPROPERTY('MachineName')" 2> Out-Null
          $body['windowsAuthentication'] = $?
          $sqlDrives = sqlcmd -Q " SET NOCOUNT ON; SELECT DISTINCT LEFT(physical_name, 1) AS DriveLetter FROM sys.master_files " -h -1 -C -W -S $serverInstance | ConvertTo-Json
          if ($sqlDrives) {
            $sqlServerInstanceStorageInfo = Get-PhysicalDisk | ForEach-Object {
            $a = $_
              Get-Partition | ForEach-Object {
                $b = $_
                if (($b.DriveLetter -ne $null) -and ($a.DeviceId -eq $b.diskNumber) -and ($sqlDrives.contains($b.DriveLetter))) {
                  if ($a.BusType -eq "NVMe") {
                    New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $a.serialnumber }
                  } elseif ($a.BusType -eq "iSCSI") {
                    $scsiTarget = (get-disk | Where { $_.BusType -eq  'iSCSI' } | Get-IscsiConnection).TargetAddress | Select -Unique
                    $scsiTarget | ForEach-Object {
                      New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $_ }
                    }
                  } else { 
                            $smbShares = Get-SMBMapping | select "RemotePath" 
                            $smbShares | ForEach-Object {
                                New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $_.RemotePath 
                                }
                    }
                  }
                }
              }
            } | ConvertTo-Json
          }
        }
      } catch {
        # Prevent any possible errors from clobbering JSON output
      }

      $info = Invoke-Expression -Command "(dir $path).VersionInfo"
      $productversion = $info.ProductVersion
      $productMajorVersion = $info.ProductMajorPart
    
      $body['sqlServerInstance'] = $instance
      $body['sqlServerState'] = $state
      $body['sqlServerVersion'] = $productversion
      $body['sqlServerMajorVersion'] = $productMajorVersion
      $body['sqlServerInstanceStorageInfo'] = $sqlServerInstanceStorageInfo
      $body['sqlServerNodes'] = $sqlServerNodes
      $body['sqlServerEdition'] = $editionDBCountMachineInfo[0]
      $body['databaseCount'] = $editionDBCountMachineInfo[1]
      $body['sqlServerName'] = $editionDBCountMachineInfo[2]

      $instanceSectionEndTime = (Get-Date)
      $body['scriptExecutionTime'] = (($instanceSectionEndTime - $instanceSectionStartTime).TotalMilliseconds)
      Echo $body | ConvertTo-Json
    } | ConvertFrom-Json | ConvertTo-Json
    `
];

export { HOST_AND_SQL_INFO_PS1, SQL_SERVER_VERSION_TO_YEAR };
