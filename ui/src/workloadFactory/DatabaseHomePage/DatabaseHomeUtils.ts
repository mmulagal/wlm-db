// eslint-disable-next-line import/no-cycle
import store from '../../store/store';
import { setManagedHostInstanceLoading } from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    CONFIG_STATES,
    COSTING_TYPES,
    DBType,
    ERROR_ANALYZER_STATUS,
    FINDINGS,
    FSXN_STORAGE_PROTOCOLS,
    GETWELL_CONFIG,
    GETWELL_STATUS,
    GETWELL_VALUES,
    INVENTORY_STATUS,
    MSSQL_API_FIELD_TO_CATEGORY,
    ORACLE_API_FIELD_TO_CATEGORY,
    ORACLE_DATABASES_COMPONENTS,
    STATUS_CONST,
    WAD_EXCLUDED_API_FIELDS_MSSQL,
    WAD_EXCLUDED_API_FIELDS_ORACLE,
    WellArchitectedCategory,
    WIZARD_TYPE
} from '../../utils/consts';
import {
    formatFractionalNumber,
    formatSizeOnePrecision,
    isAwsBackupEnabled,
    roundOffNumber,
    sortListOfDict
} from '../../utils/utilityFunctions';
import {
    formatOptimizationBreakDown,
    getCardsData,
    isAoagDeployment,
    isMssqlHaDeployment
} from '../GetWell/GetWellUtils';
import { uniqueHostRow } from '../InventoryV2/InventoryUtilsV2';
import {
    formatOracleOptimizationBreakDown,
    getOracleCardsData
} from '../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

type CategoryCounters = {
    [Category in WellArchitectedCategory]: { optimized: number; total: number };
};

interface ConfigCounters {
    totalConfigurations: number;
    optimizedConfigurations: number;
    criticalConfigurations: number;
    warningConfigurations: number;
    dismissedConfigurations: number;
    hasDismissedOrPostponed: boolean;
    categories: CategoryCounters;
}

const createEmptyCounters = (): ConfigCounters => ({
    totalConfigurations: 0,
    optimizedConfigurations: 0,
    criticalConfigurations: 0,
    warningConfigurations: 0,
    dismissedConfigurations: 0,
    hasDismissedOrPostponed: false,
    categories: {
        storage: { optimized: 0, total: 0 },
        compute: { optimized: 0, total: 0 },
        application: { optimized: 0, total: 0 },
        resiliency: { optimized: 0, total: 0 },
        cloning: { optimized: 0, total: 0 }
    }
});

export const getManagedHostCount = (data: any, dispatch: any, type: string = WIZARD_TYPE.MSSQL) => {
    let totalDatabases = 0;
    let totalhosts = 0;
    let managedDatabases = 0;
    let totalInstances = 0;
    let managedInstances = 0;
    let isLoading = false;
    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    Object.keys(data).map((val: string) => {
        const keyList = val.split('_');
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(keyList?.[0])
        ) {
            return;
        }
        uniqueResourceList.push(keyList?.[0]);
        totalhosts += 1;
        totalInstances += data[val]?.databaseInstanceDetails?.length || 0;
        data[val]?.databaseInstanceDetails?.map((per: any) => {
            if (per?.isManaged) {
                managedInstances += 1;
            }
        });

        const state = store.getState();
        const { inventoryTableData } = state.inventoryV2;
        if (type === WIZARD_TYPE.MSSQL) {
            if (inventoryTableData?.[val]) {
                inventoryTableData[val]?.sqlServerInstances?.map((per: any) => {
                    if (inventoryTableData[val]?.loading) {
                        isLoading = true;
                    }
                    totalDatabases += per?.databaseCount || 0;
                    if (per?.statusColText === INVENTORY_STATUS.MANAGED) {
                        managedDatabases += per?.databaseCount || 0;
                    }
                });
            }
        } else {
            data[val]?.databaseInstancesSummary?.map((per: any) => {
                totalDatabases += per?.databaseCount || 0;
                const instanceObj = data[val]?.databaseInstanceDetails?.find(
                    (item: any) => item?.databaseInstanceId === per?.databaseInstanceId
                );
                if (instanceObj?.isManaged) {
                    managedDatabases += per?.databaseCount || 0;
                }
            });
        }
    });

    dispatch(setManagedHostInstanceLoading(isLoading));
    return {
        totalDatabases,
        totalHosts: totalhosts,
        managedDatabases,
        totalInstances,
        managedInstances
    };
};

export const getManagedHostCountFromInventory = (
    inventoryTableData: any,
    dispatch: any,
    type: string = WIZARD_TYPE.MSSQL
) => {
    let totalDatabases = 0;
    let totalhosts = 0;
    let managedDatabases = 0;
    let totalInstances = 0;
    let managedInstances = 0;
    let isLoading = false;

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;

    if (!inventoryTableData) {
        return [];
    }

    const uniqueResourceList: Array<string> = [];
    Object.keys(inventoryTableData)?.forEach((key: any) => {
        const item = inventoryTableData[key];
        if (
            uniqueResourceList.includes(item?.resourceId || '') ||
            item?.managedInstance === 0 ||
            item?.hostType !== type ||
            shouldSkipByHeaderFilters(item, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList)
        ) {
            return;
        }
        uniqueResourceList.push(item?.resourceId || '');
        totalhosts += 1;

        item?.sqlServerInstances?.forEach((instance: any) => {
            totalInstances += 1;
            if (type === DBType.ORACLE) {
                instance?.databases?.forEach((db: any) => {
                    if (db?.type === ORACLE_DATABASES_COMPONENTS.PDB) {
                        totalDatabases += 1;
                    }
                });
            } else {
                totalDatabases += instance?.databaseCount || 0;
            }

            if (instance?.statusColText !== INVENTORY_STATUS.MANAGED) {
                return;
            }
            managedInstances += 1;
            if (type === DBType.ORACLE) {
                instance?.databases?.forEach((db: any) => {
                    if (db?.type === ORACLE_DATABASES_COMPONENTS.PDB) {
                        managedDatabases += 1;
                    }
                });
            } else {
                managedDatabases += instance?.databaseCount || 0;
            }
            if (inventoryTableData[key]?.loading) {
                isLoading = true;
            }
        });
    });

    dispatch(setManagedHostInstanceLoading(isLoading));
    return {
        totalDatabases,
        totalHosts: totalhosts,
        managedDatabases,
        totalInstances,
        managedInstances
    };
};

export const getPotentialSavingsValues = (data: any) => {
    const result = {
        loading: false,
        ebsCost: 0,
        fsxwCost: 0,
        fsxnCost: 0,
        fsxnCostForEbsHost: 0,
        fsxnCostForFsxwHost: 0,
        savings: 0,
        savingsPercent: 0,
        noSavings: false
    };

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    Object.keys(data).map((key: string) => {
        const keyList = key.split('_');
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(keyList?.[0])
        ) {
            return;
        }
        uniqueResourceList.push(keyList?.[0]);

        const val = data[key];
        if (val?.loading) {
            result.loading = true;
        }
        if (val?.data) {
            result.fsxnCost += val?.data?.totalSummary?.recommended || 0;
            if (val?.storageType === GENERAL.EBS) {
                result.fsxnCostForEbsHost += val?.data?.totalSummary?.recommended || 0;
                result.ebsCost += val?.data?.totalSummary?.existing || 0;
            } else if (val?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                result.fsxnCostForFsxwHost += val?.data?.totalSummary?.recommended || 0;
                result.fsxwCost += val?.data?.totalSummary?.existing || 0;
            }
        }
    });

    result.savings = (result?.ebsCost || 0) + (result?.fsxwCost || 0) - (result?.fsxnCost || 0);

    result.savingsPercent =
        100 * ((result.ebsCost + result.fsxwCost - result.fsxnCost) / (result.ebsCost + result.fsxwCost || 1));

    if (result.fsxnCost !== 0 && result.fsxnCost >= result.ebsCost + result.fsxwCost) {
        result.noSavings = true;
        result.savingsPercent = 0;
        result.savings = 0;
    }
    return result;
};

export const getManagedAggrProtection = (data: any) => {
    let protectedDb = 0;
    let unprotectedDb = 0;
    let awsBackupDb = 0;
    let fsxOntapSnapshotsDb = 0;
    let sqlServerBackupDb = 0;

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    Object.keys(data).map((key: string) => {
        const keyList = key.split('_');
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(keyList?.[0])
        ) {
            return;
        }

        uniqueResourceList.push(keyList?.[0]);

        let protectedHostDb = 0;
        let unProtectedHostDb = 0;
        let perFsxOntapSnapshotsDb = 0;
        let perAwsBackupDb = 0;
        let perSqlServerBackupDb = 0;
        const totalInstances = data[key]?.databaseInstancesSummary?.length || 0;
        data[key]?.databaseInstancesSummary?.map((val: any) => {
            if (
                isAwsBackupEnabled(val) ||
                val?.protection?.isFsxOntapSnapshotsEnabled ||
                val?.protection?.isSqlNativeEnabled
            ) {
                protectedHostDb = 1;
            } else if (
                (val?.status === STATUS_CONST.DOWN ||
                    val?.status === STATUS_CONST.UP ||
                    val?.status === 'ONLINE' ||
                    val?.status === 'OFFLINE') &&
                !val?.protection?.isAwsBackupEnabled?.fsxw &&
                !val?.protection?.isAwsBackupEnabled?.fsxn &&
                !val?.protection?.isAwsBackupEnabled?.ebs &&
                !val?.protection?.isFsxOntapSnapshotsEnabled &&
                !val?.protection?.isSqlNativeEnabled
            ) {
                unProtectedHostDb += 1;
            }
            if (val?.protection?.isFsxOntapSnapshotsEnabled) {
                perFsxOntapSnapshotsDb = 1;
            }
            if (isAwsBackupEnabled(val)) {
                perAwsBackupDb = 1;
            }
            if (val?.protection?.isSqlNativeEnabled) {
                perSqlServerBackupDb = 1;
            }
        });
        protectedDb += protectedHostDb;
        if (unProtectedHostDb === totalInstances) {
            unprotectedDb += 1;
        }
        fsxOntapSnapshotsDb += perFsxOntapSnapshotsDb;
        awsBackupDb += perAwsBackupDb;
        sqlServerBackupDb += perSqlServerBackupDb;
    });

    const totalHost = protectedDb + unprotectedDb;

    return {
        protectedDb,
        unprotectedDb,
        protectedPercent: (protectedDb / totalHost) * 100 || 0,
        unprotectedPercent: (unprotectedDb / totalHost) * 100 || 0,
        awsBackupDb,
        fsxOntapSnapshotsDb,
        sqlServerBackupDb
    };
};

export const getManagedAggrStorageSavings = (data: any, sandboxSavings?: any) => {
    let totalConsume = 0;
    let storageSavings = 0;
    const storageList: (string | undefined)[] = [];
    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    Object.keys(data).map((key: string) => {
        const keyList = key.split('_');
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(keyList?.[0])
        ) {
            return;
        }

        uniqueResourceList.push(keyList?.[0]);

        data[key]?.databaseInstancesSummary?.map((val: any) => {
            const fsxVal = val?.databaseInstanceTopology?.fileSystemId || '';
            const storageType = val?.databaseInstanceTopology?.fileSystemType || '';
            let fsxType = '';
            if (storageType.includes(GENERAL.FSX_FOR_ONTAP)) {
                fsxType = 'fsxn';
            } else if (storageType.includes(GENERAL.FSX_FOR_WINDOWS)) {
                fsxType = 'fsxw';
            } else if (storageType.includes(GENERAL.EBS)) {
                fsxType = 'ebs';
            }
            if (fsxType) {
                if (!fsxVal || !storageList.includes(fsxVal)) {
                    if (val?.storage?.[fsxType]?.used) {
                        totalConsume += val.storage[fsxType].used;
                    }
                    if (val?.storage?.[fsxType]?.spaceSavings) {
                        storageSavings += val.storage[fsxType].spaceSavings;
                    }
                    if (fsxVal) {
                        storageList.push(fsxVal);
                    }
                }
            }
        });
    });

    sandboxSavings?.map((val: any) => {
        if (
            !headerSelectedMultiCredIdsList.includes(val?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(val?.regionId)
        ) {
            return;
        }
        totalConsume += (val?.consumedStorage || 0) + (val?.savedStorage || 0);
        storageSavings += val?.savedStorage || 0;
    });

    const storageConsume = totalConsume - storageSavings;

    return {
        storageConsumes: formatSizeOnePrecision(storageConsume),
        storageSavings: formatSizeOnePrecision(storageSavings),
        storageSavingsPercent: (storageSavings / totalConsume) * 100 || 0
    };
};

