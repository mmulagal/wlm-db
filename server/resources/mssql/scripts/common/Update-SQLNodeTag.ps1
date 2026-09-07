[CmdletBinding()]
param(

    [Parameter(Mandatory = $true)]
    [string]$StackName,

    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform 
)

Start-Transcript -Path C:\cfn\log\updatesqlnodetag.ps1.txt -Append

$awsToolsModule = 'AWS.Tools.EC2' 
if (Get-Module -ListAvailable -Name $awsToolsModule) {
    Import-Module -Name $awsToolsModule
}
elseif (Get-Module -ListAvailable -Name AWSPowerShell) {
    Import-Module -Name AWSPowerShell
}
else {
    throw "Neither $awsToolsModule nor AWSPowerShell is available."
} 

try {
    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri http://169.254.169.254/latest/api/token
    $instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
    $region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing).Content
    $DeploymentCompletionTag = New-Object Amazon.EC2.Model.Tag
    $DeploymentCompletionTag.Key = "CF-WLMDB-StackName"
    $DeploymentCompletionTag.Value = $StackName
    Invoke-WithRetry -Command {
        New-EC2Tag -Resource $instanceID -Tag $DeploymentCompletionTag
    }
    if ($IsTerraform) {
        # once this completes add the tag to know when to proceed from primary instance
        New-EC2Tag -Region "$region" -ResourceId "$instanceID" -Tag @{ Key = "update_sql_node_tag"; Value = "completed" }
        Write-Output "Instance tagged successfully for the completion of update sql node tag"
    }
}
catch {
    $_ | Write-AWSLaunchWizardException
}