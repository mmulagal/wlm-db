import { WorkloadInstance } from '../../../../utils/common-types';

interface SnapCenterVolumeOntapInfo {
    svmId: string;
    svmName: string;
    hasSnapcenterSnapshot: boolean;
}

interface SnapCenterOntapData {
    response: Record<string, SnapCenterVolumeOntapInfo>;
    errors: Record<string, string>;
}

const SNAPCENTER_ASSESSMENT_SCRIPT = (instanceRecord: WorkloadInstance, snapCenterOntapData: SnapCenterOntapData) => {
    const volumeNames = instanceRecord.mappedVolumeNames || [];
    const volumeUuids = instanceRecord.mappedVolumesUuids || [];

    return `
$ErrorActionPreference = 'Stop'
$volumeNames = '${JSON.stringify(volumeNames)}' | ConvertFrom-Json
$volumeUuids = '${JSON.stringify(volumeUuids)}' | ConvertFrom-Json
$snapCenterOntapData = '${JSON.stringify(snapCenterOntapData.response)}' | ConvertFrom-Json

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
    $candidatePaths = @(
        'C:\\Program Files\\NetApp\\SnapCenter\\SMCore\\log',
        'C:\\Program Files\\NetApp\\SMCore\\log'
    )
    return @($candidatePaths | Where-Object { Test-Path -LiteralPath $_ })
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

function Get-VolumeOntapInfo {
    param([string]$VolumeUuid)
    $info = $snapCenterOntapData.$VolumeUuid
    if ($info) {
        return @{ svmId = $info.svmId; svmName = $info.svmName; hasSnapcenterSnapshot = [bool]$info.hasSnapcenterSnapshot }
    }
    return @{ svmId = ''; svmName = ''; hasSnapcenterSnapshot = $false }
}

$pluginRunning = Test-SnapCenterPluginRunning
$logScan = Test-SnapCenterLogsForVolumes -VolumeNames $volumeNames -VolumeUuids $volumeUuids -PluginRunning $pluginRunning

$snapcenterVolumes = @()
for ($i = 0; $i -lt $volumeUuids.Count; $i++) {
    $volUuid = $volumeUuids[$i]
    $volName = if ($i -lt $volumeNames.Count) { $volumeNames[$i] } else { '' }
    $ontapInfo = Get-VolumeOntapInfo -VolumeUuid $volUuid
    $hasSnapcenter = $ontapInfo.hasSnapcenterSnapshot
    $foundInLogs = $false
    if ($logScan.volumeLogHits.ContainsKey($volName)) {
        $foundInLogs = $logScan.volumeLogHits[$volName]
    }
    $snapcenterVolumes += [PSCustomObject]@{
        svmId = $ontapInfo.svmId
        svmName = $ontapInfo.svmName
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

export { SNAPCENTER_ASSESSMENT_SCRIPT, type SnapCenterOntapData, type SnapCenterVolumeOntapInfo };
