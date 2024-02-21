 [CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$WSFCNode2PrivateIP2,

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

Start-Sleep -Seconds 180

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id


try{
Start-Transcript -Path C:\cfn\log\AddSecondaryNode.ps1.txt -Append
$ErrorActionPreference = "Stop"
# Getting the DSC Cert Encryption Thumbprint to Secure the MOF File
$DscCertThumbprint = (get-childitem -path cert:\LocalMachine\My | where { $_.subject -eq "CN=AWSLWDscEncryptCert" }).Thumbprint
$DomainNetBIOSName = $env:USERDOMAIN
# Getting Password from Secrets Manager for AD Admin User
$SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | ConvertFrom-Json
$AdminPassword = $SsmParameter.domain.password
$ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
# Creating Credential Object for Administrator
$Credentials = (New-Object PSCredential($ClusterAdminUser,(ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))
$HostName = hostname

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

Configuration AddSecondaryNode  {
    param(
        [PSCredential] $Credentials
    )

    Import-Module -Name xFailOverCluster
    Import-Module -Name PSDscResources
    Import-Module -Name AmznFailoverCluster

    Import-DscResource -ModuleName xFailOverCluster
    Import-DscResource -ModuleName PSDscResources
    Import-DscResource -ModuleName AmznFailoverCluster

    Node 'localhost'{

        xWaitForCluster WaitForCluster {
            Name             = $ClusterName
            RetryIntervalSec = 10
            RetryCount       = 120
        }

        xCluster JoinNodeToCluster {
            Name                          = $ClusterName
            StaticIPAddress               = $WSFCNode2PrivateIP2
            DomainAdministratorCredential = $Credentials
            DependsOn                     = '[xWaitForCluster]WaitForCluster'
        }
         ClusterIPAddressResource IPaddress
        {
            OwnerGroup = 'Cluster Group'
            Ensure     = 'Present'
            PsDscRunAsCredential = $Credentials
            DependsOn = '[xCluster]JoinNodeToCluster'
        }
    }
}
try {
AddSecondaryNode -OutputPath 'C:\cfn\dsc\AddSecondaryNode' -ConfigurationData $ConfigurationData -Credentials $Credentials 
Start-DscConfiguration 'C:\cfn\dsc\AddSecondaryNode' -Wait -Verbose -Force -ErrorAction SilentlyContinue -ErrorVariable errs
}
catch {
     Write-Output $errs
}


##Re-attempt once if previous step failed to install due to synchronization with second node prepare-fci and reboot
Start-Sleep -Seconds 15
$Nodes = Invoke-Command -scriptblock {
   param($wincluster)
   $clusnodes = (Get-ClusterNode -Cluster $wincluster -ErrorAction SilentlyContinue) | Out-String
   if ([string]::IsNullOrEmpty($clusnodes)) {
     $clusnodes = (Get-ClusterNode -ErrorAction SilentlyContinue) | Out-String 
   }
   Write-Output $clusnodes
   $clusnodes
     }  -Credential $Credentials -ComputerName $HostName -Authentication credssp -ArgumentList $ClusterName
   if ($Nodes -notmatch $HostName) {   
   Write-Output "Failed to add node to Cluster. This could be network issue or cluster creation failed in node 1 or node1 still joining cluster"
   Write-Output "Retrying after 3 minutes using native Add-ClusterNode cmdlet"
   Start-Sleep -Seconds 180
   Invoke-Command -scriptblock {
   param($wincluster,$hostname)
  
   Get-Cluster -Name $wincluster | Add-ClusterNode -Name $hostname
   } -Credential $Credentials -ComputerName $HostName -Authentication credssp -ArgumentList $ClusterName,$HostName
   }

} catch {
    Write-Output "Adding secondary node for Windows cluster failed"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}
