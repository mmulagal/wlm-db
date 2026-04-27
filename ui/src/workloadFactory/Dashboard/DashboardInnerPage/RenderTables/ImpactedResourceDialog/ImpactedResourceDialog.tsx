import { DsTypography } from '@tlveng/wlm-ds';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnProps, Table } from '@netapp/design-system/dist/components/Table';
import styles from './ImpactedResourceDialog.module.scss';
import { ASSESSMENT_CONFIG_NAMES, DBType, PATCH_SCAN_FIELD, WIZARD_TYPE } from '../../../../../utils/consts';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useGetMissingPatchAssessmentDataQuery } from '../../../../../utils/apiService';
import { useTable, rowDataType } from '../../../../../common/Lib/Table/useTable';

interface ViolationDetail {
    objectName?: string;
    value?: string | number;
    objectType?: string;
    recommended?: string;
    recommendedValue?: string;
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

interface AssessmentData {
    violationDetails?: ViolationDetail[];
    objectsInViolation?: ObjectInViolation[];
    sizingViolations?: SizingViolations;
    configurationName?: string;
    configObj?: { configurationName?: string };
    name?: string;
    missingPatchList?: (PatchInstance | OracleSecurityPatchDetail)[];
    credentialId?: string;
    regionId?: string;
    databaseHostId?: string;
    instanceId?: string;
}

type PatchScanField = (typeof PATCH_SCAN_FIELD)[keyof typeof PATCH_SCAN_FIELD];

// Maps ASSESSMENT_CONFIG_NAMES display names to the `field` query param expected
// by the patch-scan assessment API for patch-type configurations.
const PATCH_CONFIG_FIELD_MAP: Record<string, PatchScanField> = {
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]: PATCH_SCAN_FIELD.HOST_OS_PATCH,
    [ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]: PATCH_SCAN_FIELD.MSSQL_PATCH,
    [ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH]: PATCH_SCAN_FIELD.ORACLE_SECURITY_PATCH
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
        typeof item === 'string' ? item : item?.ontapVolumeName || na
    ]);
    return ensureRows(columns, rows, na);
};

