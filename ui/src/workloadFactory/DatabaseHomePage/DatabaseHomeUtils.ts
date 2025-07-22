// eslint-disable-next-line import/no-cycle
import store from '../../store/store';
import { setManagedHostInstanceLoading } from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    CONFIG_STATES,
    COSTING_TYPES,
    FINDINGS,
    GETWELL_CONFIG,
    GETWELL_VALUES,
    INVENTORY_STATUS,
    STATUS_CONST,
    WIZARD_TYPE
} from '../../utils/consts';
import {
    formatFractionalNumber,
    formatSizeOnePrecision,
    formatSizeSplit,
    getByteVal,
    isAwsBackupEnabled,
    roundOffNumber,
    sortListOfDict
} from '../../utils/utilityFunctions';
import { formatOptimizationBreakDown, getCardsData } from '../GetWell/GetWellUtils';
import { uniqueHostRow } from '../InventoryV2/InventoryUtilsV2';

export const getManagedHostCount = (data: any, dispatch: any, type: string = WIZARD_TYPE.MSSQL) => {
    let totalDatabases = 0;
    let totahosts = 0;
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
        totahosts += 1;
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
        totalHosts: totahosts,
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

export const getTotalManagedAggrStorageSavings = (mssqlSavingsObj: any, pgsqlSavingsObj: any) => {
    const { storageConsumes: mssqlStorageConsumes, storageSavings: mssqlStorageSavings } = mssqlSavingsObj;
    const { storageConsumes: pgsqlStorageConsumes, storageSavings: pgsqlStorageSavings } = pgsqlSavingsObj;
    const { value: mssqlConsumesVal, format: mssqlConsumesUnit } = formatSizeSplit(mssqlStorageConsumes);
    const { value: mssqlSavingsVal, format: mssqlSavingsUnit } = formatSizeSplit(mssqlStorageSavings);
    const { value: pgsqlConsumesVal, format: pgsqlConsumesUnit } = formatSizeSplit(pgsqlStorageConsumes);
    const { value: pgsqlSavingsVal, format: pgsqlSavingsUnit } = formatSizeSplit(pgsqlStorageSavings);
    const totalConsumesVal =
        getByteVal(parseFloat(mssqlConsumesVal), mssqlConsumesUnit.toLowerCase()) +
        getByteVal(parseFloat(pgsqlConsumesVal), pgsqlConsumesUnit.toLowerCase());
    const totalSavingVal =
        getByteVal(parseFloat(mssqlSavingsVal), mssqlSavingsUnit.toLowerCase()) +
        getByteVal(parseFloat(pgsqlSavingsVal), pgsqlSavingsUnit.toLowerCase());
    return {
        storageConsumes: formatSizeOnePrecision(totalConsumesVal),
        storageSavings: formatSizeOnePrecision(totalSavingVal),
        storageSavingsPercent: (totalSavingVal / (totalConsumesVal + totalSavingVal || 1)) * 100 || 0
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
            !headerSelectedMultiCredIdsList.includes(databaseHost?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(databaseHost?.regionId) ||
            uniqueResourceList.includes(databaseHost?.databaseHostId)
        ) {
            return;
        }
        uniqueResourceList.push(databaseHost?.databaseHostId);

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
                const isLicenseOptimized = isOptimized(
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

export const getAssessmentGroupedByCategory = (assessmentData: any) => {
    const assessmentGroupedByCategory: any = {
        storage: 0,
        compute: 0,
        application: 0,
        resiliency: 0,
        cloning: 0,
        total: 0
    };

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    assessmentData.map((databaseHost: any) => {
        if (
            !headerSelectedMultiCredIdsList.includes(databaseHost?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(databaseHost?.regionId) ||
            uniqueResourceList.includes(databaseHost?.databaseHostId)
        ) {
            return;
        }
        uniqueResourceList.push(databaseHost?.databaseHostId);

        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                assessmentGroupedByCategory.total++;
                const instanceAssessmentData = instance?.assessments;
                const isComputeOptimized = isOptimized(
                    instanceAssessmentData?.compute?.status,
                    instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                );
                const isOperatingSystemPatchOptimized = isOptimized(
                    instanceAssessmentData?.hostOsPatch?.status,
                    instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                );
                const isRssConfigurationOptimized = isOptimized(
                    instanceAssessmentData?.rssConfig?.status,
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                );
                const isStorageLayoutOptimized = instanceAssessmentData?.storage?.layout?.every((item: any) => {
                    const configState = instanceAssessmentData?.dismissedConfigurations?.storage?.layout?.find(
                        (config: any) => config.configurationName === item.name
                    )?.configState;
                    return isOptimized(item?.status, configState);
                });
                const isStorageSizingOptimized = instanceAssessmentData?.storage?.sizing?.every((item: any) => {
                    const configState = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                        (config: any) => config.configurationName === item.name
                    )?.configState;
                    return isOptimized(item?.status, configState);
                });
                const isAllStorageSizingPresent =
                    instanceAssessmentData?.storage?.sizing?.length === 4 &&
                    instanceAssessmentData?.storage.sizing.every((item: any) =>
                        ['headroom', 'tempdb-drive-size', 'log-drive-size', 'performance-tier'].includes(item?.name)
                    );
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
                const isApplicationOptimized = isOptimized(
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
                const isScheduledLoclaSnapshotOptimized = isOptimized(
                    instanceAssessmentData?.snapshotPolicy?.status,
                    instanceAssessmentData?.dismissedConfigurations?.snapshotPolicy?.configState
                );
                const isScheduledAWSBackUpOptimized = isOptimized(
                    instanceAssessmentData?.awsBackup?.status,
                    instanceAssessmentData?.dismissedConfigurations?.awsBackup?.configState
                );
                const isAllMssqlHighAvailability =
                    instanceAssessmentData?.highAvailability?.length === 5 &&
                    instanceAssessmentData?.highAvailability.every((item: any) =>
                        [
                            'shared-storage',
                            'drive-letter',
                            'cluster-quorum',
                            'heartbeat-settings',
                            'sqlServer-service'
                        ].includes(item?.name)
                    );

                const isMssqlHighAvailabilityOptimized = instanceAssessmentData?.highAvailability?.every(
                    (item: any) => {
                        const configState = instanceAssessmentData?.dismissedConfigurations?.highAvailability?.find(
                            (config: any) => config.configurationName === item.name
                        )?.configState;
                        return isOptimized(item?.status, configState);
                    }
                );

                const isCloneOptimized = isOptimized(
                    instanceAssessmentData?.clone?.status,
                    instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                );
                const isCRROptimized = isOptimized(
                    instanceAssessmentData?.crr?.status,
                    instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                );

                if (isComputeOptimized && isOperatingSystemPatchOptimized && isRssConfigurationOptimized) {
                    assessmentGroupedByCategory.compute++;
                }
                if (
                    isStorageLayoutOptimized &&
                    isAllStorageSizingPresent &&
                    isStorageSizingOptimized &&
                    isStorageConfigOptimized
                ) {
                    assessmentGroupedByCategory.storage++;
                }
                if (isApplicationOptimized && isMicrosoftSqlPatchOptimized && isMaxdopPatchOptimized) {
                    assessmentGroupedByCategory.application++;
                }
                if (
                    isScheduledLoclaSnapshotOptimized &&
                    isCRROptimized &&
                    isScheduledAWSBackUpOptimized &&
                    isMssqlHighAvailabilityOptimized &&
                    isAllMssqlHighAvailability
                ) {
                    assessmentGroupedByCategory.resiliency++;
                }

                if (isCloneOptimized) {
                    assessmentGroupedByCategory.cloning++;
                }
            }
        });
    });
    return assessmentGroupedByCategory;
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

export const getAssessmentGroupedByConfigurations = (assessmentData: any) => {
    const getAssessmentGroupedByConfigurations: any = {
        storageTier: 0,
        fileSystemHeadroom: 0,
        logDriveSize: 0,
        tempdbDriveSize: 0,
        userDataFiles: 0,
        logFiles: 0,
        tempdbPlacement: 0,
        ontapConfiguration: 0,
        operatingSystem: 0,
        computeRightsizing: 0,
        operatingSystemPatch: 0,
        rssConfiguration: 0,
        applicationSqlServer: 0,
        mssqlPatch: 0,
        maxdopPatch: 0,
        scheduledLocalSnapshot: 0,
        scheduledawsBackup: 0,
        mssqlhighAvailability: 0,
        clone: 0,
        crr: 0,
        total: 0,
        severityObj: {}
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
        applicationSqlServer: [],
        mssqlPatch: [],
        maxdopPatch: [],
        scheduledLocalSnapshot: [],
        scheduledawsBackup: [],
        mssqlhighAvailability: [],
        clone: [],
        crr: []
    };

    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    assessmentData.map((databaseHost: any) => {
        if (
            !headerSelectedMultiCredIdsList.includes(databaseHost?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(databaseHost?.regionId) ||
            uniqueResourceList.includes(databaseHost?.databaseHostId)
        ) {
            return;
        }
        uniqueResourceList.push(databaseHost?.databaseHostId);

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
                const isStorageTierOptimized = isOptimized(perfTierObj?.status, perfTierStateObj?.configState);
                setConfigState(configState, 'storageTier', perfTierStateObj?.configState);

                const headroomObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'headroom'
                );
                const headroomStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'headroom'
                );
                const isFileSystemHeadroomOptimized = isOptimized(headroomObj?.status, headroomStateObj?.configState);
                setConfigState(configState, 'fileSystemHeadroom', headroomStateObj?.configState);

                const logDriveSizeObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'log-drive-size'
                );
                const logDriveSizeStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'log-drive-size'
                );
                const isLogDriveSizeOptimized = isOptimized(logDriveSizeObj?.status, logDriveSizeStateObj?.configState);
                setConfigState(configState, 'logDriveSize', logDriveSizeStateObj?.configState);

                const tempdbDriveSizeObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'tempdb-drive-size'
                );
                const tempdbDriveSizeStateObj = instanceAssessmentData?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'tempdb-drive-size'
                );
                const isTempdbDriveSizeOptimized = isOptimized(
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
                const isUserDataFilesOptimized = isOptimized(
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
                const isLogFilesOptimized = isOptimized(logFilesObj?.status, logFilesStateObj?.configState);
                setConfigState(configState, 'logFiles', logFilesStateObj?.configState);

                const tempdbFilesLocationObj = instanceAssessmentData?.storage?.layout?.find(
                    (item: any) => item.name === 'tempdb-files-location'
                );
                const tempdbFilesLocationStateObj =
                    instanceAssessmentData?.dismissedConfigurations?.storage?.layout?.find(
                        (item: any) => item?.configurationName === 'tempdb-files-location'
                    );
                const isTempdbPlacementOptimized = isOptimized(
                    tempdbFilesLocationObj?.status,
                    tempdbFilesLocationStateObj?.configState
                );
                setConfigState(configState, 'tempdbPlacement', tempdbFilesLocationStateObj?.configState);

                const isOntapConfigurationOptimized =
                    instanceAssessmentData?.storage &&
                    instanceAssessmentData?.storage?.configuration &&
                    instanceAssessmentData?.storage?.configuration?.luns?.every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.luns?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'ontapConfiguration', configStateVal);
                        return isOptimized(item?.status, configStateVal);
                    }) &&
                    instanceAssessmentData?.storage?.configuration?.volumes?.every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.volumes?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'ontapConfiguration', configStateVal);
                        return isOptimized(item?.status, configStateVal);
                    });
                const isOperatingSystemOptimized =
                    instanceAssessmentData &&
                    instanceAssessmentData?.storage &&
                    instanceAssessmentData?.storage?.configuration &&
                    instanceAssessmentData?.storage?.configuration?.os?.every((item: any) => {
                        const configStateVal =
                            instanceAssessmentData?.dismissedConfigurations?.storage?.configuration?.os?.find(
                                (config: any) => config?.configurationName === item.name
                            )?.configState;
                        setConfigState(configState, 'operatingSystem', configStateVal);
                        return isOptimized(item?.status, configStateVal);
                    });

                const isMssqlHighAvailabilityOptimized =
                    instanceAssessmentData &&
                    instanceAssessmentData?.highAvailability &&
                    instanceAssessmentData?.highAvailability?.every((item: any) => {
                        const configStateVal = instanceAssessmentData?.dismissedConfigurations?.highAvailability?.find(
                            (config: any) => config?.configurationName === item.name
                        )?.configState;
                        setConfigState(configState, 'highAvailability', configStateVal);
                        return isOptimized(item?.status, configStateVal);
                    });
                const isAllMssqlHighAvailability =
                    instanceAssessmentData?.highAvailability?.length === 5 &&
                    instanceAssessmentData?.highAvailability.every((item: any) =>
                        [
                            'shared-storage',
                            'drive-letter',
                            'cluster-quorum',
                            'heartbeat-settings',
                            'sqlServer-service'
                        ].includes(item?.name)
                    );
                const isComputeRightsizingOptimized = isOptimized(
                    instanceAssessmentData?.compute?.status,
                    instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                );
                setConfigState(
                    configState,
                    'computeRightsizing',
                    instanceAssessmentData?.dismissedConfigurations?.compute?.configState
                );

                const isOpearingSystemPatchOptimized = isOptimized(
                    instanceAssessmentData?.hostOsPatch?.status,
                    instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                );
                setConfigState(
                    configState,
                    'operatingSystemPatch',
                    instanceAssessmentData?.dismissedConfigurations?.hostOsPatch?.configState
                );

                const isRssConfigurationOptimized = isOptimized(
                    instanceAssessmentData?.rssConfig?.status,
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                );
                setConfigState(
                    configState,
                    'rssConfiguration',
                    instanceAssessmentData?.dismissedConfigurations?.rssConfig?.configState
                );

                const isApplicationSqlServerOptimized = isOptimized(
                    instanceAssessmentData?.license?.status,
                    instanceAssessmentData?.dismissedConfigurations?.license?.configState
                );
                setConfigState(
                    configState,
                    'applicationSqlServer',
                    instanceAssessmentData?.dismissedConfigurations?.license?.configState
                );

                const isMicrosoftSqlPatchOptimized = isOptimized(
                    instanceAssessmentData?.mssqlPatch?.status,
                    instanceAssessmentData?.dismissedConfigurations?.mssqlPatch?.configState
                );
                setConfigState(
                    configState,
                    'mssqlPatch',
                    instanceAssessmentData?.dismissedConfigurations?.mssqlPatch?.configState
                );

                const isMaxdopPatchOptimized = isOptimized(
                    instanceAssessmentData?.maxDOP?.status,
                    instanceAssessmentData?.dismissedConfigurations?.maxDOP?.configState
                );
                setConfigState(
                    configState,
                    'maxdopPatch',
                    instanceAssessmentData?.dismissedConfigurations?.maxDOP?.configState
                );

                const isScheduledLocalSnapshotOptimized = isOptimized(
                    instanceAssessmentData?.snapshotPolicy?.status,
                    instanceAssessmentData?.dismissedConfigurations?.snapshotPolicy?.configState
                );
                setConfigState(
                    configState,
                    'scheduledLocalSnapshot',
                    instanceAssessmentData?.dismissedConfigurations?.snapshotPolicy?.configState
                );

                const isScheduledawsBackupOptimized = isOptimized(
                    instanceAssessmentData?.awsBackup?.status,
                    instanceAssessmentData?.dismissedConfigurations?.awsBackup?.configState
                );
                setConfigState(
                    configState,
                    'scheduledawsBackup',
                    instanceAssessmentData?.dismissedConfigurations?.awsBackup?.configState
                );

                const isCloneOptimized = isOptimized(
                    instanceAssessmentData?.clone?.status,
                    instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                );
                setConfigState(
                    configState,
                    'clone',
                    instanceAssessmentData?.dismissedConfigurations?.clone?.configState
                );

                const isCrrOptimized = isOptimized(
                    instanceAssessmentData?.crr?.status,
                    instanceAssessmentData?.dismissedConfigurations?.crr?.configState
                );
                setConfigState(configState, 'crr', instanceAssessmentData?.dismissedConfigurations?.crr?.configState);

                getAssessmentGroupedByConfigurations.storageTier += isStorageTierOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.storageTier =
                    GETWELL_VALUES[perfTierObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.storageTier;
                getAssessmentGroupedByConfigurations.fileSystemHeadroom += isFileSystemHeadroomOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.fileSystemHeadroom =
                    GETWELL_VALUES[headroomObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.fileSystemHeadroom;
                getAssessmentGroupedByConfigurations.logDriveSize += isLogDriveSizeOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.logDriveSize =
                    GETWELL_VALUES[logDriveSizeObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.logDriveSize;
                getAssessmentGroupedByConfigurations.tempdbDriveSize += isTempdbDriveSizeOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.tempdbDriveSize =
                    GETWELL_VALUES[tempdbDriveSizeObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.tempdbDriveSize;
                getAssessmentGroupedByConfigurations.userDataFiles += isUserDataFilesOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.userDataFiles =
                    GETWELL_VALUES[userDataFilesObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.userDataFiles;
                getAssessmentGroupedByConfigurations.logFiles += isLogFilesOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.logFiles =
                    GETWELL_VALUES[logFilesObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.logFiles;
                getAssessmentGroupedByConfigurations.tempdbPlacement += isTempdbPlacementOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.tempdbPlacement =
                    GETWELL_VALUES[tempdbFilesLocationObj?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.tempdbPlacement;
                getAssessmentGroupedByConfigurations.ontapConfiguration += isOntapConfigurationOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.ontapConfiguration = 'Critical';
                getAssessmentGroupedByConfigurations.operatingSystem += isOperatingSystemOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.operatingSystem = 'Critical';
                getAssessmentGroupedByConfigurations.computeRightsizing += isComputeRightsizingOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.computeRightsizing =
                    GETWELL_VALUES[instanceAssessmentData?.compute?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.computeRightsizing;
                getAssessmentGroupedByConfigurations.operatingSystemPatch += isOpearingSystemPatchOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.operatingSystemPatch =
                    GETWELL_VALUES[instanceAssessmentData?.hostOsPatch?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.operatingSystemPatch;
                getAssessmentGroupedByConfigurations.rssConfiguration += isRssConfigurationOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.rssConfiguration =
                    GETWELL_VALUES[instanceAssessmentData?.rssConfig?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.rssConfiguration;
                getAssessmentGroupedByConfigurations.applicationSqlServer += isApplicationSqlServerOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.applicationSqlServer =
                    GETWELL_VALUES[instanceAssessmentData?.license?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.applicationSqlServer;
                getAssessmentGroupedByConfigurations.mssqlPatch += isMicrosoftSqlPatchOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.mssqlPatch =
                    GETWELL_VALUES[instanceAssessmentData?.mssqlPatch?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.mssqlPatch;
                getAssessmentGroupedByConfigurations.maxdopPatch += isMaxdopPatchOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.maxdopPatch =
                    GETWELL_VALUES[instanceAssessmentData?.maxDOP?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.maxdopPatch;
                getAssessmentGroupedByConfigurations.scheduledLocalSnapshot += isScheduledLocalSnapshotOptimized
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.scheduledLocalSnapshot =
                    GETWELL_VALUES[instanceAssessmentData?.snapshotPolicy?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.scheduledLocalSnapshot;

                getAssessmentGroupedByConfigurations.scheduledawsBackup += isScheduledawsBackupOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.scheduledawsBackup =
                    GETWELL_VALUES[instanceAssessmentData?.awsBackup?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.scheduledawsBackup;

                getAssessmentGroupedByConfigurations.clone += isCloneOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.clone =
                    GETWELL_VALUES[instanceAssessmentData?.clone?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.clone;

                getAssessmentGroupedByConfigurations.crr += isCrrOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.crr =
                    GETWELL_VALUES[instanceAssessmentData?.crr?.severity] ||
                    getAssessmentGroupedByConfigurations?.severityObj?.crr;

                getAssessmentGroupedByConfigurations.mssqlhighAvailability +=
                    isMssqlHighAvailabilityOptimized && isAllMssqlHighAvailability ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.mssqlhighAvailability = 'Critical';
            }
        });
    });
    return {
        ...getAssessmentGroupedByConfigurations,
        configState
    };
};

export const getAssessmentHostListGroupedByCategory = (assessmentData: any) => {
    let tableData: any = [];
    let id = 1;

    const state = store.getState();
    const { inventoryTableData, getDatabaseHosts } = state.inventoryV2;
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];

    assessmentData.map((databaseHost: any) => {
        if (
            !headerSelectedMultiCredIdsList.includes(databaseHost?.credentialId) ||
            !headerSelectedMultiRegionIdsList.includes(databaseHost?.regionId) ||
            uniqueResourceList.includes(databaseHost?.databaseHostId)
        ) {
            return;
        }
        uniqueResourceList.push(databaseHost?.databaseHostId);

        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error && instance?.assessments?.lastAssessmentTimestamp) {
                const { cardsData } = getCardsData(instance?.assessments, {});
                const optBreakDown = formatOptimizationBreakDown(
                    cardsData,
                    instance?.assessments?.databaseStorageType || ''
                );
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
                        regionId: databaseHost?.regionId
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
        if (item?.configuration === '0 out of 0') {
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

export const formatAssessmentTableData = (data: any) => {
    const result: any = [];
    data.map((item: any) => {
        if (!item?.error && !item?.errorMessage) {
            result.push({
                ...item,
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[item?.status] || item?.status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            });
        }
    });
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
                        endTime: config?.endTime
                    });
                });
            } else if (status.toLowerCase() === 'failed') {
                host?.sqlServerInstances?.map((instanceId: string) => {
                    failedList.push(`${id}_${instanceId}_${credentialsId}_${region}`);
                    failedList.push({
                        id: config?.configurationName,
                        name: type,
                        hostId: id,
                        instanceId,
                        credentialId: credentialsId,
                        regionId: region,
                        state: config?.configState,
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
                            endTime: config?.endTime
                        });
                    }
                });
            }
        });
    });

    return { successList, failedList };
};
