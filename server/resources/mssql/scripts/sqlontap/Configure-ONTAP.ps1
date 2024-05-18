   #Requires -Version 7.0
#Requires -Module AWS.Tools.FSX
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$SQLVMName,

    [Parameter(Mandatory=$true)]
    [string]$FSxDataVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$FSxLogVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$FSxTempDBVolumeName,

    [Parameter(Mandatory=$false)]
    [string]$FSxQuorumVolumeName,    

    [Parameter(Mandatory=$true)]
    [string]$FSxDataLunSize,

    [Parameter(Mandatory=$true)]
    [string]$IGROUP,

    [Parameter(Mandatory=$true)]
    [string]$SnapshotPolicy,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,   

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$Parentstackname 

)
Start-Transcript -Path C:\cfn\log\configureontap.ps1.txt -Append

$ErrorActionPreference = "Stop"

$SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
$username = $SsmParameter.fsx.username
$password = $SsmParameter.fsx.password
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

# Get FSx certificate
$isprivatesubnet = $False
$certuri= "https://fsx-aws-certificates.s3.amazonaws.com/bundle-$region.pem"
try {
    Invoke-WebRequest -Uri $certuri -OutFile C:\cfn\cert.pem
    $cert = Import-Certificate -FilePath C:\cfn\cert.pem -CertStoreLocation Cert:\LocalMachine\Root
    $restcert = Get-ChildItem -Path Cert:\LocalMachine\Root|?{$_.Subject -like $cert.Subject}
}
catch {
    $isprivatesubnet = $True
    $restcert = ''
}

Write-output "Private subnet $isprivatesubnet"

function callGetOrDeleteApi{
    param(
    [Parameter(Mandatory=$true)]
    [string]$uri,
    [Parameter(Mandatory=$true)]
    [string]$region,
    [Parameter(Mandatory=$true)]
    [string]$creds,
    [Parameter(Mandatory=$true)]
    [string]$method
    )
    try{
        $Params = @{
            "URI"     = "$uri"
            "Method"  = "$method"
            "Headers" = @{"Authorization" = "Basic $creds"}
            "ContentType" = "application/json"
        }
        if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
        }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
        }
    }catch{
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException
    }
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
    [string]$resource,    
    [Parameter(Mandatory=$true)]
    [string]$stack,
    [Parameter(Mandatory=$true)]
    [string]$instanceId
    )
    try{
        $resturi = "https://$MgmtDNS/api/$uri"
        $JsonBody = $Body | ConvertTo-Json
        $Params = @{
            "URI"     = "$resturi"
            "Method"  = "POST"
            "Headers" = @{"Authorization" = "Basic $creds"}
            "Body" =  "$JsonBody"
            "ContentType" = "application/json"
        }
        if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
        }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
        }
    }catch{
        Send-CFNResourceSignal -StackName $stack -Status FAILURE -LogicalResourceId $resource -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException
    }
}

$LOGLUN = 'sqllog'
$DATALUN = 'sqldata'
$TLUN = 'tempdb'
$QLUN = 'quorum'

# delete lun mapping if exist
$lunmapsUriDynamicPart = 'private/cli/lun/mapping'
$URI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($SQLVMName)&igroup=$($IGROUP)"
$lunmappingdata = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET").records

foreach ($perlunmap in $lunmappingdata) {
    $DeleteURI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($perlunmap.vserver)&path=$($perlunmap.path)&igroup=$($perlunmap.igroup)"
    callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE"
}
Start-Sleep 5

# delete luns if exists
$lunUriDynamicPart='private/cli/lun'
$URI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($SQLVMName)"
$lunlist = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET").records
if ($FSxQuorumVolumeName -ne "") {
$lunPathList = @("/vol/$FSxQuorumVolumeName/$QLUN",  "/vol/$FSxTempDBVolumeName/$TLUN", "/vol/$FSxLogVolumeName/$LOGLUN", "/vol/$FSxDataVolumeName/$DATALUN")
}
else {
$lunPathList = @("/vol/$FSxTempDBVolumeName/$TLUN", "/vol/$FSxLogVolumeName/$LOGLUN", "/vol/$FSxDataVolumeName/$DATALUN")
}

foreach ($perlun in $lunlist) {
    if($lunPathList -contains $perlun.path) {
        $DeleteURI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($perlun.vserver)&path=$($perlun.path)"
        callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE"
    }
}

Start-Sleep 5

# delete igroup if exists
$IGUriDynamicPart='private/cli/igroup'
$URI = "https://$($MgmtDNS)/api/$($IGUriDynamicPart)?vserver=$($SQLVMName)&igroup=$($IGROUP)"
$igrouplist = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET").records 

foreach ($perigroup in $igrouplist) {
    $DeleteURI = "https://$($MgmtDNS)/api/$($IGUriDynamicPart)?vserver=$($perigroup.vserver)&igroup=$($perigroup.igroup)"
    callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE"
}

Start-Sleep 5

#Create snapshot policy - daily with 7 days retention
$PolicyExists = $False
$SnapshotPolicyPart = 'storage/snapshot-policies'

