#Get the list of all used and available drive letters
$usedDriveLetters = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name
$availableDriveLetters = [char[]]([int][char]'D'..[int][char]'Z') | Where-Object { $_ -notin $usedDriveLetters }

#Fetching the default data and log drives of the SQL server
$results = sqlcmd -Q @"
    SET NOCOUNT ON;
    DECLARE @DataPath NVARCHAR(500);
    DECLARE @LogPath NVARCHAR(500);
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultData', @DataPath OUTPUT;
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultLog', @LogPath OUTPUT;
    SELECT LEFT(@DataPath,1) AS CurrentDataDrive, LEFT(@LogPath,1) AS CurrentLogDrive FOR JSON PATH;
"@ -y 0

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
    DefaultDriveLetters = $results | ConvertFrom-Json
    AvailableDriveLetters = $availableDriveLetters
    ExistingDriveInfo = $driveInfo
} | ConvertTo-Json

Write-Output $jsonObject
 
