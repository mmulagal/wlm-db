  [CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$WFCName,

    [Parameter(Mandatory=$true)]
    [string]$Node1,

    [Parameter(Mandatory=$true)]
    [string]$Node2
)


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

 
    $Nodes = (Get-ClusterNode -Cluster $WFCName) | Out-String
    Write-Output $Nodes
    if (($Nodes -notmatch $Node1) -Or ($Nodes -notmatch $Node2)) {
        throw [NodeException]::new('Node Check Failure',"All nodes are not path of the cluster")
    }

    $ClusterResource = Get-ClusterResource | Out-String
    Write-Output $ClusterResource
    if ($ClusterResource -notmatch "Quorum") {
        throw [ResourceException]::new('Disk Check Failure',"Cluster Quorum Disk Resource is not available")
    }
    if ($ClusterResource -notmatch "SQL-DATA") {
        throw [ResourceException]::new('Disk Check Failure',"SQL Data Disk Resource is not available")
    }
     if ($ClusterResource -notmatch "Cluster IP Address") {
        throw [ResourceException]::new('IP Check Failure',"Cluster IP Address Resource is not available")
    }   
    if ($ClusterResource -notmatch "SQL Server") {
        throw [SQLFCIException]::new('SQL Check Failure',"SQL Server Role could not be created or brought online")
    }   
    if ($ClusterResource -notmatch "SQL Server Agent") {
        throw [SQLFCIException]::new('SQL Check Failure',"SQL Server Agent Role could not be created or brought online")
    }      

}

catch [NodeException] {
    Write-Output "Cluster does not contain both nodes or not in healthy state"
    $_ | Write-AWSLaunchWizardException 
}

catch [ResourceException] {
    Write-Output "Cluster does not have all the required resources(disk and networking) created."
    $_ | Write-AWSLaunchWizardException 
    
}

catch [SQLFCIException] {
    Write-Output "SQL FCI configuration failed. SQL server related roles not created or not online"
    $_ | Write-AWSLaunchWizardException 
    
}
catch {
    $_ | Write-AWSLaunchWizardException
} 
 
 
