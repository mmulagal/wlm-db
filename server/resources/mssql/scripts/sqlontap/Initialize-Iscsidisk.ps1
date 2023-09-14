 
[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$IsFCI
)
Start-Transcript -Path C:\cfn\log\initializeiscsi.ps1.txt -Append
$ErrorActionPreference = "Stop"
#Retrieve a list of FSx for ONTAP disks
try{
$disklist=Get-Disk | Where-Object{$_.FriendlyName -eq 'NETAPP LUN C-MODE'} | Sort-Object -Property Size
foreach($dk in $disklist)
{
    if(($dk).IsOffline -eq $True){
       Set-Disk -Number ($dk).Number -IsOffline $False

    }
    if(($dk).PartitionStyle -eq 'RAW'){
        Initialize-Disk -Number ($dk).Number -PartitionStyle GPT -ErrorAction SilentlyContinue
    }
    if($dk.IsReadOnly -eq $True){
        Set-Disk -Number ($dk).Number -IsReadOnly $False
    }
}
#Create a list of drive letters
$driveletters = @("Q","T","L","S")
#Initiate, create and format volumes from the list of available FSx for ONTAP disks
#Stopping Service to prevent format dialogs
Stop-Service -Name ShellHWDetection

if ($IsFCI -ne "false") {
New-Partition -DiskNumber ($disklist[0]).Number -UseMaximumSize -DriveLetter $driveletters[0] | Format-Volume -FileSystem NTFS -Force -NewFileSystemLabel Quorum
New-Partition -DiskNumber ($disklist[1]).Number -UseMaximumSize -DriveLetter $driveletters[1] | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel SQL-TempDb
New-Partition -DiskNumber ($disklist[2]).Number -UseMaximumSize -DriveLetter $driveletters[2] | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel SQL-Log
New-Partition -DiskNumber ($disklist[3]).Number -UseMaximumSize -DriveLetter $driveletters[3] | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel SQL-Data
}
else {
New-Partition -DiskNumber ($disklist[0]).Number -UseMaximumSize -DriveLetter $driveletters[1] | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel SQL-TempDb
New-Partition -DiskNumber ($disklist[1]).Number -UseMaximumSize -DriveLetter $driveletters[2] | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel SQL-Log
New-Partition -DiskNumber ($disklist[2]).Number -UseMaximumSize -DriveLetter $driveletters[3] | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel SQL-Data
}
Start-Service -Name ShellHWDetection

}catch{
    Write-Output "Error initializing drives"
    $_ | Write-AWSLaunchWizardException
} 
