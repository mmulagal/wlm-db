import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { DBType, INVENTORY_STATUS, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../utils/consts';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import {
    setFSXId,
    setLandingFrom,
    setGwPageLoadInstanceData,
    setSelectedWellArchitectTab
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import styles from '../InventoryTable.module.scss';
import store from '../../../../store/store';
import { uniqueHostRow } from '../../InventoryUtilsV2';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { resetEiData, setLogAnalyzerState } from '../../../../store/workloadFactory/agenticAISlice';

export const instanceNameHyperLink = (rowData: any, name: string, dispatch: any) => {
    if (
        name &&
        rowData?.hostType === DBType.MSSQL &&
        rowData?.managementStatus === INVENTORY_STATUS.REGISTERED &&
        (rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
            rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP)
    ) {
        return (
            <DsButton onClick={() => resourceScreenNavigation(rowData, dispatch)} type="text">
                {name}
            </DsButton>
        );
    }
    return name;
};

export const resourceScreenNavigation = (rowData: any, dispatch: any) => {
    dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
    dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
    dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.OVERVIEW));
    dispatch(
        setFSXId({
            fsxId: rowData?.fsxId,
            ec2InstanceId: rowData?.ec2InstanceId
        })
    );
    optimizeAction(rowData, dispatch);
};

export const optimizeAction = (rowData: any, dispatch: any) => {
    const updatedState = store.getState();
    const { inventoryTableData }: any = updatedState.inventoryV2;
    const targettedHost =
        inventoryTableData[uniqueHostRow(rowData.resourceId, rowData.credentialId, rowData.regionId)] ||
        inventoryTableData[uniqueHostRow(rowData.ec2InstanceId, rowData.credentialId, rowData.regionId)];
    const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
        (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
    );
    dispatch(setLandingFrom(WLF_TABS.INVENTORY));

    let resourceId = '';
    if (targettedDbInstance?.resourceId) {
        resourceId = targettedDbInstance?.resourceId;
    } else {
        resourceId = targettedHost?.resourceId;
    }

    dispatch(
        setGwPageLoadInstanceData({
            hostname: rowData?.name,
            resourceId,
            instanceId: targettedDbInstance?.databaseInstanceId,
            instanceName: targettedDbInstance?.databaseInstanceName,
            credId: targettedHost?.credentialId,
            regionId: targettedHost?.regionId,
            storageType: targettedDbInstance?.sqlServerDeploymentType
        })
    );

    // For overview and database
    dispatch(resetWorkloadFactoryResourceData());
    dispatch(setSelectedHostname(rowData?.name));
    dispatch(
        setSelectedResourcePageHostData({
            resourceId,
            databaseInstanceId: targettedDbInstance?.databaseInstanceId,
            databaseInstanceName: targettedDbInstance?.databaseInstanceName,
            credentialId: targettedHost?.credentialId,
            regionId: targettedHost?.regionId
        })
    );
    dispatch(resetEiData({}));
    dispatch(setLogAnalyzerState(rowData?.logAnalyzer?.status));
};

export const protectionTooltipText = (data: any) => (
    <div className={styles.protectionTooltipMessage}>
        {data.map((val: any, index: number) => (
            <DsTypography key={index} variant="Regular_13" className={styles.textHeight}>
                {val}
            </DsTypography>
        ))}
    </div>
);