export const getManageAggrCost = (data: any) => {
    let storageCost: number = 0;
    let computeCost: number = 0;
    let connectivityCost = 0;
    let otherCost = 0;

    const storageList: (string | undefined)[] = [];
    const vpcList: (string | undefined)[] = [];
    let requireBillingPerm = false;
    let noDeploymentChk = true;
    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    Object.keys(data).map((key: string) => {
        const keyList = key.split('_');
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(keyList?.[0])
        ) {
            return;
        }

        uniqueResourceList.push(keyList?.[0]);
        const val = data[key];

        if (val?.estimatedUsageCost?.compute) {
            computeCost += val.estimatedUsageCost.compute;
        }

        val?.estimatedUsageCost?.storage?.fsxnBreakDownById?.map((item: any) => {
            const fsxVal = item?.id;
            if (!fsxVal || !storageList.includes(fsxVal)) {
                if (val?.estimatedUsageCost?.estimationType === 'pricing') {
                    storageCost += item?.capacityCost || 0;
                    storageCost += item?.operationalCost || 0;
                } else {
                    storageCost += item?.cost || 0;
                }
                if (fsxVal) {
                    storageList.push(fsxVal);
                }
            }
        });

        storageCost += val.estimatedUsageCost?.storage?.fsxw || 0;
        storageCost += val.estimatedUsageCost?.storage?.ebs || 0;

        // If connectivity cost is already added than no need to add again based on VPCId
        let vpcVal = '';
        if (val?.nodeTopology?.vpcId) {
            vpcVal = val.nodeTopology.vpcId;
        }
        if ((!vpcVal || !vpcList.includes(vpcVal)) && val?.estimatedUsageCost?.connectivity) {
            connectivityCost += val.estimatedUsageCost.connectivity || 0;
            if (vpcVal) {
                vpcList.push(vpcVal);
            }
        }

        if (val?.estimatedUsageCost?.others) {
            otherCost += val.estimatedUsageCost.others || 0;
        }

        if (val?.estimatedUsageCost?.estimationType === COSTING_TYPES.PRICING) {
            requireBillingPerm = true;
        }

        if (
            val?.estimatedUsageCost?.estimationType === COSTING_TYPES.PRICING ||
            val?.estimatedUsageCost?.estimationType === COSTING_TYPES.BILLING
        ) {
            noDeploymentChk = false;
        }
    });

    const totalCost =
        roundOffNumber(storageCost) +
        roundOffNumber(computeCost) +
        roundOffNumber(connectivityCost) +
        roundOffNumber(otherCost);

    return {
        storageCost: formatFractionalNumber(storageCost, 2),
        computeCost: formatFractionalNumber(computeCost, 2),
        connectivityCost: formatFractionalNumber(connectivityCost, 2),
        otherCost: formatFractionalNumber(otherCost, 2),
        totalCost: formatFractionalNumber(totalCost, 2),
        storageCostPercent: formatFractionalNumber((storageCost / totalCost) * 100),
        computeCostPercent: formatFractionalNumber((computeCost / totalCost) * 100),
        connectivityCostPercent: formatFractionalNumber((connectivityCost / totalCost) * 100),
        otherCostPercent: formatFractionalNumber((otherCost / totalCost) * 100),
        requireBillingPerm: requireBillingPerm || noDeploymentChk
    };
};

export const getTotalManagedAggrCost = (mssqlCostObj: any, pgsqlCostObj: any) => ({
    storageCost: (parseInt(mssqlCostObj.storageCost) + parseInt(pgsqlCostObj.storageCost)).toString(),
    computeCost: (parseInt(mssqlCostObj.computeCost) + parseInt(pgsqlCostObj.computeCost)).toString(),
    connectivityCost: formatFractionalNumber(
        parseInt(mssqlCostObj.connectivityCost) + parseInt(pgsqlCostObj.connectivityCost),
        2
    ),
    otherCost: formatFractionalNumber(parseInt(mssqlCostObj.otherCost) + parseInt(pgsqlCostObj.otherCost), 2),
    totalCost: formatFractionalNumber(parseInt(mssqlCostObj.totalCost) + parseInt(pgsqlCostObj.totalCost), 2),
    storageCostPercent: formatFractionalNumber(
        ((parseInt(mssqlCostObj.storageCost) + parseInt(pgsqlCostObj.storageCost)) /
            (parseInt(mssqlCostObj.totalCost) + parseInt(pgsqlCostObj.totalCost))) *
            100
    ),
    computeCostPercent: formatFractionalNumber(
        ((parseInt(mssqlCostObj.computeCost) + parseInt(pgsqlCostObj.computeCost)) /
            (parseInt(mssqlCostObj.totalCost) + parseInt(pgsqlCostObj.totalCost))) *
            100
    ),
    connectivityCostPercent: formatFractionalNumber(
        (parseInt(mssqlCostObj.connectivityCost) +
            parseInt(pgsqlCostObj.connectivityCost) /
                (parseInt(mssqlCostObj.totalCost) + parseInt(pgsqlCostObj.totalCost))) *
            100
    ),
    otherCostPercent: formatFractionalNumber(
        ((parseInt(mssqlCostObj.otherCost) + parseInt(pgsqlCostObj.otherCost)) /
            (parseInt(mssqlCostObj.totalCost) + parseInt(pgsqlCostObj.totalCost))) *
            100
    ),
    requireBillingPerm:
        mssqlCostObj.requireBillingPerm ||
        pgsqlCostObj.requireBillingPerm ||
        mssqlCostObj.noDeploymentChk ||
        pgsqlCostObj.noDeploymentChk
});

export const isOptimized = (status?: string, dismissState?: string) =>
    status?.toLowerCase() === FINDINGS.OPTIMIZED.toLowerCase() ||
    status?.toLowerCase() === FINDINGS.ANALYZING.toLowerCase() ||
    dismissState === CONFIG_STATES.DISMISSED ||
    dismissState === CONFIG_STATES.POSTPONED ||
    dismissState === CONFIG_STATES.ACTIVATING;

export const isOptimizedDashInner = (status?: string, dismissState?: string) =>
    (status?.toLowerCase() === FINDINGS.OPTIMIZED.toLowerCase() ||
        status?.toLowerCase() === FINDINGS.ANALYZING.toLowerCase()) &&
    dismissState !== CONFIG_STATES.DISMISSED &&
    dismissState !== CONFIG_STATES.POSTPONED &&
    dismissState !== CONFIG_STATES.ACTIVATING;

export const isActivating = (dismissState?: string) => dismissState === CONFIG_STATES.ACTIVATING;

export const isDismissed = (dismissState?: string) =>
    dismissState === CONFIG_STATES.DISMISSED || dismissState === CONFIG_STATES.POSTPONED;

/**
 * Checks if a host should be filtered out based on credential/region header selections.
 * WAD (offline assessment) hosts are only filtered when they have a matching credential/region;
 * WAD hosts without credentials or regions always pass through.
 * Non-WAD hosts are strictly filtered by both credential and region.
 */
export const shouldSkipByHeaderFilters = (
    host: { isWad?: boolean; credentialId?: string; regionId?: string },
    headerSelectedMultiCredIdsList: string[],
    headerSelectedMultiRegionIdsList: string[]
): boolean => {
    if (host?.isWad) {
        if (
            (host?.credentialId && !headerSelectedMultiCredIdsList.includes(host.credentialId)) ||
            (host?.regionId &&
                headerSelectedMultiRegionIdsList.length > 0 &&
                !headerSelectedMultiRegionIdsList.includes(host.regionId))
        ) {
            return true;
        }
        return false;
    }

    return (
        !headerSelectedMultiCredIdsList.includes(host?.credentialId || '') ||
        !headerSelectedMultiRegionIdsList.includes(host?.regionId || '')
    );
};

/**
 * Checks if a database host should be skipped during assessment data processing.
 * Filters out hosts based on credential/region header selections and deduplicates by host ID.
 * If the host should NOT be skipped, it is added to the uniqueResourceList to prevent future duplicates.
 */
export const shouldSkipDatabaseHost = (
    databaseHost: any,
    headerSelectedMultiCredIdsList: string[],
    headerSelectedMultiRegionIdsList: string[],
    uniqueResourceList: string[]
): boolean => {
    if (uniqueResourceList.includes(databaseHost?.databaseHostId)) {
        return true;
    }

    if (shouldSkipByHeaderFilters(databaseHost, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList)) {
        return true;
    }

    uniqueResourceList.push(databaseHost?.databaseHostId);
    return false;
};

export const hasPostponedOrDismissed = (obj: any): boolean => {
    const checkState = (item: any): boolean => {
        if (typeof item !== 'object' || item === null) return false;

        return Object.keys(item).some(key => {
            if (typeof item[key] === 'object') {
                return checkState(item[key]);
            }
            return (
                key === 'configState' &&
                (item[key] === CONFIG_STATES.POSTPONED || item[key] === CONFIG_STATES.DISMISSED)
            );
        });
    };

    return checkState(obj);
};

export const getManagedInstanceOptimizationSummary = (assessmentData: any) => {
    let totalInstances = 0;
    let optimizedInstances = 0;
    let isDismissedConfig = false;

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    assessmentData?.map((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                totalInstances++;
                const instanceAssessmentData = instance?.assessments;
                const isComputeOptimized = isOptimized(
                    instanceAssessmentData?.compute?.status,
                    instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                );
                const isRssConfigOptimized = isOptimized(
                    instanceAssessmentData?.rssConfig?.status,
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                );
                const isOperatingSystemOptimized = isOptimized(
                    instanceAssessmentData?.hostOsPatch?.status,
                    instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                );
                const isMTUConfigurationOptimized = isOptimized(
                    instanceAssessmentData?.mtuAlignment?.status,
                    instanceAssessmentData?.dismissedConfigurations?.mtuAlignment?.configState
                );
                // License is not supported for AOAG deployments, so always consider it optimized for AOAG
                const isLicenseOptimized = isAoagDeployment(instanceAssessmentData?.deploymentType)
                    ? true
                    : isOptimized(
                          instanceAssessmentData?.license?.status,
                          instanceAssessmentData?.dismissedConfigurations?.license?.configState
                      );
                const isMicrosoftSqlPatchOptimized = isOptimized(
                    instanceAssessmentData?.mssqlPatch?.status,
                    instanceAssessmentData?.dismissedConfigurations?.mssqlPatch?.configState
                );
                const isMaxdopPatchOptimized = isOptimized(
                    instanceAssessmentData?.maxDOP?.status,
                    instanceAssessmentData?.dismissedConfigurations?.maxDOP?.configState
                );
                const isCloneOptimized = isOptimized(
                    instanceAssessmentData?.clone?.status,
                    instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                );
                const isStorageLayoutOptimized = instanceAssessmentData?.storage?.layout?.every((item: any) => {
                    const configState = instanceAssessmentData?.dismissedConfigurations?.storage?.layout?.find(
                        (config: any) => config.configurationName === item.name
                    )?.configState;
                    return isOptimized(item?.status, configState);
                });
                const isAllStorageSizingPresent =
                    instanceAssessmentData?.storage?.sizing?.length === 4 &&
                    instanceAssessmentData?.storage.sizing.every((item: any) =>
                        ['headroom', 'tempdb-drive-size', 'log-drive-size', 'performance-tier'].includes(item?.name)
                    );
                const isStorageSizingOptimized = instanceAssessmentData?.storage?.sizing?.every((item: any) => {
                    const configState = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                        (config: any) => config.configurationName === item.name
                    )?.configState;
                    return isOptimized(item?.status, configState);
                });
                const isStorageConfigOptimized =
                    instanceAssessmentData &&
                    instanceAssessmentData?.storage &&
                    instanceAssessmentData?.storage?.configuration &&
                    Object.values(instanceAssessmentData?.storage?.configuration).every((item: any) =>
                        item?.every((subItem: any) => {
                            const configState =
                                instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.[item]?.find(
                                    (config: any) => config.configurationName === subItem.name
                                )?.configState;
                            return isOptimized(subItem?.status, configState);
                        })
                    );
                if (
                    isComputeOptimized &&
                    isRssConfigOptimized &&
                    isOperatingSystemOptimized &&
                    isMTUConfigurationOptimized &&
                    isLicenseOptimized &&
                    isStorageLayoutOptimized &&
                    isAllStorageSizingPresent &&
                    isStorageSizingOptimized &&
                    isStorageConfigOptimized &&
                    isMicrosoftSqlPatchOptimized &&
                    isMaxdopPatchOptimized &&
                    isCloneOptimized
                ) {
                    optimizedInstances += 1;
                }

                const isDismissedInstance = hasPostponedOrDismissed(instanceAssessmentData?.dismissedConfigurations);
                if (isDismissedInstance) {
                    isDismissedConfig = true;
                }
            }
        });
    });
    return {
        totalInstances,
        optimizedInstances,
        notOptimizedInstances: totalInstances - optimizedInstances,
        optimizedPercent: Math.round((optimizedInstances / totalInstances) * 100),
        hasDismissedOrPostponed: isDismissedConfig
    };
};

/**
 * Counts a single configuration and accumulates into the provided counters.
 * Dismissed/postponed configs are excluded from the active total.
 * Optionally tracks per-category counts when category is provided.
 */
