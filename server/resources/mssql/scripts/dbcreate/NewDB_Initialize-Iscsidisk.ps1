[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DBName,

    [Parameter(Mandatory = $true)]
    [string]$IsClustered,

    [Parameter(Mandatory = $false)]
    [string]$DataDrive,

    [Parameter(Mandatory = $false)]
    [string]$LogDrive,

    [Parameter(Mandatory = $true)]
    [string]$LogNew,

    [Parameter(Mandatory = $true)]
    [string]$DataNew,  
    
    [Parameter(Mandatory = $false)]
    [string]$Virtualmount,
    
    [Parameter(Mandatory = $true)]
    [string]$DataSerial,

    [Parameter(Mandatory = $true)]
    [string]$LogSerial             
)
$null = (Start-Transcript -Path C:\cfn\log\NewDB_initializeiscsi.log.txt -Append)
$ErrorActionPreference = "Stop"


$result = [ordered]@{}

#Refresh the cached information on iSCSI target
#Update-IscsiTarget
#This command hangs in few cases for any issue with iSCSI. Even passing -AsJob won't help as multiple jobs would be stuck. Using disk RESCAN

$null = (echo "RESCAN" | diskpart )
Start-Sleep 2

#Create a list of drive letters if not passed
if (-Not $DataDrive) { 
    if ($IsClustered -ne "false") {
        $clusterdrives = (Get-WmiObject -Namespace root\MSCluster MSCluster_DiskPartition).Path
        $DataDrive = (ls function:[d-z]: -n | ? { !(test-path $_) -And !($clusterdrives -contains $_) } | random)
    }
    else {
        $DataDrive = (ls function:[d-z]: -n | ? { !(test-path $_) } | random) 
    }
}

if (-Not $LogDrive) {
    if ($IsClustered -ne "false") {
        $clusterdrives = (Get-WmiObject -Namespace root\MSCluster MSCluster_DiskPartition).Path
        $LogDrive = (ls function:[d-z]: -n | ? { !(test-path $_) -And !($clusterdrives -contains $_) } | random)
    }
    else {
        $LogDrive = (ls function:[d-z]: -n | ? { !(test-path $_) } | random)
    }
}


if ($DBName.Length -gt 25) {
    $TruncatedName = $DBName.Substring(0, 25)
    $datalabel = $TruncatedName + "-Data"
    $loglabel = $TruncatedName + "-Log"
    $datavlabel = $TruncatedName + "_Data"
    $logvlabel = $TruncatedName + "_Log"
}
else {
    $datalabel = $DBName + "-Data"
    $loglabel = $DBName + "-Log"
    $datavlabel = $DBName + "_Data"
    $logvlabel = $DBName + "_Log"
}
$LogDriveLetter = $LogDrive.Substring(0, 1)
$DataDriveLetter = $DataDrive.Substring(0, 1)
#Folders in case of virtual drives on running out of drive letters
if ($Virtualmount -ne "false") {
    $datafolder = $DataDrive + ':\' + $datavlabel
    $logfolder = $LogDrive + ':\' + $logvlabel
}


