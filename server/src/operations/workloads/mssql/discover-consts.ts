/*
  The disks in an EC2 instance can be EBS, FSxN, FSxW or from CVO.
  This script collects serial-number of EBS disks, and the iSCSI
  connection IP for FSxN disks.  It returns a JSON object containing
  below details:
    - sqlServerInstance - Name of SQL Server instance, e.g., MSSQLSERVER.
    - sqlServerState    - The operational state of the SQL server instance.
    - sqlServerVersion  - Version of SQL Server instance, e.g., 16.0.4095.4.
    - sqlServerEdition  - Edition of SQL Server instance, e.g., 2022.
    - sqlDriveInfo      - JSON object containing a list of serial number
                          and/or iSCSI targets
  The sqlDriveInfo details help to identify the instance associated with
  an SQL Server instance.

  Example output:
    {
        "sqlServerVersion":  "16.0.4095.4",
        "sqlDriveInfo":  "[\r\n    {\r\n        \"SerialNumberOrScsiTarget\":  \"vol05109452537b7ad57_00000001.\"\r\n    },\r\n    {\r\n        \"SerialNumberOrScsiTarget\":  \"172.31.11.195\"\r\n    }\r\n]",
        "sqlServerInstance":  "MSSQLSERVER",
        "sqlServerState":  "Running",
        "sqlServerEdition":  2022,
        "windowsAuthentication":  true
    }

  Possible causes for unavailability of SQL Server details:
  - Insufficient permissions on sys.master_files view.
    Because of this, we won't be able to get the database file locations, due
    to which the script won't  get/return SerialNumberOrScsiTargets.  As a
    result, the storageType can't be determined while processing script output,
    which causes the API to return an empty  response for storageType.
 */
const hostAndSqlInfoPowerShellScript = [
    `
    $ErrorActionPreference = "Stop"
    $body = @{}
    (Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}) | SELECT Name, State, PathName | ForEach {
        $instanceSectionStartTime = (Get-Date)
        $instance = $_.Name -Replace "MSSQL\\$", ""
        $state = $_.State
        $path = $_.PathName  -Replace "-s.*",""
        $body['windowsAuthentication'] = $False
        $sqlDriveInfo = $Null

        try {
          if ($state -eq "Running") {
            Get-Command sqlcmd > Out-Null
            $serverInstance = If ($instance -ne "MSSQLSERVER" -And -$instance -ne "SQLEXPRESS") { "$Env:ComputerName\\$instance" } Else { "$Env:ComputerName" }
            sqlcmd -Q "SELECT @@serviceName" -C -S $serverInstance -l 1 2> Out-Null | Out-Null
            $body['windowsAuthentication'] = $?

            $sqlDrives = sqlcmd -Q " SET NOCOUNT ON; SELECT DISTINCT LEFT(physical_name, 1) AS DriveLetter FROM sys.master_files " -h -1 -C -W -S $serverInstance | ConvertTo-Json
            if ($sqlDrives) {
              $sqlDriveInfo = Get-PhysicalDisk | ForEach-Object {
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
        $sqlversion = $info.FileVersionRaw.Major
    
        $body['sqlServerInstance'] = $instance
        $body['sqlServerState'] = $state
        $body['sqlServerVersion'] = $productversion
        $body['sqlServerEdition'] = $sqlversion
        $body['sqlDriveInfo'] = $sqlDriveInfo

        $instanceSectionEndTime = (Get-Date)
        $body['scriptExecutionTime'] = (($instanceSectionEndTime - $instanceSectionStartTime).TotalMilliseconds)
        Echo $body | ConvertTo-Json
    } | ConvertFrom-Json | ConvertTo-Json
    `
];

// eslint-disable-next-line import/prefer-default-export
export { hostAndSqlInfoPowerShellScript };
