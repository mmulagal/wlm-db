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
    GETWELL_STATUS,
    GETWELL_VALUES,
    INVENTORY_STATUS,
    ORACLE_DATABASES_COMPONENTS,
    STATUS_CONST,
    WAD_EXCLUDED_FLAT_CONFIG_IDS_MSSQL,
    WAD_EXCLUDED_FLAT_CONFIG_IDS_ORACLE,
    WellArchitectedCategory,
    ASSESSMENT_CONFIG_CATALOG_KEYS,
    ASSESSMENT_GROUPED_CONFIG_KEYS,
    WIZARD_TYPE
} from '../../utils/consts';
import {
    formatFractionalNumber,
    formatSizeOnePrecision,
    isAwsBackupEnabled,
    roundOffNumber,
    sortListOfDict
} from '../../utils/utilityFunctions';
import { formatOptimizationBreakDown, getCardsData, isAoagDeployment } from '../GetWell/GetWellUtils';
import { uniqueHostRow } from '../InventoryV2/InventoryUtilsV2';
import {
    formatOracleOptimizationBreakDown,
    getOracleCardsData
} from '../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import {
    getAssessmentById,
    getAssessmentItems,
    getDismissedConfig,
    hasAssessmentTimestamp
} from '../WellArchitectedTab/assessmentFormatUtils';

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
        const uniqueKey = `${keyList?.[0]}_${keyList?.[2]}`;
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(uniqueKey)
        ) {
            return;
        }
        uniqueResourceList.push(uniqueKey);
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
        const uniqueKey = `${item?.resourceId}_${item?.regionId}`;
        if (
            uniqueResourceList.includes(uniqueKey) ||
            item?.managedInstance === 0 ||
            item?.hostType !== type ||
            shouldSkipByHeaderFilters(item, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList)
        ) {
            return;
        }
        uniqueResourceList.push(uniqueKey);
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
        totalEbsCost: 0,
        fsxwCost: 0,
        fsxnCost: 0,
        totalFsxnCostForEbsHost: 0,
        fsxnCostForFsxwHost: 0,
        savings: 0,
        savingsPercent: 0,
        noSavings: false,
        oracleEbsCost: 0,
        oracleFsxnCostForEbsHost: 0,
        mssqlEbsCost: 0,
        mssqlFsxnCostForEbsHost: 0
    };

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    Object.keys(data).map((key: string) => {
        const val = data[key];

        // Handle bulk entries (format: bulk_oracle_ebs_credId_regionId_batch_batchIndex)
        if (val?.isBulk) {
            const keyList = key.split('_');
            // For bulk keys: bulk_oracle_ebs_credId_regionId_batch_batchIndex -> credId is at index 3, regionId at index 4
            const bulkCredId = keyList?.[3];
            const bulkRegionId = keyList?.[4];
            const isOracle = keyList?.[1] === WIZARD_TYPE.ORACLE;

            if (
                !headerSelectedMultiCredIdsList.includes(bulkCredId) ||
                !headerSelectedMultiRegionIdsList.includes(bulkRegionId) ||
                uniqueResourceList.includes(key)
            ) {
                return;
            }
            uniqueResourceList.push(key);

            if (val?.loading) {
                result.loading = true;
            }
            if (val?.data) {
                // Bulk entries are only for EBS (Oracle bulk API)
                result.fsxnCost += val?.data?.totalSummary?.recommended || 0;
                result.totalFsxnCostForEbsHost += val?.data?.totalSummary?.recommended || 0;
                result.totalEbsCost += val?.data?.totalSummary?.existing || 0;

                // Track Oracle and MSSQL EBS separately for chart colors
                if (isOracle) {
                    result.oracleFsxnCostForEbsHost += val?.data?.totalSummary?.recommended || 0;
                    result.oracleEbsCost += val?.data?.totalSummary?.existing || 0;
                } else {
                    result.mssqlFsxnCostForEbsHost += val?.data?.totalSummary?.recommended || 0;
                    result.mssqlEbsCost += val?.data?.totalSummary?.existing || 0;
                }
            }
            return;
        }

        // Handle per-instance entries (format: instanceId_credId_regionId)
        const keyList = key.split('_');
        const uniqueKey = `${keyList?.[0]}_${keyList?.[2]}`;
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(uniqueKey)
        ) {
            return;
        }
        uniqueResourceList.push(uniqueKey);

        if (val?.loading) {
            result.loading = true;
        }
        if (val?.data) {
            result.fsxnCost += val?.data?.totalSummary?.recommended || 0;
            if (val?.storageType === GENERAL.EBS) {
                result.totalFsxnCostForEbsHost += val?.data?.totalSummary?.recommended || 0;
                result.totalEbsCost += val?.data?.totalSummary?.existing || 0;
                // Per-instance entries are MSSQL (FSxW)
                result.mssqlFsxnCostForEbsHost += val?.data?.totalSummary?.recommended || 0;
                result.mssqlEbsCost += val?.data?.totalSummary?.existing || 0;
            } else if (val?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                result.fsxnCostForFsxwHost += val?.data?.totalSummary?.recommended || 0;
                result.fsxwCost += val?.data?.totalSummary?.existing || 0;
            }
        }
    });

    result.savings = (result?.totalEbsCost || 0) + (result?.fsxwCost || 0) - (result?.fsxnCost || 0);

    result.savingsPercent =
        100 *
        ((result.totalEbsCost + result.fsxwCost - result.fsxnCost) / (result.totalEbsCost + result.fsxwCost || 1));

    if (result.fsxnCost !== 0 && result.fsxnCost >= result.totalEbsCost + result.fsxwCost) {
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
        const uniqueKey = `${keyList?.[0]}_${keyList?.[2]}`;
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(uniqueKey)
        ) {
            return;
        }

        uniqueResourceList.push(uniqueKey);

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
        const uniqueKey = `${keyList?.[0]}_${keyList?.[2]}`;
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(uniqueKey)
        ) {
            return;
        }

        uniqueResourceList.push(uniqueKey);

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
        const uniqueKey = `${keyList?.[0]}_${keyList?.[2]}`;
        if (
            !headerSelectedMultiCredIdsList.includes(keyList?.[1]) ||
            !headerSelectedMultiRegionIdsList.includes(keyList?.[2]) ||
            uniqueResourceList.includes(uniqueKey)
        ) {
            return;
        }

        uniqueResourceList.push(uniqueKey);
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
 * Filters out hosts based on credential/region header selections and deduplicates by host ID and region.
 * If the host should NOT be skipped, it is added to the uniqueResourceList to prevent future duplicates.
 */
