[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId
)
Start-Transcript -Path C:\cfn\log\connectontapinstance.ps1.txt -Append
$ErrorActionPreference = "Stop"
try{
$fslist = Get-FSXFileSystem -FileSystemId $FileSystemId
$TargetPortalAddresses = (Get-FSXStorageVirtualMachine|?{$_.FileSystemId -eq $fslist.FileSystemId}).Endpoints.Iscsi.IpAddresses
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$data= Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/local-ipv4" -Headers @{"X-aws-ec2-metadata-token" = $token} -ErrorAction Stop -UseBasicParsing
$LocaliSCSIAddress = $data.Content
Foreach ($TargetPortalAddress in $TargetPortalAddresses){
New-IscsiTargetPortal -TargetPortalAddress $TargetPortalAddress -TargetPortalPortNumber 3260 -InitiatorPortalAddress $LocaliSCSIAddress
}
#Add MPIO support for iSCSI
New-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9
#Establish iSCSI connection
1..3 | %{Foreach($TargetPortalAddress in $TargetPortalAddresses){Get-IscsiTarget | Connect-IscsiTarget -IsMultipathEnabled $true -TargetPortalAddress $TargetPortalAddress -InitiatorPortalAddress $LocaliSCSIAddress -IsPersistent $true} }
#Set the MPIO Policy to Round Robin
Set-MSDSMGlobalDefaultLoadBalancePolicy -Policy RR
}catch{
    Write-Output "Error connecting to Iscsi targets"
    $_ | Write-AWSLaunchWizardException
}

