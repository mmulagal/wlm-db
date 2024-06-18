// ToDo - Write utils dunction for dashboard page here

import { GENERAL } from '../../utils/appConstants';
import { COSTING_TYPES, STATUS_CONST } from '../../utils/consts';
import { formatFractionalNumber, formatSizeOnePrecision, isAwsBackupEnabled } from '../../utils/utilityFunctions';

export const getManagedHostCount = (data: any) => {
    let totalDatabases = 0;
    let totahosts = 0;
    Object.keys(data).map((val: string) => {
        totahosts += 1;
        data[val]?.databaseInstancesSummary?.map((per: any) => {
            totalDatabases += per?.databaseCount || 0;
        });
    });
    return {
        totalDatabases: totalDatabases,
        totalHosts: totahosts
    };
};

export const getManagedAggrProtection = (data: any) => {
    let protectedDb = 0;
    let unprotectedDb = 0;
    let awsBackupDb = 0;
    let fsxOntapSnapshotsDb = 0;
    let sqlServerBackupDb = 0;

    Object.keys(data).map((key: string) => {
        data[key]?.databaseInstancesSummary?.map((val: any) => {
            if (
                isAwsBackupEnabled(val) ||
                val?.protection?.isFsxOntapSnapshotsEnabled ||
                val?.protection?.isSqlNativeEnabled
            ) {
                protectedDb += 1;
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
                unprotectedDb += 1;
            }
            if (val?.protection?.isFsxOntapSnapshotsEnabled) {
                fsxOntapSnapshotsDb += 1;
            }
            if (isAwsBackupEnabled(val)) {
                awsBackupDb += 1;
            }
            if (val?.protection?.isSqlNativeEnabled) {
                sqlServerBackupDb += 1;
            }
        });
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
    Object.keys(data).map((key: string) => {
        data[key]?.databaseInstancesSummary?.map((val: any) => {
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
                if (val?.storage?.[fsxType]?.used) {
                    totalConsume += val.storage[fsxType].used;
                }
                if (val?.storage?.[fsxType]?.spaceSavings) {
                    storageSavings += val.storage[fsxType].spaceSavings;
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

export const getManageAggrCost = (data: any) => {
    let storageCost = 0;
    let computeCost = 0;
    let connectivityCost = 0;
    let otherCost = 0;

    let storageList: (string | undefined)[] = [];
    let vpcList: (string | undefined)[] = [];
    let requireBillingPerm = false;
    let noDeploymentChk = true;

    Object.keys(data).map((key: string) => {
        const val = data[key];
        let fsxVal = '';
        for (let i = 0; i < data[key]?.databaseInstancesSummary?.length; i++) {
            const summVal = data[key]?.databaseInstancesSummary[i];
            if (summVal?.databaseInstanceTopology?.fileSystemId) {
                fsxVal = summVal?.databaseInstanceTopology?.fileSystemId;
                break;
            }
        }
        if (val?.estimatedUsageCost?.compute) {
            computeCost += val.estimatedUsageCost.compute;
        }

        if ((!fsxVal || !storageList.includes(fsxVal)) && val?.estimatedUsageCost?.storage?.fsxn) {
            storageCost += val.estimatedUsageCost.storage?.fsxn;
            if (fsxVal) {
                storageList.push(fsxVal);
            }
        }

        storageCost += val.estimatedUsageCost?.storage?.fsxw || 0;
        storageCost += val.estimatedUsageCost?.storage?.ebs || 0;

        // If connectivity cost is already added than no need to add again based on VPCId
        let vpcVal = '';
        if (val?.nodeTopology?.vpcId) {
            vpcVal = val.nodeTopology.vpcId;
        }
        if ((!vpcVal || !vpcList.includes(vpcVal)) && val?.estimatedUsageCost?.connectivity) {
            connectivityCost += val.estimatedUsageCost.connectivity;
            if (vpcVal) {
                vpcList.push(vpcVal);
            }
        }

        if (val?.estimatedUsageCost?.others) {
            otherCost += val.estimatedUsageCost.others;
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

    const totalCost = storageCost + computeCost + connectivityCost + otherCost;

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
