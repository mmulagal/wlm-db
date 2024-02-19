[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ParameterStorePath,

    [Parameter(Mandatory = $true)]
    [string]$FSxID,

    [Parameter(Mandatory = $true)]
    [string]$FSxRegion
)

# Read fsxadmin password from secrets and encode the username:password with base64String
$FSxUserName = (Get-SSMParameter -Name "/$ParameterStorePath/fsx/username" -WithDecryption $True).Value
$FSxPassword = (Get-SSMParameter -Name "/$ParameterStorePath/fsx/password" -WithDecryption $True).Value
$FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("${FSxUserName}:${FSxPassword}"))
$FSxHostName = "management.${FSxID}.fsx.${FSxRegion}.amazonaws.com"

# Get region Certificateificate for FSx
$FSxCertificateificateUri = "https://fsx-aws-Certificates.s3.amazonaws.com/bundle-${FSxRegion}.pem"
Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\cfn\FSxCertificate.pem
$Certificate = Import-Certificate -FilePath C:\cfn\FSxCertificate.pem -CertStoreLocation Cert:\LocalMachine\Root
$regionCertificateificate = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like $Certificate.Subject }

# Get Windows drives associated with databases
$sqlresponse =  sqlcmd -Q "SET NOCOUNT ON; SELECT DISTINCT vs.logical_volume_name FROM sys.master_files AS mf CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs WHERE vs.volume_mount_point != 'C:\' AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) = 'MDF' AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) != 'TEMPDB' FOR JSON PATH;" -y 0;

[string[]]$WinVolumes = $sqlresponse | ConvertFrom-Json | % { $_.logical_volume_name }

Write-Debug "$WinVolumes"

Function Get-SerialNumberOfWinVolumes {
    Write-Debug "Getting serial number of windows volumes"

    [string[]]$serialnumers = @()
    foreach ($WinVolume in $WinVolumes) {
        $serialnumers += (Get-Volume -FileSystemLabel $WinVolume | Get-Partition | Get-Disk).SerialNumber
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
    Write-Debug "Get ONTAP lun name from serial numbers for: $LunSerialNumbers"

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

    return Invoke-ONTAPGetRequest @Params
}

if (!($WinVolumes.count -gt 0)) {
    write-error "Couldn't get database windows volumes"
    return
}

$SerialNumbers = Get-SerialNumberOfWinVolumes

if (!($SerialNumbers.count -gt 0)) {
    write-error "Couldn't get windows volume serial numbers"
    return
}

$VolumeNames = Get-LunFromSerialNumber $SerialNumbers

if (!($VolumeNames.count -gt 0)) {
    write-error "Couldn't get associated Ontap LUN volume names"
    return
}

Get-VolumeIdFromName $VolumeNames | ConvertTo-Json -Depth 10
