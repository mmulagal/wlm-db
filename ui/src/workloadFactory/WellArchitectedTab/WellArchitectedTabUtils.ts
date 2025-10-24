import store from '../../store/store';
import { selectedTabSelection } from '../../store/workloadFactory/databaseHomeSlice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';
import { setSelectedOracleInnerPageTab } from '../../store/workloadFactory/oracleSlice';
import {
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../store/workloadFactory/workloadFactoryResourceSlice';
import { DBType, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../utils/consts';
import { formatOptimizationBreakDown, getCardsData } from '../GetWell/GetWellUtils';
import {
    formatOracleOptimizationBreakDown,
    getOracleCardsData
} from '../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

export const getAllAssessmentResources = (assessmentData: any, oracleAssessmentData: any) => {
    const tableData: any = [];
    let id = 1;
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
                const { cardsData } = getCardsData(instance?.assessments, {});
                const optBreakDown = formatOptimizationBreakDown(cardsData, instance?.assessments);
                let score = '';
                score = `${optBreakDown?.total?.percent || 0}`;
                const optimized = optBreakDown?.total?.optimized || 0;
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
        });
    });

    oracleAssessmentData.map((databaseHost: any) => {
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
                const { cardsData } = getOracleCardsData(instance?.assessments, {});
                const optBreakDown = formatOracleOptimizationBreakDown(cardsData, instance?.assessments);
                let score = '';
                score = `${optBreakDown?.total?.percent || 0}`;
                const optimized = optBreakDown?.total?.optimized || 0;
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
        });
    });
    return tableData;
};

export const redirectToGetWellPage = (dispatch: any, selectedAssessmentRow: any) => {
    if (selectedAssessmentRow?.type === DBType.ORACLE) {
        dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
        dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
    } else {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
    }

    dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.WELL_ARCHITECTED_TAB));

    dispatch(setLandingFrom(WLF_TABS.INVENTORY));
    dispatch(
        setGwPageLoadInstanceData({
            hostname: selectedAssessmentRow?.hostName,
            resourceId: selectedAssessmentRow?.databaseHostId,
            instanceId: selectedAssessmentRow?.instanceId,
            instanceName: selectedAssessmentRow?.databaseInstanceName,
            credId: selectedAssessmentRow?.credentialId,
            regionId: selectedAssessmentRow?.regionId,
            storageType: selectedAssessmentRow?.sqlServerDeploymentType
        })
    );

    dispatch(setSelectedHostname(selectedAssessmentRow?.hostName));

    dispatch(
        setSelectedResourcePageHostData({
            resourceId: selectedAssessmentRow?.databaseHostId,
            databaseInstanceId: selectedAssessmentRow?.instanceId,
            databaseInstanceName: selectedAssessmentRow?.databaseInstanceName,
            credentialId: selectedAssessmentRow?.credentialId,
            regionId: selectedAssessmentRow?.regionId
        })
    );
    dispatch(
        setFSXId({
            fsxId: selectedAssessmentRow?.fsxId,
            ec2InstanceId: selectedAssessmentRow?.ec2InstanceId
        })
    );
};
