const GET_DRIVE_INFO = `
#Get the list of all used and available drive letters
$usedDriveLetters = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name
$availableDriveLetters = [char[]]([int][char]'D'..[int][char]'Z') | Where-Object { $_ -notin $usedDriveLetters }

#Updating manufacturer detail and availabble space of each existing drives
$driveInfo = $usedDriveLetters | ForEach-Object {
    $driveLetter = $_
    $drive = Get-PSDrive -Name $driveLetter
    $diskNumber = (Get-Partition -DriveLetter $driveLetter).DiskNumber
    try{
        $manufacturer = (Get-PhysicalDisk | Where-Object { $_.DeviceId -eq $diskNumber }).Manufacturer
    }
    catch {
        $manufacturer = 'N/A'
    }
    $freeSpace = $drive.Free
    [PSCustomObject]@{
        DriveLetter = $driveLetter
        FreeSpace = $freeSpace
        manufacturer = $manufacturer 
    }
}

#Get default data drive of SQL server
$defaultDataDrive = sqlcmd -Q @"
    SET NOCOUNT ON;
    DECLARE @DataPath NVARCHAR(500);
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultData', @DataPath OUTPUT;
    SELECT LEFT(@DataPath,1) AS CurrentDataDrive FOR JSON PATH;
"@ -y 0

#Get default log drive of SQL server
$defaultLogDrive = sqlcmd -Q @"
    SET NOCOUNT ON;
    DECLARE @LogPath NVARCHAR(500);
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultLog', @LogPath OUTPUT;
    SELECT LEFT(@LogPath,1) AS CurrentLogDrive FOR JSON PATH;
"@ -y 0

$jsonObject = @{
    AvailableDriveLetters = $availableDriveLetters
    ExistingDriveInfo = $driveInfo
    DefaultDataDrive = $defaultDataDrive
    DefaultLogDrive = $defaultLogDrive
} | ConvertTo-Json

Write-Output $jsonObject
`;

export { GET_DRIVE_INFO };
