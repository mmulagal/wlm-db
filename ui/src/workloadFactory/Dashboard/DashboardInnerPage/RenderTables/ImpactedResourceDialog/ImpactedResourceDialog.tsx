import { DsTypography } from '@tlveng/wlm-ds';
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnProps, Table } from '@netapp/design-system/dist/components/Table';
import styles from './ImpactedResourceDialog.module.scss';
import commonStyles from '../../../../../utils/CommonStyles.module.scss';
import { ASSESSMENT_CONFIG_IDS, DBType, PATCH_SCAN_FIELD, WIZARD_TYPE } from '../../../../../utils/consts';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useGetMissingPatchAssessmentDataQuery } from '../../../../../utils/apiService';
import { getTableLazyLoadingComponentProps } from '../../../../../common/Lib/Table/tableLazyLoadingProps';
import { useTable, rowDataType } from '../../../../../common/Lib/Table/useTable';
import { ReactComponent as ArrowIcon } from '../../../../../assets/row_arrow.svg';
import {
    toggleExpandedRow,
    useInitialExpandedRowByIndex,
    buildColumnProps,
    renderExpandableChevron
} from '../../../../GetWell/OptimizeInnerPage/InnerTables/ExpandableTableHelper';
import CopyToClipboardCommon from '../../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../../assets/ic_copy.svg';
import { normalizeImpactedResourceDialogData } from '../../../../WellArchitectedTab/assessmentFormatUtils';
import { buildSubConfigValues, getColumnConfig } from '../../../../../utils/configRegistry';

interface ViolationDetail {
    objectName?: string;
    value?: string | number;
    objectType?: string;
    recommended?: string;
    nfsMount?: string;
    dataCategory?: string;
    additionalInfo?: {
        lunPath?: string;
        driveLetter?: string;
    };
}

interface ViolationVolume {
    ontapVolumeName?: string;
    ontapVolumeUuid?: string;
    objectName?: string;
    databaseName?: string;
}

// objectsInViolation items can be plain strings or structured objects depending on the config
type ObjectInViolation = string | ViolationVolume;

interface SizingDrive {
    logAccessPath?: string;
    tempdbAccessPath?: string;
    lunPath?: string;
    databases?: string[];
    sizePercentToDataDrive?: number;
    ontapVolumeName?: string;
}

interface SizingViolations {
    overProvisionedDrives?: SizingDrive[];
    underProvisionedDrives?: SizingDrive[];
    /** Shared-drive / not optimizable per backend; same shape as other sizing drives */
    ignoredDrives?: SizingDrive[];
}

interface PatchDetail {
    kbId?: string;
    title?: string;
    classification?: string;
    severity?: string;
    cveIds?: string;
    state?: string;
}

interface OracleSecurityPatchDetail {
    cveId?: string;
    component?: string;
    description?: string;
    releaseDate?: string;
    releaseName?: string;
}

interface PatchInstance {
    ec2InstanceId?: string;
    ec2InstanceName?: string;
    missingPatchDetails?: PatchDetail[];
}

interface Ec2InterfaceToFix {
    name?: string;
    currentMTU?: number;
    recommendedMTU?: number;
    interfaceIndex?: number;
}

interface AssessmentData {
    violationDetails?: ViolationDetail[];
    objectsInViolation?: ObjectInViolation[];
    /** Top-level current value for the assessment */
    current?: string;
    /** Top-level fallback recommended value shared across rows when a row doesn't carry its own */
    recommended?: string;
    sizingViolations?: SizingViolations;
    configurationName?: string;
    configObj?: { configurationName?: string };
    name?: string;
    missingPatchList?: (PatchInstance | OracleSecurityPatchDetail)[];
    credentialId?: string;
    regionId?: string;
    databaseHostId?: string;
    instanceId?: string;
    configItem?: Record<string, unknown>;
    rssAdapters?: RssAdapter[];
    recommendedAdapterSettings?: RecommendedAdapterSettings;
    tcpOffloadState?: string;
    ec2InterfacesToFix?: Ec2InterfaceToFix[];
}

interface RssAdapter {
    adapterName?: string;
    rssProfile?: string;
    rssEnabled?: boolean;
    baseProcessorNumber?: number | string;
    numberOfReceiveQueues?: number | string;
}

interface RecommendedAdapterSettings {
    recommendedRssProfile?: string;
    recommendedBaseProcessorNumber?: number | string;
    recommendedReceiveQueues?: number | string;
}

type PatchScanField = (typeof PATCH_SCAN_FIELD)[keyof typeof PATCH_SCAN_FIELD];

