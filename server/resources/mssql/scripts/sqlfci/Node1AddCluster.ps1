[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$DomainDnsName,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname,

    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser

)
#Requires -Modules xFailOverCluster,PSDscResources
try {
Start-Transcript -Path C:\cfn\log\node1addcluster.ps1.txt -Append
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
$fsList = Get-FSXFileSystem -FileSystemId $FileSystemId
if ($fsList.DNSName) {
    $ShareName = "\\" + $fsList.DNSName + "\SqlWitnessShare"
}

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

Configuration Node1AddCluster {
    param(
        [PSCredential] $Credentials
    )

    Import-Module -Name PSDscResources
    Import-Module -Name xFailOverCluster

    Import-DscResource -Module PSDscResources
    Import-DscResource -ModuleName xFailOverCluster

    Node 'localhost' {
        WindowsFeature RSAT-AD-PowerShell {
            Name = 'RSAT-AD-PowerShell'
            Ensure = 'Present'
        }

        WindowsFeature AddFailoverFeature {
            Ensure = 'Present'
            Name   = 'Failover-clustering'
            DependsOn = '[WindowsFeature]RSAT-AD-PowerShell'
        }
    }
}

Node1AddCluster -OutputPath 'C:\cfn\dsc\Node1AddCluster' -ConfigurationData $ConfigurationData -Credentials $Credentials

Start-DscConfiguration 'C:\cfn\dsc\Node1AddCluster' -Wait -Verbose -Force

} catch{
    $_ | Write-AWSLaunchWizardException
}
