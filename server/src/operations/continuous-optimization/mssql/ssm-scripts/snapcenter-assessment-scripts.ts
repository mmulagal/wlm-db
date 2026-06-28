import { WorkloadInstance } from '../../../../utils/common-types';
import { ontapRestRequest } from '../../../workloads/mssql/common-templates';

const SNAPCENTER_ASSESSMENT_SCRIPT = (instanceRecord: WorkloadInstance) => {
    const fsxId = instanceRecord.fsxFileSystem.split(',')[0];
    const volumeNames = instanceRecord.mappedVolumeNames || [];
    const volumeUuids = instanceRecord.mappedVolumesUuids || [];

    return `
$ErrorActionPreference = 'Stop'
$FSxID = '${fsxId}'
$FSxRegion = '${instanceRecord.region}'
$volumeNames = '${JSON.stringify(volumeNames)}' | ConvertFrom-Json
$volumeUuids = '${JSON.stringify(volumeUuids)}' | ConvertFrom-Json

${ontapRestRequest}

function Test-SnapCenterPluginRunning {
    $splServices = Get-Service -ErrorAction SilentlyContinue | Where-Object {
        $_.Status -eq 'Running' -and (
            $_.Name -like '*SnapCenter*' -or
            $_.Name -like '*SMCore*' -or
            $_.DisplayName -like '*SnapCenter*' -or
            $_.DisplayName -like '*SMCore*'
        )
    }
    return [bool]$splServices
}

function Get-SnapCenterLogPaths {
    # Scan SMCore logs from the last 48 hours (same window as Oracle)
    $logPath = 'C:\\Program Files\\NetApp\\SnapCenter\\SMCore\\log'
    if (Test-Path -LiteralPath $logPath) { return @($logPath) }
    return @()
}

function Test-SnapCenterLogsForVolumes {
    param([string[]]$VolumeNames, [string[]]$VolumeUuids, [bool]$PluginRunning)

    $volumeLogHits = @{}
    foreach ($volName in $VolumeNames) { $volumeLogHits[$volName] = $false }

    if (-not $PluginRunning) {
        return @{ volumeLogHits = $volumeLogHits }
    }

    $logPaths = Get-SnapCenterLogPaths
    if ($logPaths.Count -eq 0) {
        return @{ volumeLogHits = $volumeLogHits }
    }

    $cutoff = (Get-Date).AddHours(-48)
    $recentLogs = @()
    foreach ($logPath in $logPaths) {
        Get-ChildItem -LiteralPath $logPath -Filter '*.log' -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -ge $cutoff } |
            ForEach-Object { $recentLogs += $_.FullName }
    }

    if ($recentLogs.Count -eq 0) {
        return @{ volumeLogHits = $volumeLogHits }
    }

    foreach ($logFile in $recentLogs) {
        try {
            $content = Get-Content -LiteralPath $logFile -Raw -ErrorAction SilentlyContinue
            if (-not $content) { continue }
            for ($i = 0; $i -lt $VolumeNames.Count; $i++) {
                $volName = $VolumeNames[$i]
                if ($volumeLogHits[$volName]) { continue }
                $volUuid = if ($i -lt $VolumeUuids.Count) { $VolumeUuids[$i] } else { '' }
                $matchesName = $volName -and ($content -match [regex]::Escape($volName))
                $matchesUuid = $volUuid -and ($content -match [regex]::Escape($volUuid))
                if ($matchesName -or $matchesUuid) {
                    $volumeLogHits[$volName] = $true
                }
            }
        } catch { }
    }

    return @{ volumeLogHits = $volumeLogHits }
}

function Get-VolumeHasSnapcenterSnapshot {
    param([string]$VolumeUuid)
    try {
        $endpoint = "/storage/volumes/$VolumeUuid/snapshots"
        $filter = 'comment=creator%3Dsnapcenter&max_records=1&fields=comment'
        $data = Invoke-ONTAPRequest -ApiEndpoint $endpoint -ApiQueryFilter $filter
        return [bool]($data -and $data.num_records -gt 0)
    } catch {
        return $false
    }
}

function Get-VolumeSvmInfo {
    param([string]$VolumeUuid)
    try {
        $data = Invoke-ONTAPRequest -ApiEndpoint "/storage/volumes/$VolumeUuid" -ApiQueryFields 'svm'
        return @{
            svmId = $data.svm.uuid
            svmName = $data.svm.name
        }
    } catch {
        return @{ svmId = ''; svmName = '' }
    }
}

$pluginRunning = Test-SnapCenterPluginRunning
$logScan = Test-SnapCenterLogsForVolumes -VolumeNames $volumeNames -VolumeUuids $volumeUuids -PluginRunning $pluginRunning

$snapcenterVolumes = @()
for ($i = 0; $i -lt $volumeUuids.Count; $i++) {
    $volUuid = $volumeUuids[$i]
    $volName = if ($i -lt $volumeNames.Count) { $volumeNames[$i] } else { '' }
    $svmInfo = Get-VolumeSvmInfo -VolumeUuid $volUuid
    $hasSnapcenter = Get-VolumeHasSnapcenterSnapshot -VolumeUuid $volUuid
    $foundInLogs = $false
    if ($logScan.volumeLogHits.ContainsKey($volName)) {
        $foundInLogs = $logScan.volumeLogHits[$volName]
    }
    $snapcenterVolumes += [PSCustomObject]@{
        svmId = $svmInfo.svmId
        svmName = $svmInfo.svmName
        volumeId = $volUuid
        volumeName = $volName
        hasSnapcenterSnapshot = $hasSnapcenter
        foundInSnapcenterLogs = $foundInLogs
    }
}

$output = [PSCustomObject]@{
    volumes = $snapcenterVolumes
    standaloneCheck = [PSCustomObject]@{
        pluginServiceRunning = $pluginRunning
    }
    errorMessage = ''
}

Write-Output ($output | ConvertTo-Json -Compress -Depth 5)
`;
};

export { SNAPCENTER_ASSESSMENT_SCRIPT };
