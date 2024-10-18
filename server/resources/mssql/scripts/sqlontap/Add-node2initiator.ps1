#Requires -Module AWS.Tools.FSX,netapp.ontap
[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$sqlvmname,

    [Parameter(Mandatory=$true)]
    [string]$igroup,

    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname,

    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform    
)
Start-Transcript -Path C:\cfn\log\ontapconfig.ps1.txt -Append

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

$ErrorActionPreference = "Stop"

$ScriptsPath =  Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
. "$ScriptsPath\common\InvokeRetryCommand.ps1" 
$SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
$username = $SsmParameter.fsx.username
$password = $SsmParameter.fsx.password
$fsxadmincreds = (New-Object PSCredential($username,(ConvertTo-SecureString $password -AsPlainText -Force)))
$fslist = Invoke-WithRetry -Command { Get-FSXFileSystem -FileSystemId $FileSystemId }
$MgmtDNS = $fslist.ontapconfiguration.Endpoints.Management.DNSName
$nodeiqn = (Get-InitiatorPort).NodeAddress

try{
Connect-NcController -Name $MgmtDNS -Credential $fsxadmincreds -Vserver $sqlvmname
do{
    $ig = Get-NcIgroup -Name $igroup
}while($ig -eq $null)
Add-NcIgroupInitiator -Name $igroup -Initiator $nodeiqn
}catch{
    $FailureReason = "Adding Initiator failed"
    Write-Output $FailureReason
    if ($IsTerraform) {
        throw $FailureReason
    }
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId   
    $_ | Write-AWSLaunchWizardException 
}