/**
 * MSSQL config names arrive from two sources:
 * - DashboardConfigsTable sets internal names: 'performance-tier', 'log-drive-size', etc.
 * - RecommendationTable passes display names matching ASSESSMENT_CONFIG_NAMES values.
 * Both formats are handled here.
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
        case 'performance-tier': {
            const columns = [t('databases.well-architect.volume-name'), t('databases.well-architect.ssd-storage-tier')];
            const rows = details.map(detail => [
                detail?.objectName || na,
                detail?.value != null ? `${detail.value}%` : na
            ]);
            return ensureRows(columns, rows, na);
        }

        case 'log-drive-size': {
            const columns = [
                t('databases.well-architect.drive-name'),
                t('databases.well-architect.lun-path'),
                t('databases.well-architect.databases'),
                t('databases.well-architect.status'),
                t('databases.well-architect.log-drive-size-percentage')
            ];
            const overDrives = (sizing?.overProvisionedDrives || []).map((drive: SizingDrive) => [
                drive?.logAccessPath || na,
                drive?.lunPath || na,
                (drive?.databases || []).join(', ') || na,
                t('databases.well-architect.over-provisioned'),
                drive?.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : na
            ]);
            const underDrives = (sizing?.underProvisionedDrives || []).map((drive: SizingDrive) => [
                drive?.logAccessPath || na,
                drive?.lunPath || na,
                (drive?.databases || []).join(', ') || na,
                t('databases.well-architect.under-provisioned'),
                drive?.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : na
            ]);
            return ensureRows(columns, [...overDrives, ...underDrives], na);
        }

        case 'tempdb-drive-size': {
            const columns = [
                t('databases.well-architect.drive-name'),
                t('databases.well-architect.lun-path'),
                t('databases.well-architect.databases'),
                t('databases.well-architect.status'),
                t('databases.well-architect.tempdb-drive-size-percentage')
            ];
            const overDrives = (sizing?.overProvisionedDrives || []).map((drive: SizingDrive) => [
                drive?.tempdbAccessPath || na,
                drive?.lunPath || na,
                (drive?.databases || []).join(', ') || na,
                t('databases.well-architect.over-provisioned'),
                drive?.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : na
            ]);
            const underDrives = (sizing?.underProvisionedDrives || []).map((drive: SizingDrive) => [
                drive?.tempdbAccessPath || na,
                drive?.lunPath || na,
                (drive?.databases || []).join(', ') || na,
                t('databases.well-architect.under-provisioned'),
                drive?.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : na
            ]);
            return ensureRows(columns, [...overDrives, ...underDrives], na);
        }

        case 'data-files-location':
        case 'log-files-location':
        case 'tempdb-files-location': {
            if (details.length > 0 && details.some(d => d.additionalInfo)) {
                const columns = [
                    t('databases.well-architect.database-name'),
                    t('databases.well-architect.drive-name'),
                    t('databases.well-architect.lun-path')
                ];
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
                    drives.length > 0 ? drives.join('\n') : na,
                    lunPaths.length > 0 ? lunPaths.join('\n') : na
                ]);
                return ensureRows(columns, rows, na);
            }
            const columns = [t('databases.well-architect.database-name')];
            const rows = objects.map((item: ObjectInViolation) => [
                typeof item === 'string' ? item : item?.databaseName || na
            ]);
            return ensureRows(columns, rows, na);
        }

        case 'snapshot-policy':
        case 'crr':
        case 'backup-configuration':
            return mapObjectsToVolumeName(objects, na);

        case ASSESSMENT_CONFIG_NAMES.OS_TYPE: {
            const columns = [t('databases.well-architect.lun-name'), t('databases.well-architect.os-type')];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING:
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE:
        case ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE:
        case ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT:
            return mapDetailsToSingleCol(details, objects, t('databases.well-architect.volume-name'), na);

        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE: {
            const columns = [t('databases.well-architect.volume-name'), ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE: {
            const columns = [t('databases.well-architect.volume-name'), ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE];
            const rows = details.map(detail => [
                detail?.objectName || na,
                detail?.value != null ? `${detail.value}%` : na
            ]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.TIERING_POLICY: {
            const columns = [t('databases.well-architect.volume-name'), ASSESSMENT_CONFIG_NAMES.TIERING_POLICY];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS: {
            const columns = [
                t('databases.well-architect.volume-name'),
                ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS
            ];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION:
        case ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION:
            return mapDetailsToSingleCol(details, objects, t('databases.well-architect.lun-name'), na);

        case ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE: {
            const columns = [
                t('databases.well-architect.drive-name'),
                ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE
            ];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_POLICY: {
            const columns = [t('databases.well-architect.drive-name'), t('databases.well-architect.policy')];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER: {
            const columns = [t('databases.well-architect.lun-name')];
            const rows = details.map(detail => [detail?.objectName || na]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE: {
            const columns = [t('databases.well-architect.lun-name')];
            const rows = objects.map((item: ObjectInViolation) => [typeof item === 'string' ? item : na]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
        case ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH: {
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

        default:
            return { columns: [], rows: [] };
    }
};

/**
 * Oracle config names arrive from RecommendationTable as display names matching
 * ASSESSMENT_CONFIG_NAMES, except placement configs which use internal API names
 * (e.g. 'oracle-binary-placement' instead of 'Oracle binary placement').
 */
