[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$AdminSecret,

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
Start-Transcript -Path C:\cfn\log\AdditionalNodeAddCluster.ps1.txt -Append
$ErrorActionPreference = "Stop"
# Getting the DSC Cert Encryption Thumbprint to Secure the MOF File
$DscCertThumbprint = (get-childitem -path cert:\LocalMachine\My | where { $_.subject -eq "CN=AWSLWDscEncryptCert" }).Thumbprint
$DomainNetBIOSName = $env:USERDOMAIN
# Getting Password from Secrets Manager for AD Admin User
$AdminPassword = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value.domain.password
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

Configuration AdditionalNodeAddCluster {
param(
[PSCredential] $Credentials
)

Import-DscResource -ModuleName xFailOverCluster
Import-DscResource -ModuleName PSDscResources

Node 'localhost'{

WindowsFeature RSAT-AD-PowerShell {
Name = 'RSAT-AD-PowerShell'
Ensure = 'Present'
}

WindowsFeature AddFailoverFeature {
Ensure = 'Present'
Name = 'Failover-clustering'
DependsOn = '[WindowsFeature]RSAT-AD-PowerShell'
}
}
}

AdditionalNodeAddCluster -OutputPath 'C:\cfn\dsc\AdditionalNodeAddCluster' -ConfigurationData $ConfigurationData -Credentials $Credentials

Start-DscConfiguration 'C:\cfn\dsc\AdditionalNodeAddCluster' -Wait -Verbose -Force
}catch {
    Write-Output "Failed to add second node to cluster"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}
