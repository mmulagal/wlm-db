[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$SQLVMName,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname    
)
Start-Transcript -Path C:\cfn\log\connectontapinstance.ps1.txt -Append

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id


$ErrorActionPreference = "Stop"
try{
$fslist = Get-FSXFileSystem -FileSystemId $FileSystemId
$TargetPortalAddresses = (Get-FSXStorageVirtualMachine|?{$_.FileSystemId -eq $fslist.FileSystemId -And $_.Name -eq $SQLVMName }).Endpoints.Iscsi.IpAddresses
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$data= Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/local-ipv4" -Headers @{"X-aws-ec2-metadata-token" = $token} -ErrorAction Stop -UseBasicParsing
$LocaliSCSIAddress = $data.Content
Foreach ($TargetPortalAddress in $TargetPortalAddresses){
New-IscsiTargetPortal -TargetPortalAddress $TargetPortalAddress -TargetPortalPortNumber 3260 -InitiatorPortalAddress $LocaliSCSIAddress
}


#Add MPIO support for iSCSI
New-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9
#Establish iSCSI connection. Creating 5 iSCSI sessions per target interface for optimum performance
1..5 | %{Foreach($TargetPortalAddress in $TargetPortalAddresses){Get-IscsiTarget | Connect-IscsiTarget -IsMultipathEnabled $true -TargetPortalAddress $TargetPortalAddress -InitiatorPortalAddress $LocaliSCSIAddress -IsPersistent $true} }
#Set the MPIO Policy to Round Robin
Set-MSDSMGlobalDefaultLoadBalancePolicy -Policy RR
}catch{
    Write-Output "Error connecting to Iscsi targets"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}

