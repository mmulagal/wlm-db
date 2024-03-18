const GET_DRIVE_INFO = (deploymentType: string) => `#Get the list of all used drive letters
$disks = Get-Disk
$usedDriveDetails = @()
$deploymentType = '${deploymentType}'
foreach ($disk in $disks) {
    $volume = Get-Partition | Where-Object { $_.DiskNumber -eq $disk.Number } | Get-Volume
    if ($deploymentType -eq 'FCI') {
        $labels = Get-ClusterResource | Where-Object { $_.ResourceType -eq "Physical Disk" } | Where-Object { $_.Name -eq $volume.FileSystemLabel }
    }

    $output = [PSCustomObject]@{
        driveLetter = $volume.DriveLetter
        availableSize = $volume.SizeRemaining
        manufacturer = $disk.Manufacturer
    }

    if ($deploymentType -eq 'FCI') {
        $output | Add-Member -NotePropertyName "owner" -NotePropertyValue $labels.OwnerGroup.Name
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

const GET_DEFAULT_COLLATION = `
#Get default collation of SQL server
$defaultSqlCollation = sqlcmd -Q @"
    SET NOCOUNT ON;
    SELECT CONVERT(nvarchar(128), SERVERPROPERTY('collation'));
"@ -y 0

#Get default version of SQL server
$sqlVersion = sqlcmd -Q @"
    SET NOCOUNT ON;
    SELECT @@VERSION;
"@ -y 0

Write-Output $defaultSqlCollation $sqlVersion | ConvertTo-Json
`;

export { GET_DRIVE_INFO, GET_DEFAULT_DRIVES, GET_DEFAULT_COLLATION };
