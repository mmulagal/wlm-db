   
param(
  [Parameter(Mandatory = $true)]
  [string]$SQLServer
)
 

$Query = 'SELECT name FROM sys. databases'

try {
  #Execute a query with trusted connection. If you omit the server, it will default to localhost.
  Write-Output "Connecting with Windows Authentication"
  $results =  Invoke-Sqlcmd -ConnectionString "Data Source=$SqlServer; Integrated Security=True; TrustServerCertificate=True" -Query "$Query" 
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

 
 