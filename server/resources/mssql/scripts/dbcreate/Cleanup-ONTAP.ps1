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
    [string]$IGROUP,
    
    [Parameter(Mandatory=$true)]
    [string]$DBName,

    [Parameter(Mandatory=$true)]
    [string]$IsClustered       

)
$silenttranscript = (Start-Transcript -Path C:\cfn\log\cleanup_ontap.log.txt -Append)

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

##Variables
$fslist = Get-FSXFileSystem -FileSystemId $FileSystemId
$MgmtDNS = $fslist.ontapconfiguration.Endpoints.Management.DNSName
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token} -ErrorAction Stop -UseBasicParsing).Content
$pair = "$($username):$($password)"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [System.Convert]::ToBase64String($bytes)

$result = [ordered]@{}


#Cleanup drives from SQL dependency in case of clustered configuration
$datalabel = $DBName+"-Data"
$loglabel = $DBName+"-Log"

if($IsClustered -ne "false") {
    #Check if disks are in dependency list before cleaning up
    $dependencylist = (Get-ClusterResourceDependency -Resource "SQL Server").DependencyExpression
    $logpattern = '\(\['+$loglabel+'\]\)'
    $datapattern = '\(\['+$datalabel+'\]\)'
    $logfound =  $dependencylist -match $logpattern
    $datafound = $dependencylist -match $datapattern
    if ($datafound) {
    $silencedependency =(Remove-ClusterResourceDependency -Resource "SQL Server" -Provider $datalabel)
    Remove-ClusterResource -Name $datalabel -Force
    } 
    if ($logfound) {
    $silencedependency =(Remove-ClusterResourceDependency -Resource "SQL Server" -Provider $loglabel)
    Remove-ClusterResource -Name $loglabel -Force
    }     
}

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

        $Params = @{
            "URI"     = "$uri"
            "Method"  = "$method"
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
    $result.Add('Status','Failed')
    $result.Add('Message','No volumes passed for deletion')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
}

# delete created lun mapping 
$lunmapsUriDynamicPart = 'private/cli/lun/mapping'
foreach ($lunpath in $pathlist) {
$URI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($SQLVMName)&igroup=$($IGROUP)&path=$($lunpath)"
#check if records exist before deleting
$lunmappingdata = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET" -result $result).records

foreach ($perlunmap in $lunmappingdata) {
    $DeleteURI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($perlunmap.vserver)&path=$($perlunmap.path)&igroup=$($perlunmap.igroup)"
    $deletelun = (callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE" -result $result)
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
        $deletelun = (callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE" -result $result)
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
    $deletevol = (callGetOrDeleteApi -uri $DELVOLURI -region $region -creds $base64 -method "DELETE" -result $result)
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
  
