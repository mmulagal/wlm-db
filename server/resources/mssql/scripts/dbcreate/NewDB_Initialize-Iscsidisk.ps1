[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DBName,

    [Parameter(Mandatory=$true)]
    [string]$IsClustered,

    [Parameter(Mandatory=$false)]
    [string]$DataDrive,

    [Parameter(Mandatory=$false)]
    [string]$LogDrive
)
Start-Transcript -Path C:\cfn\log\NewDB_initializeiscsi.log.txt -Append
$ErrorActionPreference = "Stop"

#Create a list of drive letters if not passed
if ($DataDrive -eq "" -Or $LogDrive -eq "") {
    $DataDrive = (ls function:[d-z]: -n | ?{ !(test-path $_) } | random)
    $LogDrive = (ls function:[d-z]: -n | ?{ !(test-path $_) } | random)
}


try{
#Retrieve a list of FSx for ONTAP disks
$disklist=Get-Disk | Where-Object{$_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.OperationalStatus -eq 'Offline'} | Sort-Object -Property Size
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

#Initiate, create and format volumes from the list of available FSx for ONTAP disks
#Stopping Service to prevent format dialogs
Stop-Service -Name ShellHWDetection

$datalabel = $DBName+"-Data"
$loglabel = $DBName+"-Log"

$LogDriveLetter = $LogDrive.Substring(0,1)
$DataDriveLetter = $DataDrive.Substring(0,1)

New-Partition -DiskNumber ($disklist[0]).Number -UseMaximumSize -DriveLetter $LogDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $loglabel
New-Partition -DiskNumber ($disklist[1]).Number -UseMaximumSize -DriveLetter $DataDriveLetter | Format-Volume -FileSystem NTFS -AllocationUnitSize 65536 -Force -NewFileSystemLabel $datalabel

Start-Service -Name ShellHWDetection

if ($IsClustered -ne "false") {
# Add new disks to Cluster Storage
$logdisk = (Get-Disk -Number $disklist[0]).Number | Add-ClusterDisk
$datadisk = (Get-Disk -Number $disklist[1]).Number | Add-ClusterDisk
#Rename Cluster Volumes
$logdisk.Name = $loglabel
$datadisk.Name = $datalabel 


#Fetch the SQL Server role from the WSFC. In discovered instances the instance name could be anything other than MSSQLSERVER, this handles that.
$SQLRoleGroup =  (Get-ClusterGroup).Name -match ('SQl Server*')
$SQLGroup = $SQLRoleGroup[0]

#Add  new cluster disks added to SQL Server Role dependency
Move-ClusterResource -Name $loglabel -Group $SQLGroup
Move-ClusterResource -Name $datalabel -Group $SQLGroup 

}
 

}catch{
    Write-Error "Error initializing drives"
    
} 
 
