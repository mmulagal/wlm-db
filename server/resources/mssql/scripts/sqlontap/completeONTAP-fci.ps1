[CmdletBinding()]
param(

    [Parameter(Mandatory = $true)]
    [string]$Node1FciIp,

    [Parameter(Mandatory = $true)]
    [string]$Node1SubnetId,

    [Parameter(Mandatory = $true)]
    [string]$Node2FciIp,

    [Parameter(Mandatory = $true)]
    [string]$Node2SubnetId,

    [Parameter(Mandatory = $true)]
    [string]$FCIName,

    [Parameter(Mandatory = $true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory = $true)]
    [string]$ServiceAccount,
    
    [Parameter(Mandatory = $true)]
    [string]$ResourceID,   

    [Parameter(Mandatory = $true)]
    [string]$Stackname,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,
    
    [Parameter(Mandatory = $true)]
    [string]$SqlCollation,

    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform,

    [Parameter(Mandatory = $false)]
    [string]$SecondaryInstanceId
)

Start-Sleep -Seconds 600


#wait until the secondary node done with update-sqlnodetag.ps1 to continue
#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing).Content

Start-Transcript -Path C:\cfn\log\completeONTAPfci.ps1.txt -Append

try {
    #Function to find Subnet mask

    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
    . "$ScriptsPath\common\PollForTag.ps1" 

    # Check if polling is required
    if ($IsTerraform -and $SecondaryInstanceId) {
        PollForTag -Region $region -InstanceId $SecondaryInstanceId -TagKey "update_sql_node_tag" -TagValue "completed"
    }
    
    function Get-SubnetMask($subnetid) {

        $subnet = Invoke-WithRetry -Command { get-ec2subnet -SubnetId $subnetid }
        
        $cidr = $subnet.CidrBlock
        $cidr_mask = $cidr.split('/')[1]
        $A = 0
        $A_Index = 8
        $B = 0
        $B_Index = 16
        $C = 0
        $C_Index = 24
        $D = 0
        $D_Index = 32
        for ($i = 1; $i -le $cidr_mask; $i++) {
            if ($i -le $A_Index) {
                $A += ([Math]::Pow(2, 8 - $i))
            }
            elseif ($i -le $B_Index) {
                $B += ([Math]::Pow(2, 8 - $i + $A_Index))
            }
            elseif ($i -le $C_Index) {
                $C += ([Math]::Pow(2, 8 - $i + $B_Index))
            }
            elseif ($i -le $D_Index) {
                $D += ([Math]::Pow(2, 8 - $i + $C_Index))
            }
        }
        $subnet_mask = "{0}.{1}.{2}.{3}" -f $A, $B, $C, $D
        return $subnet_mask
    }
    $ErrorActionPreference = "Stop"
    $DomainNetBIOSName = $env:USERDOMAIN
    $AdminGroup = 'BUILTIN\Administrators'
    # Creating Credential Object for Administrator
    $SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
    $AdminPassword = $SsmParameter.domain.password
    $ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $ServiceAccountUser = $DomainNetBIOSName + '\' + $ServiceAccount
    $Credentials = (New-Object PSCredential($ClusterAdminUser, (ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))

    #https://docs.microsoft.com/en-us/sql/database-engine/install-windows/install-sql-server-from-the-command-prompt?view=sql-server-ver15

    $HostName = hostname
    #$fsList = Get-FSXFileSystem|?{$_.Tags.Key -eq 'aws:cloudformation:stack-name' -and $_.Tags.Value -eq $Stackname}
    #Need to run cluster validation first
    
    Invoke-Command -scriptblock { Test-Cluster } -Credential $Credentials -ComputerName $HostName -Authentication credssp > C:\cfn\log\test-cluster1.txt 2>&1 
    $AccessDenied = Select-String -Path C:\cfn\log\test-cluster1.txt -Pattern "Access is denied."
    if (-not ([string]::IsNullOrEmpty($AccessDenied)) ) {
        Write-Output "Encountered access denied. Re-attempting Test-Cluster after 5 seconds."
        Start-sleep -s 5
        Invoke-Command -scriptblock { Test-Cluster } -Credential $Credentials -ComputerName $HostName -Authentication credssp > C:\cfn\log\test-cluster2.txt 2>&1 
    } 
   
    # Find path to SQL Installer media, if not found then pick installer hosted in S3.
    If (Test-Path -path "C:\SQLServerSetup\setup.exe") {
        $SQLMediaPath = "C:\SQLServerSetup\setup.exe"
    }
    else {
        Write-Output "Base Windows ami: Attemting complete failover fci from available or s3 downloaded sql installer."
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
    
    Write-Output "SQL Installer path $SQLMediaPath."

    $mediaExtractPath = 'C:\SQLServerSetup'
    #$fileshare = $fsList.DNSName

    $datavol = Invoke-WithRetry -Command { (Get-Volume -FileSystemLabel 'SQL-Data').DriveLetter }
   

    $logvol = Invoke-WithRetry -Command { (Get-Volume -FileSystemLabel 'SQL-Log').DriveLetter }

    $tempdbvol = Invoke-WithRetry -Command { (Get-Volume -FileSystemLabel 'SQL-TempDb').DriveLetter }
   
    $sqlRootPath = "$($datavol):\mssql\system"
    $sqlDataPath = "$($datavol):\mssql\data"
    $sqlLogPath = "$($logvol):\mssql\log"
    $sqlTempPath = "$($tempdbvol):\mssql\data"
    $sqlPath = "$($logvol):\mssql\log"
    $Node1SubnetMask = Invoke-WithRetry -Command { Get-SubnetMask $Node1SubnetId }
    

    $Node2SubnetMask = Invoke-WithRetry -Command { Get-SubnetMask $Node2SubnetId }
   

    $arguments = '/QUIET /ACTION=CompleteFailoverCluster /InstanceName=MSSQLSERVER /INDICATEPROGRESS=TRUE /FAILOVERCLUSTERNETWORKNAME={0} /FAILOVERCLUSTERIPADDRESSES="IPv4;{1};Cluster Network 1;{2}" "IPv4;{3};Cluster Network 2;{4}" /CONFIRMIPDEPENDENCYCHANGE=TRUE /FAILOVERCLUSTERGROUP="SQL Server (MSSQLSERVER)" /FAILOVERCLUSTERDISKS="SQL-DATA" "SQL-LOG" "SQL-TEMPDB" /INSTALLSQLDATADIR="C:\Program Files\Microsoft SQL Server" /SQLCOLLATION={10} /SQLSYSADMINACCOUNTS={5} /INSTALLSQLDATADIR={6} /SQLUSERDBDIR={7} /SQLUSERDBLOGDIR={8} /SQLTEMPDBDIR={9}' -f $FCIName, $Node1FciIp, $Node1SubnetMask, $Node2FciIp, $Node2SubnetMask, $AdminGroup, $sqlRootPath, $sqlDataPath, $sqlLogPath, $sqlTempPath, $SqlCollation
    Invoke-Command -scriptblock {
        Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\completefci_output.txt -RedirectStandardError C:\cfn\log\completefci_error.txt 

    } -Credential $Credentials -ComputerName $HostName -Authentication credssp -ErrorAction SilentlyContinue -ErrorVariable errs

    ##Re-attempt once if previous step failed to install due to synchronization with second node prepare-fci and reboot
    Start-Sleep -Seconds 30
    # Check if collation set, if not run CompleteFailoverCluster with default collation
    $SettingCollationFailed = Select-String -Path C:\cfn\log\completefci_output.txt -Pattern "The collation $SqlCollation was not found."
    if ($SettingCollationFailed -ne $null) { 
        Write-Host "Setting collation $SqlCollation failed with 'The collation $SqlCollation was not found.'. Configuring with default collation 'SQL_Latin1_General_CP1_CI_AS'."

        $SqlCollation = "SQL_Latin1_General_CP1_CI_AS"
        $arguments = '/QUIET /ACTION=CompleteFailoverCluster /InstanceName=MSSQLSERVER /INDICATEPROGRESS=TRUE /FAILOVERCLUSTERNETWORKNAME={0} /FAILOVERCLUSTERIPADDRESSES="IPv4;{1};Cluster Network 1;{2}" "IPv4;{3};Cluster Network 2;{4}" /CONFIRMIPDEPENDENCYCHANGE=TRUE /FAILOVERCLUSTERGROUP="SQL Server (MSSQLSERVER)" /FAILOVERCLUSTERDISKS="SQL-DATA" "SQL-LOG" "SQL-TEMPDB" /INSTALLSQLDATADIR="C:\Program Files\Microsoft SQL Server" /SQLCOLLATION={10} /SQLSYSADMINACCOUNTS={5} /INSTALLSQLDATADIR={6} /SQLUSERDBDIR={7} /SQLUSERDBLOGDIR={8} /SQLTEMPDBDIR={9}' -f $FCIName, $Node1FciIp, $Node1SubnetMask, $Node2FciIp, $Node2SubnetMask, $AdminGroup, $sqlRootPath, $sqlDataPath, $sqlLogPath, $sqlTempPath, $SqlCollation
        Invoke-Command -scriptblock {
            Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:arguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\completefci_output1.txt -RedirectStandardError C:\cfn\log\completefci_error1.txt 

        } -Credential $Credentials -ComputerName $HostName -Authentication credssp -ErrorAction SilentlyContinue -ErrorVariable errs
    }

    ##Re-attempt once if previous step failed to install due to synchronization with second node prepare-fci and reboot
    Start-Sleep -Seconds 30
    $ClusterResource = Invoke-Command -scriptblock {
        $clusresources = Get-ClusterResource | Out-String
        $clusresources
    }  -Credential $Credentials -ComputerName $HostName -Authentication credssp
    if ($ClusterResource -notmatch "SQL Server") {
        Start-Sleep -Seconds 300
        Write-Output "There are errors or failures in the cluster verification report. This could happen when other node restarted during test for the deployment. Skipping cluster verify errors.Confirm that cluster configuration is fine by running tests later"
        $skipclusterarguments = '/QUIET /ACTION=CompleteFailoverCluster /SkipRules=Cluster_VerifyForErrors /InstanceName=MSSQLSERVER /INDICATEPROGRESS=TRUE /FAILOVERCLUSTERNETWORKNAME={0} /FAILOVERCLUSTERIPADDRESSES="IPv4;{1};Cluster Network 1;{2}" "IPv4;{3};Cluster Network 2;{4}" /CONFIRMIPDEPENDENCYCHANGE=TRUE /FAILOVERCLUSTERGROUP="SQL Server (MSSQLSERVER)" /FAILOVERCLUSTERDISKS="SQL-DATA" "SQL-LOG" "SQL-TEMPDB" /INSTALLSQLDATADIR="C:\Program Files\Microsoft SQL Server" /SQLCOLLATION={10} /SQLSYSADMINACCOUNTS={5} /INSTALLSQLDATADIR={6} /SQLUSERDBDIR={7} /SQLUSERDBLOGDIR={8} /SQLTEMPDBDIR={9}' -f $FCIName, $Node1FciIp, $Node1SubnetMask, $Node2FciIp, $Node2SubnetMask, $AdminGroup, $sqlRootPath, $sqlDataPath, $sqlLogPath, $sqlTempPath, $SqlCollation
        Invoke-Command -scriptblock {
            Start-Process -FilePath $Using:SQLMediaPath -ArgumentList $Using:skipclusterarguments -Wait -NoNewWindow -RedirectStandardOutput C:\cfn\log\completefci_output.txt -RedirectStandardError C:\cfn\log\completefci_error.txt
        } -Credential $Credentials -ComputerName $HostName -Authentication credssp
    }

    try{
    # Add Cluster Admin and Service Account to sysadmin role

    Invoke-Command -scriptblock {
        $DomainAdminQuery = "CREATE LOGIN ["+$Using:ClusterAdminUser+"] FROM WINDOWS; EXEC sp_addsrvrolemember '"+$Using:ClusterAdminUser+"', 'sysadmin';"
        $ServiceAccountQuery = "CREATE LOGIN ["+$Using:ServiceAccountUser+"] FROM WINDOWS; EXEC sp_addsrvrolemember '"+$Using:ServiceAccountUser+"', 'sysadmin';"
        Invoke-Sqlcmd -ConnectionString "Data Source=$Using:FCIName; Integrated Security=True; TrustServerCertificate=True"  -Query $DomainAdminQuery -ErrorAction SilentlyContinue
        Invoke-Sqlcmd -ConnectionString "Data Source=$Using:FCIName; Integrated Security=True; TrustServerCertificate=True"  -Query $ServiceAccountQuery -ErrorAction SilentlyContinue
        $LoginCheckQuery =  "select r.name as Role, m.name as Principal from sys.server_role_members rm 
                                inner join sys.server_principals r on r.principal_id = rm.role_principal_id and r.type = 'R' 
                                inner join  sys.server_principals m on m.principal_id = rm.member_principal_id 
                                where m.name in ('$Using:ClusterAdminUser', '$Using:ServiceAccountUser')" 

        $LoginCheckQueryResponse = Invoke-sqlcmd -ConnectionString "Data Source=$Using:FCIName; Integrated Security=True; TrustServerCertificate=True" -Query $LoginCheckQuery | Select-Object Principal, Role |  ConvertTo-Json | ConvertFrom-Json 
        Foreach ($i in @($LoginCheckQueryResponse)) {
            Write-Output $i
            If($i.Principal -eq $Using:ClusterAdminUser) {
                Write-Output "User $Using:ClusterAdminUser has login to SQL Server"
                If($i.Role -eq 'sysadmin') {
                    Write-Output "Successfully added $Using:ClusterAdminUser to sysadmin role"
                }
                Else {
                    Write-Output "Failed to add $Using:ClusterAdminUser to sysadmin role"
                }
            }
            If($i.Principal -eq $Using:ServiceAccountUser) {
                Write-Output "User $Using:ServiceAccountUser has login to SQL Server"
                If($i.Role -eq 'sysadmin') {
                    Write-Output "Successfully added $Using:ServiceAccountUser to sysadmin role"
                }
                Else {
                    Write-Output "Failed to add $Using:ServiceAccountUser to sysadmin role"
                }
            }
        } 
    } -Credential $Credentials -ComputerName $HostName -Authentication credssp
    }
    catch {
        Write-Output "Failed to add $ClusterAdminUser and $ServiceAccountUser to sysadmin role. Error: $_"
    }

    Write-Output "Complete Failover Cluster Instance action completed successfully."
}

catch {
    $FailureReason = "Failed to run complete Failover cluster action for SQL installation: " + $_.Exception.Message
    Write-Output $FailureReason
    if ($IsTerraform) {
        throw $FailureReason
    }
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}