const GET_DIVE_INFO = `#Get the list of all used and available drive letters
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

$jsonObject = @{
    AvailableDriveLetters = $availableDriveLetters
    ExistingDriveInfo = $driveInfo
} | ConvertTo-Json

Write-Output $jsonObject
 
`;

// Execute a query through SSM
const EXECUTE_QUERY = (Query: string, Database: string = '$false') => `
    if(${Database}){
    $results = sqlcmd -d "${Database}" -Q "${Query}" -y 0
    }
    else{
    $results = sqlcmd -Q "${Query}" -y 0
    }
    Write-Output $results `;

export { GET_DIVE_INFO, EXECUTE_QUERY };
