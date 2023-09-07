#Requires -Version 7.0
#Requires -Module AWS.Tools.FSX,AWS.Tools.secretsmanager
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$AdminSecret,

    [Parameter(Mandatory=$true)]
    [string]$SQLVMName,

    [Parameter(Mandatory=$true)]
    [string]$FSxDataVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$FSxLogVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$FSxTempDBVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$FSxQuorumVolumeName,    

    [Parameter(Mandatory=$true)]
    [string]$FSxDataLunSize,

    [Parameter(Mandatory=$true)]
    [string]$IGROUP,

    [Parameter(Mandatory=$true)]
    [string]$Stackname

)
Start-Transcript -Path C:\cfn\log\configureontap.ps1.txt -Append

$ErrorActionPreference = "Stop"

$AdminUser = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $AdminSecret).SecretString
$username = $AdminUser.username
$password = $AdminUser.password
##Create Volume with ONTAP RestAPI via PowerShell 7.0
$fslist = Get-FSXFileSystem -FileSystemId $FileSystemId
$MgmtDNS = $fslist.ontapconfiguration.Endpoints.Management.DNSName
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token} -ErrorAction Stop -UseBasicParsing).Content
$pair = "$($username):$($password)"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [System.Convert]::ToBase64String($bytes)

#get management IP
$nodeiqn = (Get-InitiatorPort).NodeAddress

#get Instance ID
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

function returncert{
    param(
    [Parameter(Mandatory=$true)]
    [string]$region
    )
    $certuri= "https://fsx-aws-certificates.s3.amazonaws.com/bundle-$region.pem"
    Invoke-WebRequest -Uri $certuri -OutFile C:\cfn\cert.pem
    $cert = Import-Certificate -FilePath C:\cfn\cert.pem -CertStoreLocation Cert:\LocalMachine\Root
    return Get-ChildItem -Path Cert:\LocalMachine\Root|?{$_.Subject -like $cert.Subject}

}

function callrestapi{
    param(
    [Parameter(Mandatory=$true)]
    [string]$MgmtDNS,
    [Parameter(Mandatory=$true)]
    [string]$uri,
    [Parameter(Mandatory=$true)]
    [string]$region,
    [Parameter(Mandatory=$true)]
    [Hashtable]$parambody,
    [Parameter(Mandatory=$true)]
    [string]$creds,
    [Parameter(Mandatory=$true)]
    [string]$stack,
    [Parameter(Mandatory=$true)]
    [string]$instanceId
    )
    try{
        $restcert = returncert -region $region
        $resturi = "https://$MgmtDNS/api/$uri"
        $JsonBody = $Body | ConvertTo-Json
        $Params = @{
            "URI"     = "$resturi"
            "Method"  = "POST"
            "Headers" = @{"Authorization" = "Basic $creds"}
            "Body" =  "$JsonBody"
            "ContentType" = "application/json"
        }
        Invoke-RestMethod @Params -Certificate $restcert
    }catch{
        Send-CFNResourceSignal -StackName $stack -Status FAILURE -LogicalResourceId 'SqlFSxInstanceMAD1' -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException
    }
}
#Start ONTAP configuration
$VolUriDynamicPart='private/cli/volume'

##get volume uuid


##modify volumes
$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($FSxDataVolumeName)
"@
$Body = @{
    "fractional-reserve" = "0"
    "space-guarantee" = "none"
    "space-mgmt-try-first"= "snap_delete"
    "percent-snapshot-space" = "0"
    "read-realloc" = "on"
    "tiering-policy" = "snapshot-only"
    "snapshot-policy" = "none"
}

$JsonBody = $Body | ConvertTo-Json
$Params = @{
    "URI"     = "$URI"
    "Method"  = "PATCH"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}
try{
    $restcert = returncert -region $region
    Invoke-RestMethod @Params -Certificate $restcert
}catch{
    Write-Output "Volume modification failed"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId 'SqlFSxInstanceMAD1' -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}
Start-Sleep 5

$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($FSxLogVolumeName)
"@
$Body = @{
    "fractional-reserve" = "0"
    "space-guarantee" = "none"
    "space-mgmt-try-first"= "snap_delete"
    "percent-snapshot-space" = "0"
    "read-realloc" = "on"
    "tiering-policy" = "snapshot-only"
    "snapshot-policy" = "none"
}

$JsonBody = $Body | ConvertTo-Json
$Params = @{
    "URI"     = "$URI"
    "Method"  = "PATCH"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}
try{
    $restcert = returncert -region $region
    Invoke-RestMethod @Params -Certificate $restcert
}catch{
    Write-Output "Volume modification failed"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId 'SqlFSxInstanceMAD1' -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}
