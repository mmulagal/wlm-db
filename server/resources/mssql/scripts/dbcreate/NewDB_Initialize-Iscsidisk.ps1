  [CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DBName,

    [Parameter(Mandatory=$true)]
    [string]$IsClustered,

    [Parameter(Mandatory=$false)]
    [string]$DataDrive,

    [Parameter(Mandatory=$false)]
    [string]$LogDrive,

    [Parameter(Mandatory=$true)]
    [string]$LogNew,

    [Parameter(Mandatory=$true)]
    [string]$DataNew   
)
$silenttranscript = (Start-Transcript -Path C:\cfn\log\NewDB_initializeiscsi.log.txt -Append)
$ErrorActionPreference = "Stop"


$result = [ordered]@{}

#Refresh the cached information on iSCSI target
Update-IscsiTarget
Start-Sleep 2

#Create a list of drive letters if not passed
if (-Not $DataDrive) { 
    if ($IsClustered -ne "false") {
        $clusterdrives = (Get-WmiObject -Namespace root\MSCluster MSCluster_DiskPartition).Path
        $DataDrive = (ls function:[d-z]: -n | ?{ !(test-path $_) -And !($clusterdrives -contains $_)} | random)
    } else {
        $DataDrive = (ls function:[d-z]: -n | ?{ !(test-path $_) } | random) 
    }
}

if (-Not $LogDrive) {
    if ($IsClustered -ne "false") {
       $clusterdrives = (Get-WmiObject -Namespace root\MSCluster MSCluster_DiskPartition).Path
       $LogDrive = (ls function:[d-z]: -n | ?{ !(test-path $_) -And !($clusterdrives -contains $_)} | random)
    } else {
        $LogDrive = (ls function:[d-z]: -n | ?{ !(test-path $_) } | random)
    }
}

try {
if(($LogNew -eq "false") -And ($DataNew -eq "false")) { throw }
elseif (($LogNew -ne "false") -And ($DataNew -ne "false")) { $count = 2}
else {$count = 1}


} catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Need to define at least one new drive to configure storage')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1 
}
try{
#Retrieve a list of FSx for ONTAP disks. 
$disklist=(Get-Disk | Where-Object{$_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.OperationalStatus -eq 'Offline'} | Sort-Object -Property Size)
$diskcount = $disklist.Number.Count
#Retry for 1 min until disks are available on host
if ($diskcount -lt $count) {
    do {
    $disklist=(Get-Disk | Where-Object{$_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.OperationalStatus -eq 'Offline'} | Sort-Object -Property Size)
    $diskcount = $disklist.Number.Count
    $retry++
    Start-Sleep 20
    } until (($retry -eq 4) -Or($diskcount -ge $count))
    try {
    if (($retry -ge 4) -And ($diskcount -lt $count)) {throw}
    } catch {
    $result.Add('Status','Failed')
    $result.Add('Message','Disks created are not discoverable on host')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1        
    }

}
#Adding Silently Continue for Set-Disk as warning caused output to have the string an API considered failure despite success
#If warning is indeed serious the next step to initialize will fail and that will be caught
foreach($dk in $disklist)
{
    if(($dk).IsOffline -eq $True){
       Set-Disk -Number ($dk).Number -IsOffline $False -ErrorAction SilentlyContinue
       Start-Sleep 2

    }
    if(($dk).PartitionStyle -eq 'RAW'){
        Initialize-Disk -Number ($dk).Number -PartitionStyle GPT -ErrorAction SilentlyContinue
        Start-Sleep 2
    }
    if($dk.IsReadOnly -eq $True){
        Set-Disk -Number ($dk).Number -IsReadOnly $False -ErrorAction SilentlyContinue
        Start-Sleep 2
    }
}

#Initiate, create and format volumes from the list of available FSx for ONTAP disks
#Stopping Service to prevent format dialogs
Stop-Service -Name ShellHWDetection
} catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to set drive status')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1     
} 


