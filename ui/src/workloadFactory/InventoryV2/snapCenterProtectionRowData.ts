import store from '../../store/store';
import { uniqueHostRow } from './InventoryUtilsV2';

/** Maps Get Well / inner-page Redux context to inventory-shaped row data for SnapCenter protect. */
export const buildSnapCenterProtectionRowData = () => {
    const state = store.getState();
    const {
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedResourceId,
        selectedRowFsxId,
        selectedDatabaseStorageType,
        innerPageDetails
    } = state.getWellOptimize;
    const hostKey = uniqueHostRow(selectedResourceId, selectedGwInstanceCredId, selectedGwInstanceRegionId);
    const hostData = state.inventoryV2.inventoryTableData?.[hostKey];
    const instanceData = hostData?.sqlServerInstances?.find(
        (inst: { databaseInstanceName?: string }) => inst.databaseInstanceName === selectedDatabaseInstanceName
    );

    const hostShortName = hostData?.name || selectedHostname?.split('.')?.[0] || selectedHostname;

    return {
        databaseInstanceName: selectedDatabaseInstanceName,
        name: hostShortName,
        credentialId: selectedGwInstanceCredId,
        regionId: selectedGwInstanceRegionId,
        ec2InstanceId: innerPageDetails?.ec2InstanceId || hostData?.ec2InstanceId || instanceData?.ec2InstanceId,
        fsxId: selectedRowFsxId || innerPageDetails?.fsxId || hostData?.fsxId,
        sqlServerDeploymentType: instanceData?.sqlServerDeploymentType || selectedDatabaseStorageType,
        resourceId: selectedResourceId,
        hostRow: {
            fqdn: hostData?.fqdn || instanceData?.fqdn || selectedHostname,
            name: hostShortName,
            nodeIpAddress: hostData?.nodeIpAddress || instanceData?.nodeIpAddress,
            windowsClusterName: hostData?.windowsClusterName || instanceData?.windowsClusterName
        }
    };
};

/** Maps Well-architected dashboard row data to inventory-shaped row data for SnapCenter protect. */
export const buildSnapCenterProtectionRowDataFromDashboardRow = (rowData: {
    databaseHostId?: string;
    credentialId?: string;
    regionId?: string;
    serverInstanceName?: string;
    hostName?: string;
    ec2InstanceId?: string;
    fsxId?: string;
    data?: { databaseInstanceName?: string };
}) => {
    const state = store.getState();
    const hostKey = uniqueHostRow(rowData?.databaseHostId, rowData?.credentialId, rowData?.regionId);
    const hostData = state.inventoryV2.inventoryTableData?.[hostKey];
    const instanceName = rowData?.serverInstanceName || rowData?.data?.databaseInstanceName;
    const instanceData = hostData?.sqlServerInstances?.find(
        (inst: { databaseInstanceName?: string }) => inst.databaseInstanceName === instanceName
    );
    const hostShortName = hostData?.name || rowData?.hostName?.split('.')?.[0] || rowData?.hostName;

    return {
        databaseInstanceName: instanceName,
        name: hostShortName,
        credentialId: rowData?.credentialId,
        regionId: rowData?.regionId,
        ec2InstanceId: hostData?.ec2InstanceId || instanceData?.ec2InstanceId || rowData?.ec2InstanceId,
        fsxId: hostData?.fsxId || rowData?.fsxId,
        sqlServerDeploymentType: instanceData?.sqlServerDeploymentType,
        resourceId: rowData?.databaseHostId || hostData?.resourceId,
        hostRow: {
            fqdn: hostData?.fqdn || instanceData?.fqdn || rowData?.hostName,
            name: hostShortName,
            nodeIpAddress: hostData?.nodeIpAddress || instanceData?.nodeIpAddress,
            windowsClusterName: hostData?.windowsClusterName || instanceData?.windowsClusterName
        }
    };
};
