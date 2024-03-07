const GET_FCI_DRIVE_INFO = `#Get the list of all used drive letters
$disks = Get-Disk
$usedDriveDetails = @()
foreach ($disk in $disks) {
    $volume = Get-Partition | Where-Object { $_.DiskNumber -eq $disk.Number } | get-volume
	$labels = Get-ClusterResource | where { $_.ResourceType -eq "Physical Disk" } | where { $_.Name -eq $volume.FileSystemLabel }
    $output = New-Object PSObject -Property @{
        driveLetter = $volume.DriveLetter
        availableSize = $volume.SizeRemaining
        manufacturer = $disk.Manufacturer
	    owner = $labels.OwnerGroup.Name
    }
    $usedDriveDetails += $output 
}

 $usedDrivesInfoJson = $usedDriveDetails | ConvertTo-Json
Write-Host $usedDrivesInfoJson 
`;

const GET_STANDALONE_DRIVE_INFO = `#Get the list of all used drive letters
$disks = Get-Disk
$usedDriveDetails = @()
foreach ($disk in $disks) {
    $volume = Get-Partition | Where-Object { $_.DiskNumber -eq $disk.Number } | get-volume
    $output = New-Object PSObject -Property @{
        driveLetter = $volume.DriveLetter
        availableSize = $volume.SizeRemaining
        manufacturer = $disk.Manufacturer
    }
    $usedDriveDetails += $output 
}

 $usedDrivesInfoJson = $usedDriveDetails | ConvertTo-Json
Write-Host $usedDrivesInfoJson 
`;

const GET_DEFAULT_DRIVES = `
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

Write-Output $defaultDataDrive $defaultLogDrive | ConvertTo-Json
`;

const EXECUTE_SQL_QUERY = (query: string, database?: string) => `
if(${database}){
    $results = sqlcmd -d "${database}" -Q "${query}" -y 0
}
else{
    $results = sqlcmd -Q "${query}" -y 0
}
Write-Output $results 
`;

const GET_CLUSTER_DRIVES = `
$clusterDrives = Get-Volume | ForEach-Object {
    $volume = $_
    Get-ClusterResource | Where-Object { $_.Name -eq $volume.FileSystemLabel } | ForEach-Object {
        [PsCustomObject]@{
            DriveLetter = $volume.DriveLetter
            OwnerGroup = $_.OwnerGroup.Name
        }
    }
} | Select-Object DriveLetter, OwnerGroup | ConvertTo-Json
 
$clusterDrives
`;

export { GET_FCI_DRIVE_INFO, GET_STANDALONE_DRIVE_INFO, GET_DEFAULT_DRIVES, EXECUTE_SQL_QUERY, GET_CLUSTER_DRIVES };
