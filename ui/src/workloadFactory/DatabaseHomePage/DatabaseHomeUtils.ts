// ToDo - Write utils dunction for dashboard page here
import store from '../../store/store';
import { setManagedHostInstanceLoading } from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
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

export const getManagedHostCount = (data: any, dispatch: any, type: string = WIZARD_TYPE.MSSQL) => {
    let totalDatabases = 0;
    let totahosts = 0;
    let managedDatabases = 0;
    let totalInstances = 0;
    let managedInstances = 0;
    let isLoading = false;
    Object.keys(data).map((val: string) => {
        totahosts += 1;
        totalInstances += data[val]?.databaseInstanceDetails?.length || 0;
        data[val]?.databaseInstanceDetails?.map((per: any) => {
            if (per?.isManaged) {
                managedInstances += 1;
            }
        });

        const state = store.getState();
        const inventoryTableData = state.inventoryV2.inventoryTableData;
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
        totalDatabases: totalDatabases,
        totalHosts: totahosts,
        managedDatabases: managedDatabases,
        totalInstances: totalInstances,
        managedInstances: managedInstances
    };
};

export const getPotentialSavingsValues = (data: any) => {
    let result = {
        loading: false,
        ebsCost: 0,
        fsxwCost: 0,
        fsxnCost: 0,
        savings: 0,
        savingsPercent: 0,
        noSavings: false
    };
    Object.keys(data).map((key: string) => {
        let val = data[key];
        if (val?.loading) {
            result.loading = true;
        }
        if (val?.data) {
            result.fsxnCost += val?.data?.totalSummary?.recommended || 0;
            if (val?.storageType === GENERAL.EBS) {
                result.ebsCost += val?.data?.totalSummary?.existing || 0;
            } else if (val?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                result.fsxwCost += val?.data?.totalSummary?.existing || 0;
            }
        }
    });

    result.savings = (result?.ebsCost || 0) + (result?.fsxwCost || 0) - (result?.fsxnCost || 0);

    result.savingsPercent =
        100 * ((result.ebsCost + result.fsxwCost - result.fsxnCost) / (result.ebsCost + result.fsxwCost || 1));

    if (result.fsxnCost >= result.ebsCost + result.fsxwCost) {
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

    Object.keys(data).map((key: string) => {
        let protectedHostDb = 0;
        let unProtectedHostDb = 0;
        let perFsxOntapSnapshotsDb = 0;
        let perAwsBackupDb = 0;
        let perSqlServerBackupDb = 0;
        let totalInstances = data[key]?.databaseInstancesSummary?.length || 0;
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
        protectedDb: protectedDb,
        unprotectedDb: unprotectedDb,
        protectedPercent: (protectedDb / totalHost) * 100 || 0,
        unprotectedPercent: (unprotectedDb / totalHost) * 100 || 0,
        awsBackupDb: awsBackupDb,
        fsxOntapSnapshotsDb: fsxOntapSnapshotsDb,
        sqlServerBackupDb: sqlServerBackupDb
    };
};

export const getManagedAggrStorageSavings = (data: any, sandboxSavings?: any) => {
    let totalConsume = 0;
    let storageSavings = 0;
    let storageList: (string | undefined)[] = [];

    Object.keys(data).map((key: string) => {
        data[key]?.databaseInstancesSummary?.map((val: any) => {
            let fsxVal = val?.databaseInstanceTopology?.fileSystemId || '';
            let storageType = val?.databaseInstanceTopology?.fileSystemType || '';
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

    if (sandboxSavings) {
        totalConsume += (sandboxSavings?.consumedStorage || 0) + (sandboxSavings?.savedStorage || 0);
        storageSavings += sandboxSavings?.savedStorage || 0;
    }
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

    let storageList: (string | undefined)[] = [];
    let vpcList: (string | undefined)[] = [];
    let requireBillingPerm = false;
    let noDeploymentChk = true;

    Object.keys(data).map((key: string) => {
        const val = data[key];

        if (val?.estimatedUsageCost?.compute) {
            computeCost += val.estimatedUsageCost.compute;
        }

        val?.estimatedUsageCost?.storage?.fsxnBreakDownById?.map((item: any) => {
            let fsxVal = item?.id;
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

export const getTotalManagedAggrCost = (mssqlCostObj: any, pgsqlCostObj: any) => {
    return {
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
    };
};

export const isOptimized = (status?: string) => {
    return (
        status?.toLowerCase() === FINDINGS.OPTIMIZED.toLowerCase() ||
        status?.toLowerCase() === FINDINGS.ANALYZING.toLowerCase()
    );
};

export const getManagedInstanceOptimizationSummary = (assessmentData: any) => {
    let totalInstances = 0;
    let optimizedInstances = 0;
    assessmentData.map((databaseHost: any) => {
        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error) {
                totalInstances++;
                const instanceAssessmentData = instance?.assessments;
                const isComputeOptimized = isOptimized(instanceAssessmentData?.compute?.status);
                const isRssConfigOptimized = isOptimized(instanceAssessmentData?.rssConfig?.status);
                const isOperatingSystemOptimized = isOptimized(instanceAssessmentData?.hostOsPatch?.status);
                const isLicenseOptimized = isOptimized(instanceAssessmentData?.license?.status);
                const isMicrosoftSqlPatchOptimized = isOptimized(instanceAssessmentData?.mssqlPatch?.status);
                const isMaxdopPatchOptimized = isOptimized(instanceAssessmentData?.maxDOP?.status);
                const isStorageLayoutOptimized = instanceAssessmentData?.storage?.layout?.every((item: any) =>
                    isOptimized(item?.status)
                );
                const isAllStorageSizingPresent =
                    instanceAssessmentData?.storage?.sizing?.length === 4 &&
                    instanceAssessmentData.storage.sizing.every((item: any) => {
                        return ['headroom', 'tempdb-drive-size', 'log-drive-size', 'performance-tier'].includes(
                            item?.name
                        );
                    });
                const isStorageSizingOptimized = instanceAssessmentData?.storage?.sizing?.every((item: any) => {
                    return isOptimized(item?.status);
                });
                const isStorageConfigOptimized = Object.values(instanceAssessmentData.storage?.configuration).every(
                    (item: any) => item?.every((subItem: any) => isOptimized(subItem?.status))
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
                    isMaxdopPatchOptimized
                ) {
                    optimizedInstances += 1;
                }
            }
        });
    });
    return {
        totalInstances,
        optimizedInstances,
        notOptimizedInstances: totalInstances - optimizedInstances,
        optimizedPercent: Math.round((optimizedInstances / totalInstances) * 100)
    };
};

export const getAssessmentGroupedByCategory = (assessmentData: any) => {
    let assessmentGroupedByCategory: any = {
        storage: 0,
        compute: 0,
        application: 0,
        resiliency: 0,
        total: 0
    };
    assessmentData.map((databaseHost: any) => {
        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error) {
                assessmentGroupedByCategory.total++;
                const instanceAssessmentData = instance?.assessments;
                const isComputeOptimized = isOptimized(instanceAssessmentData?.compute?.status);
                const isOperatingSystemPatchOptimized = isOptimized(instanceAssessmentData?.hostOsPatch?.status);
                const isRssConfigurationOptimized = isOptimized(instanceAssessmentData?.rssConfig?.status);
                const isStorageLayoutOptimized = instanceAssessmentData?.storage?.layout?.every((item: any) =>
                    isOptimized(item?.status)
                );
                const isStorageSizingOptimized = instanceAssessmentData?.storage?.sizing?.every((item: any) => {
                    return isOptimized(item?.status);
                });
                const isAllStorageSizingPresent =
                    instanceAssessmentData?.storage?.sizing?.length === 4 &&
                    instanceAssessmentData.storage.sizing.every((item: any) => {
                        return ['headroom', 'tempdb-drive-size', 'log-drive-size', 'performance-tier'].includes(
                            item?.name
                        );
                    });
                const isStorageConfigOptimized = Object.values(instanceAssessmentData.storage?.configuration).every(
                    (item: any) => item?.every((subItem: any) => isOptimized(subItem?.status))
                );
                const isApplicationOptimized = isOptimized(instanceAssessmentData?.license?.status);
                const isMicrosoftSqlPatchOptimized = isOptimized(instanceAssessmentData?.mssqlPatch?.status);
                const isMaxdopPatchOptimized = isOptimized(instanceAssessmentData?.maxDOP?.status);
                const isScheduledLoclaSnapshotOptimized = isOptimized(
                    instanceAssessmentData?.resiliency?.snapshotPolicy?.status
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
                if (isScheduledLoclaSnapshotOptimized) {
                    assessmentGroupedByCategory.resiliency++;
                }
            }
        });
    });
    return assessmentGroupedByCategory;
};

export const getAssessmentGroupedByConfigurations = (assessmentData: any) => {
    let getAssessmentGroupedByConfigurations: any = {
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
        total: 0,
        severityObj: {}
    };
    assessmentData.map((databaseHost: any) => {
        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error) {
                getAssessmentGroupedByConfigurations.total++;
                const instanceAssessmentData = instance?.assessments;

                const perfTierObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'performance-tier'
                );
                const isStorageTierOptimized = isOptimized(perfTierObj?.status);

                const headroomObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'headroom'
                );
                const isFileSystemHeadroomOptimized = isOptimized(headroomObj?.status);

                const logDriveSizeObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'log-drive-size'
                );
                const isLogDriveSizeOptimized = isOptimized(logDriveSizeObj?.status);

                const tempdbDriveSizeObj = instanceAssessmentData?.storage?.sizing?.find(
                    (item: any) => item.name === 'tempdb-drive-size'
                );
                const isTempdbDriveSizeOptimized = isOptimized(tempdbDriveSizeObj?.status);

                const userDataFilesObj = instanceAssessmentData?.storage?.layout?.find(
                    (item: any) => item.name === 'data-files-location'
                );
                const isUserDataFilesOptimized = isOptimized(userDataFilesObj?.status);

                const logFilesObj = instanceAssessmentData?.storage?.layout?.find(
                    (item: any) => item.name === 'log-files-location'
                );
                const isLogFilesOptimized = isOptimized(logFilesObj?.status);

                const tempdbFilesLocationObj = instanceAssessmentData?.storage?.layout?.find(
                    (item: any) => item.name === 'tempdb-files-location'
                );
                const isTempdbPlacementOptimized = isOptimized(tempdbFilesLocationObj?.status);

                const isOntapConfigurationOptimized =
                    instanceAssessmentData?.storage?.configuration?.luns?.every((item: any) =>
                        isOptimized(item?.status)
                    ) &&
                    instanceAssessmentData?.storage?.configuration?.volumes?.every((item: any) =>
                        isOptimized(item?.status)
                    );
                const isOperatingSystemOptimized = instanceAssessmentData?.storage?.configuration?.os?.every(
                    (item: any) => isOptimized(item?.status)
                );
                const isComputeRightsizingOptimized = isOptimized(instanceAssessmentData?.compute?.status);
                const isOpearingSystemPatchOptimized = isOptimized(instanceAssessmentData?.hostOsPatch?.status);
                const isRssConfigurationOptimized = isOptimized(instanceAssessmentData?.rssConfig?.status);
                const isApplicationSqlServerOptimized = isOptimized(instanceAssessmentData?.license?.status);
                const isMicrosoftSqlPatchOptimized = isOptimized(instanceAssessmentData?.mssqlPatch?.status);
                const isMaxdopPatchOptimized = isOptimized(instanceAssessmentData?.maxDOP?.status);
                const isScheduledLocalSnapshotOptimized = isOptimized(
                    instanceAssessmentData?.resiliency?.snapshotPolicy?.status
                );

                getAssessmentGroupedByConfigurations.storageTier += isStorageTierOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.storageTier = GETWELL_VALUES[perfTierObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.storageTier;
                getAssessmentGroupedByConfigurations.fileSystemHeadroom += isFileSystemHeadroomOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.fileSystemHeadroom =
                    GETWELL_VALUES[headroomObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.fileSystemHeadroom;
                getAssessmentGroupedByConfigurations.logDriveSize += isLogDriveSizeOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.logDriveSize =
                    GETWELL_VALUES[logDriveSizeObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.logDriveSize;
                getAssessmentGroupedByConfigurations.tempdbDriveSize += isTempdbDriveSizeOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.tempdbDriveSize =
                    GETWELL_VALUES[tempdbDriveSizeObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.tempdbDriveSize;
                getAssessmentGroupedByConfigurations.userDataFiles += isUserDataFilesOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.userDataFiles =
                    GETWELL_VALUES[userDataFilesObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.userDataFiles;
                getAssessmentGroupedByConfigurations.logFiles += isLogFilesOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.logFiles = GETWELL_VALUES[logFilesObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.logFiles;
                getAssessmentGroupedByConfigurations.tempdbPlacement += isTempdbPlacementOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.tempdbPlacement =
                    GETWELL_VALUES[tempdbFilesLocationObj?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.tempdbPlacement;
                getAssessmentGroupedByConfigurations.ontapConfiguration += isOntapConfigurationOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.ontapConfiguration = 'Critical';
                getAssessmentGroupedByConfigurations.operatingSystem += isOperatingSystemOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.operatingSystem = 'Critical';
                getAssessmentGroupedByConfigurations.computeRightsizing += isComputeRightsizingOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.computeRightsizing =
                    GETWELL_VALUES[instanceAssessmentData?.compute?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.computeRightsizing;
                getAssessmentGroupedByConfigurations.operatingSystemPatch += isOpearingSystemPatchOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.operatingSystemPatch =
                    GETWELL_VALUES[instanceAssessmentData?.hostOsPatch?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.operatingSystemPatch;
                getAssessmentGroupedByConfigurations.rssConfiguration += isRssConfigurationOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.rssConfiguration =
                    GETWELL_VALUES[instanceAssessmentData?.rssConfig?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.rssConfiguration;
                getAssessmentGroupedByConfigurations.applicationSqlServer += isApplicationSqlServerOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.applicationSqlServer =
                    GETWELL_VALUES[instanceAssessmentData?.license?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.applicationSqlServer;
                getAssessmentGroupedByConfigurations.mssqlPatch += isMicrosoftSqlPatchOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.mssqlPatch =
                    GETWELL_VALUES[instanceAssessmentData?.mssqlPatch?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.mssqlPatch;
                getAssessmentGroupedByConfigurations.maxdopPatch += isMaxdopPatchOptimized ? 1 : 0;
                getAssessmentGroupedByConfigurations.severityObj.maxdopPatch =
                    GETWELL_VALUES[instanceAssessmentData?.maxDOP?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.maxdopPatch;
                getAssessmentGroupedByConfigurations.scheduledLocalSnapshot += isScheduledLocalSnapshotOptimized
                    ? 1
                    : 0;
                getAssessmentGroupedByConfigurations.severityObj.scheduledLocalSnapshot =
                    GETWELL_VALUES[instanceAssessmentData?.resiliency?.snapshotPolicy?.severity] || getAssessmentGroupedByConfigurations?.severityObj?.scheduledLocalSnapshot;
            }
        });
    });
    return getAssessmentGroupedByConfigurations;
};

export const getAssessmentHostListGroupedByCategory = (assessmentData: any) => {
    let tableData: any = [];
    let id = 1;

    const state = store.getState();
    const { inventoryTableData, getDatabaseHosts } = state.inventoryV2;

    assessmentData.map((databaseHost: any) => {
        databaseHost?.instancesAssessment?.map((instance: any) => {
            if (!instance?.error) {
                let { cardsData, formatOntapConfigList, formatOsConfigList } = getCardsData(instance?.assessments, {});
                let optBreakDown = formatOptimizationBreakDown(cardsData);
                let score = '';
                score = (optBreakDown?.total?.percent || '0') + '%';
                if (score !== '100%') {
                    let perTableData: any = {
                        id: id++,
                        hostName: databaseHost?.databaseHostName,
                        score: score,
                        databaseInstanceName: instance?.databaseInstanceName,
                        databaseHostId: databaseHost?.databaseHostId,
                        instanceId: instance?.databaseInstanceId
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

export const disableOfflineRows = (data: any) => {
    return data.map((item: any) => {
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
        } else if (item?.configuration === '0 out of 0') {
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
};

export const mapHostStatusToAssessmentData = (hostData: any, assessmentData: any, isLoading: boolean) => {
    let result = assessmentData.map((instanceData: any) => {
        let updatedAssessmentData = { ...instanceData };
        const host = hostData?.[instanceData.databaseHostId];
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
                updatedAssessmentData.loadingStatus = false;
            }
        }
        return updatedAssessmentData;
    });
    return sortListOfDict(result, 'status', false);
};

export const formatAssessmentTableData = (data: any) => {
    let result: any = [];
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