// Maps flat config ids to the `field` query param expected
// by the patch-scan assessment API for patch-type configurations.
const PATCH_CONFIG_FIELD_MAP: Record<string, PatchScanField> = {
    [ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH]: PATCH_SCAN_FIELD.HOST_OS_PATCH,
    [ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH]: PATCH_SCAN_FIELD.MSSQL_PATCH,
    [ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH]: PATCH_SCAN_FIELD.ORACLE_SECURITY_PATCH
};

// Response shapes returned by /assessment/patch-scan for each `field` value.
interface HostOsPatchResponse {
    ec2InstancesToPatch?: PatchInstance[];
}

interface MssqlPatchResponse {
    missingPatchesInEc2Instances?: PatchInstance[];
    ec2InstancesToPatch?: PatchInstance[];
}

interface OracleSecurityPatchInstance {
    ec2InstanceId?: string;
    database?: string;
    missingPatchDetails?: OracleSecurityPatchDetail[];
}

interface OracleSecurityPatchResponse {
    ec2InstancesToPatch?: OracleSecurityPatchInstance[];
}

type MissingPatchResponse = HostOsPatchResponse | MssqlPatchResponse | OracleSecurityPatchResponse;

// Normalizes different patch-scan response shapes into the flat list the
// dialog's row mappers already consume via `data.missingPatchList`.
const extractMissingPatchList = (
    field: PatchScanField,
    response: MissingPatchResponse | undefined
): (PatchInstance | OracleSecurityPatchDetail)[] => {
    if (!response) return [];
    switch (field) {
        case PATCH_SCAN_FIELD.HOST_OS_PATCH:
            return (response as HostOsPatchResponse).ec2InstancesToPatch ?? [];
        case PATCH_SCAN_FIELD.MSSQL_PATCH: {
            const mssql = response as MssqlPatchResponse;
            return mssql.missingPatchesInEc2Instances ?? mssql.ec2InstancesToPatch ?? [];
        }
        case PATCH_SCAN_FIELD.ORACLE_SECURITY_PATCH: {
            // Backend returns { ec2InstancesToPatch: [{ missingPatchDetails: [...] }, ...] };
            // flatten so the Oracle mapper can consume a single list of patches.
            const oracle = response as OracleSecurityPatchResponse;
            return (oracle.ec2InstancesToPatch ?? []).flatMap(inst => inst.missingPatchDetails ?? []);
        }
        default:
            return [];
    }
};

interface ImpactedResourcesResult {
    columns: string[];
    rows: string[][];
    isExpandable?: boolean;
}

/**
 * If mapped rows are empty, fills a single row of na values so the dialog always has at least one row to display.
 */
const ensureRows = (columns: string[], rows: string[][], na: string): ImpactedResourcesResult => ({
    columns,
    rows: rows.length > 0 ? rows : [columns.map(() => na)]
});

/**
 * Maps violationDetails (or falls back to objectsInViolation) into a single-column table.
 * objectsInViolation items can be plain strings or objects depending on the config,
 * hence the typeof check.
 */
const mapDetailsToSingleCol = (
    details: ViolationDetail[],
    objects: ObjectInViolation[],
    colName: string,
    na: string
): ImpactedResourcesResult => {
    const columns = [colName];
    const source: (ViolationDetail | ObjectInViolation)[] = details.length > 0 ? details : objects;
    const rows = source.map(item => [typeof item === 'string' ? item : (item as ViolationDetail)?.objectName || na]);
    return ensureRows(columns, rows, na);
};

const mapObjectsToVolumeName = (objects: ObjectInViolation[], na: string): ImpactedResourcesResult => {
    const columns = ['Volume name'];
    const rows = objects.map((item: ObjectInViolation) => [
        typeof item === 'string' ? item : item?.ontapVolumeName || item?.objectName || na
    ]);
    return ensureRows(columns, rows, na);
};

/**
 * Generic flat-assessment fallback when config id/name is not in the legacy switch maps.
 * Uses violationDetails / objectsInViolation directly from the API item.
 */
