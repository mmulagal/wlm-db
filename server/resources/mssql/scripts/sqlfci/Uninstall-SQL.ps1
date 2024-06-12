[CmdletBinding()]
param(

	[Parameter(Mandatory=$true)]
    [string]$AMIID
)
try
{
    Start-Transcript -Path C:\cfn\log\uninstallsql.ps1.txt -Append
    $ErrorActionPreference = "Stop"

    # Find path to SQL Installer media, if not found then pick installer hosted in S3.
    $SQLMediaPathFound = $True
    if (Test-Path -Path "C:\SQLServerSetup\setup.exe") {
        $SQLMediaPath = "C:\SQLServerSetup\setup.exe"
    }
    else {
        
        If (Test-Path -path "C:\SQL*") {
            $SQLInstallerPaths = (Get-ChildItem "C:\SQL*" -Recurse | where {$_.name -eq "setup.exe"} ).fullname
            If($SQLInstallerPaths -is 'string')
            {
            $SQLMediaPath = $SQLInstallerPaths
            }
            Else {
            $SQLMediaPath = $SQLInstallerPaths[0]
            }
        } 
        else {
            $SQLMediaPathFound = $False
        }
    }
    Write-Output "SQL Installer path $SQLMediaPath."

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
    
    try {
    $SqlEdition = (Get-ItemProperty -Path "HKLM:HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL*$SQLInstanceName\Setup").Edition 
    }catch {
        Write-Host "Error while fetching SQL server edition. $_"
        $SqlEdition = ''
    }

    Write-Output "SQL instance name $SQLInstanceName. Edition $SqlEdition."

    If ((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002')
    {
        Write-Output "SQL Server is BYOL."
        if ( $SQLMediaPathFound -eq $True ) {
            $arguments = '/q /ACTION="Uninstall" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /FEATURES="SQLENGINE,AS,RS" /INSTANCENAME="' + $SQLInstanceName + '"'
            Start-Process -FilePath $SQLMediaPath -ArgumentList $arguments -Wait -NoNewWindow
        }
        else {
            Write-Output "SQL Media path not found. Skipping uninstall."
        }
    }
    else
    {
        Write-Output "SQL LI AMI.Uninstalling SQL Server"
        $arguments = '/q /ACTION="Uninstall" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /FEATURES="SQLENGINE,AS,RS" /INSTANCENAME="' + $SQLInstanceName + '"'
        Start-Process -FilePath $SQLMediaPath -ArgumentList $arguments -Wait -NoNewWindow
    }
}catch{
            $_ | Write-AWSLaunchWizardException
}

