     [CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$DomainAdminUser,  
    
    [Parameter(Mandatory=$true)]
    [string]$WFCName,

    [Parameter(Mandatory=$true)]
    [string]$Node1,

    [Parameter(Mandatory=$true)]
    [string]$Node2,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname 
  
)

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

class NodeException: System.Exception{
    [string] $Emessage
    NodeException($Message, $Emessage) : base($Message) {
        $this.Emessage = $Emessage
    }
}
class ResourceException: System.Exception{
    [string] $Emessage
    ResourceException($Message, $Emessage) : base($Message) {
        $this.Emessage = $Emessage
    }
}

class SQLFCIException: System.Exception{
    [string] $Emessage
    SQLFCIException($Message, $Emessage) : base($Message) {
        $this.Emessage = $Emessage
    }
}


try {

    $ErrorActionPreference = "Stop"

    Start-Transcript -Path C:\cfn\log\$($MyInvocation.MyCommand.Name).log -Append

    $HostName = hostname
    $DomainNetBIOSName = $env:USERDOMAIN
    $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | ConvertFrom-Json
    $AdminPassword = $SsmParameter.domain.password
    $ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
    $Credentials = (New-Object PSCredential($ClusterAdminUser,(ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))

    try {
    $Nodes = Invoke-Command -scriptblock {
    param($wincluster)
    $clusnodes = (Get-ClusterNode -Cluster $wincluster) | Out-String
    Write-Output $clusnodes
    $clusnodes
      }  -Credential $Credentials -ComputerName $HostName -Authentication credssp -ArgumentList $WFCName -ErrorAction SilentlyContinue -ErrorVariable errs

  } catch {
  Write-Output $errs
  }
    if ($Nodes -eq "") {
    Write-Output "Failed to get nodes using Cluster name. Check problem RPC service, network connection or Firewall. Attempting to fetch nodes with Get-ClusterNode only..."
    $Nodes = Invoke-Command -scriptblock {
    $clusnodes = Get-ClusterNode | Out-String
    Write-Output $clusnodes
    $clusnodes
      }  -Credential $Credentials -ComputerName $HostName -Authentication credssp 
    }
    Write-Output $Nodes
    $ClusterResource = Invoke-Command -scriptblock {
    $clusresources = Get-ClusterResource | Out-String
    Write-Output $clusresources
    $clusresources
      }  -Credential $Credentials -ComputerName $HostName -Authentication credssp


    Write-Output $ClusterResource
     if (($Nodes -notmatch $Node1) -Or ($Nodes -notmatch $Node2)) {
        throw [NodeException]::new('Node Check Failure:Node missing in Cluster',"All nodes are not part of the cluster")
    }

    if ($ClusterResource -notmatch "Quorum") {
        throw [ResourceException]::new('Disk Check Failure:No Witness Disk',"Cluster Quorum Disk Resource is not available")
    }

    if ($ClusterResource -notmatch "SQL-DATA") {
        throw [ResourceException]::new('Disk Check Failure:No SQL Data Disk',"SQL Data Disk Resource is not available")
    }

     if ($ClusterResource -notmatch "Cluster IP Address") {
        throw [ResourceException]::new('IP Check Failure',"Cluster IP Address Resource is not available")
    } 
     if ($ClusterResource -notmatch "SQL Server") {
        throw [SQLFCIException]::new('SQL Check Failure:No SQL Server Role',"SQL Server Role could not be created or brought online")
    }

     if ($ClusterResource -notmatch "SQL Server Agent") {
        throw [SQLFCIException]::new('SQL Check Failure:No SQL Server Agent',"SQL Server Agent Role could not be created or brought online")
    }  

}
    catch [NodeException] {
    Write-Output "Cluster does not contain both nodes or not in healthy state"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException 
}

    catch [ResourceException] {
    Write-Output "Cluster does not have all the required resources(disk and networking) created."
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException 
    
}

    catch [SQLFCIException] {
    Write-Output "SQL FCI configuration failed. SQL server related roles not created or not online"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException 
    
}
  


catch {
    Write-Output "SQL FCI validation failed"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
} 
 
 