try {
    if ($DBName.Length -gt 25) {
        $TruncatedName = $DBName.Substring(0,25)
        $datalabel = $TruncatedName+"-Data"
        $loglabel = $TruncatedName+"-Log"
    } else {
      $datalabel = $DBName+"-Data"
      $loglabel = $DBName+"-Log"
    }
$LogDriveLetter = $LogDrive.Substring(0,1)
$DataDriveLetter = $DataDrive.Substring(0,1)


if(($LogNew -ne "false") -And ($DataNew -ne "false")) {
$logpartition = (New-Partition -DiskNumber ($disklist[0]).Number -UseMaximumSize -DriveLetter $LogDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $loglabel)
$datapartition = (New-Partition -DiskNumber ($disklist[1]).Number -UseMaximumSize -DriveLetter $DataDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $datalabel)
}
elseif($LogNew -ne "false") {
    $logpartition = (New-Partition -DiskNumber ($disklist[0]).Number -UseMaximumSize -DriveLetter $LogDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $loglabel)
    } else {
    $datapartition = (New-Partition -DiskNumber ($disklist[0]).Number -UseMaximumSize -DriveLetter $DataDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $datalabel)    
    }
Start-Service -Name ShellHWDetection
}catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to initialize drives')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1     
} 

try{
if ($IsClustered -ne "false") {
# Add new disks to Cluster Storage
    if( ($LogNew -ne "false")-And ($DataNew -ne "false")) {
    $logdisk = (Get-Disk -Number $disklist[0].Number | Add-ClusterDisk)
    $datadisk = (Get-Disk -Number $disklist[1].Number | Add-ClusterDisk)
    }
    elseif($LogNew -ne "false") {
        $logdisk = (Get-Disk -Number $disklist[0].Number | Add-ClusterDisk)
    } else {
        $datadisk = (Get-Disk -Number $disklist[0].Number | Add-ClusterDisk)
    }

}
}catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to add disks to cluster storage')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1        
} 
try{
if ($IsClustered -ne "false") {
#Fetch the SQL Server role from the WSFC. In discovered instances the instance name could be anything other than MSSQLSERVER, this handles that.
$SQLRoleGroup =  (Get-ClusterGroup).Name -match ('SQl Server*')
$SQLGroup = $SQLRoleGroup[0]

if( ($LogNew -ne "false")-And ($DataNew -ne "false")) {
    #Add  new cluster disks added to SQL Server Group    
    $datavol = $datadisk.Name
    $logvol = $logdisk.Name
    $movelog = (Move-ClusterResource -Name $logvol -Group $SQLGroup)
    $movedata = (Move-ClusterResource -Name $datavol -Group $SQLGroup) 

    #Add dependency on new disks in SQL Server Resource
    $adddataSQL = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $datavol)
    $addlogSQL = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $logvol)

    #Rename new cluster disks to user friendly name
    (Get-ClusterResource -Name $datavol).name = $datalabel
    (Get-ClusterResource -Name $logvol).name = $loglabel
} elseif($LogNew -ne "false") { 
    #Add  new cluster disks added to SQL Server Group    
    $logvol = $logdisk.Name
    $movelog = (Move-ClusterResource -Name $logvol -Group $SQLGroup)

    #Add dependency on new disks in SQL Server Resource
    $addlog = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $logvol)

    #Rename new cluster disks to user friendly name
    (Get-ClusterResource -Name $logvol).name = $loglabel
}
else{
    #Add  new cluster disks added to SQL Server Group    
    $datavol = $datadisk.Name
    $movedata = (Move-ClusterResource -Name $datavol -Group $SQLGroup) 

    #Add dependency on new disks in SQL Server Resource
    $adddata= (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $datavol)

    #Rename new cluster disks to user friendly name
    (Get-ClusterResource -Name $datavol).name = $datalabel
}

}
}catch{
    $result.Add('Status','Failed')
    $result.Add('Message','Failed to add disks to SQL Server Role dependency in cluster')
    $result.Add('Exception',$_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1        
} 

$result.Add('Status','Complete')
$result.Add('Message','Completed preparing iSCSI drives for new SQL database')
$resultjson = ($result | ConvertTo-Json) 
$resultjson 