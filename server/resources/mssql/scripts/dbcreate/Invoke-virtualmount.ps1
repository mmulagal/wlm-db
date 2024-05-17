[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DBName,

    [Parameter(Mandatory = $true)]
    [string]$DataFilePath,

    [Parameter(Mandatory = $true)]
    [string]$LogFilePath,

    [Parameter(Mandatory = $true)]
    [string]$DataSerial,

    [Parameter(Mandatory = $true)]
    [string]$LogSerial
)

$null = (Start-Transcript -Path "C:\cfn\log\invoke_virtualmount_$DBName.log.txt" -Append)
$ErrorActionPreference = "Stop"

try {
    $responseObject = [ordered]@{}

    if ($DataFilePath -eq $null -or $LogFilePath -eq $null -or $DataSerial -eq $null -or $LogSerial -eq $null) {
        write-debug "DataFilePath: $DataFilePath LogFilePath: $LogFilePath DataSerial: $DataSerial LogSerial: $LogSerial"
        throw "DataFilePath or LogFilePath or DataSerial or LogSerial is null"
    }

    $null = (echo "RESCAN" | diskpart )
    Start-Sleep 2

    if ($DBName.Length -gt 25) {
        $DBName = $DBName.Substring(0, 25)
    }
    $datalabel = $DBName + '-Data'
    $loglabel = $DBName + '-Log'

    $DataDriveLetter = $DataFilePath.Substring(0, 1)
    $LogDriveLetter = $LogFilePath.Substring(0, 1)
    $datafolder = $DataDriveLetter + ':\' + $datalabel
    $logfolder = $LogDriveLetter + ':\' + $loglabel

    $retry = 0
    do {
        $disklist = (Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.SerialNumber -eq $DataSerial -or $_.SerialNumber -eq $LogSerial })
        $diskcount = $disklist.Number.Count
        if ($retry -gt 0) {
            Start-Sleep 20
        }
        $retry++
    } until (($retry -eq 4) -Or ($diskcount -ge $2))

    write-debug "Disklist: $disklist"

    #Adding Silently Continue for Set-Disk as warning caused output to have the string an API considered failure despite success
    #If warning is indeed serious the next step to initialize will fail and that will be caught
    $disklist | ForEach-Object {
        $disk = $_
        Clear-ClusterDiskReservation -disk $disk.Number -Force
        if ($disk.IsReadOnly -ne $False) {
            Set-Disk -Number $disk.Number -IsReadOnly $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
 
        if ($disk.IsOffline -ne $False) {
            Set-Disk -Number $disk.Number -IsOffline $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
 
        if ($disk.PartitionStyle -eq 'RAW') {
            Set-Disk -Number $disk.Number -PartitionStyle GPT -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
    }
}
catch {
    write-debug "Error: $($_.Exception)"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to modify disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
} 

try {
    if ((Get-Service -Name ShellHWDetection).Status -eq 'Running') {
        Stop-Service -Name ShellHWDetection
    }

    $null = (New-Item -ItemType Directory -Path $datafolder -Force)
    $null = (New-Item -ItemType Directory -Path $logfolder -Force)

    $datadisknumber = ($disklist | Where-Object { $_.SerialNumber -eq $DataSerial }).Number
    $logdisknumber = ($disklist | Where-Object { $_.SerialNumber -eq $LogSerial }).Number

    $dataPartition = Get-Partition -DiskNumber $datadisknumber | Where-Object Type -eq Basic
    $logPartition = Get-Partition -DiskNumber $logdisknumber | Where-Object Type -eq Basic

    #$null = $dataPartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop
    #$null = $logPartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop

    write-debug "DataFolder: $datafolder $logfolder"


    Get-Partition -DiskNumber $datadisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $datalabel
    Get-Partition -DiskNumber $logdisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $loglabel

}
catch {
    write-debug "Error: $($_.Exception)"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to initialize disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
    exit 1
}
finally {
    if ((Get-Service -Name ShellHWDetection).Status -ne 'Running') {
        Start-Service -Name ShellHWDetection
    }
}

try {
    $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

    if ($clusterServiceStatus -eq 'Running') {
        # Add new disks to Cluster Storage

        $clusterdatadisk = Get-ClusterResource -Name $datalabel -ErrorAction SilentlyContinue
        $clusterlogdisk = Get-ClusterResource -Name $loglabel -ErrorAction SilentlyContinue

        if ($clusterdatadisk -eq $null -or $clusterlogdisk -eq $null) {
            $availabledatadisk = Get-ClusterAvailableDisk | Where-Object { $_.Number -eq $datadisknumber }
            $availablelogdisk = Get-ClusterAvailableDisk | Where-Object { $_.Number -eq $logdisknumber }

            $clusterdatadisk = ($availabledatadisk | Add-ClusterDisk -ErrorAction stop)
            $clusterlogdisk = ($availablelogdisk | Add-ClusterDisk -ErrorAction stop)
        }

        try {
            $SQLRoleGroup = (Get-ClusterGroup).Name -match ('SQl Server*')
            $SQLGroup = $SQLRoleGroup[0]

            if (($clusterdatadisk.OwnerGroup -ne $SQLGroup) -or ($clusterlogdisk.OwnerGroup -ne $SQLGroup)) {
                $null = (Move-ClusterResource -Name $($clusterdatadisk.Name) -Group $SQLGroup)
                $null = (Move-ClusterResource -Name $($clusterlogdisk.Name) -Group $SQLGroup)

                #Add dependency on new disks in SQL Server Resource
                $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $($clusterdatadisk.Name))
                $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $($clusterlogdisk.Name))

                #Rename new cluster disks to user friendly name
                (Get-ClusterResource -Name $($clusterdatadisk.Name)).name = $datalabel
                (Get-ClusterResource -Name $($clusterlogdisk.Name)).name = $loglabel
            }
        }
        catch {
            $responseObject['error'] = $_.Exception.Message
            $responseObject['message'] = "Failed to add disks to SQL Server Role dependency in cluster"
            return ($responseObject | ConvertTo-Json -Depth 5)
            exit 1
        }
    }
}
catch {
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to add disks to cluster storage'
    return ($responseObject | ConvertTo-Json -Depth 5)
    exit 1
}