const mapAssessmentViolations = (
    data: AssessmentData,
    configLabel: string,
    na: string,
    t: (key: string) => string,
    engineType?: string
): ImpactedResourcesResult => {
    const details: ViolationDetail[] = data?.violationDetails || [];
    const objects: ObjectInViolation[] = data?.objectsInViolation || [];

    if (details.length === 0 && objects.length === 0) {
        return { columns: [], rows: [] };
    }

    const objectType = details[0]?.objectType?.toLowerCase();
    const resourceColumn =
        objectType === 'lun' ? t('databases.well-architect.lun-name') : t('databases.well-architect.volume-name');

    // MSSQL volume/LUN configs use a single resource column (legacy mapDetailsToSingleCol shape).
    if (engineType === DBType.MSSQL) {
        return mapDetailsToSingleCol(details, objects, resourceColumn, na);
    }

    const hasRecommendedColumn = details.some(
        detail =>
            detail?.recommended != null &&
            detail.recommended !== '' &&
            detail.recommended !== 'true' &&
            detail.recommended !== 'false'
    );

    if (hasRecommendedColumn) {
        const columns = [resourceColumn, configLabel, 'Recommended value'];
        const rows = details.map(detail => [
            detail?.objectName || na,
            detail?.value != null ? String(detail.value) : na,
            detail?.recommended || na
        ]);
        return ensureRows(columns, rows, na);
    }

    const hasValueAndObjectName = details.some(detail => detail?.value != null && detail?.objectName);

    if (hasValueAndObjectName) {
        const columns = [resourceColumn, configLabel];
        const rows = details.map(detail => [
            detail?.objectName || na,
            detail?.value != null ? String(detail.value) : na
        ]);
        return ensureRows(columns, rows, na);
    }

    return mapDetailsToSingleCol(details, objects, resourceColumn, na);
};

const isRssAdapterNonOptimized = (adapter: RssAdapter, recommended?: RecommendedAdapterSettings): boolean => {
    if (!adapter?.rssEnabled) {
        return true;
    }
    const isProfileMismatch = adapter.rssProfile !== recommended?.recommendedRssProfile;
    const isProcessorMismatch = adapter.baseProcessorNumber !== recommended?.recommendedBaseProcessorNumber;
    const isQueueMismatch = adapter.numberOfReceiveQueues !== recommended?.recommendedReceiveQueues;
    return isProfileMismatch || isProcessorMismatch || isQueueMismatch;
};

const mapRssAdaptersToTable = (
    data: AssessmentData,
    na: string,
    t: (key: string) => string
): ImpactedResourcesResult => {
    const recommended = data.recommendedAdapterSettings;
    const adapters = data.rssAdapters || [];
    const impacted = adapters.filter(adapter => isRssAdapterNonOptimized(adapter, recommended));

    const columns = [
        t('databases.well-architect.network-adapter-name'),
        t('databases.well-architect.rss-status'),
        t('databases.well-architect.rss-profile'),
        t('databases.well-architect.base-processor-number'),
        t('databases.well-architect.receive-queues')
    ];
    const rows = impacted.map(adapter => [
        adapter?.adapterName || na,
        adapter?.rssEnabled ? 'Enabled' : 'Disabled',
        adapter?.rssProfile != null ? String(adapter.rssProfile) : na,
        adapter?.baseProcessorNumber != null ? String(adapter.baseProcessorNumber) : na,
        adapter?.numberOfReceiveQueues != null ? String(adapter.numberOfReceiveQueues) : na
    ]);
    return ensureRows(columns, rows, na);
};

const mapMtuInterfacesToTable = (
    data: AssessmentData,
    na: string,
    t: (key: string) => string
): ImpactedResourcesResult => {
    const interfaces = data.ec2InterfacesToFix || [];
    const columns = [t('databases.well-architect.network-interface-name'), 'MTU', 'Recommended value'];
    if (interfaces.length > 0) {
        const rows = interfaces.map(item => [
            item?.name || na,
            item?.currentMTU != null ? String(item.currentMTU) : na,
            item?.recommendedMTU != null ? String(item.recommendedMTU) : na
        ]);
        return ensureRows(columns, rows, na);
    }
    const rows = (data.violationDetails || []).map(detail => [
        detail?.objectName || na,
        detail?.value != null ? String(detail.value) : na,
        detail?.recommended != null ? String(detail.recommended) : na
    ]);
    return ensureRows(columns, rows, na);
};

type SizingDrivePathKey = keyof Pick<SizingDrive, 'logAccessPath' | 'tempdbAccessPath'>;

/** Log drive size and TempDB drive size share the same table shape; only the drive path field and % column label differ. */
const mssqlSizingViolationsToDriveTable = (
    sizing: SizingViolations,
    drivePathKey: SizingDrivePathKey,
    percentColumnI18nKey: string,
    na: string,
    t: (key: string) => string
): ImpactedResourcesResult => {
    const drivePath = (drive: SizingDrive) => drive[drivePathKey] || na;
    const columns = [
        t('databases.well-architect.drive-name'),
        t('databases.well-architect.lun-path'),
        t('databases.well-architect.databases'),
        t('databases.well-architect.status'),
        t(percentColumnI18nKey)
    ];
    const mapDrives = (drives: SizingDrive[] | undefined, statusI18nKey: string) =>
        (drives || []).map((drive: SizingDrive) => [
            drivePath(drive),
            drive?.lunPath || na,
            (drive?.databases || []).join(', ') || na,
            t(statusI18nKey),
            drive?.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : na
        ]);
    const rows = [
        ...mapDrives(sizing?.overProvisionedDrives, 'databases.well-architect.over-provisioned'),
        ...mapDrives(sizing?.underProvisionedDrives, 'databases.well-architect.under-provisioned'),
        ...mapDrives(sizing?.ignoredDrives, 'databases.well-architect.shared-drive')
    ];
    return ensureRows(columns, rows, na);
};

