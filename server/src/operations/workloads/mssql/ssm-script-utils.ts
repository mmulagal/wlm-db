const GET_DRIVE_INFO = `#Get the list of all used drive letters
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
$diskqry = 'ASSOCIATORS OF {{{0}}} WHERE ResultClass=MSCluster_Disk'
$partqry = 'ASSOCIATORS OF {{{0}}} WHERE ResultClass=MSCluster_DiskPartition'

$paths = Get-ClusterResource | Where-Object { $_.ResourceType.Name -eq 'Physical Disk' } \`
  | ForEach-Object { Get-WmiObject MSCluster_Resource -Namespace root/mscluster -Filter "Name='$_'" } \`
  | ForEach-Object { Get-WmiObject -Namespace root/mscluster -Query ($diskqry -f $_) } \`
  | ForEach-Object { Get-WmiObject -Namespace root/mscluster -Query ($partqry -f $_) } \`
  | Select-Object -ExpandProperty Path

$paths | ConvertTo-JSON
`;

export { GET_DRIVE_INFO, GET_DEFAULT_DRIVES, EXECUTE_SQL_QUERY, GET_CLUSTER_DRIVES };