const countSingleConfig = (
    counters: ConfigCounters,
    status?: string,
    dismissState?: string,
    severity?: string,
    category?: WellArchitectedCategory
) => {
    if (dismissState === CONFIG_STATES.DISMISSED || dismissState === CONFIG_STATES.POSTPONED) {
        counters.dismissedConfigurations++;
        counters.hasDismissedOrPostponed = true;
        return;
    }
    counters.totalConfigurations++;
    if (category) {
        counters.categories[category].total++;
    }
    if (
        dismissState === CONFIG_STATES.ACTIVATING ||
        status?.toLowerCase() === FINDINGS.OPTIMIZED.toLowerCase() ||
        status?.toLowerCase() === FINDINGS.ANALYZING.toLowerCase()
    ) {
        counters.optimizedConfigurations++;
        if (category) {
            counters.categories[category].optimized++;
        }
        if (dismissState === CONFIG_STATES.ACTIVATING) counters.hasDismissedOrPostponed = true;
    } else if (severity?.toLowerCase() === 'critical') {
        counters.criticalConfigurations++;
    } else {
        counters.warningConfigurations++;
    }
};

/**
 * Counts a top-level config if it exists on the instance and is not WAD-excluded.
 * Skips configs whose API field name appears in the wadExcludedFields set when isWad is true.
 * Uses the provided categoryMap to determine which category the config belongs to.
 */
const countTopLevelConfig = (
    fieldName: string,
    instanceAssessment: any,
    dismissedConfigs: any,
    counters: ConfigCounters,
    isWad: boolean,
    wadExcludedFields: Set<string>,
    categoryMap: Record<string, WellArchitectedCategory>
) => {
    if (isWad && wadExcludedFields.has(fieldName)) return;
    if (!instanceAssessment?.[fieldName]) return;
    countSingleConfig(
        counters,
        instanceAssessment[fieldName].status,
        dismissedConfigs?.[fieldName]?.configState,
        instanceAssessment[fieldName].severity,
        categoryMap[fieldName]
    );
};

/**
 * Counts all individual MSSQL configurations for an instance into the provided counters.
 * WAD-excluded configs are driven by WAD_EXCLUDED_API_FIELDS_MSSQL from consts.
 * Also tracks per-category counts (storage, compute, application, resiliency, cloning).
 */
