param(
        [Parameter(Mandatory=$true)]
        $FilePath,

        [Parameter(Mandatory=$true)]
        $SignatureFilePath,

        [Parameter(Mandatory=$true)]
        $PubFilePath,

        [Parameter(Mandatory=$true)]
        [string]$ResourceID,   

        [Parameter(Mandatory=$true)]
        [string]$Stackname
    )

$ErrorActionPreference = "Stop"
Start-Transcript -Path C:\cfn\log\verifysignature.log -Append

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

$logfilename = Split-Path $FilePath -leaf

try {
    & "C:\cfn\OpenSSL-Win64\bin\openssl" dgst -sha256 -verify  $PubFilePath -signature $SignatureFilePath  $FilePath >  C:\cfn\log\$logfilename.txt 2>&1

    # Check if verified or not
    $IsVerified = Select-String -Path C:\cfn\log\$logfilename.txt -Pattern "Verified OK"
    if (-not ([string]::IsNullOrEmpty($IsVerified)) ) {

        Write-Host "Signature verification for $FilePath passed."
    }
    else {
        Write-Output "Signature verification failed "+$FilePath
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        exit(1)
    }
}catch { 
    Write-host "Error while verifying signature for $FilePath : $_."
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    exit(1)
     } 
    

