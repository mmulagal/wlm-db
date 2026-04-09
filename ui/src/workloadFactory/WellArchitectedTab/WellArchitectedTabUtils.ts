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
import {
    dashboardRedirection,
    dashboardRedirectionToWellArchitected,
    sortListOfDict
} from '../../utils/utilityFunctions';
import { mapHostStatusToAssessmentData, shouldSkipDatabaseHost } from '../DatabaseHomePage/DatabaseHomeUtils';
import { formatOptimizationBreakDown, getCardsData } from '../GetWell/GetWellUtils';
import { sortAnalyzedResourceData } from '../InventoryV2/InventoryUtilsV2';
import {
    formatOracleOptimizationBreakDown,
    getOracleCardsData
} from '../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

export const getAllAssessmentResources = (assessmentData: any, oracleAssessmentData: any) => {
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
                const assessmentWithWadFlag = { ...instance?.assessments, isWad: !!databaseHost?.isWad };
                const { cardsData } = getCardsData(assessmentWithWadFlag, {});
                const optBreakDown = formatOptimizationBreakDown(cardsData, assessmentWithWadFlag);
                let score = '';
                score = `${optBreakDown?.total?.percent || 0}`;
                const optimized = optBreakDown?.total?.optimized || 0;
                const perTableData: any = {
                    id: id++,
                    hostName: databaseHost?.databaseHostName,
                    score,
                    optimized,
                    scoreForSorting: score ? Number(score) : 0,
                    serverInstanceName: instance?.databaseInstanceName,
                    databaseHostId: databaseHost?.databaseHostId,
                    instanceId: instance?.databaseInstanceId,
                    credentialId: databaseHost?.credentialId,
                    regionId: databaseHost?.regionId,
                    type: DBType.MSSQL,
                    isWad: databaseHost?.isWad,
                    lastAssessmentTimestamp: instance?.assessments?.lastAssessmentTimestamp
                };
                tableData.push(perTableData);
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
                const assessmentWithWadFlag = { ...instance?.assessments, isWad: !!databaseHost?.isWad };
                const { cardsData } = getOracleCardsData(assessmentWithWadFlag, {});
                const optBreakDown = formatOracleOptimizationBreakDown(cardsData, assessmentWithWadFlag);
                let score = '';
                score = `${optBreakDown?.total?.percent || 0}`;
                const optimized = optBreakDown?.total?.optimized || 0;
                const perTableData: any = {
                    id: id++,
                    hostName: databaseHost?.databaseHostName,
                    score,
                    scoreForSorting: score ? Number(score) : 0,
                    optimized,
                    serverInstanceName: instance?.databaseInstanceName,
                    databaseHostId: databaseHost?.databaseHostId,
                    instanceId: instance?.databaseInstanceId,
                    credentialId: databaseHost?.credentialId,
                    regionId: databaseHost?.regionId,
                    type: DBType.ORACLE,
                    isWad: databaseHost?.isWad,
                    lastAssessmentTimestamp: instance?.assessments?.lastAssessmentTimestamp
                };
                tableData.push(perTableData);
            }
        });
    });

    tableData = mapHostStatusToAssessmentData(
        inventoryTableData,
        tableData,
        getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
    );
    return sortAnalyzedResourceData(tableData);
};

export const redirectToGetWellPage = (dispatch: any, selectedAssessmentRow: any) => {
    dashboardRedirectionToWellArchitected();
    if (selectedAssessmentRow?.type === DBType.ORACLE) {
        dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED_FROM_WELL_ARCHITECTED_TAB));
        dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
    } else {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_FROM_WELL_ARCHITECTED_TAB));
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
            instanceName: selectedAssessmentRow?.serverInstanceName,
            credId: selectedAssessmentRow?.credentialId,
            regionId: selectedAssessmentRow?.regionId,
            storageType: selectedAssessmentRow?.sqlServerDeploymentType,
            isWad: selectedAssessmentRow?.isWad,
            instanceStatus: selectedAssessmentRow?.status
        })
    );

    dispatch(setSelectedHostname(selectedAssessmentRow?.hostName));

    dispatch(
        setSelectedResourcePageHostData({
            resourceId: selectedAssessmentRow?.databaseHostId,
            databaseInstanceId: selectedAssessmentRow?.instanceId,
            databaseInstanceName: selectedAssessmentRow?.serverInstanceName,
            credentialId: selectedAssessmentRow?.credentialId,
            regionId: selectedAssessmentRow?.regionId
        })
    );
    dispatch(
        setFSXId({
            fsxId: selectedAssessmentRow?.fsxId,
            ec2InstanceId: selectedAssessmentRow?.ec2InstanceId,
            isInstanceStorageAsmManaged: selectedAssessmentRow?.isInstanceStorageAsmManaged
        })
    );
};

export const engineTypeBasedResourceStr = (engineType: string | undefined, mssqlStr: string, oracleStr: string) => {
    if (engineType === DBType.ORACLE) {
        return oracleStr;
    }
    return mssqlStr;
};
