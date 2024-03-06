   #Requires -Module AWS.Tools.FSX,AWS.Tools.SimpleSystemsManagement
 [CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$SQLVMName,

    [Parameter(Mandatory=$true)]
    [string]$FSxDataLunSize,

    [Parameter(Mandatory=$true)]
    [string]$FSxLogLunSize,

    [Parameter(Mandatory=$true)]
    [string]$LogNew,

    [Parameter(Mandatory=$true)]
    [string]$DataNew   

)
$logtranscript = (New-Item -ItemType Directory -Path C:\cfn\log -Force)
$silenttranscript = (Start-Transcript -Path C:\cfn\log\Configure_luns.log.txt -Append)

$ErrorActionPreference = "Stop"

add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(
        ServicePoint srvPoint, X509Certificate certificate,
        WebRequest request, int certificateProblem) {
            return true;
        }
}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$FSxCredStore  = "/netapp/wlmdb/$FileSystemId"

$credobject =  (Get-SSMParameter -Name $FsxCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 

$username = $credobject.fsx.username
$password = $credobject.fsx.password
$fslist = Get-FSXFileSystem -FileSystemId $FileSystemId
$MgmtDNS = $fslist.ontapconfiguration.Endpoints.Management.DNSName
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token} -ErrorAction Stop -UseBasicParsing).Content
$pair = "$($username):$($password)"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [System.Convert]::ToBase64String($bytes)

$epoch = (Get-Date -Date ((Get-Date).DateTime) -UFormat %s)

$FSxDataVolumeName = "wlmdb_sqldata_"+$epoch
$FSxDataVolumeSize = [math]::Round([int]$FSxDataLunSize*1.3,2)
$FSxLogVolumeName = "wlmdb_sqllog_"+$epoch
$FSxLogVolumeSize = [math]::Round([int]$FSxLogLunSize*1.3,2)
$result = [ordered]@{}
$resources=[ordered]@{}

$LOGLUN = 'sqllog'
$DATALUN = 'sqldata'

#get initiator address
$nodeiqn = (Get-InitiatorPort).NodeAddress

##Create Volume with ONTAP RestAPI via PowerShell 7.0


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

function callGetApi{
    param(
    [Parameter(Mandatory=$true)]
    [string]$uri,
    [Parameter(Mandatory=$true)]
    [string]$region,
    [Parameter(Mandatory=$true)]
    [string]$creds,
    [Parameter(Mandatory=$true)]
    [hashtable]$result
    )
    try{
        $Params = @{
            "URI"     = "$uri"
            "Method"  = "GET"
            "Headers" = @{"Authorization" = "Basic $creds"}
            "ContentType" = "application/json"
        }
        if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
        }else {
            Invoke-RestMethod @Params
        }
    }catch{
        $result.Add('Status','Failed')
        $result.Add('Message','REST API call to FSx for NetApp ONTAP failed')
        $result.Add('Exception',$_)
        $resultjson = ($result | ConvertTo-Json) 
        $resultjson  
        exit 1
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
    [hashtable]$result 
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
            $invokerest = (Invoke-RestMethod @Params -Certificate $restcert)
        }else {
            $invokerest = (Invoke-RestMethod @Params) 
        }
        
    }catch{
        $result.Add('Status','Failed')
        $result.Add('Message','REST API call to FSx for NetApp ONTAP failed')
        $result.Add('Exception',$_)
        $resultjson = ($result | ConvertTo-Json) 
        $resultjson  
        exit 1
    }
}

$LOGLUN = 'sqllog'
$DATALUN = 'sqldata'

try {
if(($LogNew -eq "false") -And ($DataNew -eq "false")) { throw }
} catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Need to define at least one new drive to configure storage')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1 
}

#Start ONTAP configuration

##Get the existing igroup for the initiator

$IGUriDynamicPart='protocols/san/igroups'
try {
$URI=@"
https://$($MgmtDNS)/api/$($IGUriDynamicPart)/?svm.name=$($SQLVMName)&initiators.name=$($nodeiqn)&protocol=iscsi
"@
$igroups = (callGetApi -uri $URI -region $region -creds $base64 -result $result).records
$IGROUP = $igroups[0].name
} catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Unable to fetch initiator group from SVM')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson     
    exit 1
}
if ([string]::IsNullOrEmpty($IGROUP)) {
  $found = $nodeiqn -match '(.*\:.+?)\.'
  try {
  if ($found) {
    $baseiqn = $matches[1]
    }
  else { throw}
  } catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Unable to find initiator group allowing access to the node')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1 
  }
  $URI=@"
  https://$($MgmtDNS)/api/$($IGUriDynamicPart)/?svm.name=$($SQLVMName)&initiators.name=$($baseiqn)&protocol=iscsi
"@

  $igroups = (callGetApi -uri $URI -region $region -creds $base64 -result $result).records
  $IGROUP = $igroups[0].name
  try {
  if ([string]::IsNullOrEmpty($IGROUP)) { throw }
  } catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Unable to find initiator group allowing access to the node')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1
  }

}
Start-Sleep 2


