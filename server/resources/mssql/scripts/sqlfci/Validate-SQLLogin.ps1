

param(
  [Parameter(Mandatory = $true)]
  $SQLServer,
  [Parameter(Mandatory = $false)]
  $SqlUserSecret,
  [Parameter(Mandatory = $false)]
  $SqlUser
)

#Install-Module -Name SqlServer -Force;

$Query = 'SELECT name FROM sys. databases'

#Retrieving MSSQL service account
$DomainNetBIOSName = $env:USERDOMAIN
$SqlUser = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $SqlUserSecret).SecretString
$SqlUserName = $DomainNetBIOSName + '\' + $SqlUser
$SqlUserPassword = $SqlUser.password 


if ($SqlUserSecret)
{
  try {
    #Query with SQL authentication (not recommended because your password is in plaintext on the command line).
    Write-Output "Connected via SQL Authentication"
    $results = Invoke-Sqlcmd -ConnectionString "Data Source=$SQLServer; User Id=$SqlUserName; Password=$SqlUserPassword;" -Query "$Query" | Format-Table 
    Write-Output $results 
    }
  catch {
    Write-Output "A network-related or instance-specific error occurred while establishing a connection to SQL Server. The server was not 
    found or was not accessible. Verify that the instance name is correct and that SQL Server is configured to allow remote connections. "
  }
}else{

    try {
      #Execute a query with trusted connection. If you omit the server, it will default to localhost.
      Write-Output "Connected with Windows Authentication"
      $results = Invoke-Sqlcmd -ConnectionString "Data Source=$SQLServer; Integrated Security=True;" -Query "$Query" | Format-Table
      Write-Output $results
      }
    catch {
      Write-Output "A network-related or instance-specific error occurred while establishing a connection to SQL Server. The server was not 
        found or was not accessible. Verify that the instance name is correct and that SQL Server is configured to allow remote connections. "
      }
     }

$cnt = ($results | Measure-Object).Count

try {if ($cnt -le 0) { throw '1' } }
catch { if ($_.Exception.Message -eq 1) { 
  Write-Output "No Database in SQL Server" 
  $_ | Write-AWSLaunchWizardException
  } 
  } 