if ($SnapshotPolicy -eq 'default') {
$SnapshotPolicyPart = 'storage/snapshot-policies'
#Check if snapshot exists
$URI = "https://$($MgmtDNS)/api/$($SnapshotPolicyPart)?svm=$($SQLVMName)&name=daily_weekretention"
$snapshotPolicyList = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET").records 
if ($snapshotPolicyList) {
    $PolicyExists = $True
}

if ($PolicyExists -eq  $False) {
$URI=@"
https://$($MgmtDNS)/api/$($SnapshotPolicyPart)
"@
$Body = @{
    "name" = "daily_weekretention"
    "enabled" = "true"
    "comment"= "NetApp Workload Factory daily snapshot with a week retention"
    "svm" = @{"name" = "$SQLVMName"}
    "copies" = @(@{ "count" = "7" 
                  "schedule" = @{"name" = "daily"}})
}
$JsonBody = $Body | ConvertTo-Json -Depth 10
$Params = @{
    "URI"     = "$URI"
    "Method"  = "POST"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}
try{
    if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
    }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
    }
    $PolicyExists = $True
}catch{
    Write-Output "Snapshot policy creation failed." $_
}
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
    "space-mgmt-try-first"= "volume_grow"
    "percent-snapshot-space" = "0"
    "read-realloc" = "on"
    "tiering-policy" = "snapshot-only"
    "tiering-minimum-cooling-days" = "7"
    "autosize-mode" = "grow"
    "tiering-object-tags" = @( "wlmDeploymentId=" + $($Stackname.split('-')[0..2] -join "_") )
}
if ($PolicyExists -eq $True) {
    $Body["snapshot-policy"] = 'daily_weekretention'
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
    if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
    }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
    }
}catch{
    Write-Output "Volume modification failed." $_
}
Start-Sleep 5

$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($FSxLogVolumeName)
"@

$Params = @{
    "URI"     = "$URI"
    "Method"  = "PATCH"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}
try{
    if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
    }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
    }
}catch{
    Write-Output "Volume modification failed." $_
}
Start-Sleep 5

$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($FSxTempDbVolumeName)
"@

$Params = @{
    "URI"     = "$URI"
    "Method"  = "PATCH"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}
try{
    if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
    }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
    }
}catch{
    Write-Output "Volume modification failed." $_
}
Start-Sleep 5

if ($FSxQuorumVolumeName -ne "") {
$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($FSxQuorumVolumeName)
"@

$Params = @{
    "URI"     = "$URI"
    "Method"  = "PATCH"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "Body" =  "$JsonBody"
    "ContentType" = "application/json"
}

try{
    if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
    }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
    }
}catch{
    Write-Output "Volume modification failed." $_
}
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

callrestapi -MgmtDNS $MgmtDNS -uri $IGUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId
Start-Sleep 5
 
##create data lun
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
$DSIZE = $FSxDataLunSize+"M"
$LUN_PATH = "/vol/$FSxDataVolumeName/$DATALUN"
$Body = @{
    "name" = "$LUN_PATH"
    "os_type" = "windows_2008"
    "location"= @{"volume"=@{"name" = "$FSxDataVolumeName"}}
    "svm" = @{"name" = "$SQLVMName"} 
    "space" = @{"size" = "$DSIZE"}       
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId

Start-Sleep 5

##mapping data lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$URI = "https://$MgmtDNS/api/$lunmapsUriDynamicPart"
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId



##create log lun
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
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
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId

Start-Sleep 5
##mapping log lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId

##create tempDb lun
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
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
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId

Start-Sleep 5
##mapping tempDb lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$URI = "https://$MgmtDNS/api/$lunmapsUriDynamicPart"
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId

##create quorum lun
if ($FSxQuorumVolumeName -ne "") {
$lunUriDynamicPart='storage/luns'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
$LUN_PATH = "/vol/$FSxQuorumVolumeName/$QLUN"
$Body = @{
    "name" = "$LUN_PATH"
    "os_type" = "windows_2008"
    "location"= @{"volume"=@{"name" = "$FSxQuorumVolumeName"}}
    "svm" = @{"name" = "$SQLVMName"} 
    "space" = @{"size" = "10G"}   
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId 

Start-Sleep 5
##mapping quorum lun
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
$URI = "https://$MgmtDNS/api/$lunmapsUriDynamicPart"
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$LUN_PATH"}
    "igroup" = @{"name" = "$IGROUP"}
}
callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -resource $ResourceID -stack $Stackname -instanceId $instanceId
}
 
 
##modify luns
$lunUriDynamicPart='private/cli/lun'



#$lunPathList = @("/vol/$FSxQuorumVolumeName/$QLUN",  "/vol/$FSxTempDBVolumeName/$TLUN", "/vol/$FSxLogVolumeName/$LOGLUN", "/vol/$FSxDataVolumeName/$DATALUN")
foreach ($perlun in $lunPathlist) {
        $UpdateLUNURI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($SQLVMName)&path=$($perlun)"
        $Body = @{
         "space-reserve" = "enabled"
          }
          $JsonBody = $Body | ConvertTo-Json
        $Params = @{
        "URI"     = "$UpdateLUNURI"
        "Method"  = "PATCH"
        "Headers" = @{"Authorization" = "Basic $base64"}
        "Body" =  "$JsonBody"
        "ContentType" = "application/json"
        }
        try{
        if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
        }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
        }
        }
        catch{
        Write-Output "LUN modification failed." $_
        }
        Start-Sleep 2
        $Body = @{
         "space-allocation" = "enabled"
          }
          $JsonBody = $Body | ConvertTo-Json
        $Params = @{
        "URI"     = "$UpdateLUNURI"
        "Method"  = "PATCH"
        "Headers" = @{"Authorization" = "Basic $base64"}
        "Body" =  "$JsonBody"
        "ContentType" = "application/json"
        }
        try{
        if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
        }else {
            Invoke-RestMethod @Params -SkipCertificateCheck
        }
        }
        catch{
        Write-Output "LUN modification failed." $_
        }
        Start-Sleep 3
    }
 
 
 
