[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DBName,

    [Parameter(Mandatory=$true)]
    [string]$DataFilePath,

    [Parameter(Mandatory=$true)]
    [string]$LogFilePath,

    [Parameter(Mandatory=$true)]
    [string]$DataSerial,

    [Parameter(Mandatory=$true)]
    [string]$LogSerial
)

$null = (Start-Transcript -Path "C:\cfn\log\invoke_virtualmount_$DBName.log.txt" -Append)
$ErrorActionPreference = "Stop"

try {
    $responseObject = [ordered]@{}

    if ($DataFilePath -eq $null -or $LogFilePath -eq $null -or $DataSerial -eq $null -or $LogSerial -eq $null){
        write-debug "DataFilePath: $DataFilePath LogFilePath: $LogFilePath DataSerial: $DataSerial LogSerial: $LogSerial"
        throw "DataFilePath or LogFilePath or DataSerial or LogSerial is null"
    }

    $null =(echo "RESCAN" | diskpart )
    Start-Sleep 2

    if ($DBName.Length -gt 25) {
        $DBName = $DBName.Substring(0,25)
    }
    $datalabel = $DBName + '-Data'
    $loglabel = $DBName + '-Log'

    $DataDriveLetter = $DataFilePath.Substring(0,1)
    $LogDriveLetter = $LogFilePath.Substring(0,1)
    $datafolder = $DataDriveLetter +':\' + $datalabel
    $logfolder = $LogDriveLetter + ':\' + $loglabel

    $retry = 0
    do {
        $disklist=(Get-Disk | Where-Object{$_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.SerialNumber -eq $DataSerial -or $_.SerialNumber -eq $LogSerial})
        $diskcount = $disklist.Number.Count
        if ($retry -gt 0) {
            Start-Sleep 20
        }
        $retry++
    } until (($retry -eq 4) -Or($diskcount -ge $2))

    write-debug "Disklist: $disklist"

    #Adding Silently Continue for Set-Disk as warning caused output to have the string an API considered failure despite success
    #If warning is indeed serious the next step to initialize will fail and that will be caught
    $disklist | ForEach-Object {
        $disk = $_
        if ($disk.IsReadOnly -ne $False) {
            Set-Disk -Number $disk.Number -IsReadOnly $False
            Start-Sleep 2
        }

        if ($disk.IsOffline -ne $False) {
            Set-Disk -Number $disk.Number -IsOffline $False
            Start-Sleep 2
        }

        if ($disk.PartitionStyle -eq 'RAW') {
            Set-Disk -Number $disk.Number -PartitionStyle GPT
            Start-Sleep 2
        }
    }
} catch{
    write-debug "Error: $_.Exception"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to modify disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
} 

try {
    Stop-Service -Name ShellHWDetection
    $null = (New-Item -ItemType Directory -Path $datafolder -Force)
    $null = (New-Item -ItemType Directory -Path $logfolder -Force)

    $datadisknumber = ($disklist | Where-Object { $_.SerialNumber -eq $DataSerial }).Number
    $logdisknumber = ($disklist | Where-Object { $_.SerialNumber -eq $LogSerial }).Number

    $dataPartition = Get-Partition -DiskNumber $datadisknumber | Where-Object Type -eq Basic
    $logPartition = Get-Partition -DiskNumber $logdisknumber | Where-Object Type -eq Basic

    write-debug "DataAccessPaths: $($dataPartition.AccessPaths)"
    write-debug "LogAccessPaths: $($logPartition.AccessPaths)"
    write-debug "DataFolder: $datafolder $logfolder"

    if ($dataPartition.AccessPaths -notcontains $datafolder + '\') {
        $null = Add-PartitionAccessPath -DiskNumber $datadisknumber -PartitionNumber ($dataPartition).PartitionNumber -AccessPath $datafolder
        $null = Set-Partition -DiskNumber $datadisknumber -PartitionNumber ($dataPartition).PartitionNumber -NoDefaultDriveLetter $true 
    }

    if ($logPartition.AccessPaths -notcontains $logfolder + '\') {
        $null = Add-PartitionAccessPath -DiskNumber $logdisknumber -PartitionNumber ($logPartition).PartitionNumber -AccessPath $logfolder
        $null = Set-Partition -DiskNumber $logdisknumber -PartitionNumber ($logPartition).PartitionNumber -NoDefaultDriveLetter $true 
    }

    Get-Partition | Where-Object Type -eq Basic | Where-Object { $_.DiskNumber -eq $datadisknumber -or $_.DiskNumber -eq $logdisknumber } | ForEach-Object {
        $partition = $_
        $partition.AccessPaths | ForEach-Object {
            $accessPath = $_
            write-debug "AccessPath: $accessPath"
            if ($accessPath) {
                $matched = $accessPath -match '^[A-Z]:\\$'
                write-debug "Matched: $matched"
                if ($matched -eq $True) {
                    $accessDrive = $matches[0]
                    $null = ($partition | Remove-PartitionAccessPath -AccessPath $accessDrive)
                }
            }
        }
    }

    Get-Partition -DiskNumber $datadisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $datalabel
    Get-Partition -DiskNumber $logdisknumber | Get-Volume | Set-Volume -NewFileSystemLabel $loglabel

    $newDataFilePath = $datafolder + (Split-Path -Path $DataFilePath -NoQualifier)
    $newLogFilePath = $logfolder + (Split-Path -Path $LogFilePath -NoQualifier)

    if ((Test-Path $newDataFilePath) -and (Test-Path $newLogFilePath)) {
        $responseObject['dataPath'] = $newDataFilePath
        $responseObject['logPath'] = $newLogFilePath
    } else {
        $responseObject['error'] = 'Failed to validate newpaths $newDataFilePath $newLogFilePath'
    }

    write-debug "NewFilePaths: $newDataFilePath $newLogFilePath"
} catch {
    write-debug "Error: $_.Exception"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to initialize disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
} finally {
    Start-Service -Name ShellHWDetection
}

try {
    $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

    if ($clusterServiceStatus -eq 'Running') {
        # Add new disks to Cluster Storage
        $disklist | ForEach-Object {
            $null = (Get-Disk -Number $_.Number | Add-ClusterDisk)
        }

        try {
            $SQLRoleGroup =  (Get-ClusterGroup).Name -match ('SQl Server*')
            $SQLGroup = $SQLRoleGroup[0]

            $datavol = ($disklist | Where-Object { $_.SerialNumber -eq $DataSerial }).Name
            $logvol = ($disklist | Where-Object { $_.SerialNumber -eq $LogSerial }).Name

            $null = (Move-ClusterResource -Name $logvol -Group $SQLGroup)
            $null = (Move-ClusterResource -Name $datavol -Group $SQLGroup) 

            #Add dependency on new disks in SQL Server Resource
            $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $datavol)
            $null = (Add-ClusterResourceDependency -Resource "SQL Server" -Provider $logvol)

            #Rename new cluster disks to user friendly name
            (Get-ClusterResource -Name $datavol).name = $datalabel
            (Get-ClusterResource -Name $logvol).name = $loglabel
        } catch {
            $responseObject['error'] = $_.Exception.Message
            $responseObject['message'] = "Failed to add disks to SQL Server Role dependency in cluster"
        }
    }
} catch{
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to add disks to cluster storage'
}

$responseObject | ConvertTo-Json -Depth 5
