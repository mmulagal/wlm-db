   
param(
  [Parameter(Mandatory = $true)]
  [string]$SQLServer
)

# Get SQL server instance name
$SQLServiceList = Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}
$SQLInstanceName = "MSSQLSERVER"
$SQLInstanceNames = @()
ForEach ($sqlService in $sqlServiceList) {
$sqlServiceBinaryPath = $sqlService.PathName  -Replace "-s.*", ""
  If (Test-Path $sqlServiceBinaryPath.Replace('"', '')) {
    $SqlVersion = Invoke-Expression -Command "(dir $sqlServiceBinaryPath).VersionInfo"}
    $ValidSqlVersion = $SqlVersion.ProductVersion -match '^1[3-9]'
    If ($ValidSqlVersion -eq $true) {
        $InstanceName =  $sqlService.Name.Replace("MSSQL$", "") 
        $SQLInstanceNames += $InstanceName
    }} 

If ($SQLInstanceNames -NotContains "MSSQLSERVER") {
    $SQLInstanceName = $SQLInstanceNames[0]
}
Write-Output "SQL instance name $SQLInstanceName."

# Instance name to be passed to sqlcmd
$ServerInstanceName = "$env:COMPUTERNAME"
If($SQLInstanceName -ne "MSSQLSERVER") {
    $ServerInstanceName = "$env:COMPUTERNAME\$SQLInstanceName"
    
}
Write-Output "Sql server name $ServerInstanceName."

$Query = 'SELECT name FROM sys. databases'

try {
  #Execute a query with trusted connection. If you omit the server, it will default to localhost.
  Write-Output "Connecting with Windows Authentication"
  $results =  Invoke-Sqlcmd -ServerInstance $ServerInstanceName -ConnectionString "Data Source=$SqlServer; Integrated Security=True; TrustServerCertificate=True" -Query "$Query" 
  Write-Output "Connected with Windows Authentication" 
  Write-Output $results
    }
catch {
  Write-Output "A network-related or instance-specific error occurred while establishing a connection to SQL Server. The server was not 
        found or was not accessible. Verify that the instance name is correct and that SQL Server is configured to allow remote connections. "
      }
     

$cnt = ($results | Measure-Object).Count

try {if ($cnt -le 0) { throw '1' } }
catch { if ($_.Exception.Message -eq 1) { 
  Write-Output "No Database in SQL Server" 
  $_ | Write-AWSLaunchWizardException
  } 
  } 

 
 