export const shouldSkipDatabaseHost = (
    databaseHost: any,
    headerSelectedMultiCredIdsList: string[],
    headerSelectedMultiRegionIdsList: string[],
    uniqueResourceList: string[]
): boolean => {
    const uniqueKey = `${databaseHost?.databaseHostId}_${databaseHost?.regionId}`;
    if (uniqueResourceList.includes(uniqueKey)) {
        return true;
    }

    if (shouldSkipByHeaderFilters(databaseHost, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList)) {
        return true;
    }

    uniqueResourceList.push(uniqueKey);
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
            if (!instance?.error && instance?.assessments?.metadata?.lastAssessmentTimestamp) {
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
                const isLicenseOptimized = isAoagDeployment(instanceAssessmentData?.metadata?.deploymentType)
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
 * Counts all individual flat-format assessment configs for an instance into the provided counters.
 * Respects WAD exclusion lists and tracks per-category counts.
 */
const countInstanceAssessmentConfigs = (
    instanceAssessment: any,
    counters: ConfigCounters,
    isWad: boolean,
    dbType: string
) => {
    const excludedIds =
        dbType === DBType.ORACLE ? WAD_EXCLUDED_FLAT_CONFIG_IDS_ORACLE : WAD_EXCLUDED_FLAT_CONFIG_IDS_MSSQL;

    getAssessmentItems(instanceAssessment).forEach(item => {
        const configId = item.id;
        if (!configId || (isWad && excludedIds.has(configId))) {
            return;
        }

        const category = item.type as WellArchitectedCategory;
        countSingleConfig(
            counters,
            item.status,
            getDismissedConfig(instanceAssessment, configId)?.configState,
            item.severity,
            category
        );
    });
};

const countMSSQLInstanceConfigs = (instanceAssessment: any, counters: ConfigCounters, isWad = false) => {
    countInstanceAssessmentConfigs(instanceAssessment, counters, isWad, DBType.MSSQL);
};

const countOracleInstanceConfigs = (instanceAssessment: any, counters: ConfigCounters, isWad = false) => {
    countInstanceAssessmentConfigs(instanceAssessment, counters, isWad, DBType.ORACLE);
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
            if (!instance?.error && hasAssessmentTimestamp(instance?.assessments)) {
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
            if (!instance?.error && hasAssessmentTimestamp(instance?.assessments)) {
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

    if (configName === 'fra-dg-lun-layout' && !getAssessmentById(instanceAssessmentData, 'fra-dg-lun-layout')) {
        return false;
    }

    if (
        configName === 'archivelog-dg-lun-layout' &&
        !getAssessmentById(instanceAssessmentData, 'archivelog-dg-lun-layout')
    ) {
        return false;
    }

    return true;
};

export const getConfigStateList = (
    mergedData: any[],
    mergedDismissedData: any[],
    configEngineType?: string,
    formattedData?: any
) => {
    // Get config state list for any instance/database based on all sub configurations
    if (!formattedData) {
        formattedData = formatAssessmentTableData(mergedData, mergedDismissedData);
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

const ensureConfigStatsBucket = (result: Record<string, any>, configId: string) => {
    if (!result[configId]) {
        result[configId] = {
            optimized: 0,
            dismissed: 0,
            activating: 0,
            total: 0
        };
    }
};

const processInstanceForGroupedConfigs = (
    instanceAssessment: any,
    result: Record<string, any>,
    dbType: string,
    isWad: boolean
) => {
    const excludedIds =
        dbType === DBType.ORACLE ? WAD_EXCLUDED_FLAT_CONFIG_IDS_ORACLE : WAD_EXCLUDED_FLAT_CONFIG_IDS_MSSQL;
    const configIdsKey =
        dbType === DBType.ORACLE
            ? ASSESSMENT_GROUPED_CONFIG_KEYS.CONFIG_IDS.ORACLE
            : ASSESSMENT_GROUPED_CONFIG_KEYS.CONFIG_IDS.MSSQL;
    const statsKey =
        dbType === DBType.ORACLE
            ? ASSESSMENT_GROUPED_CONFIG_KEYS.STATS.ORACLE
            : ASSESSMENT_GROUPED_CONFIG_KEYS.STATS.MSSQL;
    const configStateKey =
        dbType === DBType.ORACLE
            ? ASSESSMENT_GROUPED_CONFIG_KEYS.CONFIG_STATE.ORACLE
            : ASSESSMENT_GROUPED_CONFIG_KEYS.CONFIG_STATE.MSSQL;
    const severityKey =
        dbType === DBType.ORACLE
            ? ASSESSMENT_GROUPED_CONFIG_KEYS.SEVERITY_OBJ.ORACLE
            : ASSESSMENT_GROUPED_CONFIG_KEYS.SEVERITY_OBJ.MSSQL;

    if (!result[statsKey]) {
        result[statsKey] = {};
    }
    if (!result[configStateKey]) {
        result[configStateKey] = {};
    }
    if (!result[severityKey]) {
        result[severityKey] = {};
    }

    const statsMap = result[statsKey];
    const configStateMap = result[configStateKey];
    const severityMap = result[severityKey];

    getAssessmentItems(instanceAssessment).forEach(item => {
        const configId = item.id;
        if (!configId || (isWad && excludedIds.has(configId))) {
            return;
        }

        ensureConfigStatsBucket(statsMap, configId);
        statsMap[configId].total += 1;

        const dismissState = getDismissedConfig(instanceAssessment, configId)?.configState;
        setConfigState(configStateMap, configId, dismissState ?? '');

        if (isOptimizedDashInner(item.status, dismissState)) {
            statsMap[configId].optimized += 1;
        }
        if (isDismissed(dismissState)) {
            statsMap[configId].dismissed += 1;
        }
        if (isActivating(dismissState)) {
            statsMap[configId].activating += 1;
        }

        severityMap[configId] = GETWELL_VALUES[item.severity ?? ''] || severityMap[configId];

        const catalogKey =
            dbType === DBType.ORACLE ? ASSESSMENT_CONFIG_CATALOG_KEYS.ORACLE : ASSESSMENT_CONFIG_CATALOG_KEYS.MSSQL;
        if (!result[catalogKey]) {
            result[catalogKey] = {};
        }
        if (!result[catalogKey][configId]) {
            result[catalogKey][configId] = { ...item, dbType };
        }
        if (!result[ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED][configId]) {
            result[ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED][configId] = { ...item, dbType };
        }

        if (!result[configIdsKey].includes(configId)) {
            result[configIdsKey].push(configId);
        }
    });
};

const buildAssessmentGroupedByConfigurations = (assessmentData: any, oracleAssessmentData?: any) => {
    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    const result: Record<string, any> = {
        total: 0,
        oracleTotal: 0,
        configState: {},
        severityObj: {},
        mssqlStats: {},
        oracleStats: {},
        mssqlConfigState: {},
        oracleConfigState: {},
        mssqlSeverityObj: {},
        oracleSeverityObj: {},
        [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: {},
        [ASSESSMENT_CONFIG_CATALOG_KEYS.MSSQL]: {},
        [ASSESSMENT_CONFIG_CATALOG_KEYS.ORACLE]: {},
        mssqlConfigIds: [],
        oracleConfigIds: []
    };

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
            if (!instance?.error && hasAssessmentTimestamp(instance?.assessments)) {
                result.total += 1;
                processInstanceForGroupedConfigs(instance.assessments, result, DBType.MSSQL, !!databaseHost?.isWad);
            }
        });
    });

    const oracleUniqueResourceList: Array<string> = [];
    oracleAssessmentData?.forEach((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                oracleUniqueResourceList
            )
        ) {
            return;
        }

        databaseHost?.instancesAssessment?.forEach((instance: any) => {
            if (!instance?.error && hasAssessmentTimestamp(instance?.assessments)) {
                result.oracleTotal += 1;
                processInstanceForGroupedConfigs(instance.assessments, result, DBType.ORACLE, !!databaseHost?.isWad);
            }
        });
    });

    return result;
};

export const getInstanceOptimizationBreakdown = (
    instanceAssessment: any,
    isWad = false,
    dbType: string = DBType.MSSQL
) => {
    const counters = createEmptyCounters();
    countInstanceAssessmentConfigs(instanceAssessment, counters, isWad, dbType);
    const total = counters.totalConfigurations;
    const optimized = counters.optimizedConfigurations;

    return {
        percent: total > 0 ? Math.round((optimized / total) * 100) : 0,
        optimized,
        notOptimized: total - optimized,
        total
    };
};

export const getAssessmentGroupedByConfigurations = (assessmentData: any, oracleAssessmentData?: any) =>
    buildAssessmentGroupedByConfigurations(assessmentData, oracleAssessmentData);

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
            if (!instance?.error && instance?.assessments?.metadata?.lastAssessmentTimestamp) {
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
            if (!instance?.error && instance?.assessments?.metadata?.lastAssessmentTimestamp) {
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

// TODO: Fix this function it as part of dismiss workflow mirgration. use id or name instead of configurationName.
export const formatAssessmentTableData = (data: any, dismissedData: any) => {
    const result: any = [];
    data?.map((item: any) => {
        if (!item?.error && !item?.errorMessage) {
            const formattedItem = {
                ...item,
                name: item?.name,
                status: GETWELL_VALUES?.[item?.status] || item?.status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            };

            // Check if there's a matching dismissed data entry
            const matchingDismissedItem = dismissedData?.find((dismissedItem: any) => dismissedItem?.id === item?.id);

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
export const formatOfflineDataToAssessmentFormat = (
    offlineData: any[],
    dbType: typeof DBType.MSSQL | typeof DBType.ORACLE
): any[] => {
    if (!offlineData || offlineData.length === 0) {
        return [];
    }

    // Group items by host (resourceId + credentialId + regionId)
    const hostGroups: { [key: string]: any[] } = {};

    offlineData.forEach((instanceData: any) => {
        // Use resourceId as host identifier, fallback to vmName
        const hostId =
            instanceData?.resourceId ||
            (dbType === DBType.ORACLE ? `wad-oracle-${instanceData?.vmName}` : `wad-${instanceData?.vmName}`);
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
            (dbType === DBType.ORACLE ? `wad-oracle-${firstInstance?.vmName}` : `wad-${firstInstance?.vmName}`);
        const credId = firstInstance?.credentialId || firstInstance?.credentialsId || '';
        const regionId = firstInstance?.regionId || firstInstance?.region || '';

        // Format instancesAssessment array from the grouped instances
        const instancesAssessment: any[] = instances.map((instanceData: any) => ({
            databaseInstanceId: instanceData?.databaseInstanceId,
            databaseInstanceName: instanceData?.databaseInstanceName,
            assessments: instanceData?.assessments || null,
            error: instanceData?.error || null
        }));

        // Create host-level assessment data entry
        const hostAssessmentData: any = {
            databaseHostId: hostId,
            databaseHostName: firstInstance?.assessments?.metadata?.databaseHostName,
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
