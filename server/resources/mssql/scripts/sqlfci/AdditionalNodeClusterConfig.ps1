[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$WSFCNode2PrivateIP2,

    [Parameter(Mandatory=$true)]
    [string]$ClusterName,

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname

)
try{
Start-Transcript -Path C:\cfn\log\AdditionalNodeClusterConfig.ps1.txt -Append
$ErrorActionPreference = "Stop"
# Getting the DSC Cert Encryption Thumbprint to Secure the MOF File
$DscCertThumbprint = (get-childitem -path cert:\LocalMachine\My | where { $_.subject -eq "CN=AWSLWDscEncryptCert" }).Thumbprint
$DomainNetBIOSName = $env:USERDOMAIN
# Getting Password from Secrets Manager for AD Admin User
$AdminPassword = (Get-SSMParameter -Name "/$Parentstackname/domain/password" -WithDecryption $True).Value
$ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
# Creating Credential Object for Administrator
$Credentials = (New-Object PSCredential($ClusterAdminUser,(ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))

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

Configuration AdditionalNodeClusterConfig  {
    param(
        [PSCredential] $Credentials
    )

    Import-Module -Name xFailOverCluster
    Import-Module -Name PSDscResources

    Import-DscResource -ModuleName xFailOverCluster
    Import-DscResource -ModuleName PSDscResources

    Node 'localhost'{

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
    }
}

AdditionalNodeClusterConfig -OutputPath 'C:\cfn\dsc\AdditionalNodeClusterConfig' -ConfigurationData $ConfigurationData -Credentials $Credentials

Start-DscConfiguration 'C:\cfn\dsc\AdditionalNodeClusterConfig' -Wait -Verbose -Force
} catch {
    $_ | Write-AWSLaunchWizardException
}
