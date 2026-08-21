import { TFunction } from 'i18next';
import { Button, Popover } from '@netapp/design-system';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { ASSESSMENT_CONFIG_IDS, ONLINE_INSTANCE_STATUSES, SQL_SERVER_EDITION_LABELS } from '../../../../utils/consts';
import { GwSqlServerInstanceInterface, RSSConfigAdapterInterface } from '../../../../utils/types/getWellTypes';
import { createDashboardTableConfig, resolveConfigTypeId } from '../../../WellArchitectedTab/assessmentFormatUtils';
import { getConfigEntry } from '../../../../utils/configRegistry/configRegistryHelper';
import { isFixTableImpactedViewSupported } from './ImpactedResourceDialog/impactedResourceViewConfig';
import { resolveImpactedColumnHeader } from './ImpactedResourceDialog/impactedResourceHeaderUtils';

interface ConfigTableRowData {
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    configState?: string;
    configurationName?: string;
    name?: string;
    [key: string]: unknown;
}

export type HandleImpactedResourceDialog = (rowData: ConfigTableRowData) => void;

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
    const statusLower = typeof rowData?.status === 'string' ? rowData.status.toLowerCase() : '';
    const isOnline = rowData?.loadingStatus === true || ONLINE_INSTANCE_STATUSES.has(statusLower);
    return (
        <div className={CommonStyles.impactedDrivesCell}>
            {cellData != null && String(cellData) !== ''
                ? cellData
                : t('databases.general.not-available-table-columns')}
            {showView &&
                count > 0 &&
                (isOnline ? (
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
                ) : (
                    <Popover
                        trigger="hover"
                        container={
                            <span>
                                <Button variant="text" isDisabled>
                                    {t('databases.dashboard.view')}
                                </Button>
                            </span>
                        }
                    >
                        {t('databases.well-architect.view-offline-instance-disabled')}
                    </Popover>
                ))}
        </div>
    );
};

