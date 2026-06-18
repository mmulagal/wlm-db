import { TFunction } from 'i18next';
import { Button } from '@netapp/design-system';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { ASSESSMENT_CONFIG_IDS, SQL_SERVER_EDITION_LABELS } from '../../../../utils/consts';
import { GwSqlServerInstanceInterface, RSSConfigAdapterInterface } from '../../../../utils/types/getWellTypes';
import { createDashboardTableConfig, resolveConfigTypeId } from '../../../WellArchitectedTab/assessmentFormatUtils';
import { isFixTableImpactedViewSupported } from './ImpactedResourceDialog/impactedResourceViewConfig';

interface ConfigTableRowData {
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    configState?: string;
    configurationName?: string;
    name?: string;
    [key: string]: unknown;
}

type HandleImpactedResourceDialog = (rowData: ConfigTableRowData) => void;

const FIX_UNSUPPORTED_CONFIG_IDS = new Set<string>([
    ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH,
    ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH,
    ASSESSMENT_CONFIG_IDS.LICENSE,
    ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH,
    ASSESSMENT_CONFIG_IDS.ORACLE_BINARY_PLACEMENT,
    ASSESSMENT_CONFIG_IDS.DATAFILES_PLACEMENT,
    ASSESSMENT_CONFIG_IDS.CONTROLFILES_PLACEMENT,
    ASSESSMENT_CONFIG_IDS.REDO_LOGS_PLACEMENT,
    ASSESSMENT_CONFIG_IDS.TEMP_LOGS_PLACEMENT,
    ASSESSMENT_CONFIG_IDS.ARCHIVE_PLACEMENT,
    ASSESSMENT_CONFIG_IDS.TRANSPARENT_HUGEPAGES,
    ASSESSMENT_CONFIG_IDS.TCP_ADVANCED_OPTIONS,
    ASSESSMENT_CONFIG_IDS.FILESYSTEMS_IO_OPTIONS,
    ASSESSMENT_CONFIG_IDS.MULTIPATH_READCOUNT
]);

export const ORACLE_ISCSI_ONLY_CONFIG_IDS = new Set<string>([
    ASSESSMENT_CONFIG_IDS.TRANSPARENT_HUGEPAGES,
    ASSESSMENT_CONFIG_IDS.TCP_ADVANCED_OPTIONS,
    ASSESSMENT_CONFIG_IDS.FILESYSTEMS_IO_OPTIONS,
    ASSESSMENT_CONFIG_IDS.MULTIPATH_READCOUNT
]);

const countHostOsMissingPatches = (ec2InstancesToPatch: any[] | undefined): number => {
    let totalPatches = 0;
    ec2InstancesToPatch?.forEach((instance: any) => {
        totalPatches += instance?.criticalNonCompliantCount || 0;
        totalPatches += instance?.securityNonCompliantCount || 0;
        totalPatches += instance?.otherNonCompliantCount || 0;
    });
    return totalPatches;
};

const countMssqlMissingPatches = (
    instances: Array<{ criticalMissingPatchesCount?: number; importantMissingPatchesCount?: number }> = []
) => {
    let totalPatches = 0;
    instances.forEach(perInstance => {
        totalPatches += perInstance?.criticalMissingPatchesCount || 0;
        totalPatches += perInstance?.importantMissingPatchesCount || 0;
    });
    return totalPatches;
};

const getLicenseEditionLabel = (item: any, instanceData: any) => {
    const instance = item?.sqlServerInstances?.find(
        (sqlInstance: GwSqlServerInstanceInterface) =>
            sqlInstance?.sqlServerInstance === instanceData?.databaseInstanceName
    );
    const selectedDatabaseLicense = instance?.sqlServerEdition || '';
    if (selectedDatabaseLicense.includes(SQL_SERVER_EDITION_LABELS.STANDARD)) {
        return SQL_SERVER_EDITION_LABELS.STANDARD;
    }
    if (selectedDatabaseLicense.includes(SQL_SERVER_EDITION_LABELS.ENTERPRISE)) {
        return SQL_SERVER_EDITION_LABELS.ENTERPRISE;
    }
    if (selectedDatabaseLicense.includes(SQL_SERVER_EDITION_LABELS.DEVELOPER)) {
        return SQL_SERVER_EDITION_LABELS.DEVELOPER;
    }
    return selectedDatabaseLicense;
};

