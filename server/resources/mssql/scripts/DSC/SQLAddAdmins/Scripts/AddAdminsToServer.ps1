Configuration AddAdminsToServer {
    param(

        [Parameter(Mandatory = $true)]
        [String]
        $SQLServerName

    )

    Start-Transcript -Path C:\cfn\log\AddAdminsToServer.ps1.txt -Append

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

    # Import needed custom DSC resources
    Import-DSCResource -ModuleName SqlServerDsc

    $AdminGroup = 'BUILTIN\Administrators'

    # Ensure the Admin Group is present on SQL server
    SqlLogin Add_Admin_Login {
        Ensure               = 'Present'
        Name                 = $AdminGroup
        LoginType            = 'WindowsGroup'
        ServerName           = $SQLServerName
        InstanceName         = $SQLInstanceName
    }

    # Ensure the Admin Group is added to the sysadmin role on SQL server
    SqlRole Add_Admin_To_Sysadmin_Role {
        Ensure               = 'Present'
        ServerRoleName       = 'sysadmin'
        MembersToInclude     = $AdminGroup
        ServerName           = $SQLServerName
        InstanceName         = $SQLInstanceName
    }
}