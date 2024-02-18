#Get the list of all used and available drive letters
$usedDriveLetters = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name
$availableDriveLetters = [char[]]([int][char]'D'..[int][char]'Z') | Where-Object { $_ -notin $usedDriveLetters }

#Updating manufacturer detail and availabble space of each existing drives
$driveInfo = $usedDriveLetters | ForEach-Object {
    $driveLetter = $_
    $drive = Get-PSDrive -Name $driveLetter
    $diskNumber = (Get-Partition -DriveLetter $driveLetter).DiskNumber
    $manufacturer =  (Get-PhysicalDisk    | Where {$_.DeviceId -eq $diskNumber}).Manufacturer
    $freeSpace = $drive.Free
    [PSCustomObject]@{
        DriveLetter = $driveLetter
        FreeSpace = $freeSpace
        manufacturer = $manufacturer 
    }
}

$jsonObject = @{
    AvailableDriveLetters = $availableDriveLetters
    ExistingDriveInfo = $driveInfo
} | ConvertTo-Json

Write-Output $jsonObject
 