const countNonOptimizedRssAdapters = (obj: any) => {
    let nonOptimizedAdapters = 0;
    obj?.rssAdapters?.forEach((adapter: RSSConfigAdapterInterface) => {
        if (!adapter?.rssEnabled) {
            nonOptimizedAdapters += 1;
        } else if (
            adapter?.rssProfile !== obj?.recommendedAdapterSettings?.recommendedRssProfile ||
            adapter?.baseProcessorNumber !== obj?.recommendedAdapterSettings?.recommendedBaseProcessorNumber ||
            adapter?.numberOfReceiveQueues !== obj?.recommendedAdapterSettings?.recommendedReceiveQueues
        ) {
            nonOptimizedAdapters += 1;
        }
    });
    return nonOptimizedAdapters;
};

export const renderCountWithView = (
    configNameOverride: string,
    cellData: string,
    rowData: ConfigTableRowData,
    t: TFunction,
    handleImpactedResourceDialog: HandleImpactedResourceDialog,
    showView = true
) => {
    const count = Number(cellData) || 0;
    return (
        <div className={CommonStyles.impactedDrivesCell}>
            {cellData != null && String(cellData) !== ''
                ? cellData
                : t('databases.general.not-available-table-columns')}
            {showView && count > 0 && (
                <Button
                    variant="text"
                    onClick={() =>
                        handleImpactedResourceDialog({
                            ...rowData,
                            configurationName: configNameOverride
                        })
                    }
                >
                    {t('databases.dashboard.view')}
                </Button>
            )}
        </div>
    );
};

const createCountWithViewColumn = (
    headerKey: string,
    configId: string,
    engineType: string,
    configNameOverride?: string
) => {
    const showView = isFixTableImpactedViewSupported(configId, engineType);
    const dialogConfigName = configNameOverride ?? configId;

    return {
        Header: headerKey,
        accessor: 'totalObjectsInViolation',
        id: '4',
        width: '220px',
        renderCell: (
            cellData: string,
            rowData: ConfigTableRowData,
            t: TFunction,
            handleImpactedResourceDialog: HandleImpactedResourceDialog
        ) => (
            <div className={CommonStyles.impactedDrivesCell}>
                {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                {showView && (rowData?.totalObjectsInViolation ?? 0) > 0 && (
                    <Button
                        variant="text"
                        onClick={() =>
                            handleImpactedResourceDialog({
                                ...rowData,
                                configurationName: dialogConfigName
                            })
                        }
                    >
                        {t('databases.dashboard.view')}
                    </Button>
                )}
            </div>
        )
    };
};

const createImpactedNetworkAdaptersColumn = (configId: string, engineType: string) =>
    createCountWithViewColumn(
        'databases.well-architect.dashboard-table-headers.impacted-network-adapters',
        configId,
        engineType
    );

const CONFIG_IMPACTED_COLUMN_HEADERS: Record<string, string> = {
    // Storage layout (MSSQL)
    [ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE]: 'databases.well-architect.dashboard-table-headers.impacted-drives',
    [ASSESSMENT_CONFIG_IDS.TEMPDB_DRIVE_SIZE]: 'databases.well-architect.dashboard-table-headers.impacted-drives',
    [ASSESSMENT_CONFIG_IDS.DATA_FILES_MDF]: 'databases.well-architect.dashboard-table-headers.impacted-databases',
    [ASSESSMENT_CONFIG_IDS.LOG_FILES_LDF]: 'databases.well-architect.dashboard-table-headers.impacted-databases',
    [ASSESSMENT_CONFIG_IDS.TEMPDB_PLACEMENT]: 'databases.well-architect.dashboard-table-headers.impacted-databases',
    [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: 'databases.well-architect.dashboard-table-headers.impacted-databases',
    // MSSQL OS-level (formerly nested under Operating system group)
    [ASSESSMENT_CONFIG_IDS.MULTIPATH_IO_STATUS]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.MPIO_ISCSI_COUNT]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.MULTIPATH_IO_POLICY]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.MULTIPATH_IO_TIMEOUT]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.NTFS_ALLOCATION_UNIT_SIZE]:
        'databases.well-architect.dashboard-table-headers.impacted-resources',
    // MSSQL HA (formerly nested under High Availability group)
    [ASSESSMENT_CONFIG_IDS.SHARED_STORAGE]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.CLUSTER_QUORUM]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.DRIVE_LETTER]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.HEARTBEAT_SETTINGS]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.SQL_SERVER_SERVICE]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    // Oracle EC2-level (formerly nested under storage.configuration.os[])
    [ASSESSMENT_CONFIG_IDS.MULTIPATH_CONFIGURATION]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.KERNEL_PARAMETERS]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.NFS_MOUNT_OPTIONS_DATABASEFILES]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.NFS_MOUNT_OPTIONS_ADRHOME]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.NFS_CACHING_OPTIONS]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.NFSV4_DOMAIN_NAME]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.ASM_SETUP]: 'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.AFD_LOGICAL_BLOCK_SIZE]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.ASMLIB_LOGICAL_BLOCK_SIZE]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.DNFS_CONSISTENT_IP_RESOLUTION]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.DNFS_ENABLEMENT]: 'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.DNFS_CONFIGURATION_FILE]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.DNFS_NO_SHARED_CACHE]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    // Oracle OS-level with no specific resourceType
    [ASSESSMENT_CONFIG_IDS.MULTIPATH_IO]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.HOST_UTILITIES]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.SELINUX]: 'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.ISCSI_REPLACEMENT_TIMEOUT]:
        'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.MULTIPATH_FRIENDLY_NAMES]:
        'databases.well-architect.dashboard-table-headers.impacted-resources',
    [ASSESSMENT_CONFIG_IDS.ASM_EXTERNAL_REDUNDANCY]:
        'databases.well-architect.dashboard-table-headers.impacted-resources',
    // Oracle EC2 instances (future configs)
    [ASSESSMENT_CONFIG_IDS.TRANSPARENT_HUGEPAGES]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.TCP_ADVANCED_OPTIONS]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.FILESYSTEMS_IO_OPTIONS]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances',
    [ASSESSMENT_CONFIG_IDS.MULTIPATH_READCOUNT]:
        'databases.well-architect.dashboard-table-headers.impacted-ec2-instances'
};

