 [CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$MSSQLMediaBucket,

    [Parameter(Mandatory = $true)]
    [string]$MSSQLMediaKey,

    [Parameter(Mandatory = $true)]
    [string]$AMIID,

    [Parameter(Mandatory = $true)]
    [string]$SqlUser,

    [Parameter(Mandatory = $true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$False)]
    [string]$IsManagedServiceAccount,

    [Parameter(Mandatory = $true)]
    [string]$ResourceID,   

    [Parameter(Mandatory = $true)]
    [string]$Stackname,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,

    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform,

    [Parameter(Mandatory = $false)]
    [string]$SecondaryInstanceId
)

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing).Content

try {
    Start-Transcript -Path C:\cfn\log\preparefci.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $HostName = hostname

    $DomainNetBIOSName = $env:USERDOMAIN
    # Creating Credential Object for Administrator
    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
    . "$ScriptsPath\common\PollForTag.ps1" 
    $SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
    $AdminPassword = $SsmParameter.domain.password
    $ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $Credentials = (New-Object PSCredential($ClusterAdminUser, (ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))

    # Check if polling is required
    if ($IsTerraform -and $SecondaryInstanceId) {
        PollForTag -Region $region -InstanceId $SecondaryInstanceId -TagKey "add_secondary_node" -TagValue "completed"
    }
    
    #Retrieving MSSQL service account
    $SqlUserName = $DomainNetBIOSName + '\' + $SqlUser
    $SqlUserPassword = $SsmParameter.sql[0].password
    $SqlServiceUser = $SqlUserName+'$'

    Write-Output "Running PrepareFailoverCluster action" 

    Write-Output "https://learn.microsoft.com/en-us/answers/questions/1276441/invok-command-on-localhost-not-working"
    Write-Output "DBS-2299/2709: Enable PSRemoting Service to Start Automatic and Enable PSREmoting on both host" 
    Set-Service winrm -StartupType Automatic
    Start-Service winrm
    Enable-PSRemoting -Force 

    # Find path to SQL Installer media, if not found then pick installer hosted in S3.
    if (Test-Path -Path "C:\SQLServerSetup\setup.exe") {
        $SQLMediaPath = "C:\SQLServerSetup\setup.exe"
    }
    else {
        $SQLMediaPath = 'C:\cfn\Installer\SQLServerSetup\setup.exe'
        If (Test-Path -path "C:\SQL*") {
            $SQLInstallerPaths = (Get-ChildItem "C:\SQL*\*" -Recurse | where { $_.name -eq "setup.exe" } ).fullname | Sort-Object -Property Length
            If ($SQLInstallerPaths -is 'string') {
                $SQLMediaPath = $SQLInstallerPaths
            }
            Else {
                $SQLMediaPath = $SQLInstallerPaths[0]
            }
        } 
    }

    # Check if Evaluation edition
    $IsEvaluationEdition = Select-String -Path C:\cfn\log\uninstallsql.ps1.txt -Pattern "Evaluation Edition"

    Write-Output "SQL Installer path $SQLMediaPath."
    # Find path to SQL Installer media, if not found then pick installer hosted in S3.
    if ((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002') {
        Write-Output "Base Windows ami: Running prepare fci from available or s3 downloaded sql installer."
        #Prepare FCI installation
        $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
        if (-not ([string]::IsNullOrEmpty($IsEvaluationEdition)) ) {
            $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
        }
        if (-not ([string]::IsNullOrEmpty($IsManagedServiceAccount)) -and ($IsManagedServiceAccount -eq 'true')) {
            $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlServiceUser
            }
        try {
            Invoke-Command -scriptblock {
                if (-not ([string]::IsNullOrEmpty($Using:IsManagedServiceAccount)) -and ($Using:IsManagedServiceAccount -eq 'true')) {
                    Write-Host "Installing managed service account $Using:SqlUser"
                    Install-ADServiceAccount -Identity $Using:SqlUser -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 10
                }
                Write-Host "Running prepare fci step"
                Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
            } -Credential $Credentials -ComputerName $HostName -Authentication credssp
        }
        catch {
            $Service = Get-Service -Name 'MSSQLSERVER' -ErrorAction SilentlyContinue
            if ([string]::IsNullOrEmpty($Service)) {
                Start-Sleep -Seconds 15
                Write-Output "Re-attempting PrepareFailoverCluster"
                Invoke-Command -scriptblock {
                    Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
                } -Credential $Credentials -ComputerName $HostName -Authentication credssp
            }

        }
    }
    else {    
        try {
            $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
            if (-not ([string]::IsNullOrEmpty($IsManagedServiceAccount)) -and ($IsManagedServiceAccount -eq 'true')) {
            $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlServiceUser
            }
            Invoke-Command -scriptblock {
                if (-not ([string]::IsNullOrEmpty($Using:IsManagedServiceAccount)) -and ($Using:IsManagedServiceAccount -eq 'true')) {
                    Write-Host "Installing managed service account $Using:SqlUser"
                    Install-ADServiceAccount -Identity $Using:SqlUser -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 10
                }
                Write-Host "Running prepare fci step"
                Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 

            } -Credential $Credentials -ComputerName $HostName -Authentication credssp
        }
        catch {
            $Service = Get-Service -Name 'MSSQLSERVER' -ErrorAction SilentlyContinue
            if ([string]::IsNullOrEmpty($Service)) {
                Start-Sleep -Seconds 15
                Write-Output "Re-attempting PrepareFailoverCluster"
                $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
                Invoke-Command -scriptblock {
                    Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
                } -Credential $Credentials -ComputerName $HostName -Authentication credssp
            }
        }
    }

    Start-Sleep -Seconds 15
    $Service = Get-Service -Name 'MSSQLSERVER' -ErrorAction SilentlyContinue
    if ([string]::IsNullOrEmpty($Service)) {
        Start-Sleep -Seconds 180
        Write-Output "Configuring SQLServer(MSSQLSERVER) service by skipping Cluster verify errors. Validation of cluster and SQL service will be done at completion of configuration"
        Write-Output "https://learn.microsoft.com/en-us/answers/questions/1276441/invok-command-on-localhost-not-working"
        Write-Output "DBS-2299: Enable PSRemoting Service to Start Automatic and Enable PSREmoting on both host" 
        Set-Service winrm -StartupType Automatic
        Start-Service winrm
        Enable-PSRemoting -Force 
    
        if ((get-ec2image $AMIID).UsageOperation -eq 'RunInstances:0002') {
            Write-Output "Base Windows ami: Re-attemting prepare fci from available or s3 downloaded sql installer."
            $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
            if (-not ([string]::IsNullOrEmpty($IsManagedServiceAccount)) -and ($IsManagedServiceAccount -eq 'true')) {
                $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /SUPPRESSPAIDEDITIONNOTICE="True" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlServiceUser
            }
            if (-not ([string]::IsNullOrEmpty($IsEvaluationEdition) )) {
                $arguments = '/ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher"' -f $SqlUserName, $SqlUserPassword
            }
        }
        else {
            $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /AGTSVCPASSWORD="{1}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCPASSWORD="{1}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlUserName, $SqlUserPassword
            if (-not ([string]::IsNullOrEmpty($IsManagedServiceAccount)) -and ($IsManagedServiceAccount -eq 'true')) {
                $arguments = '/SkipRules=Cluster_VerifyForErrors /ACTION="PrepareFailoverCluster" /IAcceptSQLServerLicenseTerms="True" /IACCEPTROPENLICENSETERMS="False" /SUPPRESSPRIVACYSTATEMENTNOTICE="True" /ENU="True" /QUIET="True" /UpdateEnabled="False" /USEMICROSOFTUPDATE="False" /UpdateSource="MU" /FEATURES=SQLENGINE,REPLICATION,FULLTEXT,DQ /HELP="False" /INDICATEPROGRESS="True" /INSTANCENAME="MSSQLSERVER" /INSTALLSHAREDDIR="C:\Program Files\Microsoft SQL Server" /INSTALLSHAREDWOWDIR="C:\Program Files (x86)\Microsoft SQL Server" /INSTANCEID="MSSQLSERVER" /INSTANCEDIR="C:\Program Files\Microsoft SQL Server" /AGTSVCACCOUNT="{0}" /FILESTREAMLEVEL="0" /SQLSVCACCOUNT="{0}" /SQLSVCINSTANTFILEINIT="False" /FTSVCACCOUNT="NT Service\MSSQLFDLauncher" ' -f $SqlServiceUser
            }
        }

        Invoke-Command -scriptblock {
            Start-Service -Name 'Remote Registry'
            Start-Sleep -Seconds 180
            Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\preparefci_output.txt -RedirectStandardError C:\cfn\log\preparefci_error.txt 
            Stop-Service -Name 'Remote Registry'

        } -Credential $Credentials -ComputerName $HostName -Authentication credssp
        try {
            $Service = Get-Service -Name 'MSSQLSERVER' 
        }
        catch {
            $FailureReason = "Failed to create SQLServer(MSSQLSERVER) service"
            Write-Output $FailureReason
            if ($IsTerraform) {
                throw $FailureReason
            }
            Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
            $_ | Write-AWSLaunchWizardException  
        }
    }
    else {
        Write-Output "Configured SQL Server(MSSQLSERVER) successfully"
    }

}
catch {
    $FailureReason = "Failed to run prepare Failover cluster action for SQL installation"
    Write-Output $FailureReason
    if ($IsTerraform) {
        throw $FailureReason
    }
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardExceptio
}