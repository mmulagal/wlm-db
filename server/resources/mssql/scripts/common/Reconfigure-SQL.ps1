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

    #Set collation for the sql server
    Start-Sleep 5
    try {
        Write-Output "Setting collation on SQLServer(MSSQLSERVER)"
        # Stop SQL Service
        $SQLService = Get-Service -Name 'MSSQLSERVER'
        if ($SQLService.status -eq 'Running') { $SQLService.Stop() }
        $SQLService.WaitForStatus('Stopped', '00:01:00')
 
        #Set collation value and rebuild system databases
        $rebuildarguments = '/QUIET /ACTION="REBUILDDATABASE" /INSTANCENAME="MSSQLSERVER" /SQLSYSADMINACCOUNTS="' + $DomainAdminFullUser + '" /SAPWD="' + $DomainAdminPassword + '" /SQLCOLLATION="' + $SqlCollation + '"'
        Invoke-Command -scriptblock {
            Start-Process -FilePath C:\SQLServerSetup\setup.exe -ArgumentList $Using:rebuildarguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\rebuild_collation.txt -RedirectStandardError C:\cfn\log\rebuild_error.txt
        } -Credential $DomainAdminCreds -ComputerName $HostName -Authentication credssp
 
        # Start SQL service
        $SQLService.Start()
        $SQLService.WaitForStatus('Running', '00:01:00')
    }
    catch {
        Write-Output "Failed to set collation on SQLServer(MSSQLSERVER)"
        # Start SQL service even though collation fails
        $SQLService.Start()
        $SQLService.WaitForStatus('Running', '00:01:00')
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
        Set-Location "SQLSERVER:\SQL\$env:COMPUTERNAME\DEFAULT"
        $Server = (Get-Item .)
        $Server.DefaultFile = $dataPath
        $Server.DefaultLog = $logPath
        $Server.Alter()

        # Update Startup settings with new master db path
        [System.Reflection.Assembly]::LoadWithPartialName('Microsoft.SqlServer.SqlWmiManagement') | Out-Null
        $smowmi = New-Object Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer localhost
        $SQLService = $smowmi.Services | where { $_.name -eq 'MSSQLSERVER' }
        $SQLService.StartupParameters = $Using:params
        $SQLService.Alter()

        # Create account for SQL Service Account user. AD user is added above as part of setting collation.
        $SQLUser = "[" + $Using:DomainNetBIOSName + "\" + $Using:SQLServiceAccount + "]"
        Invoke-Sqlcmd -Query "CREATE LOGIN $SQLUser FROM WINDOWS ;"
        Invoke-Sqlcmd -Query "ALTER SERVER ROLE [sysadmin] ADD MEMBER $SQLUser ;"


        # Grant permissions to NT AUTHORITY\SYSTEM
        Invoke-Sqlcmd -Query 'GRANT VIEW ANY DEFINITION TO "NT AUTHORITY\SYSTEM" ;'

        # Update paths for tempdb,model and MSDB
        $tempDevFile = "'$Using:tempPath\tempdb.mdf'"
        $modelDevFile = "'$Using:dataPath\model.mdf'"
        $msdbDataFile = "'$Using:dataPath\MSDBData.mdf'"
        $tempLogFile = "'$Using:tempPath\templog.ldf'"
        $modelLogFile = "'$Using:logPath\modellog.ldf'"
        $msdbLogFile = "'$Using:logPath\MSDBLog.ldf'"
        Invoke-Sqlcmd -Query "USE master; ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, FILENAME = $tempDevFile); ALTER DATABASE tempdb MODIFY FILE (NAME = templog, FILENAME = $tempLogFile);"
        Invoke-Sqlcmd -Query "USE master; ALTER DATABASE model MODIFY FILE (NAME = modeldev, FILENAME = $modelDevFile); ALTER DATABASE model MODIFY FILE (NAME = modellog, FILENAME = $modelLogFile);"
        Invoke-Sqlcmd -Query "USE master; ALTER DATABASE MSDB MODIFY FILE (NAME = MSDBData, FILENAME = $msdbDataFile); ALTER DATABASE MSDB MODIFY FILE (NAME = MSDBLog, FILENAME = $msdbLogFile);"
        Invoke-Sqlcmd -Query "USE master;EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultData', REG_SZ, N'$Using:dataPath';"
        Invoke-Sqlcmd -Query "USE master;EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultLog', REG_SZ, N'$Using:logPath';"
        Invoke-Sqlcmd -Query "USE master;EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'BackupDirectory', REG_SZ, N'$Using:backupPath';"

        # Stop SQL Service
        $SQLService = Get-Service -Name 'MSSQLSERVER'
        if ($SQLService.status -eq 'Running') { $SQLService.Stop() }
        $SQLService.WaitForStatus('Stopped', '00:01:00')

        # Move files to new locations
        $tempDevFile = "$Using:tempPath\tempdb.mdf"
        $modelDevFile = "$Using:dataPath\model.mdf"
        $msdbDataFile = "$Using:dataPath\MSDBData.mdf"
        $tempLogFile = "$Using:tempPath\templog.ldf"
        $modelLogFile = "$Using:logPath\modellog.ldf"
        $msdbLogFile = "$Using:logPath\MSDBLog.ldf"
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\tempdb.mdf" $tempDevFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\templog.ldf" $tempLogFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\model.mdf" $modelDevFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\modellog.ldf" $modelLogFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\MSDBData.mdf" $msdbDataFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\MSDBLog.ldf" $msdbLogFile
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\master.mdf" "$Using:dataPath\master.mdf"
        Move-Item-Safely "C:\Program Files\Microsoft SQL Server\MSSQL*.MSSQLSERVER\MSSQL\DATA\mastlog.ldf" "$Using:logPath\mastlog.ldf"

        # Set SQL Server and Agent services user to SQL AD user
        $Services = Get-WmiObject -Class Win32_Service -Filter "Name='SQLSERVERAGENT' OR Name='MSSQLSERVER'"
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