try {
    if (($LogNew -eq "false") -And ($DataNew -eq "false")) { throw }
    elseif (($LogNew -ne "false") -And ($DataNew -ne "false")) { $count = 2 }
    else { $count = 1 }


}
catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Need to define at least one new drive to configure storage')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1 
}
try {
    #Retrieve a list of FSx for ONTAP disks. 
    if ($DataNew -ne "false") {
        $getdatadisk = (Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.OperationalStatus -eq 'Offline' -and $_.SerialNumber -eq $DataSerial })
        #Retry for 1 min until disks are available on host
        if ([string]::IsNullOrEmpty($getdatadisk)) {
            do {
                $getdatadisk = (Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.OperationalStatus -eq 'Offline' -and $_.SerialNumber -eq $DataSerial })
                $retrydata++
                Start-Sleep 20
            } until (($retrydata -eq 4) -Or !([string]::IsNullOrEmpty($getdatadisk) ))
            try {
                if (($retrydata -ge 4) -And ([string]::IsNullOrEmpty($getdatadisk))) { throw }
            }
            catch {
                $result.Add('Status', 'Failed')
                $result.Add('Message', 'Disks created are not discoverable on host')
                $result.Add('Exception', $_)
                $resultjson = ($result | ConvertTo-Json) 
                $resultjson  
                exit 1        
            }

        }
    }

    if ($LogNew -ne "false") {
        $getlogdisk = (Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.OperationalStatus -eq 'Offline' -and $_.SerialNumber -eq $LogSerial })
        #Retry for 1 min until disks are available on host
        if ([string]::IsNullOrEmpty($getlogdisk)) {
            do {
                $getlogdisk = (Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.OperationalStatus -eq 'Offline' -and $_.SerialNumber -eq $LogSerial })
                $retrylog++
                Start-Sleep 20
            } until (($retrylog -eq 4) -Or !([string]::IsNullOrEmpty($getlogdisk) ))
            try {
                if (($retrylog -ge 4) -And ([string]::IsNullOrEmpty($getlogdisk))) { throw }
            }
            catch {
                $result.Add('Status', 'Failed')
                $result.Add('Message', 'Disks created are not discoverable on host')
                $result.Add('Exception', $_)
                $resultjson = ($result | ConvertTo-Json) 
                $resultjson  
                exit 1        
            }

        }
    }

    #Adding Silently Continue for Set-Disk as warning caused output to have the string an API considered failure despite success
    #If warning is indeed serious the next step to initialize will fail and that will be caught

    if ($DataNew -ne "false") {
        if (($getdatadisk).IsOffline -eq $True) {
            Set-Disk -Number ($getdatadisk).Number -IsOffline $False -ErrorAction SilentlyContinue
            Start-Sleep 2

        }
        if (($getdatadisk).PartitionStyle -eq 'RAW') {
            Initialize-Disk -Number ($getdatadisk).Number -PartitionStyle GPT -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
        if ($getdatadisk.IsReadOnly -eq $True) {
            Set-Disk -Number ($getdatadisk).Number -IsReadOnly $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
    }

    if ($LogNew -ne "false") {
        if (($getlogdisk).IsOffline -eq $True) {
            Set-Disk -Number ($getlogdisk).Number -IsOffline $False -ErrorAction SilentlyContinue
            Start-Sleep 2

        }
        if (($getlogdisk).PartitionStyle -eq 'RAW') {
            Initialize-Disk -Number ($getlogdisk).Number -PartitionStyle GPT -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
        if ($getlogdisk.IsReadOnly -eq $True) {
            Set-Disk -Number ($getlogdisk).Number -IsReadOnly $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
    }

    #Initiate, create and format volumes from the list of available FSx for ONTAP disks
    #Stopping Service to prevent format dialogs
    Stop-Service -Name ShellHWDetection
}
catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to set drive status')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1     
} 


try {

    if (($LogNew -ne "false") -And ($DataNew -ne "false")) {
        if ($Virtualmount -eq "true") { 
            #Mount new ISCSI disks to a folder in selected drive 
            $null = (New-Item -ItemType Directory -Path $datafolder -Force)
            $null = (New-Item -ItemType Directory -Path $logfolder -Force)
            $null = (New-Partition -DiskNumber ($getlogdisk).Number -UseMaximumSize  | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force)
            $null = (New-Partition -DiskNumber ($getdatadisk).Number -UseMaximumSize | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force) 

        }
        else {
            $null = (New-Partition -DiskNumber ($getlogdisk).Number -UseMaximumSize -DriveLetter $LogDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $loglabel)
            $null = (New-Partition -DiskNumber ($getdatadisk).Number -UseMaximumSize -DriveLetter $DataDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $datalabel)
        } 
    }
    elseif ($LogNew -ne "false") {
        if ($Virtualmount -eq "true") { 
            $null = (New-Item -ItemType Directory -Path $logfolder -Force)
            $null = (New-Partition -DiskNumber ($getlogdisk).Number -UseMaximumSize  | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force)
        }
        else {
            $null = (New-Partition -DiskNumber ($getlogdisk).Number -UseMaximumSize -DriveLetter $LogDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $loglabel)
        }
    }
    else {
        if ($Virtualmount -eq "true") { 
            $null = (New-Item -ItemType Directory -Path $datafolder -Force)
            $null = (New-Partition -DiskNumber ($getdatadisk).Number -UseMaximumSize | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force)
        }
        else {
            $null = (New-Partition -DiskNumber ($getdatadisk).Number -UseMaximumSize -DriveLetter $DataDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $datalabel)    
        }
    }
    Start-Service -Name ShellHWDetection
}
catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to initialize drives')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1     
} 

try {
    if ($IsClustered -ne "false") {
        # Add new disks to Cluster Storage
        if ( ($LogNew -ne "false") -And ($DataNew -ne "false")) {
            $logdisk = (Get-Disk -Number $getlogdisk.Number | Add-ClusterDisk)
            $datadisk = (Get-Disk -Number $getdatadisk.Number | Add-ClusterDisk)
        }
        elseif ($LogNew -ne "false") {
            $logdisk = (Get-Disk -Number $getlogdisk.Number | Add-ClusterDisk)
        }
        else {
            $datadisk = (Get-Disk -Number $getdatadisk.Number | Add-ClusterDisk)
        }

    }
}
catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to add disks to cluster storage')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1        
} 
try {
    if ($IsClustered -ne "false") {
        #Fetch the SQL Server role from the WSFC. In discovered instances the instance name could be anything other than MSSQLSERVER, this handles that.
        $SQLRoleGroup = (Get-ClusterGroup).Name -match ('SQl Server*')
        $SQLGroup = $SQLRoleGroup[0]

        if ( ($LogNew -ne "false") -And ($DataNew -ne "false")) {
            #Add  new cluster disks added to SQL Server Group    
            $datavol = $datadisk.Name
            $logvol = $logdisk.Name
            $null = (Move-ClusterResource -Name $logvol -Group $SQLGroup)
            $null = (Move-ClusterResource -Name $datavol -Group $SQLGroup) 

            #Add dependency on new disks in SQL Server Resource
            $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $datavol)
            $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $logvol)

            #Rename new cluster disks to user friendly name
    (Get-ClusterResource -Name $datavol).name = $datalabel
    (Get-ClusterResource -Name $logvol).name = $loglabel
        }
        elseif ($LogNew -ne "false") { 
            #Add  new cluster disks added to SQL Server Group    
            $logvol = $logdisk.Name
            $null = (Move-ClusterResource -Name $logvol -Group $SQLGroup)

            #Add dependency on new disks in SQL Server Resource
            $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $logvol)

            #Rename new cluster disks to user friendly name
    (Get-ClusterResource -Name $logvol).name = $loglabel
        }
        else {
            #Add  new cluster disks added to SQL Server Group    
            $datavol = $datadisk.Name
            $null = (Move-ClusterResource -Name $datavol -Group $SQLGroup) 

            #Add dependency on new disks in SQL Server Resource
            $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $datavol)

            #Rename new cluster disks to user friendly name
    (Get-ClusterResource -Name $datavol).name = $datalabel
        }

    }
}
catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to add disks to SQL Server Role dependency in cluster')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json) 
    $resultjson  
    exit 1        
} 

