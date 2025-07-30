import { getVolumeIdFromPath } from './sandbox-scripts';

const cleanupResources = (
    fileSystemId: string,
    sqlVMName: string,
    iGROUP: string,
    dbName: string,
    isClustered: string,
    instanceName: string,
    isDefaultInstance: string,
    filePathString: string,
    fSxDataVolumeName: string = '',
    fSxLogVolumeName: string = ''
) => `

$FileSystemId = '${fileSystemId}'
$SQLVMName = '${sqlVMName}'
$IGROUP = '${iGROUP}'
$DBName = '${dbName}'
$IsClustered = '${isClustered}'
$InstanceName = '${instanceName}'
$IsDefaultInstance = '${isDefaultInstance}'
$FilePathString = '${filePathString}'
$FSxDataVolumeName = '${fSxDataVolumeName}'
$FSxLogVolumeName = '${fSxLogVolumeName}'

Add-Type @"
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

#Requires -Module AWS.Tools.FSX,AWS.Tools.SimpleSystemsManagement
$WarningPreference = 'SilentlyContinue';
$ProgressPreference = "SilentlyContinue";
$silenttranscript = (Start-Transcript -Path C:\\cfn\\log\\cleanup_ontap.log.txt -Append)

$ErrorActionPreference = "Stop"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$FilePaths = $FilePathString.Split(',')
$FSxCredStore = "/netapp/wlmdb/$FileSystemId"
$connection = Test-Connection -ComputerName fsx-aws-certificates.s3.amazonaws.com -Quiet -Count 1
if ($connection -eq $False) {
    # Set the registry key to disable certificate revocation check in case of private subnet
    Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\" -Name State -Value 146944 -Force | Out-Null
}
$credobject = (Get-SSMParameter -Name $FsxCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 

$username = $credobject.fsx.username
$password = $credobject.fsx.password

##Variables
$fslist = Get-FSXFileSystem -FileSystemId $FileSystemId
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
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$region = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/placement/region" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing).Content
$pair = "$($username):$($password)"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [System.Convert]::ToBase64String($bytes)

$result = [ordered]@{}


#Cleanup drives from SQL dependency in case of clustered configuration
if ($DBName.Length -gt 25) {
    $TruncatedName = $DBName.Substring(0, 25)
    $datalabel = $TruncatedName + "-Data"
    $loglabel = $TruncatedName + "-Log"
}
else {
    $datalabel = $DBName + "-Data"
    $loglabel = $DBName + "-Log"
}

${getVolumeIdFromPath}

if ($IsClustered -ne "false") {
    
    #Check if disks are in dependency list before cleaning up
    if ($IsDefaultInstance -eq "true"){
        $ClusterResourceName = "SQL Server"
    }
    else {
        $ClusterResourceName = "SQL Server ($InstanceName)"
    }

    $windowsVolumeIds = $FilePaths | ForEach-Object {
        Get-VolumeIdFromPath -absolutePath $_
    }

    $sqlgroup = Get-ClusterResource | Where-Object Name -eq $ClusterResourceName

    $sqlserver = Get-WmiObject -namespace root\\MSCluster MSCluster_Resource -filter "Name='$sqlgroup'"
    $resourcegroup = $sqlserver.GetRelated() | Where-Object Type -eq 'Physical Disk'

    $clusterdisksToRemove = @()

    foreach ($resource in $resourcegroup) {
        $disks = $resource.GetRelated("MSCluster_Disk")
        foreach ($disk in $disks) {
            $diskpart = $disk.GetRelated("MSCluster_DiskPartition")
            $clusterdisk = ($resource.name).replace('\r\n','')
            $diskvolume = $diskpart.VolumeGuid
            write-debug "Cluster Disk $diskvolume"
            if ($windowsVolumeIds -contains $diskpart.VolumeGuid) {
                $clusterdisksToRemove += $clusterdisk
            }
        }
    }

    write-Information "$logPrefix Cluster Disks to remove $clusterdisksToRemove"

    if ($clusterdisksToRemove.count -ne 0) {
        $clusterdisksToRemove | ForEach-Object {
            $diskToRemove = $_
            $diskToRemove = $diskToRemove.ToString()
            write-Information "$logPrefix Removing disk $diskToRemove"
            $null = (Remove-ClusterResourceDependency -Resource $ClusterResourceName -Provider $diskToRemove)
            $null = (Remove-ClusterSharedVolume -Name $diskToRemove -ErrorAction SilentlyContinue)
            $null = (Remove-ClusterResource -Name $diskToRemove -Force -ErrorAction SilentlyContinue)
        }
    }
}

# Get FSx certificate
$isprivatesubnet = $False
if ($connection -eq $False) {
    $isprivatesubnet = $True
    $restcert = ''
}
else {
    $certuri = "https://fsx-aws-certificates.s3.amazonaws.com/bundle-$region.pem"
    Invoke-WebRequest -Uri $certuri -OutFile C:\\cfn\\cert.pem
    $cert = Import-Certificate -FilePath C:\\cfn\\cert.pem -CertStoreLocation Cert:\\LocalMachine\\Root
    $restcert = Get-ChildItem -Path Cert:\\LocalMachine\\Root | ? { $_.Subject -like $cert.Subject }
}

function callGetOrDeleteApi {
    param(
        [Parameter(Mandatory = $true)]
        [string]$uri,
        [Parameter(Mandatory = $true)]
        [string]$region,
        [Parameter(Mandatory = $true)]
        [string]$creds,
        [Parameter(Mandatory = $true)]
        [string]$method,
        [Parameter(Mandatory = $true)]
        [hashtable]$result     
    )
    
    try {

        $Params = @{
            "URI"         = "$uri"
            "Method"      = "$method"
            "Headers"     = @{"Authorization" = "Basic $creds" }
            "ContentType" = "application/json"
        }
        
        if ($isprivatesubnet -eq $False) {
            Invoke-RestMethod @Params -Certificate $restcert
        }
        else {
            Invoke-RestMethod @Params
        }
        
    }
    catch {
        $result.Add('Status', 'Failed')
        $result.Add('Message', 'Failed to run the REST API command')
        $result.Add('Exception', $_)
        $resultjson = ($result | ConvertTo-Json) 
        $resultjson 
        exit 1
    }
}


$LOGLUN = 'sqllog'
$DATALUN = 'sqldata'
if ($FSxDataVolumeName -And $FsxLogVolumeName) {
    $vollist = @($FSxDataVolumeName, $FSxLogVolumeName)
    $pathlist = @("/vol/$FSxDataVolumeName/$DATALUN", "/vol/$FSxLogVolumeName/$LOGLUN")
}
elseif ($FSxDataVolumeName) {
    $vollist = @($FSxDataVolumeName)
    $pathlist = @("/vol/$FSxDataVolumeName/$DATALUN")
}
elseif ($FSxLogVolumeName) {
    $vollist = @($FSxLogVolumeName)
    $pathlist = @("/vol/$FSxLogVolumeName/$LOGLUN")
}
else {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'No volumes passed for deletion')
    $result.Add('Exception', $_)
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
try {
    $lunUriDynamicPart = 'private/cli/lun'
    $URI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($SQLVMName)"
    $lunlist = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET" -result $result).records
    #check if lun exists before deleting
    foreach ($perlun in $lunlist) {
        if ($pathlist -contains $perlun.path) {
            $DeleteURI = "https://$($MgmtDNS)/api/$($lunUriDynamicPart)?vserver=$($perlun.vserver)&path=$($perlun.path)"
            $deletelun = (callGetOrDeleteApi -uri $DeleteURI -region $region -creds $base64 -method "DELETE" -result $result)
        }
    }
}
catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to delete LUNs')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
}


# delete volumes created
try {
    $volUriDynamicPart = 'storage/volumes'
    foreach ($volume in $vollist) {
        $URI = "https://$($MgmtDNS)/api/$($volUriDynamicPart)?name=$($volume)"
        $voluri = (callGetOrDeleteApi -uri $URI -region $region -creds $base64 -method "GET" -result $result).records.uuid
        if ($voluri) {
            $DELVOLURI = "https://$($MgmtDNS)/api/$($volUriDynamicPart)/$($voluri)"
            $deletevol = (callGetOrDeleteApi -uri $DELVOLURI -region $region -creds $base64 -method "DELETE" -result $result)
        }
    }
}
catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to delete volumes')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson 
    exit 1
}


if ($FilePaths.count -ne 0) {
    $virtualDrives = $filePaths | ForEach-Object {
        $splits = $_.Split('\\')
        $splits[0] + '\\' + $splits[1]
    }

    $virtualDrives | ForEach-Object {
        $null = (Remove-Item -Path $_ -Force -Recurse -ErrorAction SilentlyContinue)
    }
}

$result.Add('Status', 'Complete')
$result.Add('Message', 'Cleaning up resources complete')
$resultjson = ($result | ConvertTo-Json) 
$resultjson 
  
`;

export { cleanupResources };
