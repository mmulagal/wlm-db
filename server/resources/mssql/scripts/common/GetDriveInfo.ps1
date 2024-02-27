#Get the list of all used drive letters
$usedDriveLetters = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name

#Updating manufacturer detail and availabble space of each existing drives
$driveInfo = $usedDriveLetters | ForEach-Object {
    $driveLetter = $_
    $drive = Get-PSDrive -Name $driveLetter
    $diskNumber = (Get-Partition -DriveLetter $driveLetter).DiskNumber
    try{
        if((Get-PhysicalDisk | Where-Object { $_.DeviceId -eq $diskNumber }).Manufacturer -eq 'NETAPP'){
            $isNetappDrive = $true 
        }
        else{
            $isNetappDrive = $false 
        }
    }
    catch {
        $isNetappDrive = $false 
    }
    $freeSpace = $drive.Free
    [PSCustomObject]@{
        driveLetter = $driveLetter
        availableSize = $freeSpace
        isNetappDrive = $isNetappDrive 
    }
}

Write-Output $driveInfo | ConvertTo-Json