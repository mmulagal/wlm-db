  [CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$SGID
)
    Import-Module -name AWSPowerShell
 try {   
    Start-Transcript -Path C:\cfn\log\updatesecuritygroup.ps1.txt -Append
#Update Security Group for Cluster communication
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$mac = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/mac
$local_addresses = (Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/network/interfaces/macs/$mac/local-ipv4s).Split([Environment]::NewLine)

Foreach ($address in $local_addresses) {
    $cidrBlocks = New-Object 'collections.generic.list[string]'
    $cidrBlocks.add("$address/32")
    $ipPermissions = New-Object Amazon.EC2.Model.IpPermission
    $ipPermissions.IpProtocol = "All"
    $ipPermissions.FromPort = -1
    $ipPermissions.ToPort = -1
    $ipPermissions.IpRanges = $cidrBlocks
    Grant-EC2SecurityGroupIngress -GroupID $SGID -IpPermissions $ipPermissions
    Start-Sleep 2
}
}
catch {
  Write-Output "Failed to update Security Group with Instance IPs"
  }

 
 
