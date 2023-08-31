[CmdletBinding()]
param(
[Parameter(Mandatory=$true)]
[Int[]]$VolumeSizes,

[Parameter(Mandatory=$true)]
[string[]]$DriveLetters,

[Parameter(Mandatory=$true)]
[string[]]$DeviceNames

)

function Get-EC2InstanceMetadata {
  param([string]$Path)
  $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri http://169.254.169.254/latest/api/token
  (Invoke-WebRequest -Uri "http://169.254.169.254/latest/$Path" -Headers @{"X-aws-ec2-metadata-token" = $token} -Method Get -UseBasicParsing).Content
}

function Convert-SCSITargetIdToDeviceName {
  param([int]$SCSITargetId)
  If ($SCSITargetId -eq 0) {
    return "sda1"
  }
  $deviceName = "xvd"
  If ($SCSITargetId -gt 25) {
    $deviceName += [char](0x60 + [int]($SCSITargetId / 26))
  }
  $deviceName += [char](0x61 + $SCSITargetId % 26)
  return $deviceName
}


try{
    $ErrorActionPreference = "Stop"
    # List the Windows disks
    $InstanceId = Get-EC2InstanceMetadata "meta-data/instance-id"
    $AZ = Get-EC2InstanceMetadata "meta-data/placement/availability-zone"
    $Region = $AZ.Remove($AZ.Length - 1)
    $BlockDeviceMappings = (Get-EC2Instance -Region $Region -Instance $InstanceId).Instances.BlockDeviceMappings
    $VirtualDeviceMap = @{}
    (Get-EC2InstanceMetadata "meta-data/block-device-mapping").Split("`n") | ForEach-Object {
        $VirtualDevice = $_
        $BlockDeviceName = Get-EC2InstanceMetadata "meta-data/block-device-mapping/$VirtualDevice"
        $VirtualDeviceMap[$BlockDeviceName] = $VirtualDevice
        $VirtualDeviceMap[$VirtualDevice] = $BlockDeviceName
    }

    $disks = Get-disk | ForEach-Object {
        $DriveLetter = $null
        $VolumeName = $null

        $DiskDrive = $_
        $Disk = $_.Number
        $Partitions = $_.NumberOfPartitions
        $EbsVolumeID = $_.SerialNumber -replace "_[^ ]*$" -replace "vol", "vol-"
        Get-Partition -DiskId $_.Path | ForEach-Object {
            if ($_.DriveLetter -ne "") {
                $DriveLetter = $_.DriveLetter
                $VolumeName = (Get-PSDrive | Where-Object {$_.Name -eq $DriveLetter}).Description
            }
        }
        If ($DiskDrive.path -like "*PROD_PVDISK*") {
            $BlockDeviceName = Convert-SCSITargetIdToDeviceName((Get-WmiObject -Class Win32_Diskdrive | Where-Object {$_.DeviceID -eq ("\\.\PHYSICALDRIVE" + $DiskDrive.Number) }).SCSITargetId)
            $BlockDeviceName = "/dev/" + $BlockDeviceName
            $BlockDevice = $BlockDeviceMappings | Where-Object { $BlockDeviceName -like "*"+$_.DeviceName+"*" }
            $EbsVolumeID = $BlockDevice.Ebs.VolumeId
            $VirtualDevice = If ($VirtualDeviceMap.ContainsKey($BlockDeviceName)) { $VirtualDeviceMap[$BlockDeviceName] } Else { $null }
        }
        ElseIf ($DiskDrive.path -like "*PROD_AMAZON_EC2_NVME*") {
            $BlockDeviceName = Get-EC2InstanceMetadata "meta-data/block-device-mapping/ephemeral$((Get-WmiObject -Class Win32_Diskdrive | Where-Object {$_.DeviceID -eq ("\\.\PHYSICALDRIVE"+$DiskDrive.Number) }).SCSIPort - 2)"
            $BlockDevice = $null
            $VirtualDevice = If ($VirtualDeviceMap.ContainsKey($BlockDeviceName)) { $VirtualDeviceMap[$BlockDeviceName] } Else { $null }
        }
        ElseIf ($DiskDrive.path -like "*PROD_AMAZON*") {
            $BlockDevice = ""
            $BlockDeviceName = ($BlockDeviceMappings | Where-Object {$_.ebs.VolumeId -eq $EbsVolumeID}).DeviceName
            $VirtualDevice = $null
        }
        Else {
            $BlockDeviceName = $null
            $BlockDevice = $null
            $VirtualDevice = $null
        }
        New-Object PSObject -Property @{
            Disk          = $Disk;
            Partitions    = $Partitions;
            DriveLetter   = If ($DriveLetter -eq $null) { "N/A" } Else { $DriveLetter };
            EbsVolumeId   = If ($EbsVolumeID -eq $null) { "N/A" } Else { $EbsVolumeID };
            Device        = If ($BlockDeviceName -eq $null) { "N/A" } Else { $BlockDeviceName };
            VirtualDevice = If ($VirtualDevice -eq $null) { "N/A" } Else { $VirtualDevice };
            VolumeName    = If ($VolumeName -eq $null) { "N/A" } Else { $VolumeName };
        }
    } | where DriveLetter -ne 'C'


    $tempLetters = New-Object System.Collections.Queue
    $tempLetters.Enqueue('O')
    $tempLetters.Enqueue('U')
    $tempLetters.Enqueue('W')
    $tempLetters.Enqueue('V')
    $tempLetters.Enqueue('X')
    $tempLetters.Enqueue('Y')
    $tempLetters.Enqueue('Z')
    $BDtoDrLetter = @{}
    for($i = 0; $i -lt 4; $i++) {
        if($DeviceNames[$i] -ne 'N/A') {
            $BDtoDrLetter.add([String]$DeviceNames[$i], [String]$DriveLetters[$i])
        }
    }

    $letterToSizeMap = @{}
    for($i = 0; $i -lt $DriveLetters.Count; $i++) {
        $letter = $DriveLetters[$i]
        $size = $VolumeSizes[$i]
        $letterToSizeMap.add($letter, $size)
    }

    $length = $disks.Length
    for($i = 0; $i -lt $length; $i++) {
        $disks = Get-disk | ForEach-Object {
            $DriveLetter = $null
            $VolumeName = $null

            $DiskDrive = $_
            $Disk = $_.Number
            $Partitions = $_.NumberOfPartitions
            $EbsVolumeID = $_.SerialNumber -replace "_[^ ]*$" -replace "vol", "vol-"
            Get-Partition -DiskId $_.Path | ForEach-Object {
                if ($_.DriveLetter -ne "") {
                    $DriveLetter = $_.DriveLetter
                    $VolumeName = (Get-PSDrive | Where-Object {$_.Name -eq $DriveLetter}).Description
                }
            }
            If ($DiskDrive.path -like "*PROD_PVDISK*") {
                $BlockDeviceName = Convert-SCSITargetIdToDeviceName((Get-WmiObject -Class Win32_Diskdrive | Where-Object {$_.DeviceID -eq ("\\.\PHYSICALDRIVE" + $DiskDrive.Number) }).SCSITargetId)
                $BlockDeviceName = "/dev/" + $BlockDeviceName
                $BlockDevice = $BlockDeviceMappings | Where-Object { $BlockDeviceName -like "*"+$_.DeviceName+"*" }
                $EbsVolumeID = $BlockDevice.Ebs.VolumeId
                $VirtualDevice = If ($VirtualDeviceMap.ContainsKey($BlockDeviceName)) { $VirtualDeviceMap[$BlockDeviceName] } Else { $null }
            }
            ElseIf ($DiskDrive.path -like "*PROD_AMAZON_EC2_NVME*") {
                $BlockDeviceName = Get-EC2InstanceMetadata "meta-data/block-device-mapping/ephemeral$((Get-WmiObject -Class Win32_Diskdrive | Where-Object {$_.DeviceID -eq ("\\.\PHYSICALDRIVE"+$DiskDrive.Number) }).SCSIPort - 2)"
                $BlockDevice = $null
                $VirtualDevice = If ($VirtualDeviceMap.ContainsKey($BlockDeviceName)) { $VirtualDeviceMap[$BlockDeviceName] } Else { $null }
            }
            ElseIf ($DiskDrive.path -like "*PROD_AMAZON*") {
                $BlockDevice = ""
                $BlockDeviceName = ($BlockDeviceMappings | Where-Object {$_.ebs.VolumeId -eq $EbsVolumeID}).DeviceName
                $VirtualDevice = $null
            }
            Else {
                $BlockDeviceName = $null
                $BlockDevice = $null
                $VirtualDevice = $null
            }
            New-Object PSObject -Property @{
                Disk          = $Disk;
                Partitions    = $Partitions;
                DriveLetter   = If ($DriveLetter -eq $null) { "N/A" } Else { $DriveLetter };
                EbsVolumeId   = If ($EbsVolumeID -eq $null) { "N/A" } Else { $EbsVolumeID };
                Device        = If ($BlockDeviceName -eq $null) { "N/A" } Else { $BlockDeviceName };
                VirtualDevice = If ($VirtualDevice -eq $null) { "N/A" } Else { $VirtualDevice };
                VolumeName    = If ($VolumeName -eq $null) { "N/A" } Else { $VolumeName };
            }
        } | where DriveLetter -ne 'C'
        if($DeviceNames -contains $disks[$i].Device) {
            $key = $disks[$i].Device
            if($disks[$i].DriveLetter -ne $BDtoDrLetter.$key) {
                # check for collision
                $listOfAllDrLetters = (get-partition).DriveLetter
                if($listOfAllDrLetters -contains $BDtoDrLetter.$key) {
                    $tempLetter = $tempLetters.Dequeue()
                    while($listOfAllDrLetters -contains $tempLetter) {
                        $tempLetter = $tempLetters.Dequeue()
                    }
                    Get-Partition -DriveLetter $BDtoDrLetter.$key| Set-Partition -NewDriveLetter $tempLetter
                }

                Get-Partition -DiskNumber $disks[$i].Disk | Set-Partition -NewDriveLetter $BDtoDrLetter.$key
            }
        }
        Start-Sleep -s 2
    }

    $disks = Get-disk | ForEach-Object {
        $DriveLetter = $null
        $VolumeName = $null

        $DiskDrive = $_
        $Disk = $_.Number
        $Partitions = $_.NumberOfPartitions
        $EbsVolumeID = $_.SerialNumber -replace "_[^ ]*$" -replace "vol", "vol-"
        Get-Partition -DiskId $_.Path | ForEach-Object {
            if ($_.DriveLetter -ne "") {
                $DriveLetter = $_.DriveLetter
                $VolumeName = (Get-PSDrive | Where-Object {$_.Name -eq $DriveLetter}).Description
            }
        }
        If ($DiskDrive.path -like "*PROD_PVDISK*") {
            $BlockDeviceName = Convert-SCSITargetIdToDeviceName((Get-WmiObject -Class Win32_Diskdrive | Where-Object {$_.DeviceID -eq ("\\.\PHYSICALDRIVE" + $DiskDrive.Number) }).SCSITargetId)
            $BlockDeviceName = "/dev/" + $BlockDeviceName
            $BlockDevice = $BlockDeviceMappings | Where-Object { $BlockDeviceName -like "*"+$_.DeviceName+"*" }
            $EbsVolumeID = $BlockDevice.Ebs.VolumeId
            $VirtualDevice = If ($VirtualDeviceMap.ContainsKey($BlockDeviceName)) { $VirtualDeviceMap[$BlockDeviceName] } Else { $null }
        }
        ElseIf ($DiskDrive.path -like "*PROD_AMAZON_EC2_NVME*") {
            $BlockDeviceName = Get-EC2InstanceMetadata "meta-data/block-device-mapping/ephemeral$((Get-WmiObject -Class Win32_Diskdrive | Where-Object {$_.DeviceID -eq ("\\.\PHYSICALDRIVE"+$DiskDrive.Number) }).SCSIPort - 2)"
            $BlockDevice = $null
            $VirtualDevice = If ($VirtualDeviceMap.ContainsKey($BlockDeviceName)) { $VirtualDeviceMap[$BlockDeviceName] } Else { $null }
        }
        ElseIf ($DiskDrive.path -like "*PROD_AMAZON*") {
            $BlockDevice = ""
            $BlockDeviceName = ($BlockDeviceMappings | Where-Object {$_.ebs.VolumeId -eq $EbsVolumeID}).DeviceName
            $VirtualDevice = $null
        }
        Else {
            $BlockDeviceName = $null
            $BlockDevice = $null
            $VirtualDevice = $null
        }
        New-Object PSObject -Property @{
            Disk          = $Disk;
            Partitions    = $Partitions;
            DriveLetter   = If ($DriveLetter -eq $null) { "N/A" } Else { $DriveLetter };
            EbsVolumeId   = If ($EbsVolumeID -eq $null) { "N/A" } Else { $EbsVolumeID };
            Device        = If ($BlockDeviceName -eq $null) { "N/A" } Else { $BlockDeviceName };
            VirtualDevice = If ($VirtualDevice -eq $null) { "N/A" } Else { $VirtualDevice };
            VolumeName    = If ($VolumeName -eq $null) { "N/A" } Else { $VolumeName };
        }
    } | where DriveLetter -ne 'C'

    #resize
    foreach ($disk in $disks) {
        if ($DriveLetters -contains $disk.DriveLetter) {
            $key = [String]$disk.DriveLetter
            $VolumeSize = $letterToSizeMap.$key
            $volume = get-ec2volume -VolumeId $disk.EbsVolumeId
            if ($volume.Size -lt $VolumeSize) {
                Edit-EC2Volume -VolumeId $disk.EbsVolumeId -Size $VolumeSize
            }
        }
    }


    C:\cfn\scripts\common\Restart-Computer.ps1

} catch {
    Write-Host $_.Exception.Message
    $_ | Write-AWSLaunchWizardException
}
