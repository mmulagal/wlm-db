import { getVolumeIdFromPath } from './sandbox-scripts';

const cleanupResources = (
    dbName: string,
    isClustered: string,
    instanceName: string,
    isDefaultInstance: string,
    filePathString: string
) => `
#Clean up resources script
$DBName = '${dbName}'
$IsClustered = '${isClustered}'
$InstanceName = '${instanceName}'
$IsDefaultInstance = '${isDefaultInstance}'
$FilePathString = '${filePathString}'

$WarningPreference = 'SilentlyContinue';
$ProgressPreference = "SilentlyContinue";
$silenttranscript = (Start-Transcript -Path C:\\cfn\\log\\cleanup_ontap.log.txt -Append)

$ErrorActionPreference = "Stop"

$FilePaths = $FilePathString.Split(',')

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
            $clusterdisk = ($resource.name).replace('\\r\\n','')
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
