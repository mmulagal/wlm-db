import { GENERAL } from '../../utils/appConstants';
import { FSX_DEPLOYMENT_MODE } from '../../utils/consts';
import {
    DatabaseInstancesSummaryInterface,
    EstimatedUsageCostInterface,
    InventoryTableData,
    ManagedHostsRowInterface
} from '../../utils/types/inventoryV2Types';
import { formatFractionalNumber, formatSizeOnePrecision } from '../../utils/utilityFunctions';

export const formatInventoryTableData = (
    managedData: { [key: string]: ManagedHostsRowInterface } | null,
    discoverData: any
) => {
    let result = {};
    if (!managedData) {
        return result;
    }
    Object.keys(managedData).map((key: string) => {
        result = { ...result, ...{ [key]: formatManagedRows(managedData[key]) } };
    });
    return result;
};

export const getInventoryDataCount = (data: { [key: string]: InventoryTableData } | null) => {
    let result;
    if (!data) {
        return result;
    }

    let detectedHostCount = 0;
    let undetectedHostCount = 0;
    let managedInst = 0;
    let totalInstance = 0;
    Object.keys(data).map((key: string) => {
        if (data[key]?.action === 'Manage') {
            detectedHostCount += 1;
        } else if (data[key]?.action === 'Detect') {
            undetectedHostCount += 1;
        }
        managedInst += data[key]?.managedInstance || 0;
        totalInstance += data[key]?.totalInstance || 0;
    });
    result = {
        detectedHost: detectedHostCount,
        undetectedHost: undetectedHostCount,
        managedInstance: managedInst,
        unmanagedInstance: totalInstance - managedInst
    };
    return result;
};

export const formatManagedRows = (managedRow: ManagedHostsRowInterface) => {
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
        totalCost: getTotalCost(managedRow?.estimatedUsageCost || {}),
        allocatedCapacity: getAllocatedCapacity(managedRow),
        sqlServerInstances: formatInstanceData(managedRow)
    };
    return result;
};

export const getNodeStatus = (row: ManagedHostsRowInterface) => {
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

export const getSsmState = (row: ManagedHostsRowInterface) => {
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

export const managedInstancesCount = (row: ManagedHostsRowInterface) => {
    if (row?.databaseInstanceDetails && row?.databaseInstanceDetails?.length > 0) {
        let managedRows = row?.databaseInstanceDetails?.filter(per => per?.isManaged);
        return managedRows?.length;
    } else {
        return '';
    }
};

export const getInstallationMode = (row: ManagedHostsRowInterface) => {
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

export const getTotalCost = (estimatedUsageCost: EstimatedUsageCostInterface) => {
    if (estimatedUsageCost) {
        return (
            (estimatedUsageCost?.compute || 0) +
            (estimatedUsageCost?.storage?.fsxn || 0) +
            (estimatedUsageCost?.storage?.fsxw || 0) +
            (estimatedUsageCost?.storage?.ebs || 0) +
            (estimatedUsageCost?.connectivity || 0) +
            (estimatedUsageCost?.others || 0)
        ).toString();
    } else {
        return 0;
    }
};

export const getAllocatedCapacity = (row: ManagedHostsRowInterface) => {
    let allocatedCapacity = 0;
    if (row?.databaseInstancesSummary && row?.databaseInstancesSummary?.length > 0) {
        row?.databaseInstancesSummary?.map(perRow => {
            allocatedCapacity +=
                (perRow?.storage?.fsxn?.size || 0) +
                (perRow?.storage?.fsxw?.size || 0) +
                (perRow?.storage?.ebs?.size || 0);
        });
        return allocatedCapacity;
    } else {
        return 0;
    }
};

export const getFileSystemDeploymentMode = (val: string | undefined) => {
    return val === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
        ? GENERAL.SINGLE_AZ
        : val === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
        ? GENERAL.MULTI_AZ
        : val;
};

export const getStorageSavingsText = (val: DatabaseInstancesSummaryInterface) => {
    let storagePercent = 0;
    let storageSavingsText: string = '';
    let fsxType: string = '';
    let fileSystemType = val?.databseInstanceTopology?.fileSystemType || '';
    if (fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        fsxType = 'fsxn';
    } else if (fileSystemType.includes(GENERAL.FSX_FOR_WINDOWS)) {
        fsxType = 'fsxw';
    } else if (fileSystemType.includes(GENERAL.EBS)) {
        fsxType = 'ebs';
    }

    if (fsxType) {
        let fsxTypeValue = val?.storage?.[fsxType] || {};
        storagePercent = fsxTypeValue ? (Number(fsxTypeValue?.spaceSavings) / Number(fsxTypeValue?.used)) * 100 : 0;
        storageSavingsText =
            (val?.storage?.[fsxType]?.spaceSavings &&
                val?.storage?.[fsxType]?.used &&
                formatFractionalNumber(storagePercent, 2) +
                    '% (' +
                    formatSizeOnePrecision(Number(fsxTypeValue?.spaceSavings)) +
                    ')') ||
            '';
    }
    return storageSavingsText;
};

export const formatInstanceData = (row: ManagedHostsRowInterface) => {
    let instanceRows = row?.databaseInstancesSummary?.map(perRow => {
        const isManagedRow = row?.databaseInstanceDetails?.filter(
            per => per?.instanceName === perRow?.databaseInstanceName
        );
        return {
            ...perRow,
            statusColText: isManagedRow?.[0]?.isManaged ? 'Managed' : 'Unmanaged',
            fileSystemDeploymentMode: getFileSystemDeploymentMode(
                perRow?.databseInstanceTopology?.fileSystemDeploymentMode
            ),
            fileSystemType: perRow?.databseInstanceTopology?.fileSystemType,
            storageSavingsText: getStorageSavingsText(perRow),
            allocatedCapacity:
                (perRow?.storage?.fsxn?.size || 0) +
                (perRow?.storage?.fsxw?.size || 0) +
                (perRow?.storage?.ebs?.size || 0)
        };
    });
    return instanceRows;
};