interface SubConfigDetail {
    name?: string;
    recommended?: string;
    recommendedByDataCategory?: Record<string, string>;
}

/**
 * Builds resource | current | recommended rows for combined sub-config configs
 * (storage-efficiencies, tiering-tco-optimization, block-device-space-management),
 * where each row's current/recommended is an aggregate of its violated sub-configs.
 */
const mapSubConfigViolations = (data: AssessmentData, columns: string[], na: string): ImpactedResourcesResult => {
    const details: ViolationDetail[] = data?.violationDetails || [];
    const configDetails = (data?.configItem?.configDetails as SubConfigDetail[] | undefined) ?? [];
    const rows = details.map(detail => {
        const { current, recommended } = buildSubConfigValues(detail, configDetails);
        return [detail?.objectName || na, current || na, recommended || na];
    });
    return ensureRows(columns, rows, na);
};

/**
 * Generic fallback using column config from unified registry.
 * Maps violationDetails to table rows based on column accessor configuration.
 */
const mapGenericConfigFromRegistry = (
    configId: string,
    data: AssessmentData,
    na: string,
    t: (key: string) => string,
    engineType?: string
): ImpactedResourcesResult | null => {
    const columnConfig = getColumnConfig(configId, engineType);
    if (!columnConfig) return null;

    // Handle sub-configs (storage-efficiencies, etc.)
    if (columnConfig.hasSubConfigs) {
        const columns = columnConfig.columns.map(col => t(col.label) || col.label);
        return mapSubConfigViolations(data, columns, na);
    }

    // Generic mapping for standard configs
    const details: ViolationDetail[] = data?.violationDetails || [];
    const columns = columnConfig.columns.map(col => t(col.label) || col.label);
    // Top-level `recommended` is shared by all rows when a row doesn't carry its own (mirrors DynamicInnerTable)
    const topRecommended = data?.recommended;

    const rows = details.map(detail =>
        columnConfig.columns.map(col => {
            const accessor = col.accessor || col.key;
            const value =
                accessor === 'recommended'
                    ? detail?.recommended || topRecommended
                    : detail?.[accessor as keyof ViolationDetail];

            // Special formatting based on column key
            if (col.key === 'value' && typeof value === 'number') {
                // Percentage formatting for performance-tier, snapshot-copy-reserve
                if (configId === 'performance-tier' || configId === 'snapshot-copy-reserve') {
                    return `${value}%`;
                }
            }

            if (col.key === 'rss' && typeof value === 'boolean') {
                return value ? 'Enabled' : 'Disabled';
            }

            if (col.key === 'divergence' && typeof value === 'number') {
                return `${value}%`;
            }

            return value != null && value !== '' ? String(value) : na;
        })
    );

    return ensureRows(columns, rows, na);
};

/**
 * MSSQL flat API configs use internal IDs: 'performance-tier', 'log-drive-size', etc.
 */
