 #Requires -Version 7.0
#Requires -Module AWS.Tools.FSX,AWS.Tools.secretsmanager
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId,

    [Parameter(Mandatory=$true)]
    [string]$FSxCredStore,

    [Parameter(Mandatory=$true)]
    [string]$SQLVMName,

    [Parameter(Mandatory=$true)]
    [string]$FSxDataVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$FSxLogVolumeName,

    [Parameter(Mandatory=$true)]
    [string]$IGROUP

)
Start-Transcript -Path C:\cfn\log\cleanup_ontap.log.txt -Append

$ErrorActionPreference = "Stop"

$userfilter= new-object -typename Amazon.SimpleSystemsManagement.Model.ParameterStringFilter -property @{key="Type";Option="Equals";Values="String"}
$pwdfilter= new-object -typename Amazon.SimpleSystemsManagement.Model.ParameterStringFilter -property @{key="Type";Option="Equals";Values="SecureString"}
$username = (Get-SSMParametersByPath -Path $FSxCredStore -WithDecryption $true -Recursive $true -ParameterFilter $userfilter).Value
$password = (Get-SSMParametersByPath -Path $FSxCredStore -WithDecryption $true -Recursive $true -ParameterFilter $pwdfilter).Value

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
    [string]$method
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
        Write-Error "{Message:Failed to run the API command,Exception: $_"
    }
}


$LOGLUN = 'sqllog'
$DATALUN = 'sqldata'
$vollist = @($FSxDataVolumeName,$FSxLogVolumeName)
$pathlist =@("/vol/$FSxDataVolumeName/$DATALUN","/vol/$FSxLogVolumeName/$LOGLUN")

# delete created lun mapping 
$lunmapsUriDynamicPart = 'private/cli/lun/mapping'
foreach ($lunpath in $pathlist) {
$URI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($SQLVMName)&igroup=$($IGROUP)&path=$($lunpath)"
$restcert = returncert -region $region
#check if records exist before deleting
$lunmappingdata = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET").records

foreach ($perlunmap in $lunmappingdata) {
    $DeleteURI = "https://$($MgmtDNS)/api/$($lunmapsUriDynamicPart)?vserver=$($perlunmap.vserver)&path=$($perlunmap.path)&igroup=$($perlunmap.igroup)"
    callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE"
    Write-Output ("Deleted LUN mapping for {0}" -f $perlunmap.path)
}

}

# delete created luns 
try{
$lunUriDynamicPart='private/cli/lun'
$URI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($SQLVMName)"
$lunlist = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET").records
#check if lun exists before deleting
foreach ($perlun in $lunlist) {
    if($pathlist -contains $perlun.path) {
        $DeleteURI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($perlun.vserver)&path=$($perlun.path)"
        callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE"
        Write-Output ("Deleted LUN {0}" -f $perlun.path)
    }
}
}catch{
        Write-Error "{Message:Failed to cleanup LUNs,Exception: $_}"
    }


# delete volumes created
try{
$volUriDynamicPart = 'storage/volumes'
foreach ($volume in $vollist) {
$URI = "https://$($MgmtDNS)/api/$($volUriDynamicPart)?name=$($volume)"
$voluri = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET").records.uuid
if ($voluri) {
    $DELVOLURI = "https://$($MgmtDNS)/api/$($volUriDynamicPart)/$($voluri)"
    callGetOrDeleteApi -uri $DELVOLURI -region $region -creds $base64 -method "DELETE"
    Write-Output "Deleted volume $volume"
}
else {Write-Output "Volume $volume not present"}
}
}catch{
        Write-Error "{Message:Failed to cleanup volumes,Exception: $_}"
    }
 