const getOracleImpactedResources = (configName: string, data: AssessmentData, na: string): ImpactedResourcesResult => {
    const details: ViolationDetail[] = data?.violationDetails || [];
    const objects: ObjectInViolation[] = data?.objectsInViolation || [];

    const oracleVolumeConfigWithValue = (valueName: string): ImpactedResourcesResult => {
        const columns = ['Volume name', valueName, 'Recommended value'];
        const rows = details.map(detail => [
            detail?.objectName || na,
            String(detail?.value ?? na),
            detail?.recommended || detail?.recommendedValue || na
        ]);
        return ensureRows(columns, rows, na);
    };

    switch (configName) {
        case ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING:
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE:
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE:
        case ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE:
        case ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT:
        case ASSESSMENT_CONFIG_NAMES.TIERING_POLICY:
        case ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS:
        case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
        case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
        case ASSESSMENT_CONFIG_NAMES.COMPACTION:
        case ASSESSMENT_CONFIG_NAMES.NFS_ROOTONLY:
        case ASSESSMENT_CONFIG_NAMES.EXPORT_POLICY:
            return oracleVolumeConfigWithValue(configName);

        case ASSESSMENT_CONFIG_NAMES.OS_TYPE: {
            const columns = ['LUN name', 'OS type', 'Recommended value'];
            const rows = details.map(detail => [
                detail?.objectName || na,
                String(detail?.value ?? na),
                detail?.recommended || na
            ]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION:
        case ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION: {
            const columns = ['LUN name', configName, 'Recommended value'];
            const rows = details.map(detail => [
                detail?.objectName || na,
                String(detail?.value ?? na),
                detail?.recommended || na
            ]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE: {
            const columns = ['NFS mount', 'Current dNFS configuration', 'Recommended dNFS configuration'];
            const rows = details.map(detail => [
                detail?.objectName || detail?.nfsMount || na,
                String(detail?.value ?? na),
                detail?.recommended || na
            ]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE:
        case ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES: {
            const columns = ['NFS mount', 'Current mount options', 'Recommended mount options'];
            const rows = details.map(detail => [
                detail?.objectName || detail?.nfsMount || na,
                String(detail?.value ?? na),
                detail?.recommended || na
            ]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH: {
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

        case ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH: {
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

        // placement configs use internal API names, not ASSESSMENT_CONFIG_NAMES display names
        case 'crr':
        case 'snapcenter-snapshot':
        case 'backup-configuration':
        case 'oracle-binary-placement':
        case 'datafiles-placement':
        case 'controlfiles-placement':
        case 'redologs-placement':
        case 'templogs-placement':
        case 'archive-placement': {
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
        case ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES:
        case ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS:
        case ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS:
        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT: {
            const columns = ['Instance ID'];
            const rows = objects.map((item: ObjectInViolation) => [typeof item === 'string' ? item : na]);
            return ensureRows(columns, rows, na);
        }
        default:
            return { columns: [], rows: [] };
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

const buildColumnProps = (columns: string[]): ColumnProps[] =>
    columns.map((name, idx) => ({
        Header: name,
        accessor: name,
        id: `col-${idx}`,
        isSortable: true,
        width: 'auto',
        renderCell: renderTextCell
    }));

const buildRowData = (columns: string[], rows: string[][]): rowDataType[] =>
    rows.map((row, idx) => {
        const obj: Record<string, unknown> = { id: String(idx) };
        columns.forEach((name, colIdx) => {
            obj[name] = row[colIdx] ?? '';
        });
        return obj as rowDataType;
    });

const ImpactedResourceDialog = ({ data }: { data: AssessmentData }) => {
    const { t } = useTranslation();
    const { configEngineType } = useAppSelector(state => state.getWellOptimize);

    const na = t('databases.general.not-available');
    const configName = data?.configurationName ?? data?.configObj?.configurationName ?? data?.name;

    const patchField = configName ? PATCH_CONFIG_FIELD_MAP[configName] : undefined;
    const isPatchConfig = Boolean(patchField);

    const hasPatchIds = Boolean(
        isPatchConfig && data?.credentialId && data?.regionId && data?.databaseHostId && data?.instanceId
    );
    const patchDbType =
        patchField === PATCH_SCAN_FIELD.MSSQL_PATCH
            ? WIZARD_TYPE.MSSQL
            : configEngineType === DBType.ORACLE
            ? WIZARD_TYPE.ORACLE
            : WIZARD_TYPE.MSSQL;

    // Patch configs no longer include missingPatchDetails inline; fetch them on demand
    // when the dialog is opened so the table can render loader → rows.
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
        if (!isPatchConfig || !patchField) return data;
        return {
            ...data,
            missingPatchList: extractMissingPatchList(
                patchField,
                missingPatchResponse as MissingPatchResponse | undefined
            )
        };
    }, [isPatchConfig, patchField, data, missingPatchResponse]);

    const { columns, rows } =
        configEngineType === DBType.MSSQL
            ? getMssqlImpactedResources(configName || '', dialogData, na, t)
            : getOracleImpactedResources(configName || '', dialogData, na);

    const isLoading = isPatchConfig && isMissingPatchLoading;

    const columnProps = useMemo(() => buildColumnProps(columns), [columns]);

    const rowData = useMemo(() => (isLoading ? [] : buildRowData(columns, rows)), [isLoading, columns, rows]);

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
                variant="innerTable"
            />
        </div>
    );
};

export default ImpactedResourceDialog;
