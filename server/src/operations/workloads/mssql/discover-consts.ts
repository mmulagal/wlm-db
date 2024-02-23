const hostAndSqlInfoPowerShellScript = [
    `
    $ErrorActionPreference = "Stop"

    $body = @{}
    (Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}) | SELECT Name, State, PathName | ForEach {
    
        $instance = $_.Name -Replace "MSSQL\\$", ""
        $state = $_.State
        $path = $_.PathName  -Replace "-s.*",""
        $body['windowsAuthentication'] = $False

        try {
            if ($state -eq "Running") {
              Get-Command sqlcmd > Out-Nul
              $serverInstance = If ($instance -ne "MSSQLSERVER") { "$Env:ComputerName\\$instance" } Else { "$Env:ComputerName" }
              sqlcmd -Q "SELECT @@serviceName" -C -S $serverInstance -l 1 2> Out-Null | Out-Null
              $body['windowsAuthentication'] = $?

              $sqlDrives = sqlcmd -Q " SET NOCOUNT ON; SELECT DISTINCT LEFT(physical_name, 1) AS DriveLetter FROM sys.master_files " -h -1 -C -W -S $serverInstance | ConvertTo-Json
              $sqlDriveInfo = Get-PhysicalDisk | ForEach-Object {
                $a = $_
                Get-Partition | ForEach-Object {
                  $b = $_
                  if (($b.DriveLetter -ne $null) -and ($a.DeviceId -eq $b.diskNumber) -and ($sqlDrives.contains($b.DriveLetter))) {
                    if ($a.BusType -eq "NVMe") {
                      New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $a.serialnumber }
                  } elseif ($a.BusType -eq "iSCSI") {
                    $scsiTarget = (get-disk | Where { $_.BusType -eq  'iSCSI' } | Get-IscsiConnection).TargetAddress
                    New-Object -TypeName PSObject -Property @{ SerialNumberOrScsiTarget = $scsiTarget }
                  }
                }
              }
            } | ConvertTo-Json
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
    
        Echo $body | ConvertTo-Json
    } | ConvertFrom-Json | ConvertTo-Json
    `
];

// eslint-disable-next-line import/prefer-default-export
export { hostAndSqlInfoPowerShellScript };
