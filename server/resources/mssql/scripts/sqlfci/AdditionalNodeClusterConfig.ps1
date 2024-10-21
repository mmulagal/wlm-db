[CmdletBinding()]
param(

    [Parameter(Mandatory = $true)]
    [string]$WSFCNode2PrivateIP2,

    [Parameter(Mandatory = $true)]
    [string]$ClusterName,

    [Parameter(Mandatory = $true)]
    [string]$DomainAdminUser,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,
    
    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform,
    
    [Parameter(Mandatory = $false)]
    [string]$PrimaryInstanceId
)

try {
    Start-Transcript -Path C:\cfn\log\AdditionalNodeClusterConfig.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
    $region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing).Content

    # Getting the DSC Cert Encryption Thumbprint to Secure the MOF File
    $DscCertThumbprint = (get-childitem -path cert:\LocalMachine\My | where { $_.subject -eq "CN=AWSLWDscEncryptCert" }).Thumbprint
    $DomainNetBIOSName = $env:USERDOMAIN
    # Getting Password from Secrets Manager for AD Admin User
    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
    . "$ScriptsPath\common\PollForTag.ps1" 
    $SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
    $AdminPassword = $SsmParameter.domain.password
    $ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    # Creating Credential Object for Administrator
    $Credentials = (New-Object PSCredential($ClusterAdminUser, (ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))

    # look for primary node Configure-MAD-Permissions.ps1 is completed then only proceed
    # Check if polling is required
    if ($IsTerraform) {
        PollForTag -Region $region -InstanceId $PrimaryInstanceId -TagKey "configure_mad_permissions" -TagValue "completed"
    }

    $ConfigurationData = @{
        AllNodes = @(
            @{
                NodeName             = "*"
                CertificateFile      = "C:\cfn\dsc\publickeys\AWSLWDscPublicKey.cer"
                Thumbprint           = $DscCertThumbprint
                PSDscAllowDomainUser = $true
            },
            @{
                NodeName = 'localhost'
            }
        )
    }

    Configuration AdditionalNodeClusterConfig {
        param(
            [PSCredential] $Credentials
        )

        Import-Module -Name xFailOverCluster
        Import-Module -Name PSDscResources

        Import-DscResource -ModuleName xFailOverCluster
        Import-DscResource -ModuleName PSDscResources

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
        }
    }

    AdditionalNodeClusterConfig -OutputPath 'C:\cfn\dsc\AdditionalNodeClusterConfig' -ConfigurationData $ConfigurationData -Credentials $Credentials

    Start-DscConfiguration 'C:\cfn\dsc\AdditionalNodeClusterConfig' -Wait -Verbose -Force
}
catch {
    Write-Error $_.Exception.Message
    $_ | Write-AWSLaunchWizardException
    if ($IsTerraform) {
        throw $_.Exception.Message
    }
}
