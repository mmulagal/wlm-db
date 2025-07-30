#Requires -Module AWS.Tools.FSX,netapp.ontap
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$sqlvmname,

    [Parameter(Mandatory = $true)]
    [string]$igroup,

    [Parameter(Mandatory = $true)]
    [string]$FileSystemId,

    [Parameter(Mandatory = $true)]
    [string]$ResourceID,   

    [Parameter(Mandatory = $true)]
    [string]$Stackname,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,

    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform,
    
    [Parameter(Mandatory = $false)]
    [string]$PrimaryInstanceId
)
Start-Transcript -Path C:\cfn\log\ontapconfig.ps1.txt -Append

# Get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing).Content


$ErrorActionPreference = "Stop"

$ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
. "$ScriptsPath\common\InvokeRetryCommand.ps1"
. "$ScriptsPath\common\PollForTag.ps1" 
$SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
$username = $SsmParameter.fsx.username
$password = $SsmParameter.fsx.password
$fsxadmincreds = (New-Object PSCredential($username, (ConvertTo-SecureString $password -AsPlainText -Force)))
$fslist = Invoke-WithRetry -Command { Get-FSXFileSystem -FileSystemId $FileSystemId }

try {
    # Check if polling is required
    if ($IsTerraform) {
        PollForTag -Region $region -InstanceId $PrimaryInstanceId -TagKey "primary_configure_ontap" -TagValue "completed"
    }

    $MgmtDNS = $fslist.ontapconfiguration.Endpoints.Management.DNSName
    try {
    $FSxNHTTP_Request = [System.Net.WebRequest]::Create("https://$MgmtDNS")
    $FSxNHTTP_Response = $FSxNHTTP_Request.GetResponse()
    $FSxNHTTP_Response.Close()
}
catch {
    write-Information "FSxNHTTP_Response: $($_.Exception.Message)"
    if ($_.Exception.Message -like "*remote server returned an error*") {
        Write-Information "Server connection works, returned error for 0 arguments"       
    }
    else {
        Write-Information "FSxN Management domain $MgmtDNS is not resolved. Switching to management IP."
        $MgmtDNS = $fslist.ontapconfiguration.Endpoints.Management.IpAddresses
        if ($MgmtDNS -is [array]) {
            $MgmtDNS = $MgmtDNS[0]
        }
        $isprivatesubnet = $True
        $restcert = ''
    }
}
    $nodeiqn = (Get-InitiatorPort).NodeAddress
    Connect-NcController -Name $MgmtDNS -Credential $fsxadmincreds -Vserver $sqlvmname
    Write-Output "Connected to NetApp controller at $MgmtDNS"
    
    $retryCount = 0
    $maxRetries = 50
    $ig = $null

    while ($retryCount -lt $maxRetries -and $null -eq $ig) {
        try {
            $ig = Get-NcIgroup -Name $igroup
            if ($null -eq $ig) {
                Write-Output "Igroup $igroup not found, retrying..."
                Start-Sleep -Seconds 20
            }
        }
        catch {
            Write-Output "Error retrieving igroup: $_"
            Start-Sleep -Seconds 20
        }
        $retryCount++
    }

    if ($null -eq $ig) {
        throw "Igroup $igroup not found after $maxRetries attempts"
    }

    Write-Output "Igroup $igroup found, adding initiator $nodeiqn"
    Add-NcIgroupInitiator -Name $igroup -Initiator $nodeiqn
}
catch {
    Write-Output $_
    Write-Error $_.Exception.Message
    $FailureReason = "Adding Initiator failed: " + $_.Exception.Message
    Write-Output $FailureReason
    if ($IsTerraform) {
        throw $FailureReason
    }
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceID   
    $_ | Write-AWSLaunchWizardException 
}