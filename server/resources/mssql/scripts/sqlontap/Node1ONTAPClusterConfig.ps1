[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$DomainDnsName,

    [Parameter(Mandatory=$true)]
    [string]$WSFCNode1PrivateIP2,

    [Parameter(Mandatory=$true)]
    [string]$ClusterName,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname    

)
#Requires -Modules xFailOverCluster,PSDscResources

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id


try {
Start-Transcript -Path C:\cfn\log\node1ONTAPClusterConfig.ps1.txt -Append
$ErrorActionPreference = "Stop"
# Getting the DSC Cert Encryption Thumbprint to Secure the MOF File
$DscCertThumbprint = (get-childitem -path cert:\LocalMachine\My | where { $_.subject -eq "CN=AWSLWDscEncryptCert" }).Thumbprint
# Getting Password from Secrets Manager for AD Admin User
$DomainNetBIOSName = $env:USERDOMAIN
$SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
$AdminPassword = $SsmParameter.domain.password
$ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
# Creating Credential Object for Administrator
$Credentials = (New-Object PSCredential($ClusterAdminUser,(ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))
$disklist=Get-Disk | Where-Object{$_.FriendlyName -eq 'NETAPP LUN C-MODE'} | Sort-Object -Property Size

$ConfigurationData = @{
    AllNodes = @(
        @{
            NodeName="*"
            CertificateFile = "C:\cfn\dsc\publickeys\AWSLWDscPublicKey.cer"
            Thumbprint = $DscCertThumbprint
            PSDscAllowDomainUser = $true
        },
        @{
            NodeName = 'localhost'
        }
    )
}

Configuration Node1ClusterConfig {
    param(
        [PSCredential] $Credentials
    )

    Import-Module -Name PSDscResources
    Import-Module -Name xFailOverCluster

    Import-DscResource -Module PSDscResources
    Import-DscResource -ModuleName xFailOverCluster

    Node 'localhost' {

        WindowsFeature AddRemoteServerAdministrationToolsClusteringFeature {
            Ensure    = 'Present'
            Name      = 'RSAT-Clustering-Mgmt'
        }

        WindowsFeature AddRemoteServerAdministrationToolsClusteringPowerShellFeature {
            Ensure    = 'Present'
            Name      = 'RSAT-Clustering-PowerShell'
            DependsOn = '[WindowsFeature]AddRemoteServerAdministrationToolsClusteringFeature'
        }

        WindowsFeature AddRemoteServerAdministrationToolsClusteringCmdInterfaceFeature {
            Ensure    = 'Present'
            Name      = 'RSAT-Clustering-CmdInterface'
            DependsOn = '[WindowsFeature]AddRemoteServerAdministrationToolsClusteringPowerShellFeature'
        }

        xCluster CreateCluster {
            Name                          =  $ClusterName
            StaticIPAddress               =  $WSFCNode1PrivateIP2
            DomainAdministratorCredential =  $Credentials
            DependsOn                     = '[WindowsFeature]AddRemoteServerAdministrationToolsClusteringCmdInterfaceFeature'
        }

        xClusterDisk AddDataClusterDisk
        {
            Number = 1
            Ensure = 'Present'
            Label  = 'SQL-DATA'
        }

        xClusterDisk AddLogClusterDisk
        {
            Number = 2
            Ensure = 'Present'
            Label  = 'SQL-LOG'
        }

        xClusterDisk AddTempDbClusterDisk
        {
            Number = 3
            Ensure = 'Present'
            Label  = 'SQL-TEMPDB'
        }

        xClusterDisk AddQuorumClusterDisk
        {
            Number = 4
            Ensure = 'Present'
            Label  = 'Quorum'
        }

        xClusterQuorum SetQuorumToNodeMajority {
            IsSingleInstance = 'Yes'
            Type             = 'NodeAndDiskMajority'
            Resource         =  'Quorum'
            DependsOn        = '[xClusterDisk]AddQuorumClusterDisk'
            }
    }
    }
Node1ClusterConfig -OutputPath 'C:\cfn\dsc\Node1ClusterConfig' -ConfigurationData $ConfigurationData -Credentials $Credentials

Start-DscConfiguration 'C:\cfn\dsc\Node1ClusterConfig' -Wait -Verbose -Force

} catch{
    Write-Output "Configuring shared disks for Windows cluster failed"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}
