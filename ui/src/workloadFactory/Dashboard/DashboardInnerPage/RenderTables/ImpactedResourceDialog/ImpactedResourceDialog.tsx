import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './ImpactedResourceDialog.module.scss';
import { ASSESSMENT_CONFIG_NAMES, DBType } from '../../../../../utils/consts';
import { useAppSelector } from '../../../../../store/storeHooks';

interface ViolationDetail {
    objectName?: string;
    value?: string | number;
    objectType?: string;
    recommended?: string;
    recommendedValue?: string;
    nfsMount?: string;
    dataCategory?: string;
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
}

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
const getMssqlImpactedResources = (configName: string, data: AssessmentData, na: string): ImpactedResourcesResult => {
    const details: ViolationDetail[] = data?.violationDetails || [];
    const objects: ObjectInViolation[] = data?.objectsInViolation || [];
    const sizing: SizingViolations = data?.sizingViolations || {};

    switch (configName) {
        case 'performance-tier': {
            const columns = ['Volume name', 'SSD storage tier'];
            const rows = details.map(detail => [
                detail?.objectName || na,
                detail?.value != null ? `${detail.value}%` : na
            ]);
            return ensureRows(columns, rows, na);
        }

        case 'log-drive-size': {
            const columns = ['Drive name', 'Databases', 'Status', 'Log drive size percentage'];
            const overDrives = (sizing?.overProvisionedDrives || []).map((drive: SizingDrive) => [
                drive?.logAccessPath || na,
                (drive?.databases || []).join(', ') || na,
                'Over provisioned',
                drive?.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : na
            ]);
            const underDrives = (sizing?.underProvisionedDrives || []).map((drive: SizingDrive) => [
                drive?.logAccessPath || na,
                (drive?.databases || []).join(', ') || na,
                'Under provisioned',
                drive?.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : na
            ]);
            return ensureRows(columns, [...overDrives, ...underDrives], na);
        }

        case 'data-files-location':
        case 'log-files-location': {
            const columns = ['Database name'];
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
            const columns = ['LUN name', 'OS type'];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING:
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE:
        case ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE:
        case ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT:
            return mapDetailsToSingleCol(details, objects, 'Volume name', na);

        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE: {
            const columns = ['Volume name', ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE: {
            const columns = ['Volume name', ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE];
            const rows = details.map(detail => [
                detail?.objectName || na,
                detail?.value != null ? `${detail.value}%` : na
            ]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.TIERING_POLICY: {
            const columns = ['Volume name', ASSESSMENT_CONFIG_NAMES.TIERING_POLICY];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS: {
            const columns = ['Volume name', ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION:
        case ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION:
            return mapDetailsToSingleCol(details, objects, 'LUN name', na);

        case ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE: {
            const columns = ['Drive name', ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_POLICY: {
            const columns = ['Drive name', 'Policy'];
            const rows = details.map(detail => [detail?.objectName || na, String(detail?.value ?? na)]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER: {
            const columns = ['LUN name'];
            const rows = details.map(detail => [detail?.objectName || na]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE: {
            const columns = ['LUN name'];
            const rows = objects.map((item: ObjectInViolation) => [typeof item === 'string' ? item : na]);
            return ensureRows(columns, rows, na);
        }

        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
        case ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH: {
            const columns = ['KB', 'Name', 'Classification', 'Severity'];
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

        default:
            return { columns: [], rows: [] };
    }
};

const ImpactedResourceDialog = ({ data }: { data: AssessmentData }) => {
    const { t } = useTranslation();
    const { configEngineType } = useAppSelector(state => state.getWellOptimize);

    const na = t('databases.general.not-available');
    const configName = data?.configurationName ?? data?.configObj?.configurationName ?? data?.name;

    const { columns, rows } =
        configEngineType === DBType.MSSQL
            ? getMssqlImpactedResources(configName || '', data, na)
            : getOracleImpactedResources(configName || '', data, na);

    if (columns.length === 0) {
        return null;
    }

    const colCount = columns.length;
    const colStyle: React.CSSProperties = {
        minWidth: colCount === 1 ? '500px' : '180px'
    };

    return (
        <div className={styles.tableWrapper}>
            <div className={styles.tableRow}>
                {columns.map(name => (
                    <DsTypography key={name} variant="Semibold_14" className={styles.tableCell} style={colStyle}>
                        {name}
                    </DsTypography>
                ))}
            </div>
            <div className={styles.tableBody}>
                {rows.map((row, rowIdx) => (
                    <div key={rowIdx} className={styles.tableRow}>
                        {row.map((value, colIdx) => (
                            <DsTypography
                                key={colIdx}
                                variant="Regular_14"
                                className={styles.tableCell}
                                style={colStyle}
                                title={value}
                            >
                                {value}
                            </DsTypography>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ImpactedResourceDialog;