const getMssqlImpactedResources = (
    configName: string,
    data: AssessmentData,
    na: string,
    t: (key: string) => string
): ImpactedResourcesResult => {
    const details: ViolationDetail[] = data?.violationDetails || [];
    const objects: ObjectInViolation[] = data?.objectsInViolation || [];
    const sizing: SizingViolations = data?.sizingViolations || {};

    switch (configName) {
        // === SUB-CONFIG CASES (storage-efficiencies, etc.) ===
        case ASSESSMENT_CONFIG_IDS.STORAGE_EFFICIENCIES:
        case ASSESSMENT_CONFIG_IDS.TIERING_TCO_OPTIMIZATION:
            return mapSubConfigViolations(
                data,
                [
                    t('databases.well-architect.volume-name'),
                    t('databases.well-architect.current'),
                    t('databases.well-architect.recommended')
                ],
                na
            );

        case ASSESSMENT_CONFIG_IDS.BLOCK_DEVICE_SPACE_MANAGEMENT:
            return mapSubConfigViolations(
                data,
                [
                    t('databases.well-architect.object-name'),
                    t('databases.well-architect.current'),
                    t('databases.well-architect.recommended')
                ],
                na
            );

        // === SPECIAL SIZING CASES ===
        case ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE:
            return mssqlSizingViolationsToDriveTable(
                sizing,
                'logAccessPath',
                'databases.well-architect.log-drive-size-percentage',
                na,
                t
            );

        case ASSESSMENT_CONFIG_IDS.TEMPDB_DRIVE_SIZE:
            return mssqlSizingViolationsToDriveTable(
                sizing,
                'tempdbAccessPath',
                'databases.well-architect.tempdb-drive-size-percentage',
                na,
                t
            );

        // === FILE LOCATION CASES (complex grouping logic) ===
        case ASSESSMENT_CONFIG_IDS.DATA_FILES_MDF:
        case ASSESSMENT_CONFIG_IDS.LOG_FILES_LDF:
        case ASSESSMENT_CONFIG_IDS.TEMPDB_PLACEMENT: {
            const columns = [
                t('databases.well-architect.database-name'),
                t('databases.well-architect.current-value'),
                t('databases.well-architect.recommended-value'),
                t('databases.well-architect.drive-name'),
                t('databases.well-architect.lun-path')
            ];
            const topCurrent = data?.current ?? na;
            const topRecommended = data?.recommended ?? na;
            if (details.length > 0 && details.some(d => d.additionalInfo)) {
                const grouped = new Map<string, { drives: string[]; lunPaths: string[] }>();
                for (const detail of details) {
                    const dbName = String(detail?.value ?? na);
                    if (!grouped.has(dbName)) {
                        grouped.set(dbName, { drives: [], lunPaths: [] });
                    }
                    const entry = grouped.get(dbName)!;
                    if (detail?.additionalInfo?.driveLetter) entry.drives.push(detail.additionalInfo.driveLetter);
                    if (detail?.additionalInfo?.lunPath) entry.lunPaths.push(detail.additionalInfo.lunPath);
                }
                const rows = Array.from(grouped.entries()).map(([dbName, { drives, lunPaths }]) => [
                    dbName,
                    topCurrent,
                    topRecommended,
                    drives.join('|'),
                    lunPaths.join('|')
                ]);
                return { columns, rows, isExpandable: true };
            }
            const rows = objects.map((item: ObjectInViolation) => [
                typeof item === 'string' ? item : item?.databaseName || na,
                topCurrent,
                topRecommended,
                na,
                na
            ]);
            return ensureRows(columns, rows, na);
        }

        // === PATCH CASES (special data structure) ===
        case ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH:
        case ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH: {
            const columns = [
                t('databases.well-architect.kb-id'),
                t('databases.well-architect.name'),
                t('databases.well-architect.classification'),
                t('databases.well-architect.severity')
            ];
            const rows: string[][] = [];
            data?.missingPatchList?.forEach(instance => {
                (instance as PatchInstance)?.missingPatchDetails?.forEach(patch => {
                    rows.push([
                        patch?.kbId || na,
                        patch?.title || na,
                        patch?.classification || na,
                        patch?.severity || na
                    ]);
                });
            });
            return ensureRows(columns, rows, na);
        }

        // === SPECIAL ADAPTER/INTERFACE CASES ===
        case ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION:
            return mapRssAdaptersToTable(data, na, t);

        case ASSESSMENT_CONFIG_IDS.MTU:
            return mapMtuInterfacesToTable(data, na, t);

        // === SIMPLE VOLUME NAME ONLY CASES ===
        case ASSESSMENT_CONFIG_IDS.SCHEDULED_LOCAL_SNAPSHOT:
        case ASSESSMENT_CONFIG_IDS.CRR:
        case ASSESSMENT_CONFIG_IDS.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
            return mapObjectsToVolumeName(objects, na);

        // === GENERIC FALLBACK: Try registry-based mapping ===
        default: {
            const registryResult = mapGenericConfigFromRegistry(configName, data, na, t, DBType.MSSQL);
            if (registryResult) {
                return registryResult;
            }
            // Ultimate fallback for unmapped configs
            return { columns: [], rows: [] };
        }
    }
};

/**
 * Oracle flat API configs use internal API IDs (e.g. 'oracle-binary-placement').
 */