const createCountWithViewColumn = (
    headerKey: string,
    configId: string,
    engineType: string,
    configNameOverride?: string,
    headerIsI18nKey = headerKey.startsWith('databases.')
) => {
    const showView = isFixTableImpactedViewSupported(configId, engineType);
    const dialogConfigName = configNameOverride ?? configId;

    return {
        Header: headerKey,
        headerIsI18nKey,
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

const createImpactedNetworkAdaptersColumn = (configId: string, engineType: string) => {
    const { header, headerIsI18nKey } = resolveImpactedColumnHeader(configId, engineType);
    return createCountWithViewColumn(header, configId, engineType, undefined, headerIsI18nKey);
};

const createDefaultImpactedColumn = (configId: string, engineType: string) => {
    const { header, headerIsI18nKey } = resolveImpactedColumnHeader(configId, engineType);
    return createCountWithViewColumn(header, configId, engineType, undefined, headerIsI18nKey);
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

const createValueWithViewColumn = (header: string, configId: string) => ({
    Header: header,
    accessor: 'current',
    id: '4',
    width: '200px',
    renderCell: (
        cellData: string,
        rowData: ConfigTableRowData,
        t: TFunction,
        handleImpactedResourceDialog: HandleImpactedResourceDialog
    ) => (
        <div className={CommonStyles.impactedDrivesCell}>
            {cellData || t('databases.general.not-available-table-columns')}
            {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                <Button
                    variant="text"
                    onClick={() => handleImpactedResourceDialog({ ...rowData, configurationName: configId })}
                >
                    {t('databases.dashboard.view')}
                </Button>
            )}
        </div>
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
            current: `${item?.missingPatchesCount ?? 0}`,
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
        customColumns: (() => {
            const { header, headerIsI18nKey } = resolveImpactedColumnHeader(ASSESSMENT_CONFIG_IDS.MTU, engineType);
            return [
                createCountWithViewColumn(header, ASSESSMENT_CONFIG_IDS.MTU, engineType, undefined, headerIsI18nKey)
            ];
        })()
    },
    [ASSESSMENT_CONFIG_IDS.MAXDOP]: {
        dataMapping: (item: any) => ({
            current: item?.current,
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || 0,
            objectsInViolation: item?.objectsInViolation || [],
            violationDetails: item?.violationDetails || [],
            configurationName: ASSESSMENT_CONFIG_IDS.MAXDOP,
            configItem: item
        }),
        customColumns: [
            createValueWithViewColumn(
                'databases.well-architect.dashboard-table-headers.maxdop-value',
                ASSESSMENT_CONFIG_IDS.MAXDOP
            )
        ]
    },
    [ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM]: {
        dataMapping: (item: any) => ({
            current: item?.current,
            recommended: item?.recommended,
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || item?.objectsInViolation?.length || 0,
            violationDetails: item?.violationDetails || [],
            objectsInViolation: item?.objectsInViolation || [],
            configurationName: ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM,
            configItem: item
        }),
        customColumns: [
            createValueWithViewColumn(
                'databases.well-architect.dashboard-table-headers.file-system-headroom',
                ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM
            )
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
            createValueWithViewColumn(
                'databases.well-architect.dashboard-table-headers.swap-space',
                ASSESSMENT_CONFIG_IDS.SWAP_SPACE
            )
        ]
    },
    ...Object.fromEntries(
        [
            ASSESSMENT_CONFIG_IDS.DATA_FILES_MDF,
            ASSESSMENT_CONFIG_IDS.LOG_FILES_LDF,
            ASSESSMENT_CONFIG_IDS.TEMPDB_PLACEMENT
        ].map(configId => [
            configId,
            {
                dataMapping: (item: any) => ({
                    current: item?.current,
                    recommended: item?.recommended,
                    totalObjectsAssessed: item?.totalObjectsAssessed || 0,
                    totalObjectsInViolation: item?.totalObjectsInViolation || 0,
                    violationDetails: item?.violationDetails || [],
                    objectsInViolation: item?.objectsInViolation || [],
                    configurationName: configId,
                    configItem: item
                }),
                customColumns: [createDefaultImpactedColumn(configId, engineType)]
            }
        ])
    ),
    [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: {
        dataMapping: (item: any) => ({
            totalObjectsAssessed: item?.totalObjectsAssessed || 0,
            totalObjectsInViolation: item?.totalObjectsInViolation || 0,
            objectsInViolation: item?.objectsInViolation || [],
            cloneDetails: item?.cloneDetails,
            tags: item?.tags ?? item?.categories,
            severity: item?.severity,
            recommendation: item?.recommendation,
            configurationName: ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT,
            configItem: item
        }),
        customColumns: [createDefaultImpactedColumn(ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT, engineType)]
    },
    ...Object.fromEntries(
        [ASSESSMENT_CONFIG_IDS.DNFS_CONFIGURATION_FILE, ASSESSMENT_CONFIG_IDS.DNFS_NO_SHARED_CACHE].map(configId => [
            configId,
            {
                customColumns: [
                    createCountWithViewColumn(
                        'databases.well-architect.dashboard-table-headers.impacted-nfs-mounts',
                        configId,
                        engineType,
                        undefined,
                        true
                    )
                ]
            }
        ])
    ),
    ...Object.fromEntries(
        [ASSESSMENT_CONFIG_IDS.MULTIPATH_CONFIGURATION, ASSESSMENT_CONFIG_IDS.MULTIPATH_IO_TIMEOUT].map(configId => [
            configId,
            {
                customColumns: [
                    createCountWithViewColumn(
                        'databases.well-architect.dashboard-table-headers.impacted-configurations',
                        configId,
                        engineType,
                        undefined,
                        true
                    )
                ]
            }
        ])
    )
});

export const resolveDashboardTableConfig = (configType: string, engineType: string) => {
    const configId = resolveConfigTypeId(configType);
    const base = createDashboardTableConfig(configId);
    if (getConfigEntry(configId, engineType)?.fixSupported === false) {
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
