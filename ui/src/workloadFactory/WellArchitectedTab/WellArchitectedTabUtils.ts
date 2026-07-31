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
import { LunFilesMap, LunFilterOption } from '../../utils/types/workloadFactoryResourceTypes';
import { dashboardRedirectionToWellArchitected } from '../../utils/utilityFunctions';
import {
    mapHostStatusToAssessmentData,
    shouldSkipDatabaseHost,
    getInstanceOptimizationBreakdown
} from '../DatabaseHomePage/DatabaseHomeUtils';
import { sortAnalyzedResourceData } from '../InventoryV2/InventoryUtilsV2';
import {
    getLastAssessmentTimestamp,
    hasAssessmentTimestamp,
    shouldSkipDashboardAssessmentItem
} from './assessmentFormatUtils';

/**
 * Returns the unique, non-empty LUN path names across a database's dataFiles and logFiles,
 * preserving first-seen order (dataFiles first, then logFiles).
 *
 * Centralized so table/filter/dialog components share identical dedupe, sort, and
 * missing-name handling rules.
 */
export const getUniqueLunNames = (luns?: LunFilesMap | null): string[] => {
    if (!luns) return [];
    const dataNames = (luns.dataFiles ?? []).map(f => f?.name).filter(Boolean) as string[];
    const logNames = (luns.logFiles ?? []).map(f => f?.name).filter(Boolean) as string[];
    return Array.from(new Set([...dataNames, ...logNames]));
};

/**
 * Builds the de-duplicated, alphabetically sorted `{ value, label }` list used by the
 * associated-LUNs column filter. Accepts any row shape that already exposes a `lunPaths`
 * array (populated via `getUniqueLunNames`). Shared across resource-page and inventory
 * tables so the filter options stay consistent.
 */
export const getLunFilterOptions = (rows?: ReadonlyArray<{ lunPaths?: string[] | null }>): LunFilterOption[] => {
    const unique = new Set<string>();
    (rows || []).forEach(row => {
        (row?.lunPaths || []).forEach(path => unique.add(path));
    });
    return Array.from(unique)
        .sort((a, b) => a.localeCompare(b))
        .map(path => ({ value: path, label: path }));
};

export const getAllAssessmentResources = (assessmentData: any, oracleAssessmentData: any) => {
    let tableData: any = [];
    let id = 1;
    const state = store.getState();
    const { inventoryTableData, getDatabaseHosts, getOracleDatabaseHosts } = state.inventoryV2;
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
            if (shouldSkipDashboardAssessmentItem(instance)) {
                return;
            }
            if (!instance?.error && hasAssessmentTimestamp(instance?.assessments)) {
                const optimizationBreakdown = getInstanceOptimizationBreakdown(
                    instance?.assessments,
                    !!databaseHost?.isWad,
                    DBType.MSSQL
                );
                const score = `${optimizationBreakdown.percent || 0}`;
                const { optimized } = optimizationBreakdown;
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
                    lastAssessmentTimestamp: getLastAssessmentTimestamp(instance?.assessments)
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
            if (shouldSkipDashboardAssessmentItem(instance)) {
                return;
            }
            if (!instance?.error && hasAssessmentTimestamp(instance?.assessments)) {
                const optimizationBreakdown = getInstanceOptimizationBreakdown(
                    instance?.assessments,
                    !!databaseHost?.isWad,
                    DBType.ORACLE
                );
                const score = `${optimizationBreakdown.percent || 0}`;
                const { optimized } = optimizationBreakdown;
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
                    lastAssessmentTimestamp: getLastAssessmentTimestamp(instance?.assessments)
                };
                tableData.push(perTableData);
            }
        });
    });

    const isLoading =
        getDatabaseHosts?.fullHostDataLoading ||
        getDatabaseHosts?.databaseHostsLoading ||
        getOracleDatabaseHosts?.fullHostDataLoading ||
        getOracleDatabaseHosts?.databaseHostsLoading;
    tableData = mapHostStatusToAssessmentData(inventoryTableData, tableData, isLoading);
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