const getOracleImpactedResources = (configName: string, data: AssessmentData, na: string): ImpactedResourcesResult => {
    const details: ViolationDetail[] = data?.violationDetails || [];
    const objects: ObjectInViolation[] = data?.objectsInViolation || [];

    const oracleVolumeConfigWithValue = (valueName: string): ImpactedResourcesResult => {
        const columns = ['Volume name', valueName, 'Recommended value'];
        const rows = details.map(detail => [
            detail?.objectName || na,
            String(detail?.value ?? na),
            detail?.recommended || na
        ]);
        return ensureRows(columns, rows, na);
    };

    switch (configName) {
        // === SUB-CONFIG CASES (storage-efficiencies, etc.) ===
        case ASSESSMENT_CONFIG_IDS.STORAGE_EFFICIENCIES:
        case ASSESSMENT_CONFIG_IDS.TIERING_TCO_OPTIMIZATION:
            return mapSubConfigViolations(data, ['Volume name', 'Current', 'Recommended'], na);

        case ASSESSMENT_CONFIG_IDS.BLOCK_DEVICE_SPACE_MANAGEMENT:
            return mapSubConfigViolations(data, ['Object name', 'Current', 'Recommended'], na);

        // === ORACLE VOLUME CONFIGS (common pattern) ===
        case ASSESSMENT_CONFIG_IDS.THIN_PROVISIONING:
        case ASSESSMENT_CONFIG_IDS.SNAPSHOT_AUTODELETE:
        case ASSESSMENT_CONFIG_IDS.SPACE_MANAGEMENT:
        case ASSESSMENT_CONFIG_IDS.COMPACTION:
            return oracleVolumeConfigWithValue(configName);

        // === DNFS SPECIAL CASES (use nfsMount field) ===
        case ASSESSMENT_CONFIG_IDS.DNFS_CONFIGURATION_FILE: {
            const columns = ['NFS mount', 'Current dNFS configuration', 'Recommended dNFS configuration'];
            const rows = details.map(detail => [
                detail?.objectName || detail?.nfsMount || na,
                String(detail?.value ?? na),
                detail?.recommended || na
            ]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_IDS.DNFS_NO_SHARED_CACHE:
        case ASSESSMENT_CONFIG_IDS.NFS_MOUNT_OPTIONS_DATABASEFILES: {
            const columns = ['NFS mount', 'Current mount options', 'Recommended mount options'];
            const rows = details.map(detail => [
                detail?.objectName || detail?.nfsMount || na,
                String(detail?.value ?? na),
                detail?.recommended || na
            ]);
            return ensureRows(columns, rows, na);
        }

        // === PATCH CASES (special data structure) ===
        case ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH: {
            const columns = ['Component', 'Package name', 'Update type', 'Severity'];
            const rows: string[][] = [];
            data?.missingPatchList?.forEach(instance => {
                (instance as PatchInstance)?.missingPatchDetails?.forEach(patch => {
                    rows.push([
                        patch?.cveIds || na,
                        patch?.title || na,
                        patch?.classification || na,
                        patch?.severity || na
                    ]);
                });
            });
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH: {
            const columns = ['CVE ID', 'Component', 'Description', 'Published Date'];
            const rows: string[][] = [];
            data?.missingPatchList?.forEach(detail => {
                const patch = detail as OracleSecurityPatchDetail;
                rows.push([
                    patch?.cveId || na,
                    patch?.component || na,
                    patch?.description || na,
                    patch?.releaseDate || na
                ]);
            });
            return ensureRows(columns, rows, na);
        }

        // === PLACEMENT CONFIGS ===
        case ASSESSMENT_CONFIG_IDS.CRR:
        case ASSESSMENT_CONFIG_IDS.SNAPCENTER_SNAPSHOT:
        case ASSESSMENT_CONFIG_IDS.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
        case ASSESSMENT_CONFIG_IDS.ORACLE_BINARY_PLACEMENT:
        case ASSESSMENT_CONFIG_IDS.DATAFILES_PLACEMENT:
        case ASSESSMENT_CONFIG_IDS.CONTROLFILES_PLACEMENT:
        case ASSESSMENT_CONFIG_IDS.REDO_LOGS_PLACEMENT:
        case ASSESSMENT_CONFIG_IDS.TEMP_LOGS_PLACEMENT:
        case ASSESSMENT_CONFIG_IDS.ARCHIVE_PLACEMENT: {
            const columns = ['Volume name'];
            if (details.length > 0) {
                const rows = details.map(detail => [detail?.objectName || na]);
                return ensureRows(columns, rows, na);
            }
            const rows = objects.map((item: ObjectInViolation) => [
                typeof item === 'string' ? item : (item as ViolationVolume)?.ontapVolumeName || item?.objectName || na
            ]);
            return ensureRows(columns, rows, na);
        }

        // === INSTANCE-ONLY CONFIGS ===
        case ASSESSMENT_CONFIG_IDS.TRANSPARENT_HUGEPAGES:
        case ASSESSMENT_CONFIG_IDS.TCP_ADVANCED_OPTIONS:
        case ASSESSMENT_CONFIG_IDS.FILESYSTEMS_IO_OPTIONS:
        case ASSESSMENT_CONFIG_IDS.MULTIPATH_READCOUNT: {
            const columns = ['Instance ID'];
            const rows = objects.map((item: ObjectInViolation) => [typeof item === 'string' ? item : na]);
            return ensureRows(columns, rows, na);
        }

        // === GENERIC FALLBACK: Try registry-based mapping ===
        default: {
            const registryResult = mapGenericConfigFromRegistry(
                configName,
                data,
                na,
                (key: string) => key,
                DBType.ORACLE
            );
            if (registryResult) {
                return registryResult;
            }
            // Ultimate fallback for unmapped configs
            return { columns: [], rows: [] };
        }
    }
};

const renderTextCell = (cellData: unknown) => {
    const str = String(cellData ?? '');
    if (str.includes('\n')) {
        return (
            <div>
                {str.split('\n').map((line, i) => (
                    <DsTypography key={i} variant="Regular_14" className={styles.multiLineCellItem} title={line}>
                        {line}
                    </DsTypography>
                ))}
            </div>
        );
    }
    return (
        <DsTypography variant="Regular_14" className={styles.cellWrapper} title={str}>
            {str}
        </DsTypography>
    );
};

const buildRowData = (columns: string[], rows: string[][]): rowDataType[] =>
    rows.map((row, idx) => {
        const obj: Record<string, unknown> = { id: String(idx) };
        columns.forEach((name, colIdx) => {
            obj[name] = row[colIdx] ?? '';
        });
        return obj as rowDataType;
    });
const resolveImpactedResources = (
    configName: string,
    data: AssessmentData,
    na: string,
    t: (key: string) => string,
    engineType?: string
): ImpactedResourcesResult => {
    const resolver =
        engineType === DBType.MSSQL
            ? (name: string) => getMssqlImpactedResources(name, data, na, t)
            : (name: string) => getOracleImpactedResources(name, data, na);

    const result = resolver(configName);
    if (result.columns.length > 0) {
        return result;
    }

    return mapAssessmentViolations(data, configName, na, t, engineType);
};

const ImpactedResourceDialog = ({ data }: { data: AssessmentData }) => {
    const { t } = useTranslation();
    const { configEngineType } = useAppSelector(state => state.getWellOptimize);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const na = t('databases.general.unavailable');
    const normalizedData = normalizeImpactedResourceDialogData(data);
    // TODO: Fix this function it as part of dismiss workflow mirgration. use id or name instead of configurationName.
    const rawConfigName =
        normalizedData?.configurationName ?? normalizedData?.configObj?.configurationName ?? normalizedData?.name;

    const patchField = rawConfigName ? PATCH_CONFIG_FIELD_MAP[rawConfigName] : undefined;
    const isPatchConfig = Boolean(patchField);

    const hasPatchIds = Boolean(
        isPatchConfig && data?.credentialId && data?.regionId && data?.databaseHostId && data?.instanceId
    );
    const patchDbType =
        patchField === PATCH_SCAN_FIELD.MSSQL_PATCH || configEngineType !== DBType.ORACLE
            ? WIZARD_TYPE.MSSQL
            : WIZARD_TYPE.ORACLE;

    const { data: missingPatchResponse, isFetching: isMissingPatchLoading } = useGetMissingPatchAssessmentDataQuery(
        {
            dbType: patchDbType,
            credentialId: data?.credentialId,
            regionId: data?.regionId,
            databaseHostId: data?.databaseHostId,
            instanceId: data?.instanceId,
            field: patchField
        },
        { skip: !hasPatchIds || !patchField }
    );

    const dialogData: AssessmentData = useMemo(() => {
        if (!isPatchConfig || !patchField) return normalizedData;
        return {
            ...normalizedData,
            missingPatchList: extractMissingPatchList(
                patchField,
                missingPatchResponse as MissingPatchResponse | undefined
            )
        };
    }, [isPatchConfig, patchField, normalizedData, missingPatchResponse]);

    const { columns, rows, isExpandable } = resolveImpactedResources(
        rawConfigName ?? '',
        dialogData,
        na,
        t,
        configEngineType
    );

    const isLoading = isPatchConfig && isMissingPatchLoading;

    useInitialExpandedRowByIndex(rows, !!isExpandable, setExpandedRows);

    const toggleRow = useCallback(
        (idx: string | number) => toggleExpandedRow(idx as number, setExpandedRows, false),
        []
    );

    const expandableRowData = useMemo(() => {
        if (!isExpandable || isLoading) return [];
        // Row shape: [dbName, current, recommended, drives, lunPaths]
        const result: rowDataType[] = [];
        rows.forEach((row: string[], idx: number) => {
            const dbName = row[0];
            const currentVal = row[1] || na;
            const recommendedVal = row[2] || na;
            const drives = row[3]?.split('|') || [];
            const lunPaths = row[4]?.split('|') || [];
            const isMulti = drives.length > 1;
            const isExpanded = expandedRows.has(idx);

            result.push({
                id: String(idx),
                databaseName: dbName,
                current: currentVal,
                recommended: recommendedVal,
                drives: isMulti ? `${drives.length} ${t('databases.well-architect.drives')}` : drives[0] || na,
                luns: isMulti ? `${lunPaths.length} ${t('databases.well-architect.lun-paths')}` : lunPaths[0] || na,
                isMulti,
                isExpanded,
                isSubRow: false,
                parentIdx: idx
            } as rowDataType);

            if (isMulti && isExpanded) {
                drives.forEach((drive, subIdx) => {
                    result.push({
                        id: `${idx}-sub-${subIdx}`,
                        databaseName: '',
                        current: currentVal,
                        recommended: recommendedVal,
                        drives: drive,
                        luns: lunPaths[subIdx] || na,
                        isMulti: false,
                        isExpanded: false,
                        isSubRow: true,
                        parentIdx: idx
                    } as rowDataType);
                });
            }
        });
        return result;
    }, [isExpandable, isLoading, rows, expandedRows, t, na]);

    const expandableColumnProps = useMemo((): ColumnProps[] => {
        if (!isExpandable) return [];
        return [
            {
                Header: t('databases.well-architect.database-name'),
                accessor: 'databaseName',
                id: 'database',
                isSortable: true,
                width: 'auto',
                renderCell: (cellData: string, rowData: any) => {
                    if (rowData.isSubRow) return null;
                    return (
                        <DsTypography variant="Regular_14" className={styles.cellWrapper} title={cellData}>
                            {cellData}
                        </DsTypography>
                    );
                }
            },
            {
                Header: t('databases.well-architect.current-value'),
                accessor: 'current',
                id: 'current',
                isSortable: false,
                width: 'auto',
                renderCell: (cellData: string, rowData: any) => {
                    if (rowData.isSubRow) return null;
                    return (
                        <DsTypography variant="Regular_14" className={styles.cellWrapper} title={cellData}>
                            {cellData || na}
                        </DsTypography>
                    );
                }
            },
            {
                Header: t('databases.well-architect.recommended-value'),
                accessor: 'recommended',
                id: 'recommended',
                isSortable: false,
                width: 'auto',
                renderCell: (cellData: string, rowData: any) => {
                    if (rowData.isSubRow) return null;
                    return (
                        <DsTypography variant="Regular_14" className={styles.cellWrapper} title={cellData}>
                            {cellData || na}
                        </DsTypography>
                    );
                }
            },
            {
                Header: t('databases.well-architect.drive-name'),
                accessor: 'drives',
                id: 'drive',
                isSortable: true,
                width: 'auto',
                renderCell: (cellData: string) => (
                    <DsTypography variant="Regular_14" className={styles.cellWrapper} title={cellData}>
                        {cellData}
                    </DsTypography>
                )
            },
            {
                Header: t('databases.well-architect.lun-path'),
                accessor: 'luns',
                id: 'lun',
                isSortable: true,
                width: 'auto',
                renderCell: (cellData: string, rowData: any) => {
                    const showCopyIcon = rowData.isSubRow || !rowData.isMulti;
                    return (
                        <div className={styles.lunPathCellContainer}>
                            <DsTypography variant="Regular_14" className={commonStyles.lunPathCell} title={cellData}>
                                {cellData}
                            </DsTypography>
                            {showCopyIcon && (
                                <CopyToClipboardCommon
                                    value={cellData}
                                    iconProvided={<CopyIcon className={styles.copyIcon} />}
                                />
                            )}
                        </div>
                    );
                }
            },
            {
                Header: '',
                accessor: 'isMulti',
                id: 'chevron',
                isSortable: false,
                width: '48px',
                renderCell: (_cellData: unknown, rowData: any) =>
                    renderExpandableChevron({
                        rowData,
                        toggleRow,
                        commonStyles,
                        ArrowIcon,
                        useParentIdx: true
                    })
            }
        ];
    }, [isExpandable, columns, toggleRow, t, na]);

    const columnProps = useMemo(
        () => (isExpandable ? expandableColumnProps : buildColumnProps(columns, renderTextCell)),
        [isExpandable, expandableColumnProps, columns]
    );

    const rowData = useMemo(() => {
        if (isLoading) return [];
        return isExpandable ? expandableRowData : buildRowData(columns, rows);
    }, [isLoading, isExpandable, expandableRowData, columns, rows]);

    const tableComponentProps = getTableLazyLoadingComponentProps(t('databases.general.loading'));

    const tableProps = useTable({
        selectionType: 'none',
        isSorting: false,
        columns: columnProps,
        rows: rowData,
        pageSize: 100,
        isLazyLoading: isLoading
    });

    if (columns.length === 0) {
        return null;
    }

    return (
        <div className={styles.tableWrapper}>
            <Table // @ts-ignore
                tableProps={tableProps}
                {...tableComponentProps}
                variant="innerTable"
            />
        </div>
    );
};

export default ImpactedResourceDialog;
