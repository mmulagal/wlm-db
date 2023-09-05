[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$StackName
)
Import-Module -Name AWSPowerShell
try {
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri http://169.254.169.254/latest/api/token
	$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
    $DeploymentCompletionTag =  New-Object Amazon.EC2.Model.Tag
    $DeploymentCompletionTag.Key = "CF-WLMDB-StackName"
    $DeploymentCompletionTag.Value = $StackName 
    New-EC2Tag -Resource $instanceID -Tag $DeploymentCompletionTag
}
catch {
    $_ | Write-AWSLaunchWizardException
}