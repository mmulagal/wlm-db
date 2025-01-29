[CmdletBinding()]
param(

    [Parameter(Mandatory = $true)]
    [string]
    $NetBIOSName,

    [Parameter(Mandatory = $true)]
    [string]
    $DomainAdminUser,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,

    [Parameter(Mandatory = $false)]
    [string]
    $dop = "4",

    [Parameter(Mandatory = $false)]
    [string]$ClusterName

)

try {
    Start-Transcript -Path C:\cfn\log\SetMaxDOP.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $DomainNetBIOSName = $env:USERDOMAIN
    #$DomainAdminPassword = (Get-SSMParameterValue -Names $DomainAdminPasswordKey -WithDecryption $True).Parameters[0].Value
    #$DomainAdminSecurePassword = ConvertTo-SecureString $DomainAdminPassword -AsPlainText -Force
    #$DomainAdminCreds = New-Object System.Management.Automation.PSCredential($DomainAdminFullUser, $DomainAdminSecurePassword)
    $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
    $SsmParameter = Invoke-WithRetry -Command {
        (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
    }
    $DomainPassword = $SsmParameter.domain.password
    $pass = ConvertTo-SecureString $DomainPassword -AsPlainText -Force
    $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser, $pass))

    # Get SQL server instance name
    $SQLServiceList = Get-WmiObject win32_service | ? { $_.DisplayName -like 'sql server (*' }
    $SQLInstanceName = "MSSQLSERVER"
    $SQLInstanceNames = @()
    ForEach ($sqlService in $sqlServiceList) {
        $sqlServiceBinaryPath = $sqlService.PathName -Replace "-s.*", ""
        If (Test-Path $sqlServiceBinaryPath.Replace('"', '')) {
            $SqlVersion = Invoke-Expression -Command "(dir $sqlServiceBinaryPath).VersionInfo"
        }
        $ValidSqlVersion = $SqlVersion.ProductVersion -match '^1[3-9]'
        If ($ValidSqlVersion -eq $true) {
            $InstanceName = $sqlService.Name.Replace("MSSQL$", "") 
            $SQLInstanceNames += $InstanceName
        }
    } 

    If ($SQLInstanceNames -NotContains "MSSQLSERVER") {
        $SQLInstanceName = $SQLInstanceNames[0]
    }
    Write-Output "SQL instance name $SQLInstanceName."

    # Instance name to be passed to Invoke-sqlcmd
    $ServerInstanceName = "$env:COMPUTERNAME"
    If ($SQLInstanceName -ne "MSSQLSERVER") {
        $ServerInstanceName = "$env:COMPUTERNAME\$SQLInstanceName"
         
    }
    Write-Output "Sql server name $ServerInstanceName."
    
    $vcpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
    if ($vcpus -gt 8 -and $vcpus -le 16) {
        $dop = "8"
    }
    elseif ($vcpus -gt 16) {
        $dop = "16"
    }

    Write-Output "Setting max dop to $dop."
    $SetupMaxDOPPs = {
        $sql = "EXEC sp_configure 'show advanced options', 1; RECONFIGURE WITH OVERRIDE; EXEC sp_configure 'max degree of parallelism', " + $Using:dop + "; RECONFIGURE WITH OVERRIDE; "
        try {
            Import-Module SQLPS
            Invoke-Sqlcmd -AbortOnError -ErrorAction Stop -Query $sql -ServerInstance $Using:ServerInstanceName
        }
        catch {
            Write-Output "Error while configuring max dop using server instance name: $_."
            if ($Using:ClusterName -ne '') {
                try {
                    $connectionString = "Server=$Using:ClusterName;Integrated Security=True;TrustServerCertificate=True;"
                    Invoke-Sqlcmd -AbortOnError -ErrorAction Stop -Query $sql -ConnectionString $connectionString
                    Write-Output "Max dop configured using cluster name."
                }
                catch {
                    Write-Output "Error while configuring max dop using cluster name: $_."
                }
            }
        }
    }
    
    Invoke-Command -Authentication Credssp -Scriptblock $SetupMaxDOPPs -ComputerName $NetBIOSName -Credential $DomainAdminCreds
}
catch {
    Write-Output "Error while configuring max dop: $_."
}
