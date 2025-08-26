[CmdletBinding()]
param(

	[Parameter(Mandatory = $true)]
	[string]$DomainAdminUser,   

	[Parameter(Mandatory = $true)]
	[string]$wsfcName,

	[Parameter(Mandatory = $false)]
	[string]$DCName,

	[Parameter(Mandatory = $true)]
	[string]$ResourceID,   

	[Parameter(Mandatory = $true)]
	[string]$Stackname,

	[Parameter(Mandatory = $true)]
	[string]$Parentstackname,

	[Parameter(Mandatory = $false)]
	[boolean]$IsTerraform
)

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing).Content
if($DCName -eq "default" -or $DCName -eq "no-value") {
        $DCName = ''
    }

try {
	Start-Transcript -Path C:\cfn\log\configuremadpermissions.ps1.txt -Append
	$ErrorActionPreference = "Stop"
	$HostName = hostname
	$DomainNetBIOSName = $env:USERDOMAIN
	$ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
	. "$ScriptsPath\common\InvokeRetryCommand.ps1" 
	$SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
	$AdminPassword = $SsmParameter.domain.password
	$ClusterAdminUser = $DomainNetBIOSName + '\' + $DomainAdminUser
	$Credentials = (New-Object PSCredential($ClusterAdminUser, (ConvertTo-SecureString $AdminPassword -AsPlainText -Force)))
	$wsfcCN = $wsfcName
	Invoke-Command -scriptblock {
		if([string]::IsNullOrEmpty($Using:DCName)) {
		$computer = get-adcomputer $Using:wsfcCN
		} else {
			$computer = get-adcomputer $Using:wsfcCN -Server $Using:DCName
		}
		$discard, $OU = $computer -split ',', 2
		$acl = get-acl "ad:$OU"
		$acl.access #to get access right of the OU
		$sid = [System.Security.Principal.SecurityIdentifier] $computer.SID
		$objectguid1 = new-object Guid bf967a86-0de6-11d0-a285-00aa003049e2 # is the rightsGuid for Create Computer Object class
		$inheritedobjectguid = new-object Guid bf967aa5-0de6-11d0-a285-00aa003049e2 # is the schemaIDGuid for the OU
		$identity = [System.Security.Principal.IdentityReference] $SID
		$adRights = [System.DirectoryServices.ActiveDirectoryRights] "CreateChild"
		$adRights2 = [System.DirectoryServices.ActiveDirectoryRights] "ReadProperty"
		$type = [System.Security.AccessControl.AccessControlType] "Allow"
		$inheritanceType = [System.DirectoryServices.ActiveDirectorySecurityInheritance] "All"
		$ace1 = new-object System.DirectoryServices.ActiveDirectoryAccessRule $identity, $adRights, $type, $objectGuid1, $inheritanceType, $inheritedobjectguid
		$ACE2 = New-Object System.DirectoryServices.ActiveDirectoryAccessRule $identity, $adRights2, $type, $inheritanceType
		$acl.AddAccessRule($ace1)
		$acl.AddAccessRule($ACE2)
		Set-acl -aclobject $acl "ad:$OU"
	} -Credential $Credentials -ComputerName $HostName -Authentication credssp
	if ($IsTerraform) {
		# once this completes add the tag to know when to proceed from secondary instance
		New-EC2Tag -Region "$region" -ResourceId "$instanceId" -Tag @{ Key = "configure_mad_permissions"; Value = "completed" }
		Write-Output "Instance tagged successfully for the completion of configure managed ad permissions"
	}
}
catch {
	$FailureReason = "Error configuring permissions for WSFC in Active Directory"
	Write-Output $FailureReason
	if ($IsTerraform) {
		throw $FailureReason
	}
	Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
	$_ | Write-AWSLaunchWizardException
}

 