const countMSSQLInstanceConfigs = (instanceAssessment: any, counters: ConfigCounters, isWad = false) => {
    const dismissedConfigs = instanceAssessment?.dismissedConfigurations;
    const excluded = WAD_EXCLUDED_API_FIELDS_MSSQL;
    const categoryMap = MSSQL_API_FIELD_TO_CATEGORY;

    // Compute category
    countTopLevelConfig('compute', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    countTopLevelConfig('hostOsPatch', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    countTopLevelConfig('mtuAlignment', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    countTopLevelConfig('rssConfig', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);

    // Application category (license also not supported for AOAG deployments)
    if (!isAoagDeployment(instanceAssessment?.deploymentType)) {
        countTopLevelConfig('license', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    }
    countTopLevelConfig('mssqlPatch', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    countTopLevelConfig('maxDOP', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);

    // Cloning category
    countTopLevelConfig('clone', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);

    // Resiliency category
    countTopLevelConfig('snapshotPolicy', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    countTopLevelConfig('crr', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    countTopLevelConfig('awsBackup', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);

    // High Availability - count as ONE config (like ONTAP/OS) if it exists
    if (isMssqlHaDeployment(instanceAssessment?.deploymentType) && instanceAssessment?.highAvailability) {
        const haConfigs = instanceAssessment.highAvailability;

        const hasNotOptimized = haConfigs.some(
            (item: any) =>
                item?.status?.toLowerCase() !== FINDINGS.OPTIMIZED.toLowerCase() &&
                item?.status?.toLowerCase() !== FINDINGS.ANALYZING.toLowerCase()
        );
        const worstSeverity = haConfigs.reduce((worst: string, item: any) => {
            if (item?.severity?.toLowerCase() === 'critical') return 'critical';
            if (worst !== 'critical' && item?.severity?.toLowerCase() === 'warning') return 'warning';
            return worst;
        }, '');

        // Check if HA config is dismissed/postponed at the parent level
        const haDismissedState =
            dismissedConfigs?.highAvailability_configuration?.configState ||
            dismissedConfigs?.mssql_high_availability?.configState;

        countSingleConfig(
            counters,
            hasNotOptimized ? FINDINGS.NOT_OPTIMIZED_STATUS.toLowerCase() : FINDINGS.OPTIMIZED.toLowerCase(),
            haDismissedState,
            worstSeverity,
            categoryMap.highAvailability
        );
    }

    // Storage - layout
    instanceAssessment?.storage?.layout?.forEach((item: any) => {
        const configState = dismissedConfigs?.storage?.layout?.find(
            (config: any) => config.configurationName === item.name
        )?.configState;
        countSingleConfig(counters, item?.status, configState, item?.severity, 'storage');
    });

    // Storage - sizing
    instanceAssessment?.storage?.sizing?.forEach((item: any) => {
        const configState = dismissedConfigs?.storage?.sizing?.find(
            (config: any) => config.configurationName === item.name
        )?.configState;
        countSingleConfig(counters, item?.status, configState, item?.severity, 'storage');
    });

    // Storage - configuration (volumes, luns, os)
    // Count ONTAP (volumes + LUNs) as ONE config, and OS as ONE config
    // This matches the card-level counting in formatOptimizationBreakDown
    if (instanceAssessment?.storage?.configuration) {
        const volumes = instanceAssessment.storage.configuration.volumes || [];
        const luns = instanceAssessment.storage.configuration.luns || [];
        const osConfigs = instanceAssessment.storage.configuration.os || [];

        // Count ONTAP configuration (volumes + LUNs combined) as 1 config if either exists
        if (volumes.length > 0 || luns.length > 0) {
            // Determine overall ONTAP status: if any volume/LUN is not optimized, ONTAP is not optimized
            const allOntapConfigs = [...volumes, ...luns];
            const hasNotOptimized = allOntapConfigs.some(
                (item: any) =>
                    item?.status?.toLowerCase() !== FINDINGS.OPTIMIZED.toLowerCase() &&
                    item?.status?.toLowerCase() !== FINDINGS.ANALYZING.toLowerCase()
            );
            const worstSeverity = allOntapConfigs.reduce((worst: string, item: any) => {
                if (item?.severity?.toLowerCase() === 'critical') return 'critical';
                if (worst !== 'critical' && item?.severity?.toLowerCase() === 'warning') return 'warning';
                return worst;
            }, '');

            // Check if ONTAP config is dismissed/postponed at the parent level
            const ontapDismissedState = dismissedConfigs?.storage?.configuration?.ontap_configuration?.configState;

            countSingleConfig(
                counters,
                hasNotOptimized ? FINDINGS.NOT_OPTIMIZED_STATUS.toLowerCase() : FINDINGS.OPTIMIZED.toLowerCase(),
                ontapDismissedState,
                worstSeverity,
                'storage'
            );
        }

        // Count OS configuration as 1 config if it exists
        if (osConfigs.length > 0) {
            // Determine overall OS status: if any OS config is not optimized, OS is not optimized
            const hasNotOptimized = osConfigs.some(
                (item: any) =>
                    item?.status?.toLowerCase() !== FINDINGS.OPTIMIZED.toLowerCase() &&
                    item?.status?.toLowerCase() !== FINDINGS.ANALYZING.toLowerCase()
            );
            const worstSeverity = osConfigs.reduce((worst: string, item: any) => {
                if (item?.severity?.toLowerCase() === 'critical') return 'critical';
                if (worst !== 'critical' && item?.severity?.toLowerCase() === 'warning') return 'warning';
                return worst;
            }, '');

            // Check if OS config is dismissed/postponed at the parent level
            const osDismissedState = dismissedConfigs?.storage?.configuration?.os_configuration?.configState;

            countSingleConfig(
                counters,
                hasNotOptimized ? FINDINGS.NOT_OPTIMIZED_STATUS.toLowerCase() : FINDINGS.OPTIMIZED.toLowerCase(),
                osDismissedState,
                worstSeverity,
                'storage'
            );
        }
    }
};

/**
 * Counts all individual Oracle configurations for an instance into the provided counters.
 * WAD-excluded configs are driven by WAD_EXCLUDED_API_FIELDS_ORACLE from consts.
 * Also tracks per-category counts (storage, compute, application, resiliency, cloning).
 */
const countOracleInstanceConfigs = (instanceAssessment: any, counters: ConfigCounters, isWad = false) => {
    const dismissedConfigs = instanceAssessment?.dismissedConfigurations;
    const excluded = WAD_EXCLUDED_API_FIELDS_ORACLE;
    const categoryMap = ORACLE_API_FIELD_TO_CATEGORY;

    // Compute category
    countTopLevelConfig('hostOsPatch', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);

    // Application category
    countTopLevelConfig(
        'oracleSecurityPatch',
        instanceAssessment,
        dismissedConfigs,
        counters,
        isWad,
        excluded,
        categoryMap
    );

    // Resiliency category
    countTopLevelConfig('crr', instanceAssessment, dismissedConfigs, counters, isWad, excluded, categoryMap);
    countTopLevelConfig(
        'snapcenterSnapshot',
        instanceAssessment,
        dismissedConfigs,
        counters,
        isWad,
        excluded,
        categoryMap
    );

    // Storage - layout
    instanceAssessment?.storage?.layout?.forEach((item: any) => {
        if (!item?.name) return;
        const configState = dismissedConfigs?.storage?.layout?.find(
            (config: any) => config.configurationName === item.name
        )?.configState;
        countSingleConfig(counters, item?.status, configState, item?.severity, 'storage');
    });

    // Storage - sizing
    instanceAssessment?.storage?.sizing?.forEach((item: any) => {
        if (!item?.name) return;
        const configState = dismissedConfigs?.storage?.sizing?.find(
            (config: any) => config.configurationName === item.name
        )?.configState;
        countSingleConfig(counters, item?.status, configState, item?.severity, 'storage');
    });

    // Storage - configuration (volumes, luns, os)
    // Count ONTAP (volumes + LUNs) as ONE config, and OS as ONE config
    // This matches the card-level counting in formatOptimizationBreakDown
    if (instanceAssessment?.storage?.configuration) {
        const volumes = instanceAssessment.storage.configuration.volumes || [];
        const luns = instanceAssessment.storage.configuration.luns || [];
        const osConfigs = instanceAssessment.storage.configuration.os || [];

        // Count ONTAP configuration (volumes + LUNs combined) as 1 config if either exists
        if (volumes.length > 0 || luns.length > 0) {
            // Determine overall ONTAP status: if any volume/LUN is not optimized, ONTAP is not optimized
            const allOntapConfigs = [...volumes, ...luns];
            const hasNotOptimized = allOntapConfigs.some(
                (item: any) =>
                    item?.status?.toLowerCase() !== FINDINGS.OPTIMIZED.toLowerCase() &&
                    item?.status?.toLowerCase() !== FINDINGS.ANALYZING.toLowerCase()
            );
            const worstSeverity = allOntapConfigs.reduce((worst: string, item: any) => {
                if (item?.severity?.toLowerCase() === 'critical') return 'critical';
                if (worst !== 'critical' && item?.severity?.toLowerCase() === 'warning') return 'warning';
                return worst;
            }, '');

            // Check if ONTAP config is dismissed/postponed at the parent level
            const ontapDismissedState = dismissedConfigs?.storage?.configuration?.ontap_configuration?.configState;

            countSingleConfig(
                counters,
                hasNotOptimized ? FINDINGS.NOT_OPTIMIZED_STATUS.toLowerCase() : FINDINGS.OPTIMIZED.toLowerCase(),
                ontapDismissedState,
                worstSeverity,
                'storage'
            );
        }

        // Count OS configuration as 1 config if it exists
        if (osConfigs.length > 0) {
            // Determine overall OS status: if any OS config is not optimized, OS is not optimized
            const hasNotOptimized = osConfigs.some(
                (item: any) =>
                    item?.status?.toLowerCase() !== FINDINGS.OPTIMIZED.toLowerCase() &&
                    item?.status?.toLowerCase() !== FINDINGS.ANALYZING.toLowerCase()
            );
            const worstSeverity = osConfigs.reduce((worst: string, item: any) => {
                if (item?.severity?.toLowerCase() === 'critical') return 'critical';
                if (worst !== 'critical' && item?.severity?.toLowerCase() === 'warning') return 'warning';
                return worst;
            }, '');

            // Check if OS config is dismissed/postponed at the parent level
            const osDismissedState = dismissedConfigs?.storage?.configuration?.os_configuration?.configState;

            countSingleConfig(
                counters,
                hasNotOptimized ? FINDINGS.NOT_OPTIMIZED_STATUS.toLowerCase() : FINDINGS.OPTIMIZED.toLowerCase(),
                osDismissedState,
                worstSeverity,
                'storage'
            );
        }
    }
};

/**
 * Process MSSQL assessment data counting individual configurations (not instances).
 */
const processMSSQLAssessmentData = (assessmentData: any, headerFilters: any, uniqueResourceList: Array<string>) => {
    const counters = createEmptyCounters();
    let totalInstances = 0;
    let mssqlTotal = 0;

    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = headerFilters;

    assessmentData?.forEach((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.forEach((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                totalInstances++;
                mssqlTotal++;
                countMSSQLInstanceConfigs(instance.assessments, counters, !!databaseHost?.isWad);
            }
        });
    });

    return { ...counters, totalInstances, mssqlTotal };
};

/**
 * Process Oracle assessment data counting individual configurations (not instances).
 */
const processOracleAssessmentData = (
    oracleAssessmentData: any,
    headerFilters: any,
    uniqueResourceList: Array<string>
) => {
    const counters = createEmptyCounters();
    let totalInstances = 0;
    let oracleTotal = 0;

    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = headerFilters;

    oracleAssessmentData?.forEach((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.forEach((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                totalInstances++;
                oracleTotal++;
                countOracleInstanceConfigs(instance.assessments, counters, !!databaseHost?.isWad);
            }
        });
    });

    return { ...counters, totalInstances, oracleTotal };
};

/**
 * Main function to get managed optimization summary for both MSSQL and Oracle.
 * Calculates score based on individual configurations across the entire estate,
 * not based on fully-optimized instances.
 */
export const getManagedOptimizationSummary = (assessmentData: any, oracleAssessmentData: any) => {
    const state = store.getState();
    const headerFilters = {
        headerSelectedMultiCredIdsList: state.headers.headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList: state.headers.headerSelectedMultiRegionIdsList
    };
    const uniqueResourceList: Array<string> = [];

    const mssqlResults = processMSSQLAssessmentData(assessmentData, headerFilters, uniqueResourceList);
    const oracleResults = processOracleAssessmentData(oracleAssessmentData, headerFilters, uniqueResourceList);

    const totalConfigurations = mssqlResults.totalConfigurations + oracleResults.totalConfigurations;
    const optimizedConfigurations = mssqlResults.optimizedConfigurations + oracleResults.optimizedConfigurations;

    return {
        totalConfigurations,
        optimizedConfigurations,
        notOptimizedConfigurations: totalConfigurations - optimizedConfigurations,
        criticalConfigurations: mssqlResults.criticalConfigurations + oracleResults.criticalConfigurations,
        warningConfigurations: mssqlResults.warningConfigurations + oracleResults.warningConfigurations,
        optimizedPercent:
            totalConfigurations > 0 ? Math.round((optimizedConfigurations / totalConfigurations) * 100) : 0,
        hasDismissedOrPostponed: mssqlResults.hasDismissedOrPostponed || oracleResults.hasDismissedOrPostponed,
        totalInstances: mssqlResults.totalInstances + oracleResults.totalInstances
    };
};

export const getErrorInvestigationSummary = (allLogAnalysisData: any) => {
    const state = store.getState();
    const { inventoryTableData } = state.inventoryV2;
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;

    if (!inventoryTableData) {
        return [];
    }

    if (!allLogAnalysisData || allLogAnalysisData?.length === 0) {
        return {
            emptyState: true,
            totalResource: 0,
            activeResource: 0,
            totalEvents: 0,
            severity1: 0,
            severity2: 0,
            severity3: 0
        };
    }

    let emptyState = true;
    let totalResource = 0;
    let activeResource = 0;
    let totalEvents = 0;
    let severity1 = 0;
    let severity2 = 0;
    let severity3 = 0;

    const uniqueResourceList: Array<string> = [];
    Object.keys(inventoryTableData)?.forEach((key: any) => {
        const item = inventoryTableData[key];
        if (
            !headerSelectedMultiCredIdsList.includes(item?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(item?.regionId) ||
            uniqueResourceList.includes(item?.resourceId || '') ||
            item?.managedInstance === 0 ||
            !(item?.hostType === DBType.MSSQL || item?.hostType === DBType.ORACLE)
        ) {
            return;
        }
        uniqueResourceList.push(item?.resourceId || '');

        item?.sqlServerInstances?.forEach((instance: any) => {
            if (instance?.statusColText !== INVENTORY_STATUS.MANAGED) {
                return;
            }
            totalResource += 1;

            // Find matching log analysis data for this managed instance
            const logAnalysisMatch = allLogAnalysisData?.find(
                (logHost: any) =>
                    logHost?.databaseHostId === item?.resourceId &&
                    logHost?.databaseInstanceId === instance?.databaseInstanceId &&
                    logHost?.credentialId === item?.credentialId &&
                    logHost?.regionId === item?.regionId &&
                    logHost?.dbType === item?.hostType
            );

            if (logAnalysisMatch) {
                emptyState = false;
                if (logAnalysisMatch?.status === ERROR_ANALYZER_STATUS.ACTIVE) {
                    activeResource++;
                }
                totalEvents += logAnalysisMatch?.latestReport?.errorCount || 0;

                // Get severity counts from log analysis data
                severity1 += logAnalysisMatch?.latestReport?.severityCounts?.critical || 0;
                severity2 += logAnalysisMatch?.latestReport?.severityCounts?.severe || 0;
                severity3 += logAnalysisMatch?.latestReport?.severityCounts?.important || 0;
            }
        });
    });

    return {
        emptyState,
        totalResource,
        activeResource,
        totalEvents,
        severity1,
        severity2,
        severity3
    };
};

/**
 * Groups assessment data by category, counting individual optimized configurations
 * (not fully-optimized instances) per category.
 */
/**
 * Returns assessment data grouped by category (storage, compute, application, resiliency, cloning).
 * Reuses the same counting logic as getManagedOptimizationSummary to ensure consistency.
 */
export const getAssessmentGroupedByCategory = (assessmentData: any, oracleAssessmentData: any) => {
    const state = store.getState();
    const headerFilters = {
        headerSelectedMultiCredIdsList: state.headers.headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList: state.headers.headerSelectedMultiRegionIdsList
    };
    const uniqueResourceList: Array<string> = [];

    const mssqlResults = processMSSQLAssessmentData(assessmentData, headerFilters, uniqueResourceList);
    const oracleResults = processOracleAssessmentData(oracleAssessmentData, headerFilters, uniqueResourceList);

    return {
        storage: {
            optimized: mssqlResults.categories.storage.optimized + oracleResults.categories.storage.optimized,
            total: mssqlResults.categories.storage.total + oracleResults.categories.storage.total
        },
        compute: {
            optimized: mssqlResults.categories.compute.optimized + oracleResults.categories.compute.optimized,
            total: mssqlResults.categories.compute.total + oracleResults.categories.compute.total
        },
        application: {
            optimized: mssqlResults.categories.application.optimized + oracleResults.categories.application.optimized,
            total: mssqlResults.categories.application.total + oracleResults.categories.application.total
        },
        resiliency: {
            optimized: mssqlResults.categories.resiliency.optimized + oracleResults.categories.resiliency.optimized,
            total: mssqlResults.categories.resiliency.total + oracleResults.categories.resiliency.total
        },
        cloning: {
            optimized: mssqlResults.categories.cloning.optimized + oracleResults.categories.cloning.optimized,
            total: mssqlResults.categories.cloning.total + oracleResults.categories.cloning.total
        },
        totalInstances: mssqlResults.totalInstances + oracleResults.totalInstances,
        mssqlTotal: mssqlResults.mssqlTotal,
        oracleTotal: oracleResults.oracleTotal
    };
};

export const setConfigState = (configState: any, configName: string, state: string) => {
    // Initialize array if it doesn't exist
    if (!configState[configName]) {
        configState[configName] = [];
    }

    if (state && !configState[configName].includes(state)) {
        configState[configName] = [...configState[configName], state];
    } else if (!state && !configState[configName].includes(CONFIG_STATES.ACTIVE)) {
        configState[configName] = [...configState[configName], CONFIG_STATES.ACTIVE];
    }
    return configState;
};

// Helper function to filter Oracle ASM-related configurations
export const filterDatabaseRowsForNonAsm = (configName: any, instanceAssessmentData: any): boolean => {
    // For asm oracle configs we need to exclude rows that are not ASM
    if (
        (configName === 'data-dg-lun-layout' ||
            configName === 'redolog-dg-lun-layout' ||
            configName === 'fra-dg-lun-layout' ||
            configName === 'archivelog-dg-lun-layout') &&
        (!instanceAssessmentData?.isASMManaged ||
            instanceAssessmentData?.storageProtocol !== FSXN_STORAGE_PROTOCOLS.ISCSI)
    ) {
        return false;
    }

    if (
        configName === 'fra-dg-lun-layout' &&
        !instanceAssessmentData?.storage?.layout?.some((item: any) => item?.name === 'fra-dg-lun-layout')
    ) {
        return false;
    }

    if (
        configName === 'archivelog-dg-lun-layout' &&
        !instanceAssessmentData?.storage?.layout?.some((item: any) => item?.name === 'archivelog-dg-lun-layout')
    ) {
        return false;
    }

    return true;
};

/**
 * Helper function to process storage layout configuration for Oracle
 */
const processStorageLayoutConfig = (
    instanceAssessmentData: any,
    configName: string,
    resultKey: string,
    configState: any,
    getAssessmentGroupedByConfigurations: any
) => {
    const configObj = instanceAssessmentData?.storage?.layout?.find((item: any) => item.name === configName);
    const configStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.layout?.find(
        (item: any) => item?.configurationName === configName
    );

    const isConfigOptimized = isOptimizedDashInner(configObj?.status, configStateObj?.configState);
    setConfigState(configState, resultKey, configStateObj?.configState);

    // Filter Oracle ASM-related configurations
    if (!filterDatabaseRowsForNonAsm(configName, instanceAssessmentData)) {
        return;
    }

    getAssessmentGroupedByConfigurations[resultKey].optimized += isConfigOptimized ? 1 : 0;
    getAssessmentGroupedByConfigurations[resultKey].dismissed += isDismissed(configStateObj?.configState) ? 1 : 0;
    getAssessmentGroupedByConfigurations[resultKey].activating += isActivating(configStateObj?.configState) ? 1 : 0;
    getAssessmentGroupedByConfigurations.severityObj[resultKey] =
        GETWELL_VALUES[configObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.[resultKey];
};

/**
 * Helper function to process Oracle assessment data for configurations
 */
const processOracleConfigurationData = (
    oracleAssessmentData: any,
    headerSelectedMultiCredIdsList: any,
    headerSelectedMultiRegionIdsList: any,
    uniqueResourceList: Array<string>,
    configState: any,
    getAssessmentGroupedByConfigurations: any
) => {
    oracleAssessmentData?.map((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                getAssessmentGroupedByConfigurations.oracleTotal++;
                const instanceAssessmentData = instance?.assessments;

                // For ASM configs we need to calculate total database count seperately.
                // Updating asm related flags
                if (
                    instanceAssessmentData?.isASMManaged &&
                    instanceAssessmentData?.storageProtocol === FSXN_STORAGE_PROTOCOLS.ISCSI
                ) {
                    getAssessmentGroupedByConfigurations.dataDgLunLayout.total++;
                    getAssessmentGroupedByConfigurations.logDgLunLayout.total++;
                    getAssessmentGroupedByConfigurations.isAsmEnable = true;
                    const isFraCheck =
                        instanceAssessmentData?.storage?.layout?.some(
                            (item: any) => item?.name === 'fra-dg-lun-layout'
                        ) || false;
                    if (isFraCheck) {
                        getAssessmentGroupedByConfigurations.fraDgLunLayout.total++;
                        getAssessmentGroupedByConfigurations.isFraEnable = true;
                    }
                    const isArchiveCheck =
                        instanceAssessmentData?.storage?.layout?.some(
                            (item: any) => item?.name === 'archivelog-dg-lun-layout'
                        ) || false;
                    if (isArchiveCheck) {
                        getAssessmentGroupedByConfigurations.archiveLogDgLunLayout.total++;
                        getAssessmentGroupedByConfigurations.isArchiveEnable = true;
                    }
                }

                // Process Oracle storage layout configurations
                const oracleLayoutConfigs = [
                    { configName: 'datafiles-placement', resultKey: 'datafilesPlacement' },
                    { configName: 'controlfiles-placement', resultKey: 'controlfilesPlacement' },
                    { configName: 'redologs-placement', resultKey: 'redoLogsPlacement' },
                    { configName: 'templogs-placement', resultKey: 'tempLogsPlacement' },
                    { configName: 'archive-placement', resultKey: 'archivePlacement' },
                    { configName: 'data-dg-lun-layout', resultKey: 'dataDgLunLayout' },
                    { configName: 'redolog-dg-lun-layout', resultKey: 'logDgLunLayout' },
                    { configName: 'fra-dg-lun-layout', resultKey: 'fraDgLunLayout' },
                    { configName: 'archivelog-dg-lun-layout', resultKey: 'archiveLogDgLunLayout' },
                    { configName: 'oracle-binary-placement', resultKey: 'oracleBinaryPlacement' }
                ];

                oracleLayoutConfigs.forEach(({ configName, resultKey }) => {
                    processStorageLayoutConfig(
                        instanceAssessmentData,
                        configName,
                        resultKey,
                        configState,
                        getAssessmentGroupedByConfigurations
                    );
                });

                // Process Oracle storage sizing configurations
                const headroomObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'headroom'
                );
                const headroomStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'headroom'
                );
                const isHeadroomOptimized = isOptimizedDashInner(headroomObj?.status, headroomStateObj?.configState);
                setConfigState(configState, 'oracleFileSystemHeadroom', headroomStateObj?.configState);
                getAssessmentGroupedByConfigurations.oracleFileSystemHeadroom.optimized += isHeadroomOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.oracleFileSystemHeadroom.dismissed += isDismissed(
                    headroomStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.oracleFileSystemHeadroom.activating += isActivating(
                    headroomStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.oracleFileSystemHeadroom =
                    GETWELL_VALUES[headroomObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.oracleFileSystemHeadroom;

                const swapSpaceObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'swap-space'
                );
                const swapSpaceStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'swap-space'
                );
                const isSwapSpaceOptimized = isOptimizedDashInner(swapSpaceObj?.status, swapSpaceStateObj?.configState);
                setConfigState(configState, 'oracleSwapSpace', swapSpaceStateObj?.configState);
                getAssessmentGroupedByConfigurations.oracleSwapSpace.optimized += isSwapSpaceOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.oracleSwapSpace.dismissed += isDismissed(
                    swapSpaceStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.oracleSwapSpace.activating += isActivating(
                    swapSpaceStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.oracleSwapSpace =
                    GETWELL_VALUES[swapSpaceObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.oracleSwapSpace;

                // Process Oracle Compute configurations
                // Skip oracleOperatingSystemPatch counting for WAD instances (WAD-excluded config for Oracle)
                if (!databaseHost?.isWad) {
                    const operatingSystemPatchObj = instanceAssessmentData?.hostOsPatch;
                    const operatingSystemPatchStateObj = instanceAssessmentData?.dismissedConfigurations?.hostOsPatch;
                    const isOperatingSystemPatchOptimized = isOptimizedDashInner(
                        operatingSystemPatchObj?.status,
                        operatingSystemPatchStateObj?.configState
                    );
                    setConfigState(
                        configState,
                        'oracleOperatingSystemPatch',
                        operatingSystemPatchStateObj?.configState
                    );
                    getAssessmentGroupedByConfigurations.oracleOperatingSystemPatch.total++;
                    getAssessmentGroupedByConfigurations.oracleOperatingSystemPatch.optimized +=
                        isOperatingSystemPatchOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.oracleOperatingSystemPatch.dismissed += isDismissed(
                        operatingSystemPatchStateObj?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.oracleOperatingSystemPatch.activating += isActivating(
                        operatingSystemPatchStateObj?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.oracleOperatingSystemPatch =
                        GETWELL_VALUES[operatingSystemPatchObj?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.oracleOperatingSystemPatch;
                }

                const isOntapConfigurationOptimized =
                    instanceAssessmentData?.storage &&
                    instanceAssessmentData?.storage?.configuration &&
                    (instanceAssessmentData?.storage?.configuration?.luns || []).every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.luns?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'oracleOntapConfiguration', configStateVal);
                        return isOptimizedDashInner(item?.status, configStateVal);
                    }) &&
                    (instanceAssessmentData?.storage?.configuration?.volumes || []).every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.volumes?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'oracleOntapConfiguration', configStateVal);
                        return isOptimizedDashInner(item?.status, configStateVal);
                    });
                const isOperatingSystemOptimized =
                    instanceAssessmentData &&
                    instanceAssessmentData?.storage &&
                    instanceAssessmentData?.storage?.configuration &&
                    (instanceAssessmentData?.storage?.configuration?.os || []).every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.os?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'oracleOperatingSystem', configStateVal);
                        return isOptimizedDashInner(item?.status, configStateVal);
                    });
                getAssessmentGroupedByConfigurations.oracleOntapConfiguration.optimized += isOntapConfigurationOptimized
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.oracleOntapConfiguration = 'Critical';
                const ontapStateList = getConfigStateList(
                    [
                        ...(instanceAssessmentData?.storage?.configuration?.luns || []),
                        ...(instanceAssessmentData?.storage?.configuration?.volumes || [])
                    ],
                    [
                        ...(instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.luns || []),
                        ...(instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.volumes || [])
                    ],
                    DBType.ORACLE
                );
                ontapStateList?.forEach(configStateVal => {
                    setConfigState(configState, 'oracleOntapConfiguration', configStateVal);
                });
                getAssessmentGroupedByConfigurations.oracleOntapConfiguration.dismissed += checkConfigState(
                    ontapStateList,
                    CONFIG_STATES.DISMISSED
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.oracleOntapConfiguration.activating += checkConfigState(
                    ontapStateList,
                    CONFIG_STATES.ACTIVATING
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.oracleOntapConfiguration.partiallyDismissed += checkConfigState(
                    ontapStateList,
                    CONFIG_STATES.PARTIAL
                )
                    ? 1
                    : 0;

                getAssessmentGroupedByConfigurations.oracleOperatingSystem.optimized += isOperatingSystemOptimized
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.oracleOperatingSystem = 'Critical';
                const osStateList = getConfigStateList(
                    [...(instanceAssessmentData?.storage?.configuration?.os || [])],
                    [...(instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.os || [])],
                    DBType.ORACLE
                );
                osStateList?.forEach(configStateVal => {
                    setConfigState(configState, 'oracleOperatingSystem', configStateVal);
                });
                getAssessmentGroupedByConfigurations.oracleOperatingSystem.dismissed += checkConfigState(
                    osStateList,
                    CONFIG_STATES.DISMISSED
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.oracleOperatingSystem.activating += checkConfigState(
                    osStateList,
                    CONFIG_STATES.ACTIVATING
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.oracleOperatingSystem.partiallyDismissed += checkConfigState(
                    osStateList,
                    CONFIG_STATES.PARTIAL
                )
                    ? 1
                    : 0;

                // Skip oracleSecurityPatch counting for WAD instances (WAD-excluded config for Oracle)
                if (!databaseHost?.isWad) {
                    const isSecurityPatchOptimized = isOptimizedDashInner(
                        instanceAssessmentData?.oracleSecurityPatch?.status,
                        instanceAssessmentData?.dismissedConfigurations?.oracleSecurityPatch?.configState
                    );
                    setConfigState(
                        configState,
                        'oracleSecurityPatch',
                        instanceAssessmentData?.dismissedConfigurations?.oracleSecurityPatch?.configState
                    );
                    getAssessmentGroupedByConfigurations.oracleSecurityPatch.total++;
                    getAssessmentGroupedByConfigurations.oracleSecurityPatch.optimized += isSecurityPatchOptimized
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.oracleSecurityPatch.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.oracleSecurityPatch?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.oracleSecurityPatch.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.oracleSecurityPatch?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.oracleSecurityPatch =
                        GETWELL_VALUES[instanceAssessmentData?.oracleSecurityPatch?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.oracleSecurityPatch;
                }

                // Skip oracleCrr counting for WAD instances (WAD-excluded config for Oracle)
                if (!databaseHost?.isWad) {
                    const isCrrOptimized = isOptimizedDashInner(
                        instanceAssessmentData?.crr?.status,
                        instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                    );
                    setConfigState(
                        configState,
                        'oracleCrr',
                        instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                    );
                    getAssessmentGroupedByConfigurations.oracleCrr.total++;
                    getAssessmentGroupedByConfigurations.oracleCrr.optimized += isCrrOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.oracleCrr.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.oracleCrr.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.oracleCrr =
                        GETWELL_VALUES[instanceAssessmentData?.crr?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.oracleCrr;
                }

                // Skip oracleSnapcenterSnapshot counting for WAD instances (WAD-excluded config for Oracle)
                if (!databaseHost?.isWad) {
                    const isSnapcenterSnapshotOptimized = isOptimizedDashInner(
                        instanceAssessmentData?.snapcenterSnapshot?.status,
                        instanceAssessmentData?.dismissedConfigurations?.snapcenterSnapshot?.configState
                    );
                    setConfigState(
                        configState,
                        'oracleSnapcenterSnapshot',
                        instanceAssessmentData?.dismissedConfigurations?.snapcenterSnapshot?.configState
                    );
                    getAssessmentGroupedByConfigurations.oracleSnapcenterSnapshot.total++;
                    getAssessmentGroupedByConfigurations.oracleSnapcenterSnapshot.optimized +=
                        isSnapcenterSnapshotOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.oracleSnapcenterSnapshot.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.snapcenterSnapshot?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.oracleSnapcenterSnapshot.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.snapcenterSnapshot?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.oracleSnapcenterSnapshot =
                        GETWELL_VALUES[instanceAssessmentData?.snapcenterSnapshot?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.oracleSnapcenterSnapshot;
                }
            }
        });
    });
};

export const getConfigStateList = (
    mergedData: any[],
    mergedDismissedData: any[],
    configEngineType?: string,
    formattedData?: any
) => {
    // Get config state list for any instance/database based on all sub configurations
    if (!formattedData) {
        formattedData = formatAssessmentTableData(mergedData, mergedDismissedData, configEngineType);
    }
    const result: string[] = [];

    // Loop through formattedData and collect all configState values
    const configStates = new Set<string>();

    formattedData?.forEach((item: any) => {
        if (item?.configState) {
            configStates.add(item.configState);
        }
    });

    // Convert Set to Array to get unique values and add to result
    const uniqueConfigStates = Array.from(configStates);

    // If no config states found, default to ACTIVE
    if (uniqueConfigStates.length === 0) {
        result.push(CONFIG_STATES.ACTIVE);
    } else {
        result.push(...uniqueConfigStates);
    }

    return result;
};

export const checkConfigState = (stateList: string[], state: string) => {
    if (state === CONFIG_STATES.DISMISSED || state === CONFIG_STATES.POSTPONED) {
        return (
            (stateList.includes(CONFIG_STATES.DISMISSED) || stateList.includes(CONFIG_STATES.POSTPONED)) &&
            !stateList.includes(CONFIG_STATES.ACTIVE) &&
            !stateList.includes(CONFIG_STATES.ACTIVATING)
        );
    }
    if (state === CONFIG_STATES.ACTIVATING) {
        return (
            stateList.includes(CONFIG_STATES.ACTIVATING) &&
            !stateList.includes(CONFIG_STATES.DISMISSED) &&
            !stateList.includes(CONFIG_STATES.POSTPONED) &&
            !stateList.includes(CONFIG_STATES.ACTIVE)
        );
    }
    if (state === CONFIG_STATES.ACTIVE) {
        return (
            stateList.includes(CONFIG_STATES.ACTIVE) &&
            !stateList.includes(CONFIG_STATES.DISMISSED) &&
            !stateList.includes(CONFIG_STATES.POSTPONED) &&
            !stateList.includes(CONFIG_STATES.ACTIVATING)
        );
    }
    if (state === CONFIG_STATES.PARTIAL) {
        return (
            (stateList.includes(CONFIG_STATES.ACTIVE) || stateList.includes(CONFIG_STATES.ACTIVATING)) &&
            (stateList.includes(CONFIG_STATES.DISMISSED) || stateList.includes(CONFIG_STATES.POSTPONED))
        );
    }
    return false;
};

export const getAssessmentGroupedByConfigurations = (assessmentData: any, oracleAssessmentData?: any) => {
    const getAssessmentGroupedByConfigurations: any = {
        storageTier: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        fileSystemHeadroom: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        logDriveSize: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        tempdbDriveSize: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        userDataFiles: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        logFiles: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        tempdbPlacement: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        ontapConfiguration: {
            optimized: 0,
            dismissed: 0,
            activating: 0,
            partiallyDismissed: 0
        },
        operatingSystem: {
            optimized: 0,
            dismissed: 0,
            activating: 0,
            partiallyDismissed: 0
        },
        computeRightsizing: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        operatingSystemPatch: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        rssConfiguration: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        mtuConfiguration: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        applicationSqlServer: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        mssqlPatch: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        maxdopPatch: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        scheduledLocalSnapshot: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        scheduledawsBackup: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        mssqlhighAvailability: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0,
            partiallyDismissed: 0
        },
        clone: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        crr: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        oracleSecurityPatch: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        oracleCrr: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        oracleSnapcenterSnapshot: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        oracleBinaryPlacement: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        datafilesPlacement: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        controlfilesPlacement: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        redoLogsPlacement: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        tempLogsPlacement: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        archivePlacement: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        dataDgLunLayout: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        logDgLunLayout: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        fraDgLunLayout: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        archiveLogDgLunLayout: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        oracleOntapConfiguration: {
            optimized: 0,
            dismissed: 0,
            activating: 0,
            partiallyDismissed: 0
        },
        oracleOperatingSystem: {
            optimized: 0,
            dismissed: 0,
            activating: 0,
            partiallyDismissed: 0
        },
        oracleFileSystemHeadroom: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        oracleOperatingSystemPatch: {
            total: 0,
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        oracleSwapSpace: {
            optimized: 0,
            dismissed: 0,
            activating: 0
        },
        total: 0,
        oracleTotal: 0,
        severityObj: {},
        isAsmEnable: false,
        isFraEnable: false,
        isArchiveEnable: false,
        isHaMssqlEnable: false
    };

    const configState: any = {
        storageTier: [],
        fileSystemHeadroom: [],
        logDriveSize: [],
        tempdbDriveSize: [],
        userDataFiles: [],
        logFiles: [],
        tempdbPlacement: [],
        ontapConfiguration: [],
        operatingSystem: [],
        computeRightsizing: [],
        operatingSystemPatch: [],
        rssConfiguration: [],
        mtuConfiguration: [],
        applicationSqlServer: [],
        mssqlPatch: [],
        maxdopPatch: [],
        scheduledLocalSnapshot: [],
        scheduledawsBackup: [],
        mssqlhighAvailability: [],
        clone: [],
        crr: [],
        oracleBinaryPlacement: [],
        datafilesPlacement: [],
        controlfilesPlacement: [],
        redoLogsPlacement: [],
        tempLogsPlacement: [],
        archivePlacement: [],
        dataDgLunLayout: [],
        logDgLunLayout: [],
        fraDgLunLayout: [],
        archiveLogDgLunLayout: [],
        oracleOntapConfiguration: [],
        oracleOperatingSystem: [],
        oracleFileSystemHeadroom: [],
        oracleOperatingSystemPatch: [],
        oracleSwapSpace: [],
        oracleSecurityPatch: [],
        oracleCrr: [],
        oracleSnapcenterSnapshot: []
    };

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    assessmentData.map((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                getAssessmentGroupedByConfigurations.total++;
                const instanceAssessmentData = instance?.assessments;

                const perfTierObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'performance-tier'
                );
                const perfTierStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'performance-tier'
                );
                const isStorageTierOptimized = isOptimizedDashInner(perfTierObj?.status, perfTierStateObj?.configState);
                setConfigState(configState, 'storageTier', perfTierStateObj?.configState);

                const headroomObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'headroom'
                );
                const headroomStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'headroom'
                );
                const isFileSystemHeadroomOptimized = isOptimizedDashInner(
                    headroomObj?.status,
                    headroomStateObj?.configState
                );
                setConfigState(configState, 'fileSystemHeadroom', headroomStateObj?.configState);

                const logDriveSizeObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'log-drive-size'
                );
                const logDriveSizeStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'log-drive-size'
                );
                const isLogDriveSizeOptimized = isOptimizedDashInner(
                    logDriveSizeObj?.status,
                    logDriveSizeStateObj?.configState
                );
                setConfigState(configState, 'logDriveSize', logDriveSizeStateObj?.configState);

                const tempdbDriveSizeObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'tempdb-drive-size'
                );
                const tempdbDriveSizeStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'tempdb-drive-size'
                );
                const isTempdbDriveSizeOptimized = isOptimizedDashInner(
                    tempdbDriveSizeObj?.status,
                    tempdbDriveSizeStateObj?.configState
                );
                setConfigState(configState, 'tempdbDriveSize', tempdbDriveSizeStateObj?.configState);

                const userDataFilesObj = instanceAssessmentData?.storage?.layout?.find(
                    (item: any) => item.name === 'data-files-location'
                );
                const userDataFilesStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.layout?.find(
                    (item: any) => item?.configurationName === 'data-files-location'
                );
                const isUserDataFilesOptimized = isOptimizedDashInner(
                    userDataFilesObj?.status,
                    userDataFilesStateObj?.configState
                );
                setConfigState(configState, 'userDataFiles', userDataFilesStateObj?.configState);

                const logFilesObj = instanceAssessmentData?.storage?.layout?.find(
                    (item: any) => item.name === 'log-files-location'
                );
                const logFilesStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.layout?.find(
                    (item: any) => item?.configurationName === 'log-files-location'
                );
                const isLogFilesOptimized = isOptimizedDashInner(logFilesObj?.status, logFilesStateObj?.configState);
                setConfigState(configState, 'logFiles', logFilesStateObj?.configState);

                const tempdbFilesLocationObj = instanceAssessmentData?.storage?.layout?.find(
                    (item: any) => item.name === 'tempdb-files-location'
                );
                const tempdbFilesLocationStateObj =
                    instanceAssessmentData?.dismissedConfigurations?.storage?.layout?.find(
                        (item: any) => item?.configurationName === 'tempdb-files-location'
                    );
                const isTempdbPlacementOptimized = isOptimizedDashInner(
                    tempdbFilesLocationObj?.status,
                    tempdbFilesLocationStateObj?.configState
                );
                setConfigState(configState, 'tempdbPlacement', tempdbFilesLocationStateObj?.configState);

                const isOntapConfigurationOptimized =
                    instanceAssessmentData?.storage &&
                    instanceAssessmentData?.storage?.configuration &&
                    (instanceAssessmentData?.storage?.configuration?.luns || []).every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.luns?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'ontapConfiguration', configStateVal);
                        return isOptimizedDashInner(item?.status, configStateVal);
                    }) &&
                    (instanceAssessmentData?.storage?.configuration?.volumes || []).every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.volumes?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'ontapConfiguration', configStateVal);
                        return isOptimizedDashInner(item?.status, configStateVal);
                    });
                const isOperatingSystemOptimized =
                    instanceAssessmentData &&
                    instanceAssessmentData?.storage &&
                    instanceAssessmentData?.storage?.configuration &&
                    (instanceAssessmentData?.storage?.configuration?.os || []).every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.os?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'operatingSystem', configStateVal);
                        return isOptimizedDashInner(item?.status, configStateVal);
                    });

                const isMssqlHighAvailabilityOptimized =
                    instanceAssessmentData &&
                    instanceAssessmentData?.highAvailability &&
                    instanceAssessmentData?.highAvailability?.length > 0 &&
                    instanceAssessmentData?.highAvailability?.every((item: any) => {
                        const configStateVal = instanceAssessmentData?.dismissedConfigurations?.highAvailability?.find(
                            (config: any) => config?.configurationName === item.name
                        )?.configState;
                        setConfigState(configState, 'mssqlhighAvailability', configStateVal);
                        return isOptimizedDashInner(item?.status, configStateVal);
                    });

                const isComputeRightsizingOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.compute?.status,
                    instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                );
                setConfigState(
                    configState,
                    'computeRightsizing',
                    instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                );

                const isOperatingSystemPatchOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.hostOsPatch?.status,
                    instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                );
                setConfigState(
                    configState,
                    'operatingSystemPatch',
                    instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                );

                const isRssConfigurationOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.rssConfig?.status,
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                );
                setConfigState(
                    configState,
                    'rssConfiguration',
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                );

                const isMtuConfigurationOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.mtuAlignment?.status,
                    instanceAssessmentData?.dismissedConfigurations?.mtuAlignment?.configState
                );
                setConfigState(
                    configState,
                    'mtuConfiguration',
                    instanceAssessmentData?.dismissedConfigurations?.mtuAlignment?.configState
                );

                // License is not supported for AOAG deployments
                const isAoagInstanceDeployment = isAoagDeployment(instanceAssessmentData?.deploymentType);
                const isApplicationSqlServerOptimized = isAoagInstanceDeployment
                    ? false // For AOAG, we don't count license - will be skipped in counting below
                    : isOptimizedDashInner(
                          instanceAssessmentData?.license?.status,
                          instanceAssessmentData?.dismissedConfigurations?.license?.configState
                      );
                if (!isAoagInstanceDeployment) {
                    setConfigState(
                        configState,
                        'applicationSqlServer',
                        instanceAssessmentData?.dismissedConfigurations?.license?.configState
                    );
                }

                const isMicrosoftSqlPatchOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.mssqlPatch?.status,
                    instanceAssessmentData?.dismissedConfigurations?.mssqlPatch?.configState
                );
                setConfigState(
                    configState,
                    'mssqlPatch',
                    instanceAssessmentData?.dismissedConfigurations?.mssqlPatch?.configState
                );

                const isMaxdopPatchOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.maxDOP?.status,
                    instanceAssessmentData?.dismissedConfigurations?.maxDOP?.configState
                );
                setConfigState(
                    configState,
                    'maxdopPatch',
                    instanceAssessmentData?.dismissedConfigurations?.maxDOP?.configState
                );

                const isScheduledLocalSnapshotOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.snapshotPolicy?.status,
                    instanceAssessmentData?.dismissedConfigurations?.snapshotPolicy?.configState
                );
                setConfigState(
                    configState,
                    'scheduledLocalSnapshot',
                    instanceAssessmentData?.dismissedConfigurations?.snapshotPolicy?.configState
                );

                const isScheduledawsBackupOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.awsBackup?.status,
                    instanceAssessmentData?.dismissedConfigurations?.awsBackup?.configState
                );
                setConfigState(
                    configState,
                    'scheduledawsBackup',
                    instanceAssessmentData?.dismissedConfigurations?.awsBackup?.configState
                );

                const isCloneOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.clone?.status,
                    instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                );
                setConfigState(
                    configState,
                    'clone',
                    instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                );

                const isCrrOptimized = isOptimizedDashInner(
                    instanceAssessmentData?.crr?.status,
                    instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                );
                setConfigState(configState, 'crr', instanceAssessmentData?.dismissedConfigurations?.crr?.configState);

                getAssessmentGroupedByConfigurations.storageTier.optimized += isStorageTierOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.storageTier.dismissed += isDismissed(perfTierStateObj?.configState)
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.storageTier.activating += isActivating(
                    perfTierStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.storageTier =
                    GETWELL_VALUES[perfTierObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.storageTier;

                getAssessmentGroupedByConfigurations.fileSystemHeadroom.optimized += isFileSystemHeadroomOptimized
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.fileSystemHeadroom.dismissed += isDismissed(
                    headroomStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.fileSystemHeadroom.activating += isActivating(
                    headroomStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.fileSystemHeadroom =
                    GETWELL_VALUES[headroomObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.fileSystemHeadroom;
                getAssessmentGroupedByConfigurations.logDriveSize.optimized += isLogDriveSizeOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.logDriveSize.dismissed += isDismissed(
                    logDriveSizeStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.logDriveSize.activating += isActivating(
                    logDriveSizeStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.logDriveSize =
                    GETWELL_VALUES[logDriveSizeObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.logDriveSize;
                getAssessmentGroupedByConfigurations.tempdbDriveSize.optimized += isTempdbDriveSizeOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.tempdbDriveSize.dismissed += isDismissed(
                    tempdbDriveSizeStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.tempdbDriveSize.activating += isActivating(
                    tempdbDriveSizeStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.tempdbDriveSize =
                    GETWELL_VALUES[tempdbDriveSizeObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.tempdbDriveSize;

                getAssessmentGroupedByConfigurations.userDataFiles.optimized += isUserDataFilesOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.userDataFiles.dismissed += isDismissed(
                    userDataFilesStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.userDataFiles.activating += isActivating(
                    userDataFilesStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.userDataFiles =
                    GETWELL_VALUES[userDataFilesObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.userDataFiles;
                getAssessmentGroupedByConfigurations.logFiles.optimized += isLogFilesOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.logFiles.dismissed += isDismissed(logFilesStateObj?.configState)
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.logFiles.activating += isActivating(logFilesStateObj?.configState)
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.logFiles =
                    GETWELL_VALUES[logFilesObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.logFiles;
                getAssessmentGroupedByConfigurations.tempdbPlacement.optimized += isTempdbPlacementOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.tempdbPlacement.dismissed += isDismissed(
                    tempdbFilesLocationStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.tempdbPlacement.activating += isActivating(
                    tempdbFilesLocationStateObj?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.tempdbPlacement =
                    GETWELL_VALUES[tempdbFilesLocationObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.tempdbPlacement;
                getAssessmentGroupedByConfigurations.ontapConfiguration.optimized += isOntapConfigurationOptimized
                    ? 1
                    : 0;
                const ontapStateList = getConfigStateList(
                    [
                        ...(instanceAssessmentData?.storage?.configuration?.luns || []),
                        ...(instanceAssessmentData?.storage?.configuration?.volumes || [])
                    ],
                    [
                        ...(instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.luns || []),
                        ...(instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.volumes || [])
                    ],
                    DBType.MSSQL
                );
                ontapStateList?.forEach(configStateVal => {
                    setConfigState(configState, 'ontapConfiguration', configStateVal);
                });
                getAssessmentGroupedByConfigurations.ontapConfiguration.dismissed += checkConfigState(
                    ontapStateList,
                    CONFIG_STATES.DISMISSED
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.ontapConfiguration.activating += checkConfigState(
                    ontapStateList,
                    CONFIG_STATES.ACTIVATING
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.ontapConfiguration.partiallyDismissed += checkConfigState(
                    ontapStateList,
                    CONFIG_STATES.PARTIAL
                )
                    ? 1
                    : 0;

                getAssessmentGroupedByConfigurations.severityObj.ontapConfiguration = 'Critical';

                getAssessmentGroupedByConfigurations.operatingSystem.optimized += isOperatingSystemOptimized ? 1 : 0;
                const osStateList = getConfigStateList(
                    [...(instanceAssessmentData?.storage?.configuration?.os || [])],
                    [...(instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.os || [])],
                    DBType.MSSQL
                );
                osStateList?.forEach(configStateVal => {
                    setConfigState(configState, 'operatingSystem', configStateVal);
                });
                getAssessmentGroupedByConfigurations.operatingSystem.dismissed += checkConfigState(
                    osStateList,
                    CONFIG_STATES.DISMISSED
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.operatingSystem.activating += checkConfigState(
                    osStateList,
                    CONFIG_STATES.ACTIVATING
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.operatingSystem.partiallyDismissed += checkConfigState(
                    osStateList,
                    CONFIG_STATES.PARTIAL
                )
                    ? 1
                    : 0;

                getAssessmentGroupedByConfigurations.severityObj.operatingSystem = 'Critical';

                // Skip computeRightsizing counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.computeRightsizing.total++;
                    getAssessmentGroupedByConfigurations.computeRightsizing.optimized += isComputeRightsizingOptimized
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.computeRightsizing.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.computeRightsizing.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.computeRightsizing =
                        GETWELL_VALUES[instanceAssessmentData?.compute?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.computeRightsizing;
                }
                // Skip operatingSystemPatch counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.operatingSystemPatch.total++;
                    getAssessmentGroupedByConfigurations.operatingSystemPatch.optimized +=
                        isOperatingSystemPatchOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.operatingSystemPatch.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.operatingSystemPatch.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.operatingSystemPatch =
                        GETWELL_VALUES[instanceAssessmentData?.hostOsPatch?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.operatingSystemPatch;
                }
                getAssessmentGroupedByConfigurations.rssConfiguration.optimized += isRssConfigurationOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.rssConfiguration.dismissed += isDismissed(
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.rssConfiguration.activating += isActivating(
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.rssConfiguration =
                    GETWELL_VALUES[instanceAssessmentData?.rssConfig?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.rssConfiguration;
                // Skip mtuConfiguration counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.mtuConfiguration.total++;
                    getAssessmentGroupedByConfigurations.mtuConfiguration.optimized += isMtuConfigurationOptimized
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.mtuConfiguration.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.mtuAlignment?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.mtuConfiguration.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.mtuAlignment?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.mtuConfiguration =
                        GETWELL_VALUES[instanceAssessmentData?.mtuAlignment?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.mtuConfiguration;
                }
                // Skip license (applicationSqlServer) counting for AOAG deployments and WAD instances
                if (!isAoagInstanceDeployment && !databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.applicationSqlServer.total++;
                    getAssessmentGroupedByConfigurations.applicationSqlServer.optimized +=
                        isApplicationSqlServerOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.applicationSqlServer.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.license?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.applicationSqlServer.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.license?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.applicationSqlServer =
                        GETWELL_VALUES[instanceAssessmentData?.license?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.applicationSqlServer;
                }
                // Skip mssqlPatch counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.mssqlPatch.total++;
                    getAssessmentGroupedByConfigurations.mssqlPatch.optimized += isMicrosoftSqlPatchOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.mssqlPatch.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.mssqlPatch?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.mssqlPatch.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.mssqlPatch?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.mssqlPatch =
                        GETWELL_VALUES[instanceAssessmentData?.mssqlPatch?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.mssqlPatch;
                }
                getAssessmentGroupedByConfigurations.maxdopPatch.optimized += isMaxdopPatchOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.maxdopPatch.dismissed += isDismissed(
                    instanceAssessmentData?.dismissedConfigurations?.maxDOP?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.maxdopPatch.activating += isActivating(
                    instanceAssessmentData?.dismissedConfigurations?.maxDOP?.configState
                )
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.maxdopPatch =
                    GETWELL_VALUES[instanceAssessmentData?.maxDOP?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.maxdopPatch;
                // Skip scheduledLocalSnapshot counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.scheduledLocalSnapshot.total++;
                    getAssessmentGroupedByConfigurations.scheduledLocalSnapshot.optimized +=
                        isScheduledLocalSnapshotOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.scheduledLocalSnapshot.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.snapshotPolicy?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.scheduledLocalSnapshot.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.snapshotPolicy?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.scheduledLocalSnapshot =
                        GETWELL_VALUES[instanceAssessmentData?.snapshotPolicy?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.scheduledLocalSnapshot;
                }

                // Skip scheduledawsBackup counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.scheduledawsBackup.total++;
                    getAssessmentGroupedByConfigurations.scheduledawsBackup.optimized += isScheduledawsBackupOptimized
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.scheduledawsBackup.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.awsBackup?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.scheduledawsBackup.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.awsBackup?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.scheduledawsBackup =
                        GETWELL_VALUES[instanceAssessmentData?.awsBackup?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.scheduledawsBackup;
                }

                // Skip clone counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.clone.total++;
                    getAssessmentGroupedByConfigurations.clone.optimized += isCloneOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.clone.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.clone.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.clone =
                        GETWELL_VALUES[instanceAssessmentData?.clone?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.clone;
                }

                // Skip crr counting for WAD instances (WAD-excluded config)
                if (!databaseHost?.isWad) {
                    getAssessmentGroupedByConfigurations.crr.total++;
                    getAssessmentGroupedByConfigurations.crr.optimized += isCrrOptimized ? 1 : 0;
                    getAssessmentGroupedByConfigurations.crr.dismissed += isDismissed(
                        instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.crr.activating += isActivating(
                        instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.crr =
                        GETWELL_VALUES[instanceAssessmentData?.crr?.severity] ||
                        getAssessmentGroupedByConfigurations?.severityObj?.crr;
                }

                if (isMssqlHaDeployment(instance?.assessments?.deploymentType)) {
                    getAssessmentGroupedByConfigurations.isHaMssqlEnable = true;
                    getAssessmentGroupedByConfigurations.mssqlhighAvailability.total++;
                    getAssessmentGroupedByConfigurations.mssqlhighAvailability.optimized +=
                        isMssqlHighAvailabilityOptimized ? 1 : 0;
                    const hsStateList = getConfigStateList(
                        [...(instanceAssessmentData?.highAvailability || [])],
                        [...(instanceAssessmentData?.dismissedConfigurations?.highAvailability || [])],
                        DBType.MSSQL
                    );
                    hsStateList?.forEach(configStateVal => {
                        setConfigState(configState, 'mssqlhighAvailability', configStateVal);
                    });
                    getAssessmentGroupedByConfigurations.mssqlhighAvailability.dismissed += checkConfigState(
                        hsStateList,
                        CONFIG_STATES.DISMISSED
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.mssqlhighAvailability.activating += checkConfigState(
                        hsStateList,
                        CONFIG_STATES.ACTIVATING
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.mssqlhighAvailability.partiallyDismissed += checkConfigState(
                        hsStateList,
                        CONFIG_STATES.PARTIAL
                    )
                        ? 1
                        : 0;
                    getAssessmentGroupedByConfigurations.severityObj.mssqlhighAvailability = 'Critical';
                }
            }
        });
    });

    // Process oracle data
    processOracleConfigurationData(
        oracleAssessmentData,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList,
        uniqueResourceList,
        configState,
        getAssessmentGroupedByConfigurations
    );

    return {
        ...getAssessmentGroupedByConfigurations,
        configState
    };
};

export const getAssessmentHostListGroupedByCategory = (assessmentData: any, oracleAssessmentData: any) => {
    let tableData: any = [];
    let id = 1;

    const state = store.getState();
    const { inventoryTableData, getDatabaseHosts } = state.inventoryV2;
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    assessmentData.map((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                const { cardsData } = getCardsData(instance?.assessments, {});
                const optBreakDown = formatOptimizationBreakDown(cardsData, instance?.assessments);
                let score = '';
                score = `${optBreakDown?.total?.percent || '0'}%`;
                const optimized = optBreakDown?.total?.optimized || 0;
                if (score !== '100%') {
                    const perTableData: any = {
                        id: id++,
                        hostName: databaseHost?.databaseHostName,
                        score,
                        optimized,
                        databaseInstanceName: instance?.databaseInstanceName,
                        databaseHostId: databaseHost?.databaseHostId,
                        instanceId: instance?.databaseInstanceId,
                        credentialId: databaseHost?.credentialId,
                        regionId: databaseHost?.regionId,
                        type: DBType.MSSQL
                    };
                    tableData.push(perTableData);
                }
            }
        });
    });

    oracleAssessmentData.map((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                const { cardsData } = getOracleCardsData(instance?.assessments, {});
                const optBreakDown = formatOracleOptimizationBreakDown(cardsData, instance?.assessments);
                let score = '';
                score = `${optBreakDown?.total?.percent || '0'}%`;
                const optimized = optBreakDown?.total?.optimized || 0;
                if (score !== '100%') {
                    const perTableData: any = {
                        id: id++,
                        hostName: databaseHost?.databaseHostName,
                        score,
                        optimized,
                        databaseInstanceName: instance?.databaseInstanceName,
                        databaseHostId: databaseHost?.databaseHostId,
                        instanceId: instance?.databaseInstanceId,
                        credentialId: databaseHost?.credentialId,
                        regionId: databaseHost?.regionId,
                        type: DBType.ORACLE
                    };
                    tableData.push(perTableData);
                }
            }
        });
    });
    tableData = mapHostStatusToAssessmentData(
        inventoryTableData,
        tableData,
        getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
    );
    return disableOfflineRows(tableData);
};

export const disableOfflineRows = (data: any) =>
    data.map((item: any) => {
        if (
            item.status === INVENTORY_STATUS.STOPPED ||
            item.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN ||
            item?.loadingStatus
        ) {
            return {
                ...item,
                cellProps: {
                    isDisabled: true,
                    selectionProps: {
                        title: item?.loadingStatus ? '' : GENERAL.ONLINE_INSTANCE_ASSESS,
                        titleProps: {
                            placement: 'bottom'
                        }
                    }
                }
            };
        }
        if (
            item?.configuration === '0 out of 0' &&
            !item?.configStateList.includes(CONFIG_STATES.DISMISSED) &&
            !item?.configStateList.includes(CONFIG_STATES.POSTPONED)
        ) {
            return {
                ...item,
                cellProps: {
                    isDisabled: true,
                    selectionProps: {
                        title: GENERAL.NO_CONFIG_AVAILABLE,
                        titleProps: {
                            placement: 'bottom'
                        }
                    }
                }
            };
        }
        return item;
    });

export const mapHostStatusToAssessmentData = (hostData: any, assessmentData: any, isLoading: boolean) => {
    const result = assessmentData.map((instanceData: any) => {
        const updatedAssessmentData = { ...instanceData };
        const host =
            hostData?.[uniqueHostRow(instanceData.databaseHostId, instanceData?.credentialId, instanceData.regionId)];
        if (!host) {
            updatedAssessmentData.loadingStatus = isLoading;
        } else {
            const instance = host?.sqlServerInstances?.find(
                (instance: any) => instance.databaseInstanceId === instanceData.instanceId
            );
            if (!instance) {
                updatedAssessmentData.loadingStatus = isLoading;
            } else {
                updatedAssessmentData.status = instance.status;
                updatedAssessmentData.ec2InstanceId = host?.ec2InstanceId;
                updatedAssessmentData.fsxId = instance?.fsxId;
                updatedAssessmentData.sqlServerId = instance?.sqlServerId;
                updatedAssessmentData.loadingStatus = false;
            }
        }
        return updatedAssessmentData;
    });
    return sortListOfDict(result, 'status', false);
};

export const formatAssessmentTableData = (data: any, dismissedData: any, engineType?: string) => {
    const result: any = [];
    data?.map((item: any) => {
        if (!item?.error && !item?.errorMessage) {
            // Determine the name to use, handling Oracle snapshot-policy case
            const itemName =
                engineType === DBType.ORACLE && item?.name === 'snapshot-policy' ? 'snapshot-policy-vol' : item?.name;

            const formattedItem = {
                ...item,
                name: GETWELL_CONFIG?.[itemName || ''] || itemName,
                status: GETWELL_VALUES?.[item?.status] || item?.status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            };

            // Check if there's a matching dismissed data entry
            const matchingDismissedItem = dismissedData?.find(
                (dismissedItem: any) => dismissedItem?.configurationName === item?.name
            );

            if (matchingDismissedItem) {
                const formattedDismissedItem = {
                    ...formattedItem,
                    ...matchingDismissedItem,
                    dismissedObj: {
                        configState: matchingDismissedItem.configState,
                        startTime: matchingDismissedItem?.startTime,
                        endTime: matchingDismissedItem?.endTime
                    }
                };
                result.push(formattedDismissedItem);
            } else {
                const formattedRegItem = {
                    ...formattedItem,
                    configState: CONFIG_STATES.ACTIVE,
                    dismissedObj: {
                        configState: CONFIG_STATES.ACTIVE
                    }
                };
                result.push(formattedRegItem);
            }
        }
    });

    // If no active data than also we need to add configs from dismissed data
    if (data?.length === 0 && dismissedData?.length > 0) {
        dismissedData?.map((item: any) => {
            const formattedItem = {
                ...item,
                name: item?.configurationName,
                configState: item.configState,
                dismissedObj: {
                    configState: item.configState,
                    startTime: item?.startTime,
                    endTime: item?.endTime
                }
            };
            result.push(formattedItem);
        });
    }
    return result;
};

export const categorizeStateInstances = (data: any, type: string) => {
    const successList: any = [];
    const failedList: any = [];

    data?.dismissedConfigurations?.map((config: any) => {
        config?.databaseHosts?.map((host: any) => {
            const { id, credentialsId, region, status, failedInstances } = host;

            if (status.toLowerCase() === 'success') {
                host?.sqlServerInstances?.map((instanceId: string) => {
                    successList.push({
                        id: config?.configurationName,
                        name: type,
                        hostId: id,
                        instanceId,
                        credentialId: credentialsId,
                        regionId: region,
                        state: config?.configState,
                        startTime: config?.startTime,
                        endTime: config?.endTime
                    });
                });
            } else if (status.toLowerCase() === 'failed') {
                host?.sqlServerInstances?.map((instanceId: string) => {
                    failedList.push({
                        id: config?.configurationName,
                        name: type,
                        hostId: id,
                        instanceId,
                        credentialId: credentialsId,
                        regionId: region,
                        state: config?.configState,
                        startTime: config?.startTime,
                        endTime: config?.endTime
                    });
                });
            } else if (status.toLowerCase() === 'partial' && failedInstances) {
                host?.sqlServerInstances?.map((instanceId: string) => {
                    if (failedInstances?.[instanceId]) {
                        failedList.push({
                            id: config?.configurationName,
                            name: type,
                            hostId: id,
                            instanceId,
                            credentialId: credentialsId,
                            regionId: region,
                            state: config?.configState,
                            startTime: config?.startTime,
                            endTime: config?.endTime
                        });
                    } else {
                        successList.push({
                            id: config?.configurationName,
                            name: type,
                            hostId: id,
                            instanceId,
                            credentialId: credentialsId,
                            regionId: region,
                            state: config?.configState,
                            startTime: config?.startTime,
                            endTime: config?.endTime
                        });
                    }
                });
            }
        });
    });

    return { successList, failedList };
};

/**
 * Transform log analyzer data into unique rows based on databaseHostName, databaseHostId,
 * databaseInstanceName, databaseInstanceId, credentialId, regionId
 * and add sandboxCount field
 */
export const createLogAnalyzerNotActiveInstance = (tableData: any) => {
    const state = store.getState();
    const { inventoryTableData, allLogAnalysisData, allLogAnalysisLoading } = state.inventoryV2;
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;

    if (!inventoryTableData) {
        return [];
    }

    const newTableData: any[] = [];

    const uniqueResourceList: Array<string> = [];
    let id = 1;
    Object.keys(inventoryTableData)?.forEach((key: any) => {
        const item = inventoryTableData[key];
        if (
            !headerSelectedMultiCredIdsList.includes(item?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(item?.regionId) ||
            uniqueResourceList.includes(item?.resourceId || '') ||
            item?.managedInstance === 0 ||
            !(item?.hostType === DBType.MSSQL || item?.hostType === DBType.ORACLE)
        ) {
            return;
        }
        uniqueResourceList.push(item?.resourceId || '');

        item?.sqlServerInstances?.forEach((instance: any) => {
            if (instance?.statusColText !== INVENTORY_STATUS.MANAGED) {
                return;
            }
            let logAnalyzerRow = allLogAnalysisData?.find(
                (perLa: any) =>
                    uniqueHostRow(perLa?.databaseHostId, perLa?.credentialId || '', perLa?.regionId || '') === key &&
                    perLa?.databaseInstanceId === instance?.databaseInstanceId
            );
            if (!logAnalyzerRow) {
                logAnalyzerRow = allLogAnalysisData?.find(
                    (perLa: any) =>
                        perLa?.databaseHostId === instance?.resourceId &&
                        perLa?.credentialId === item?.credentialId &&
                        perLa?.regionId === item?.regionId &&
                        perLa?.databaseInstanceId === instance?.databaseInstanceId
                );
            }
            const logAnalyzerStatus = logAnalyzerRow?.status || ERROR_ANALYZER_STATUS.NOT_ACTIVE;
            if (logAnalyzerStatus === ERROR_ANALYZER_STATUS.ACTIVE) {
                return;
            }
            newTableData.push({
                databaseHostName: item?.name,
                databaseHostId: item?.resourceId,
                databaseInstanceName: instance?.databaseInstanceName,
                databaseInstanceId: instance?.databaseInstanceId,
                credentialId: item?.credentialId,
                regionId: item?.regionId,
                type: item?.hostType,
                status: instance?.status,
                id: id++,
                logAnalyzer: {
                    loading: allLogAnalysisLoading,
                    errorCount: logAnalyzerRow?.latestReport?.errorCount || 0,
                    status: logAnalyzerStatus,
                    lastScan: logAnalyzerRow?.latestReport?.creationTime || '',
                    severityCounts: {
                        important: logAnalyzerRow?.latestReport?.severityCounts?.important || 0,
                        critical: logAnalyzerRow?.latestReport?.severityCounts?.critical || 0,
                        severe: logAnalyzerRow?.latestReport?.severityCounts?.severe || 0
                    }
                },
                ec2InstanceId: item?.ec2InstanceId,
                fsxId: instance?.fsxId,
                sqlServerDeploymentType: instance?.sqlServerDeploymentType,
                cellProps: {
                    isDisabled: instance?.status === STATUS_CONST.DOWN || instance?.status === INVENTORY_STATUS.STOPPED
                }
            });
        });
    });

    return newTableData;
};

/**
 * Transform log analyzer data into unique rows based on databaseHostName, databaseHostId,
 * databaseInstanceName, databaseInstanceId, credentialId, regionId
 * and add sandboxCount field
 */
export const createLogAnalyzerActiveInstance = (tableData: any[]) => {
    const state = store.getState();
    const { inventoryTableData, allLogAnalysisData, allLogAnalysisLoading } = state.inventoryV2;
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;

    if (!inventoryTableData) {
        return [];
    }

    const newTableData: any[] = [];

    const uniqueResourceList: Array<string> = [];
    let id = 1;
    Object.keys(inventoryTableData)?.forEach((key: any) => {
        const item = inventoryTableData[key];
        if (
            !headerSelectedMultiCredIdsList.includes(item?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(item?.regionId) ||
            uniqueResourceList.includes(item?.resourceId || '') ||
            item?.managedInstance === 0 ||
            !(item?.hostType === DBType.MSSQL || item?.hostType === DBType.ORACLE)
        ) {
            return;
        }
        uniqueResourceList.push(item?.resourceId || '');

        item?.sqlServerInstances?.forEach((instance: any) => {
            if (instance?.statusColText !== INVENTORY_STATUS.MANAGED) {
                return;
            }
            let logAnalyzerRow = allLogAnalysisData?.find(
                (perLa: any) =>
                    uniqueHostRow(perLa?.databaseHostId, perLa?.credentialId || '', perLa?.regionId || '') === key &&
                    perLa?.databaseInstanceId === instance?.databaseInstanceId
            );
            if (!logAnalyzerRow) {
                logAnalyzerRow = allLogAnalysisData?.find(
                    (perLa: any) =>
                        perLa?.databaseHostId === instance?.resourceId &&
                        perLa?.credentialId === item?.credentialId &&
                        perLa?.regionId === item?.regionId &&
                        perLa?.databaseInstanceId === instance?.databaseInstanceId
                );
            }
            const logAnalyzerStatus = logAnalyzerRow?.status || ERROR_ANALYZER_STATUS.NOT_ACTIVE;
            if (logAnalyzerStatus !== ERROR_ANALYZER_STATUS.ACTIVE) {
                return;
            }
            newTableData.push({
                databaseHostName: item?.name,
                databaseHostId: item?.resourceId,
                databaseInstanceName: instance?.databaseInstanceName,
                databaseInstanceId: instance?.databaseInstanceId,
                credentialId: item?.credentialId,
                regionId: item?.regionId,
                type: item?.hostType,
                status: instance?.status,
                id: id++,
                logAnalyzerErrorCount: logAnalyzerRow?.latestReport?.errorCount || 0,
                logAnalyzer: {
                    loading: allLogAnalysisLoading,
                    errorCount: logAnalyzerRow?.latestReport?.errorCount || 0,
                    status: logAnalyzerStatus,
                    lastScan: logAnalyzerRow?.latestReport?.creationTime || '',
                    severityCounts: {
                        important: logAnalyzerRow?.latestReport?.severityCounts?.important || 0,
                        critical: logAnalyzerRow?.latestReport?.severityCounts?.critical || 0,
                        severe: logAnalyzerRow?.latestReport?.severityCounts?.severe || 0
                    }
                },
                ec2InstanceId: item?.ec2InstanceId,
                fsxId: instance?.fsxId,
                sqlServerDeploymentType: instance?.sqlServerDeploymentType,
                cellProps: {
                    isDisabled: instance?.status === STATUS_CONST.DOWN || instance?.status === INVENTORY_STATUS.STOPPED
                }
            });
        });
    });

    return newTableData;
};

/**
 * Formats offline (WAD) assessment data to match the assessment data format used by
 * allmssqlHostAssessmentData and allOracleHostAssessmentData.
 *
 * Offline data structure (flat instance-level):
 * { resourceId, databaseInstanceId, databaseInstanceName, credentialsId, region, regionName,
 *   vmName, virtualNetworkId, virtualNetworkName, clusterNodes, assessments, isWad }
 *
 * Target assessment data structure (hierarchical host-level):
 * { credentialId, databaseHostId, databaseHostName, regionId, isWad,
 *   instancesAssessment: [{ databaseInstanceId, databaseInstanceName, assessments }] }
 *
 * @param offlineData - The flat offline assessment data array
 * @param dbType - The database type ('mssql' or 'oracle')
 * @returns Formatted assessment data array matching the hierarchical structure
 */
export const formatOfflineDataToAssessmentFormat = (offlineData: any[], dbType: 'mssql' | 'oracle'): any[] => {
    if (!offlineData || offlineData.length === 0) {
        return [];
    }

    // Group items by host (resourceId + credentialId + regionId)
    const hostGroups: { [key: string]: any[] } = {};

    offlineData.forEach((instanceData: any) => {
        // Use resourceId as host identifier, fallback to vmName
        const hostId =
            instanceData?.resourceId ||
            (dbType === 'oracle' ? `wad-oracle-${instanceData?.vmName}` : `wad-${instanceData?.vmName}`);
        const credId = instanceData?.credentialId || instanceData?.credentialsId || '';
        const regionId = instanceData?.regionId || instanceData?.region || '';

        // Create a unique key for grouping instances by host
        const groupKey = `${hostId}_${credId}_${regionId}`;

        if (!hostGroups[groupKey]) {
            hostGroups[groupKey] = [];
        }
        hostGroups[groupKey].push(instanceData);
    });

    // Create assessment data entries for each host group
    const result: any[] = [];

    Object.keys(hostGroups).forEach((groupKey: string) => {
        const instances = hostGroups[groupKey];
        const firstInstance = instances[0]; // Use first instance for host-level data

        const hostId =
            firstInstance?.resourceId ||
            (dbType === 'oracle' ? `wad-oracle-${firstInstance?.vmName}` : `wad-${firstInstance?.vmName}`);
        const credId = firstInstance?.credentialId || firstInstance?.credentialsId || '';
        const regionId = firstInstance?.regionId || firstInstance?.region || '';

        // Format instancesAssessment array from the grouped instances
        const instancesAssessment: any[] = instances.map((instanceData: any) => ({
            databaseInstanceId: instanceData?.databaseInstanceId,
            databaseInstanceName: instanceData?.databaseInstanceName,
            assessments: instanceData?.assessments
                ? {
                      ...instanceData.assessments,
                      lastAssessmentTimestamp: instanceData.assessments?.lastAssessmentTimestamp || Date.now()
                  }
                : null,
            error: instanceData?.error || null
        }));

        // Create host-level assessment data entry
        const hostAssessmentData: any = {
            databaseHostId: hostId,
            databaseHostName: firstInstance?.assessments?.databaseHostName,
            credentialId: credId,
            regionId,
            region: firstInstance?.region || '',
            regionName: firstInstance?.regionName || '',
            virtualNetworkId: firstInstance?.virtualNetworkId || '',
            virtualNetworkName: firstInstance?.virtualNetworkName || '',
            vmInstanceId: firstInstance?.vmInstanceId || '',
            vmName: firstInstance?.vmName || '',
            numberOfDatabaseInstances: instances.length,
            isWad: true,
            instancesAssessment
        };

        result.push(hostAssessmentData);
    });

    return result;
};