const createDefaultImpactedColumn = (configId: string, engineType: string) => {
    const headerKey =
        CONFIG_IMPACTED_COLUMN_HEADERS[configId] || 'databases.well-architect.dashboard-table-headers.impacted-volumes';
    return createCountWithViewColumn(headerKey, configId, engineType);
};

const createMissingPatchesColumn = (configId: string, engineType: string) => ({
    Header: 'databases.well-architect.dashboard-table-headers.missing-patches',
    accessor: 'current',
    id: '4',
    width: '200px',
    renderCell: (
        cellData: string,
        rowData: ConfigTableRowData,
        t: TFunction,
        handleImpactedResourceDialog: HandleImpactedResourceDialog
    ) =>
        renderCountWithView(
            configId,
            cellData,
            rowData,
            t,
            handleImpactedResourceDialog,
            isFixTableImpactedViewSupported(configId, engineType)
        )
});

const createDashboardTableConfigOverrides = (
    engineType: string
): Record<string, Partial<ReturnType<typeof createDashboardTableConfig>>> => ({
    [ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH]: {
        dataMapping: (item: any) => ({
            current: `${countHostOsMissingPatches(item?.ec2InstancesToPatch)}`,
            totalObjectsAssessed: item?.totalObjectsAssessed,
            totalObjectsInViolation: item?.totalObjectsInViolation,
            violationDetails: item?.violationDetails || [],
            objectsInViolation: item?.objectsInViolation || [],
            configurationName: item?.id,
            configItem: item
        }),
        customColumns: [createMissingPatchesColumn(ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH, engineType)]
    },
    [ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH]: {
        dataMapping: (item: any) => ({
            current: countMssqlMissingPatches(item?.missingPatchesInEc2Instances),
            totalObjectsAssessed: item?.totalObjectsAssessed,
            totalObjectsInViolation: item?.totalObjectsInViolation,
            violationDetails: item?.violationDetails || [],
            objectsInViolation: item?.objectsInViolation || [],
            configurationName: item?.id,
            configItem: item
        }),
        customColumns: [createMissingPatchesColumn(ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH, engineType)]
    },
    [ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH]: {
        dataMapping: (item: any) => ({
            current: `${countHostOsMissingPatches(item?.ec2InstancesToPatch)}`,
            totalObjectsAssessed: item?.totalObjectsAssessed,
            totalObjectsInViolation: item?.totalObjectsInViolation,
            violationDetails: item?.violationDetails || [],
            objectsInViolation: item?.objectsInViolation || [],
            configurationName: item?.id,
            configItem: item
        }),
        customColumns: [createMissingPatchesColumn(ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH, engineType)]
    },
    [ASSESSMENT_CONFIG_IDS.LICENSE]: {
        dataMapping: (item: any, instanceData: any) => ({
            current: getLicenseEditionLabel(item, instanceData),
            configurationName: ASSESSMENT_CONFIG_IDS.LICENSE,
            configItem: item
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.license-edition',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_IDS.COMPUTE_RIGHTSIZING]: {
        dataMapping: (item: any) => ({
            findingReasons: `${item?.objectsInViolation?.length || 0} Findings`,
            recommendationOptions: item?.recommendationOptions,
            isMissingPermissions: item?.errorMessage?.includes('is not authorized to perform: ') || false,
            configurationName: ASSESSMENT_CONFIG_IDS.COMPUTE_RIGHTSIZING,
            configItem: item
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.finding-reasons',
                accessor: 'findingReasons',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION]: {
        dataMapping: (item: any) => {
            const nonOptimizedAdapters = countNonOptimizedRssAdapters(item);
            return {
                totalObjectsAssessed: item?.rssAdapters?.length || 0,
                totalObjectsInViolation: nonOptimizedAdapters,
                networkAdapters: item?.rssAdapters?.map((adapter: RSSConfigAdapterInterface) => adapter?.adapterName),
                rssAdapters: item?.rssAdapters,
                recommendedAdapterSettings: item?.recommendedAdapterSettings,
                tcpOffloadState: item?.tcpOffloadState,
                violationDetails: item?.violationDetails || [],
                objectsInViolation: item?.objectsInViolation || [],
                configurationName: ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION,
                configItem: item
            };
        },
        customColumns: [createImpactedNetworkAdaptersColumn(ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION, engineType)]
    },
    [ASSESSMENT_CONFIG_IDS.MTU]: {
        dataMapping: (item: any) => ({
            current: item?.current,
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || 0,
            objectsInViolation: item?.objectsInViolation || [],
            violationDetails: item?.violationDetails || [],
            ec2InterfacesToFix: item?.ec2InterfacesToFix,
            configurationName: ASSESSMENT_CONFIG_IDS.MTU,
            configItem: item
        }),
        customColumns: [
            createCountWithViewColumn(
                'databases.well-architect.dashboard-table-headers.network-interface',
                ASSESSMENT_CONFIG_IDS.MTU,
                engineType
            )
        ]
    },
    [ASSESSMENT_CONFIG_IDS.MAXDOP]: {
        dataMapping: (item: any) => ({
            current: item?.current,
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || 0,
            configurationName: ASSESSMENT_CONFIG_IDS.MAXDOP,
            configItem: item
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.maxdop-value',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM]: {
        dataMapping: (item: any) => ({
            current: item?.current,
            recommended: item?.recommended,
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || 0,
            violationDetails: item?.violationDetails || [],
            objectsInViolation: item?.objectsInViolation || [],
            configurationName: ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM,
            configItem: item
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.current-value',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_IDS.SWAP_SPACE]: {
        dataMapping: (item: any) => ({
            current: item?.current,
            recommended: item?.recommended,
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || 0,
            violationDetails: item?.violationDetails || [],
            objectsInViolation: item?.objectsInViolation || [],
            configurationName: ASSESSMENT_CONFIG_IDS.SWAP_SPACE,
            configItem: item
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.swap-space',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: {
        dataMapping: (item: any) => ({
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || 0,
            objectsInViolation: item?.objectsInViolation || [],
            cloneDetails: item?.cloneDetails,
            tags: item?.tags ?? item?.categories,
            severity: item?.severity,
            configurationName: ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT,
            configItem: item
        }),
        customColumns: [createDefaultImpactedColumn(ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT, engineType)]
    }
});

export const resolveDashboardTableConfig = (configType: string, engineType: string) => {
    const configId = resolveConfigTypeId(configType);
    const base = createDashboardTableConfig(configId);
    if (FIX_UNSUPPORTED_CONFIG_IDS.has(configId)) {
        base.isFixSupported = false;
    }
    const override = createDashboardTableConfigOverrides(engineType)[configId];
    const defaultColumn = createDefaultImpactedColumn(configId, engineType);
    if (!override) {
        return {
            ...base,
            customColumns: [defaultColumn]
        };
    }
    return {
        ...base,
        ...override,
        customColumns: override.customColumns ?? [defaultColumn],
        dataMapping: override.dataMapping ?? base.dataMapping
    };
};