try {
    Start-Sleep 5
    if ($dataPartition.AccessPaths -notcontains $datafolder + '\') {
        $null = Add-PartitionAccessPath -DiskNumber $datadisknumber -PartitionNumber ($dataPartition).PartitionNumber -AccessPath $datafolder -ErrorAction stop
        $null = (Get-Partition -DiskNumber $datadisknumber |  Where-Object Type -eq Basic | Set-Partition -NoDefaultDriveLetter $true)
    }

    if ($logPartition.AccessPaths -notcontains $logfolder + '\') {
        $null = Add-PartitionAccessPath -DiskNumber $logdisknumber -PartitionNumber ($logPartition).PartitionNumber -AccessPath $logfolder -ErrorAction stop
        $null = (Get-Partition -DiskNumber $logdisknumber |  Where-Object Type -eq Basic | Set-Partition -NoDefaultDriveLetter $true)
    }
}catch {
        $responseObject['error'] = $_.Exception.Message
        $responseObject['message'] = 'Failed to add access path to disks'
        return ($responseObject | ConvertTo-Json -Depth 5)
        exit 1

    }

try {
    Get-Partition | Where-Object Type -eq Basic | Where-Object { $_.DiskNumber -eq $datadisknumber -or $_.DiskNumber -eq $logdisknumber } | ForEach-Object {
        $partition = $_
        $partition.AccessPaths | ForEach-Object {
            $accessPath = $_
            write-debug "AccessPath: $accessPath"
            if ($accessPath) {
                $matched = $accessPath -match '^[A-Z]:\\$'
                write-debug "Matched: $matched"
                if ($matched -eq $True -and $accessPath -notcontains $DataDriveLetter -and $accessPath -notcontains $logDriveLetter) {
                    $accessDrive = $matches[0]
                    $null = ($partition | Remove-PartitionAccessPath -AccessPath $accessDrive)
                }
            }
        }
    }

    Get-ChildItem -Path $datafolder -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
    Get-ChildItem -Path $logfolder -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
} catch {
    write-debug "Failed to remove stale junction paths"
}

try {
    $DataFileLeaf = Split-Path -Path $DataFilePath -Leaf
    $LogFileLeaf = Split-Path -Path $LogFilePath -Leaf
    $newDataFilePath = (Get-ChildItem -Path $datafolder -Recurse -Filter $DataFileLeaf).FullName
    $newLogFilePath = (Get-ChildItem -Path $logfolder -Recurse -Filter $LogFileLeaf).FullName
    if ((Test-Path $newDataFilePath) -and (Test-Path $newLogFilePath)) {
        $responseObject['dataPath'] = $newDataFilePath
        $responseObject['logPath'] = $newLogFilePath
        write-debug "NewFilePaths: $newDataFilePath $newLogFilePath"
    }
    else {
        throw 
    }
} catch {
    $responseObject['error'] = "Failed to validate newpaths $newDataFilePath $newLogFilePath"
}


$responseObject | ConvertTo-Json -Depth 5 
