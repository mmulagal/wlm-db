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
    [string]$IGROUP

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
        Send-CFNResourceSignal -StackName $stack -Status FAILURE -LogicalResourceId $resource -UniqueId $instanceId
        $_ | Write-AWSLaunchWizardException
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


# delete volumes created
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
 
