[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]
    $NetBIOSName,

    [Parameter(Mandatory = $true)]
    [string]
    $SQLServiceAccount,

    [Parameter(Mandatory = $true)]
    [string]
    $DomainAdminUser,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,
    
    [Parameter(Mandatory = $true)]
    [string]$SqlCollation
)

try {
    Start-Transcript -Path C:\cfn\log\Reconfigure-SQL.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $DomainNetBIOSName = $env:USERDOMAIN
    
    $datavol = (Get-Volume -FileSystemLabel 'SQL-Data').DriveLetter
    $logvol = (Get-Volume -FileSystemLabel 'SQL-Log').DriveLetter
    $tempdbvol = (Get-Volume -FileSystemLabel 'SQL-TempDb').DriveLetter

    $sqlRootPath = "$($datavol):\mssql\system"
    $dataPath = "$($datavol):\mssql\data"
    $logPath = "$($logvol):\mssql\log"
    $tempPath = "$($tempdbvol):\mssql\data"
    $sqlPath = "$($logvol):\mssql\log"
    $backupPath = "$($datavol):\mssql\backup"

    [array]$paths = $dataPath, $logPath, $tempPath, $backupPath

    Write-Host $paths
    $params = "-d$dataPath\master.mdf;-e$sqlpath\ERRORLOG;-l$logPath\mastlog.ldf"
    $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
    $DomainAdminPassword = $SsmParameter.domain.password
    $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser, (ConvertTo-SecureString $DomainAdminPassword -AsPlainText -Force)))
    $SQLServiceAccountPassword = $SsmParameter.sql[0].password
    $SQLFullUser = $DomainNetBIOSName + '\' + $SQLServiceAccount
    $HostName = hostname

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

    # to-do - Consume $SQLInstanceName for non-default instance

    #Set collation for the sql server if installer is available. Need to check if collation is an input for custom ami. 
    $SkipCollation = $False
    if (Test-Path -Path "C:\SQLServerSetup\setup.exe") {
        Start-Sleep 5
        try {
            Write-Output "Setting collation on SQLServer($SQLInstanceName)"
            # Stop SQL Service
            $SQLService = Get-Service -Name "$SQLInstanceName"
            if ($SQLService.status -eq 'Running') { $SQLService.Stop() }
            $SQLService.WaitForStatus('Stopped', '00:01:00')
    
            #Set collation value and rebuild system databases
            $rebuildarguments = '/QUIET /ACTION="REBUILDDATABASE" /INSTANCENAME="' + $SQLInstanceName + '" /SQLSYSADMINACCOUNTS="' + $DomainAdminFullUser + '" /SAPWD="' + $DomainAdminPassword + '" /SQLCOLLATION="' + $SqlCollation + '"'
            Invoke-Command -scriptblock {
                Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:rebuildarguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\rebuild_collation.txt -RedirectStandardError C:\cfn\log\rebuild_error.txt
            } -Credential $DomainAdminCreds -ComputerName $HostName -Authentication credssp
    
            # Start SQL service
            $SQLService.Start()
            $SQLService.WaitForStatus('Running', '00:01:00')
        }
        catch {
            Write-Output "Failed to set collation on SQLServer($SQLInstanceName)"
            # Start SQL service even though collation fails
            $SQLService.Start()
            $SQLService.WaitForStatus('Running', '00:01:00')
        }
    }
    else {
            $SkipCollation = $True
    }

    $ConfigureSqlPs = {
        $ErrorActionPreference = "Stop"

        ForEach ($path in $Using:paths) {
            New-Item -ItemType directory -Path $path
            $rule = new-object System.Security.AccessControl.FileSystemAccessRule($Using:DomainAdminFullUser, "FullControl", "ContainerInherit, ObjectInherit", "InheritOnly", "Allow")
            $acl = Get-Acl $path
            $acl.SetAccessRule($rule)
            Set-ACL -Path $path -AclObject $acl
        }

        # Set Default Paths
        Import-Module SQLPS
        If ($Using:SQLInstanceName -eq "MSSQLSERVER") {
            Set-Location "SQLSERVER:\SQL\$env:COMPUTERNAME\DEFAULT"
        }
        Else {
            Set-Location "SQLSERVER:\SQL\$env:COMPUTERNAME\$Using:SQLInstanceName"
        }
        $Server = (Get-Item .)
        $Server.DefaultFile = $dataPath
        $Server.DefaultLog = $logPath
        try {
            $Server.Alter()
        }catch{
            Write-Host "Error while setting default data and log paths. These will configured later by modifying instance registry details."
        }

        # Update Startup settings with new master db path
        try {
        [System.Reflection.Assembly]::LoadWithPartialName('Microsoft.SqlServer.SqlWmiManagement') | Out-Null
        $smowmi = New-Object Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer localhost
        $SQLService = $smowmi.Services | where { $_.name -eq "$Using:SQLInstanceName" }
        $SQLService.StartupParameters = $Using:params
        $SQLService.Alter()
        }catch{
            [System.Reflection.Assembly]::LoadWithPartialName('Microsoft.SqlServer.SqlWmiManagement') | Out-Null
            $smowmi = New-Object Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer localhost
            $SQLService = $smowmi.Services | where { $_.displayname -eq "SQL Server ($Using:SQLInstanceName)" }
            $SQLService.StartupParameters = $Using:params
            $SQLService.Alter()
        }

        # Instance name to be passed to Invoke-sqlcmd
        $ServerInstanceName = "$env:COMPUTERNAME"
        If($Using:SQLInstanceName -ne "MSSQLSERVER") {
            $ServerInstanceName = "$env:COMPUTERNAME\$Using:SQLInstanceName"
            
        }
        
        # Create account for AD user
        If($Using:SkipCollation -eq $True){
            $AdminUser = "[" + $Using:DomainNetBIOSName + "\" + $Using:DomainAdminUser + "]"
            Invoke-Sqlcmd -ServerInstance $ServerInstanceName -Query "CREATE LOGIN $AdminUser FROM WINDOWS ;" 
            Invoke-Sqlcmd -ServerInstance $ServerInstanceName -Query "ALTER SERVER ROLE [sysadmin] ADD MEMBER $AdminUser ;" 
        }

        # Create account for SQL Service Account user. AD user is added above as part of setting collation.
        $SQLUser = "[" + $Using:DomainNetBIOSName + "\" + $Using:SQLServiceAccount + "]"
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName -Query "CREATE LOGIN $SQLUser FROM WINDOWS ;" 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query "ALTER SERVER ROLE [sysadmin] ADD MEMBER $SQLUser ;" 


        # Grant permissions to NT AUTHORITY\SYSTEM
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT VIEW ANY DEFINITION TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT ALTER RESOURCES TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT ALTER ANY DATABASE TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT CONTROL SERVER TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT ALTER ANY LOGIN TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT CREATE ANY DATABASE TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT IMPERSONATE ANY LOGIN TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT CONNECT ANY DATABASE TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT CREATE SERVER ROLE TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT ALTER ANY SERVER ROLE TO "NT AUTHORITY\SYSTEM" ;' 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query 'GRANT ALTER SETTINGS TO "NT AUTHORITY\SYSTEM" ;' 
  

        # Update paths for tempdb,model and MSDB
        $tempDevFile = "'$Using:tempPath\tempdb.mdf'"
        $modelDevFile = "'$Using:dataPath\model.mdf'"
        $msdbDataFile = "'$Using:dataPath\MSDBData.mdf'"
        $tempLogFile = "'$Using:tempPath\templog.ldf'"
        $modelLogFile = "'$Using:logPath\modellog.ldf'"
        $msdbLogFile = "'$Using:logPath\MSDBLog.ldf'"
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query "USE master; ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, FILENAME = $tempDevFile); ALTER DATABASE tempdb MODIFY FILE (NAME = templog, FILENAME = $tempLogFile);" 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query "USE master; ALTER DATABASE model MODIFY FILE (NAME = modeldev, FILENAME = $modelDevFile); ALTER DATABASE model MODIFY FILE (NAME = modellog, FILENAME = $modelLogFile);" 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query "USE master; ALTER DATABASE MSDB MODIFY FILE (NAME = MSDBData, FILENAME = $msdbDataFile); ALTER DATABASE MSDB MODIFY FILE (NAME = MSDBLog, FILENAME = $msdbLogFile);" 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query "USE master;EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultData', REG_SZ, N'$Using:dataPath';" 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query "USE master;EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultLog', REG_SZ, N'$Using:logPath';" 
        Invoke-Sqlcmd -ServerInstance $ServerInstanceName  -Query "USE master;EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'BackupDirectory', REG_SZ, N'$Using:backupPath';" 

        #Check if .ndf file exists andalter secondary tempdb data file
        $tempndffile ="C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\tempdb_mssql*.ndf"
        $temp2DevFile = "'$Using:tempPath\tempdb_mssql_2.ndf'"
        $ndfFound = $False
        if (Test-Path -Path $tempndffile) {
            try {
                Invoke-Sqlcmd -ServerInstance $ServerInstanceName -Query "USE master; ALTER DATABASE tempdb MODIFY FILE (NAME = temp2, FILENAME = $temp2DevFile);"
                $ndfFound = $True
            } catch {
                Write-Host "Error while altering temp2 in tempDb. Error: $_"
            }
        }

        # Stop SQL Service
        $SQLService = Get-Service -Name "$Using:SQLInstanceName"
        if ($SQLService.status -eq 'Running') { $SQLService.Stop() }
        $SQLService.WaitForStatus('Stopped', '00:01:00')

        # Move files to new locations
        $tempDevFile = "$Using:tempPath\tempdb.mdf"
        $modelDevFile = "$Using:dataPath\model.mdf"
        $msdbDataFile = "$Using:dataPath\MSDBData.mdf"
        $tempLogFile = "$Using:tempPath\templog.ldf"
        $modelLogFile = "$Using:logPath\modellog.ldf"
        $msdbLogFile = "$Using:logPath\MSDBLog.ldf"
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\tempdb.mdf" $tempDevFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\templog.ldf" $tempLogFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\model.mdf" $modelDevFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\modellog.ldf" $modelLogFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\MSDBData.mdf" $msdbDataFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\MSDBLog.ldf" $msdbLogFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\master.mdf" "$Using:dataPath\master.mdf"
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\mastlog.ldf" "$Using:logPath\mastlog.ldf"

        #Move secondary tempdb data file if found
        if($ndfFound -eq $True) {
            $temp2DevFile = "$Using:tempPath\tempdb_mssql_2.ndf"
            try {
                Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.$Using:SQLInstanceName\MSSQL\DATA\tempdb_mssql*.ndf" $temp2DevFile
            } catch {
                Write-Host "Error while moving .ndf file. Error: $_"
            }
        }

        # Set SQL Server and Agent services user to SQL AD user
        $Services = Get-WmiObject -Class Win32_Service -Filter "Name='SQLSERVERAGENT' OR Name='$Using:SQLInstanceName'"
        $Services.change($null, $null, $null, $null, $null, $null, $Using:DomainAdminFullUser , $Using:DomainAdminPassword, $null, $null, $null)
 
 
        # Start SQL service
        $SQLService.Start()
        $SQLService.WaitForStatus('Running', '00:01:00')
    }
 
    Invoke-Command -Authentication Credssp -Scriptblock $ConfigureSqlPs -ComputerName $NetBIOSName -Credential $DomainAdminCreds
 
}
catch {
    $_ | Write-AWSLaunchWizardException
}