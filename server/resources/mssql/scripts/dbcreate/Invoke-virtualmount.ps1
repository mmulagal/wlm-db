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

$null = (Start-Transcript -Path C:\cfn\log\NewDB_initializeiscsi.log.txt -Append)
$ErrorActionPreference = "Stop"

try {
    $responseObject = [ordered]@{}

    if ($DataFilePath -eq $null -or $LogFilePath -eq $null -or $DataSerial -eq $null -or $LogSerial -eq $null){
        write-debug "DataFilePath: $DataFilePath LogFilePath: $LogFilePath DataSerial: $DataSerial LogSerial: $LogSerial"
        throw "DataFilePath or LogFilePath DataSerial or LogSerial is null"
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
        if ($disk.IsOffline -ne $False) {
            Set-Disk -Number $disk.Number -IsOffline $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }

        if ($disk.PartitionStyle -ne 'GPT') {
            Set-Disk -Number $disk.Number -PartitionStyle GPT -ErrorAction SilentlyContinue
            Start-Sleep 2
        }

        if ($disk.IsReadOnly -ne $False) {
            Set-Disk -Number $disk.Number -IsReadOnly $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
    }
} catch{
    write-debug "Error: $_.Exception"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to modify disks'
} 

try {
    Stop-Service -Name ShellHWDetection
    $null = (New-Item -ItemType Directory -Path $datafolder -Force)
    $null = (New-Item -ItemType Directory -Path $logfolder -Force)

    $datadisknumber = ($disklist | Where-Object { $_.SerialNumber -eq $DataSerial }).Number
    $logdisknumber = ($disklist | Where-Object { $_.SerialNumber -eq $LogSerial }).Number

    $dataPartition = Get-Partition -DiskNumber $datadisknumber
    $logPartition = Get-Partition -DiskNumber $logdisknumber

    write-debug "DataAccessPaths: $($dataPartition.AccessPaths)"
    write-debug "LogAccessPaths: $($logPartition.AccessPaths)"

    if ($dataPartition.AccessPaths -notcontains $datafolder + '\') {
        $null = $dataPartition | Where-Object Type -eq Basic | Add-PartitionAccessPath -AccessPath $datafolder
    }

    if ($logPartition.AccessPaths -notcontains $logfolder + '\') {
        $null = $logPartition | Where-Object Type -eq Basic | Add-PartitionAccessPath -AccessPath $logfolder
    }

    Get-Partition | Where-Object { $_.DiskNumber -eq $datadisknumber -or $_.DiskNumber -eq $logdisknumber } | ForEach-Object {
        $dataPartition.AccessPaths | ForEach-Object {
            $accessPath = $_
            write-debug "AccessPath: $accessPath"
            if ($accessPath) {
                $matched = $accessPath -match '^[A-Z]:\\$'
                write-debug "Matched: $matched"
                if ($matched -eq $True) {
                    $accessDrive = $matches[0]
                    $null = ($dataPartition | Remove-PartitionAccessPath -AccessPath $accessDrive)
                }
            }
        }
    }

    $dataPartition | Get-Volume | Set-Volume -NewFileSystemLabel $datalabel
    $logPartition | Get-Volume | Set-Volume -NewFileSystemLabel $loglabel

    Start-Service -Name ShellHWDetection

    $newDataFilePath = $datafolder + (Split-Path -Path $DataFilePath -NoQualifier)
    $newLogFilePath = $logfolder + (Split-Path -Path $LogFilePath -NoQualifier)

    if ((Test-Path $newDataFilePath) -and (Test-Path $newLogFilePath)) {
        $responseObject['datapath'] = $newDataFilePath
        $responseObject['logpath'] = $newLogFilePath
    } else {
        $responseObject['error'] = 'Failed to validate newpaths $newDataFilePath $newLogFilePath'
    }

    write-debug "NewFilePaths: $newDataFilePath $newLogFilePath"
} catch {
    write-debug "Error: $_.Exception"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to initialize disks'    
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