##create volumes
try {
$volUriDynamicPart='storage/volumes'
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
if($DataNew -ne "false") {
$DVOLSIZE = $FSxDataVolumeSize.ToString()+"M"
$Body = @{
    "name" = "$FSxDataVolumeName"
    "state" = "online"
    "type" = "RW"
    "svm" = @{"name" = "$SQLVMName"} 
    "aggregates.name" = @("aggr1")
    "snapshot_policy" = @{"name" = "none"} 
    "style" = "flexvol"
    "nas" = @{"security_style" = "NTFS"}
    "size" = "$DVOLSIZE"      
}
$datavolcreate= (callrestapi -MgmtDNS $MgmtDNS -uri $volUriDynamicPart -region $region -parambody $Body -creds $base64 -result $result)
}

if($LogNew -ne "false") {
$LVOLSIZE = $FSxLogVolumeSize.ToString()+"M"
$Body = @{
    "name" = "$FSxLogVolumeName"
    "state" = "online"
    "type" = "RW"
    "svm" = @{"name" = "$SQLVMName"} 
    "aggregates.name" = @("aggr1")
    "snapshot_policy" = @{"name" = "none"} 
    "style" = "flexvol"
    "nas" = @{"security_style" = "NTFS"}
    "size" = "$LVOLSIZE"      
}
$logvolcreate = (callrestapi -MgmtDNS $MgmtDNS -uri $volUriDynamicPart -region $region -parambody $Body -creds $base64 -result $result)
}
} catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to create volume on FSx for NetApp ONTAP')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1    
}

Start-Sleep 5

#Build return object for cleanup after volume creation
   $resources = @{
      'FSxDataVolumeName' = $FsxDataVolumeName
      'FSxLogVolumeName' = $FsxLogVolumeName
      'Igroup' = $IGROUP
      'SQLVMName' = $SQLVMName
   }
   $result.Add('Resources',$resources)

##modify volumes
$VolUriDynamicPart='private/cli/volume'
if(($LogNew -ne "false")-And ($DataNew -ne "false")) {
    $vollist = @($FSxDataVolumeName,$FSxLogVolumeName) 
} elseif($DataNew -ne "false") {
    $vollist = @($FSxDataVolumeName) 
}
else {
  $vollist = @($FSxLogVolumeName) 
}

foreach ($vol in $vollist) {
$URI=@"
https://$($MgmtDNS)/api/$($VolUriDynamicPart)?vserver=$($SQLVMName)&volume=$($vol)
"@
$Body = @{
    "fractional-reserve" = "0"
    "space-guarantee" = "none"
    "space-mgmt-try-first"= "volume_grow"
    "percent-snapshot-space" = "0"
    "read-realloc" = "on"
    "tiering-policy" = "snapshot-only"
    "tiering-minimum-cooling-days" = "7"
    "snapshot-policy" = "none"
    "autosize-mode" = "grow"
    "min-readahead" = "true"
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
            $modifyvol = (Invoke-RestMethod @Params -Certificate $restcert)
    }else {
            $modifyvol = (Invoke-RestMethod @Params)
        }
}catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to set best practise parameters on the volume')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1
}
Start-Sleep 5
}




 
##create data and log LUNs
$lunUriDynamicPart='storage/luns'
if ($DataNew -ne "false") {
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
$createdatalun = (callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -result $result)
Start-Sleep 2
}

if ($LogNew -ne "false") {
$URI = "https://$MgmtDNS/api/$lunUriDynamicPart"
$LUN_PATH = "/vol/$FSxLogVolumeName/$LOGLUN"
$LSIZE = $FSxLogLunSize+"M"
$Body = @{
    "name" = "$LUN_PATH"
    "os_type" = "windows_2008"       
    "location"= @{"volume"=@{"name" = "$FSxLogVolumeName"}}
    "svm" = @{"name" = "$SQLVMName"} 
    "space" = @{"size" = "$LSIZE"}   
}
$createloglun = (callrestapi -MgmtDNS $MgmtDNS -uri $lunUriDynamicPart -region $region -parambody $Body -creds $base64 -result $result)
Start-Sleep 2
}

##mapping data and log LUNs
if (($LogNew -ne "false")-And ($DataNew -ne "false")) {
$pathlist =@("/vol/$FSxDataVolumeName/$DATALUN","/vol/$FSxLogVolumeName/$LOGLUN")
} elseif ($DataNew -ne "false") {
    $pathlist =@("/vol/$FSxDataVolumeName/$DATALUN")
}
else {
   $pathlist =@("/vol/$FSxLogVolumeName/$LOGLUN")
}
$lunmapsUriDynamicPart = 'protocols/san/lun-maps'
foreach ($path in $pathlist) {
$URI = "https://$MgmtDNS/api/$lunmapsUriDynamicPart"
$Body = @{
    "svm" = @{"name" = "$SQLVMName"}
    "lun" = @{"name" = "$path"}
    "igroup" = @{"name" = "$IGROUP"}
}
$lunmodify = (callrestapi -MgmtDNS $MgmtDNS -uri $lunmapsUriDynamicPart -region $region -parambody $Body -creds $base64 -result $result)
}

Start-Sleep 2


 
##modify luns. PATCH api on LUNs allow to update only one parameter at a time

$lunUriDynamicPart='private/cli/lun'

foreach ($perlun in $pathlist) {
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
            $lunmodify1 = (Invoke-RestMethod @Params -Certificate $restcert)
        }else {
            $lunmodify1 = (Invoke-RestMethod @Params) 
        }
        
        }
        catch{
            $result.Add('Status','Failed')
            $result.Add('Message','Failed to set best practise parameters on the storage')
            $result.Add('Exception',$_)
            $resultjson = ($result | ConvertTo-Json) 
            $resultjson  
            exit 1
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
            $lunmodify1 = (Invoke-RestMethod @Params -Certificate $restcert)
        }else {
            $lunmodify1 = (Invoke-RestMethod @Params) 
        }
        }
        catch{
            $result.Add('Status','Failed')
            $result.Add('Message','Failed to set best practise parameters on the storage')
            $result.Add('Exception',$_)
            $resultjson = ($result | ConvertTo-Json) 
            $resultjson  
            exit 1
        }
        Start-Sleep 3
    }
    $result.Add('Status','Complete')
    $result.Add('Message','Provisioning storage on FSx for NetApp ONTAP complete')
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
 