try {
Start-Sleep 5
if ($LogNew -eq "true" -And $Virtualmount -eq "true") {
$null = (Get-Partition -DiskNumber ($getlogdisk).Number |  Where-Object Type -eq Basic | Add-PartitionAccessPath -AccessPath $logfolder -ErrorAction Stop)
$null = (Get-Partition -DiskNumber ($getlogdisk).Number |  Where-Object Type -eq Basic | Set-Partition -NoDefaultDriveLetter $true)
}
if ($DataNew -eq "true" -And $Virtualmount -eq "true") {
$null = (Get-Partition -DiskNumber ($getdatadisk).Number |  Where-Object Type -eq Basic  | Add-PartitionAccessPath -AccessPath $datafolder -ErrorAction Stop)
$null = (Get-Partition -DiskNumber ($getdatadisk).Number |  Where-Object Type -eq Basic | Set-Partition -NoDefaultDriveLetter $true)
}
} catch {
    $result.Add('Status', 'Failed')
    $result.Add('Message', 'Failed to add access paths to disks')
    $result.Add('Exception', $_)
    $resultjson = ($result | ConvertTo-Json)
    $resultjson
    exit 1
}

$result.Add('Status', 'Complete')
$result.Add('Message', 'Completed preparing iSCSI drives for new SQL database')
$resultjson = ($result | ConvertTo-Json) 
$resultjson
