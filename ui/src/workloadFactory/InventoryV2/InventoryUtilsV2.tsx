import { GENERAL } from "../../utils/appConstants";
import { formatFractionalNumber, formatSizeOnePrecision } from "../../utils/utilityFunctions";

export const formatInventoryTableData = (managedData: any, discoverData: any) => {
    let result = {};
    if (!managedData) {
        return result;
    }
    Object.keys(managedData).map((key: string) => {
        result = { ...result, ...{ [key]: formatManagedRows(managedData[key]) } };
    });
    return result;
};

export const formatManagedRows = (managedRow: any) => {
    let managedInstanceCount = managedInstancesCount(managedRow);
    let totalInstanceCount = managedRow?.databaseInstanceDetails?.length;
    let ssmState = getSsmState(managedRow);
    const result = {
        id: managedRow?.id,
        ec2InstanceId: managedRow?.nodeTopology?.ec2Details?.[0]?.id,
        ec2InstanceName: managedRow?.nodeTopology?.ec2Details?.[0]?.name,
        resourceId: managedRow?.id,
        name: managedRow?.name,
        status: getNodeStatus(managedRow),
        ssmState: ssmState,
        totalInstance: totalInstanceCount,
        managedInstance: managedInstanceCount,
        serverInstallationMode: getInstallationMode(managedRow),
        vpcId: managedRow?.nodeTopology?.vpcId,
        vpcName: managedRow?.nodeTopology?.vpcName,
        vpcCidr: managedRow?.nodeTopology?.vpcCidr,
        action: ssmState === 'Online' ? 'Manage' : '', // This is default for managed rows,
        actionDisable: totalInstanceCount === managedInstanceCount,
        ec2Details: managedRow?.nodeTopology?.ec2Details,
        estimatedUsageCost: managedRow?.estimatedUsageCost,
        totalCost: getTotalCost(managedRow?.estimatedUsageCost),
        allocatedCapacity: getAllocatedCapacity(managedRow),
        sqlServerInstances: formatInstanceData(managedRow)
    };
    return result;
};

export const getNodeStatus = (row: any) => {
    if (row?.nodeStatus && row?.nodeStatus !== 'N/A') {
        if (row?.nodeStatus === 'running') {
            return 'Online';
        } else {
            return 'Offline';
        }
    } else {
        return 'Unknown';
    }
};

export const getSsmState = (row: any) => {
    if (row?.ssmStatus && row?.ssmStatus !== 'N/A') {
        if (row?.ssmStatus === 'Connected') {
            return 'Online';
        } else {
            return 'Offline';
        }
    } else {
        return 'Offline';
    }
};

export const managedInstancesCount = (row: any) => {
    if (row?.databaseInstanceDetails && row?.databaseInstanceDetails?.length > 0) {
        let managedRows = row?.databaseInstanceDetails?.filter((per:any) => per?.isManaged);
        return managedRows?.length;
    } else {
        return '';
    }
};

export const getInstallationMode = (row: any) => {
    let installationMode = '';
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        for (let i = 0; i < row?.databaseInstancesSummary?.length; i++) {
            const val = row?.databaseInstancesSummary[i];
            if (val?.databseInstanceTopology?.serverInstallationMode) {
                installationMode = val?.databseInstanceTopology?.serverInstallationMode;
                break;
            }
        }
        return installationMode;
    } else {
        return '';
    }
};

export const getTotalCost = (estimatedUsageCost: any) => {
    if (estimatedUsageCost) {
        return (
            (estimatedUsageCost?.compute || 0) +
            (estimatedUsageCost?.storage?.fsxn || 0) +
            (estimatedUsageCost?.storage?.fsxw || 0) +
            (estimatedUsageCost?.storage?.ebs || 0) +
            (estimatedUsageCost?.connectivity || 0) +
            (estimatedUsageCost?.others || 0)
        ).toString()
    } else {
        return 0;
    }
};

export const getAllocatedCapacity = (row: any) => {
    let allocatedCapacity = 0;
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        row?.databaseInstancesSummary?.map((perRow:any) => {
            allocatedCapacity += ((perRow?.storage?.fsxn?.size || 0) + (perRow?.storage?.fsxw?.size || 0) + (perRow?.storage?.ebs?.size || 0))
        });
        return allocatedCapacity;
    } else {
        return 0;
    }
};

export const getStorageSavingsText = (val: any) => {
    let storagePercent = 0;
    let storageSavingsText = '';
    let fsxType = '';
    let fileSystemType = val?.databseInstanceTopology?.fileSystemType;
    if (fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        fsxType = 'fsxn';
    } else if (fileSystemType.includes(GENERAL.FSX_FOR_WINDOWS)) {
        fsxType = 'fsxw';
    } else if (fileSystemType.includes(GENERAL.EBS)) {
        fsxType = 'ebs';
    }

    if (fsxType) {
        storagePercent = val?.storage?.[fsxType]
            ? (val.storage?.[fsxType]?.spaceSavings / val.storage?.[fsxType]?.used) * 100
            : 0;
        storageSavingsText =
            val?.storage?.[fsxType]?.spaceSavings &&
            val?.storage?.[fsxType]?.used &&
            formatFractionalNumber(storagePercent, 2) +
                '% (' +
                formatSizeOnePrecision(val.storage?.[fsxType]?.spaceSavings) +
                ')';
    }
    return storageSavingsText;
};

export const formatInstanceData = (row: any) => {
    let instanceRows = row?.databaseInstancesSummary?.map((perRow: any) => {
        const isManagedRow = row?.databaseInstancesSummary?.filter((per:any) => per?.instanceName === perRow?.databaseInstanceName);
        return {
            ...perRow,
            isDetected: true, // for managed rows 
            isManaged: isManagedRow?.[0]?.isManaged || false,
            fileSystemDeploymentMode: perRow?.databseInstanceTopology?.fileSystemDeploymentMode,
            fileSystemType: perRow?.databseInstanceTopology?.fileSystemType,
            storageSavingsText: getStorageSavingsText(perRow),
            allocatedCapacity: (perRow?.storage?.fsxn?.size || 0) + (perRow?.storage?.fsxw?.size || 0) + (perRow?.storage?.ebs?.size || 0)
        }
    });
    return instanceRows;
};

