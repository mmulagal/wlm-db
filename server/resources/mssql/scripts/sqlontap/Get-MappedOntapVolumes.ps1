[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FSxSecretName,

    [Parameter(Mandatory = $true)]
    [string]$FSxID,

    [Parameter(Mandatory = $true)]
    [string]$FSxRegion
)

Start-Transcript -Path C:\cfn\log\ontapvolumesmapping.ps1.txt -Append
$ErrorActionPreference = "Stop"

# Read fsxadmin password from secrets and encode the username:password with base64String
$SecretInfo = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId ${FSxSecretName}).SecretString
$FSxUserName = $SecretInfo.username
$FSxPassword = $SecretInfo.password
$FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("${FSxUserName}:${FSxPassword}"))
$FSxHostName = "management.${FSxID}.fsx.${FSxRegion}.amazonaws.com"

# Get region Certificateificate for FSx
$FSxCertificateificateUri = "https://fsx-aws-Certificates.s3.amazonaws.com/bundle-${FSxRegion}.pem"
Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\cfn\FSxCertificate.pem
$Certificate = Import-Certificate -FilePath C:\cfn\FSxCertificate.pem -CertStoreLocation Cert:\LocalMachine\Root
$regionCertificateificate = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like $Certificate.Subject }

# Get Windows drives associated with databases
$qlresponse =  sqlcmd -Q "SET NOCOUNT ON; SELECT DISTINCT vs.logical_volume_name FROM sys.master_files AS mf CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs WHERE vs.volume_mount_point != 'C:\' AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) = 'MDF' AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) != 'TEMPDB';" -y 0 ;

$drives = $sqlresponse.split('\r\n')

Write-output $drives

Function Get-SerialNumberOfWinVolumes {
    Write-Debug "Getting serial number of windows volumes"

    [string[]]$serialnumers = @()
    foreach ($drive in $drives) {
        $serialnumers += (Get-Volume -FileSystemLabel $drive | Get-Partition | Get-Disk).SerialNumber
    }

    Write-Debug "Serial numbers: $serialnumers"
    return $serialnumers
}

function Invoke-ONTAPGetRequest {
    param(
        [Parameter(Mandatory = $false)]
        [string]$ApiEndpoint,

        [Parameter(Mandatory = $false)]
        [string]$ApiQueryFilter
    )

    Write-Debug "Invoke ONTAP rest request"

    $Params = @{
        "URI"     = "https://$FSxHostName/api${ApiEndpoint}?${ApiQueryFilter}"
        "Method"  = "GET"
        "Headers" = @{"Authorization" = "Basic $FSxCredentialsInBase64"}
        "ContentType" = "application/json"
    }

    return Invoke-RestMethod @Params -Certificate $regionCertificateificate
}

function Get-LunFromSerialNumber($LunSerialNumbers) {
    Write-Debug "Get ONTAP lun name from serial numbers: $LunSerialNumbers"

    $QueryFilter = ''
    foreach ($LunSerialNumber in $LunSerialNumbers) {
        if ($LunSerialNumber -ne '') {
             $QueryFilter += $LunSerialNumber + '|'
        }
    }

    $Params = @{
        "ApiEndPoint" = "/storage/luns"
    }

    if ($QueryFilter -ne '') {
        $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter"}
    }

    $Response = Invoke-ONTAPGetRequest @Params

    $LunRecords = $Response.records

    [string[]]$LunNames = @()
    foreach ($record in $LunRecords) {
        $LunNames += $record.name
    }

    Write-Debug "Lun names: $LunNames"
    return $LunNames
}

function Get-VolumeIdFromName($Names) {
    Write-Debug "Get Volume Id from name: $Names"

    $QueryFilter = ''
    foreach ($Name in $Names) {
        if ($Name -ne '') {
             $QueryFilter += $Name + '|'
        }
    }

    $Params = @{
        "ApiEndPoint" = "/storage/volumes"
    }

    if ($QueryFilter -ne '') {
        $Params += @{"ApiQueryFilter" = "name=$QueryFilter"}
    }

    $Response = Invoke-ONTAPGetRequest @Params

    $VolumeRecords = $Response.records

    [string[]]$VolumeIds = @()
    foreach ($record in $VolumeRecords) {
        $VolumeIds += $record.uuid
    }

    Write-Debug "Volume ids: $VolumeIds"
    return $VolumeIds
}

$SerialNumbers = Get-SerialNumberOfWinVolumes

$VolumeNames = Get-LunFromSerialNumber $SerialNumbers

Get-VolumeIdFromName $VolumeNames
