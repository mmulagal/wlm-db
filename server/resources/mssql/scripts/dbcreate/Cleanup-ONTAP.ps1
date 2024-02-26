#Requires -Version 7.0
#Requires -Module AWS.Tools.FSX,AWS.Tools.SimpleSystemsManagement
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$SQLVMName,

    [Parameter(Mandatory=$false)]
    [string]$FSxDataVolumeName,

    [Parameter(Mandatory=$false)]
    [string]$FSxLogVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$IGROUP    

)
$silenttranscript = (Start-Transcript -Path C:\cfn\log\cleanup_ontap.log.txt -Append)

$ErrorActionPreference = "Stop"

$FSxCredStore  = "/netapp/wlmdb/$FileSystemId"
$credobject =  (Get-SSMParameter -Name $FsxCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 

$username = $credobject.fsx.username
$password = $credobject.fsx.password

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

$result = @{}

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

function callGetOrDeleteApi{
    param(
    [Parameter(Mandatory=$true)]
    [string]$uri,
    [Parameter(Mandatory=$true)]
    [string]$region,
    [Parameter(Mandatory=$true)]
    [string]$creds,
    [Parameter(Mandatory=$true)]
    [string]$method,
    [Parameter(Mandatory=$true)]
    [hashtable]$result    
    )
    try{
        $restcert = returncert -region $region
        $Params = @{
            "URI"     = "$uri"
            "Method"  = "$method"
            "Headers" = @{"Authorization" = "Basic $creds"}
            "ContentType" = "application/json"
        }
        Invoke-RestMethod @Params -Certificate $restcert
    }catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to run the REST API command')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
    }
}


$LOGLUN = 'sqllog'
$DATALUN = 'sqldata'
if ($FSxDataVolumeName -And $FsxLogVolumeName){
$vollist = @($FSxDataVolumeName,$FSxLogVolumeName)
$pathlist =@("/vol/$FSxDataVolumeName/$DATALUN","/vol/$FSxLogVolumeName/$LOGLUN")
}  elseif($FSxDataVolumeName) {
    $vollist = @($FSxDataVolumeName)
    $pathlist =@("/vol/$FSxDataVolumeName/$DATALUN")
}
elseif($FSxLogVolumeName){
    $vollist = @($FSxLogVolumeName)
    $pathlist =@("/vol/$FSxLogVolumeName/$LOGLUN")
} else {
    Write-Error "{Message:No volumes passed for cleanup,Exception:$_}"
}

# delete created lun mapping 
$lunmapsUriDynamicPart = 'private/cli/lun/mapping'
foreach ($lunpath in $pathlist) {
$URI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($SQLVMName)&igroup=$($IGROUP)&path=$($lunpath)"
$restcert = returncert -region $region
#check if records exist before deleting
$lunmappingdata = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET" -result $result).records

foreach ($perlunmap in $lunmappingdata) {
    $DeleteURI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($perlunmap.vserver)&path=$($perlunmap.path)&igroup=$($perlunmap.igroup)"
    callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE" -result $result
}

}

# delete created luns 
try{
$lunUriDynamicPart='private/cli/lun'
$URI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($SQLVMName)"
$lunlist = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET" -result $result).records
#check if lun exists before deleting
foreach ($perlun in $lunlist) {
    if($pathlist -contains $perlun.path) {
        $DeleteURI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($perlun.vserver)&path=$($perlun.path)"
        callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE" -result $result
    }
}
}catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to delete LUNs')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
    }


# delete volumes created
try{
$volUriDynamicPart = 'storage/volumes'
foreach ($volume in $vollist) {
$URI = "https://$($MgmtDNS)/api/$($volUriDynamicPart)?name=$($volume)"
$voluri = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET" -result $result).records.uuid
if ($voluri) {
    $DELVOLURI = "https://$($MgmtDNS)/api/$($volUriDynamicPart)/$($voluri)"
    callGetOrDeleteApi -uri $DELVOLURI -region $region -creds $base64 -method "DELETE" -result $result
}
}
}catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to delete volumes')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
    }
    $result.Add('Status','Complete')
    $result.Add('Message','Cleaning up resources complete')
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