Start-Sleep 5

$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($FSxTempDbVolumeName)
"@
$Body = @{
    "fractional-reserve" = "0"
    "space-guarantee" = "none"
    "space-mgmt-try-first"= "snap_delete"
    "percent-snapshot-space" = "0"
    "read-realloc" = "on"
    "tiering-policy" = "snapshot-only"
    "snapshot-policy" = "none"
}

$JsonBody = $Body | ConvertTo-Json
$Params = @{
    "URI"     = "$URI"
    "Method"  = "PATCH"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}
try{
    $restcert = returncert -region $region
    Invoke-RestMethod @Params -Certificate $restcert
}catch{
    Write-Output "Volume modification failed"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId 'SqlFSxInstanceMAD1' -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}
Start-Sleep 5

$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($FSxQuorumVolumeName)
"@
$Body = @{
    "fractional-reserve" = "0"
     "space-mgmt-try-first"= "snap_delete"
}

$JsonBody = $Body | ConvertTo-Json
$Params = @{
    "URI"     = "$URI"
    "Method"  = "PATCH"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}
try{
    $restcert = returncert -region $region
    Invoke-RestMethod @Params -Certificate $restcert
}catch{
    Write-Output "Volume modification failed"
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId 'SqlFSxInstanceMAD1' -UniqueId $instanceId
    $_ | Write-AWSLaunchWizardException
}
Start-Sleep 5
##create igroup

$IGUriDynamicPart='protocols/san/igroups'
$URI = "https://$MgmtDNS/api/$IGUriDynamicPart"
$Body = @{
    "name"  = "$IGROUP"
    "svm" = @{"name" = "$SQLVMName"}
    "os_type" = "windows"
    "protocol" = "iscsi"
    "initiators"= @(@{"name" = "$nodeiqn"})
}

callrestapi -MgmtDNS $MgmtDNS -uri $IGUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId
Start-Sleep 5
 
##create data lun
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
$DATALUN = 'sqldata'
$DSIZE = $FSxDataLunSize+"M"
$LUN_PATH = "/vol/$FSxDataVolumeName/$DATALUN"
$Body = @{
    "name" = "$LUN_PATH"
    "os_type" = "windows_2008"    
    "location"= @{"volume"=@{"name" = "$FSxDataVolumeName"}}
    "svm" = @{"name" = "$SQLVMName"} 
    "space" = @{"size" = "$DSIZE"}       
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

Start-Sleep 5

##mapping data lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$URI = "https://$MgmtDNS/api/$lunmapsUriDynamicPart"
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

##create log lun
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
$LOGLUN = 'sqllog'
$LUN_PATH = "/vol/$FSxLogVolumeName/$LOGLUN"
$loglunsize = [math]::Round([int]$FSxDataLunSize*0.25)
$LSIZE = $loglunsize.ToString()+"M"
$Body = @{
    "name" = "$LUN_PATH"
    "os_type" = "windows_2008"    
    "location"= @{"volume"=@{"name" = "$FSxLogVolumeName"}}
    "svm" = @{"name" = "$SQLVMName"} 
    "space" = @{"size" = "$LSIZE"}   
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

Start-Sleep 5
##mapping log lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

##create tempDb lun
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
$TLUN = 'tempdb'
$LUN_PATH = "/vol/$FSxTempDBVolumeName/$TLUN"
$templunsize = [math]::Round([int]$FSxDataLunSize*0.1)
$TSIZE = $templunsize.ToString()+"M"

$Body = @{
    "name" = "$LUN_PATH"
    "os_type" = "windows_2008"    
    "location"= @{"volume"=@{"name" = "$FSxTempDbVolumeName"}}
    "svm" = @{"name" = "$SQLVMName"} 
    "space" = @{"size" = "$TSIZE"}   
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

Start-Sleep 5
##mapping tempDb lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$URI = "https://$MgmtDNS/api/$lunmapsUriDynamicPart"
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

##create quorum lun
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
$QLUN = 'quorum'
$LUN_PATH = "/vol/$FSxQuorumVolumeName/$QLUN"
$Body = @{
    "name" = "$LUN_PATH"
    "os_type" = "windows_2008"    
    "location"= @{"volume"=@{"name" = "$FSxQuorumVolumeName"}}
    "svm" = @{"name" = "$SQLVMName"} 
    "space" = @{"size" = "10G"}   
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

Start-Sleep 5
##mapping quorum lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$URI = "https://$MgmtDNS/api/$lunmapsUriDynamicPart"
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -stack $Stackname -instanceId $instanceId

 
 
 
