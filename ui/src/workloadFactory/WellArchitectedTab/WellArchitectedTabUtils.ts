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
import {
    DBType,
    INVENTORY_STATUS,
    WELL_ARCHITECTED_TABS,
    WELL_ARCH_ASSESSMENT_FLOW,
    WLF_TABS
} from '../../utils/consts';
import { LunFilesMap, LunFilterOption } from '../../utils/types/workloadFactoryResourceTypes';
import { dashboardRedirectionToWellArchitected } from '../../utils/utilityFunctions';
import {
    mapHostStatusToAssessmentData,
    shouldSkipDatabaseHost,
    getInstanceOptimizationBreakdown
} from '../DatabaseHomePage/DatabaseHomeUtils';
import {
    resolveInventoryRowForAssessmentInstance,
    resolveRegisteredAssessmentHostId,
    resolveWellArchAssessmentFlow,
    shouldSkipWellArchAssessmentItem,
    shouldSkipDuplicateAssessmentInstance,
    sortAnalyzedResourceData
} from '../InventoryV2/InventoryUtilsV2';
import { getLastAssessmentTimestamp, hasAssessmentTimestamp } from './assessmentFormatUtils';

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

/**
 * Appends Well-architected tab rows from one bulk assessment host (registered, WAD, or unregistered).
 * Skips ineligible instances via shouldSkipWellArchAssessmentItem, resolves the matching inventory row
 * for host name / FSx readiness / EC2 id, and falls back to inventory wadAssessmentData when the bulk
 * instance payload has no assessment timestamp yet.
 */
const appendAssessedHostInstances = ({
    databaseHost,
    dbType,
    inventoryTableData,
    tableData,
    idRef,
    uniqueInstanceList
}: {
    databaseHost: any;
    dbType: string;
    inventoryTableData: any;
    tableData: any[];
    idRef: { value: number };
    uniqueInstanceList: string[];
}) => {
    databaseHost?.instancesAssessment?.forEach((instance: any) => {
        if (shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)) {
            return;
        }

        const inventoryRow = resolveInventoryRowForAssessmentInstance(databaseHost, instance, inventoryTableData);
        if (shouldSkipDuplicateAssessmentInstance(databaseHost, instance, inventoryTableData, uniqueInstanceList)) {
            return;
        }
        const assessments = hasAssessmentTimestamp(instance?.assessments)
            ? instance?.assessments
            : inventoryRow?.wadAssessmentData;

        if (instance?.error || !hasAssessmentTimestamp(assessments)) {
            return;
        }

        const optimizationBreakdown = getInstanceOptimizationBreakdown(assessments, !!databaseHost?.isWad, dbType);
        const score = `${optimizationBreakdown.percent || 0}`;
        const { optimized } = optimizationBreakdown;
        tableData.push({
            id: idRef.value++,
            hostName: inventoryRow?.hostName || databaseHost?.databaseHostName,
            score,
            optimized,
            scoreForSorting: score ? Number(score) : 0,
            serverInstanceName: instance?.databaseInstanceName,
            databaseHostId:
                resolveRegisteredAssessmentHostId({
                    inventoryTableData,
                    databaseHostId: databaseHost?.databaseHostId,
                    credentialId: databaseHost?.credentialId,
                    regionId: databaseHost?.regionId,
                    instanceId: instance?.databaseInstanceId,
                    instanceName: instance?.databaseInstanceName
                }) ?? databaseHost?.databaseHostId,
            instanceId: instance?.databaseInstanceId,
            credentialId: databaseHost?.credentialId,
            regionId: databaseHost?.regionId,
            type: dbType,
            isWad: databaseHost?.isWad,
            isUnregistered: !!databaseHost?.isUnregistered,
            hostManageReadiness: inventoryRow?.hostManageReadiness,
            ec2InstanceId: inventoryRow?.ec2InstanceId || databaseHost?.vmInstanceId,
            lastAssessmentTimestamp: getLastAssessmentTimestamp(assessments)
        });
    });
};

/**
 * Appends discover (unmanaged) inventory instances that have locally merged wadAssessmentData but are
 * not yet represented in the bulk assessment store — e.g. immediately after on-demand unregistered
 * analyze, before WADApis bulk refresh catches up. Respects header credential/region filters and
 * skips rows already emitted by appendAssessedHostInstances to avoid duplicates.
 */
const appendInventoryMergedUnregisteredAssessments = ({
    inventoryTableData,
    tableData,
    idRef,
    headerSelectedMultiCredIdsList,
    headerSelectedMultiRegionIdsList,
    uniqueInstanceList
}: {
    inventoryTableData: any;
    tableData: any[];
    idRef: { value: number };
    headerSelectedMultiCredIdsList: string[];
    headerSelectedMultiRegionIdsList: string[];
    uniqueInstanceList: string[];
}) => {
    Object.values(inventoryTableData ?? {}).forEach((host: any) => {
        const dbType = host?.hostType;
        if (dbType !== DBType.MSSQL && dbType !== DBType.ORACLE) {
            return;
        }
        if (!headerSelectedMultiCredIdsList.includes(host?.credentialId || '')) {
            return;
        }
        if (
            headerSelectedMultiRegionIdsList.length > 0 &&
            !headerSelectedMultiRegionIdsList.includes(host?.regionId || '')
        ) {
            return;
        }

        host?.sqlServerInstances?.forEach((inst: any) => {
            if (inst?.statusColText === INVENTORY_STATUS.MANAGED || inst?.resourceId) {
                return;
            }
            if (!inst?.wadAssessmentData || !hasAssessmentTimestamp(inst.wadAssessmentData)) {
                return;
            }

            const ec2Id = host?.ec2InstanceId;
            if (
                shouldSkipDuplicateAssessmentInstance(
                    {
                        databaseHostId: ec2Id,
                        vmInstanceId: ec2Id,
                        regionId: host?.regionId,
                        credentialId: host?.credentialId
                    },
                    { databaseInstanceName: inst?.databaseInstanceName },
                    inventoryTableData,
                    uniqueInstanceList
                )
            ) {
                return;
            }

            const optimizationBreakdown = getInstanceOptimizationBreakdown(inst.wadAssessmentData, false, dbType);
            const score = `${optimizationBreakdown.percent || 0}`;
            tableData.push({
                id: idRef.value++,
                hostName: host?.name,
                score,
                optimized: optimizationBreakdown.optimized,
                scoreForSorting: score ? Number(score) : 0,
                serverInstanceName: inst?.databaseInstanceName,
                databaseHostId: ec2Id,
                instanceId: inst?.databaseInstanceId,
                credentialId: host?.credentialId,
                regionId: host?.regionId,
                type: dbType,
                isWad: false,
                isUnregistered: true,
                hostManageReadiness: inst?.hostManageReadiness ?? host?.hostManageReadiness,
                ec2InstanceId: ec2Id,
                lastAssessmentTimestamp: getLastAssessmentTimestamp(inst.wadAssessmentData)
            });
        });
    });
};

export const getAllAssessmentResources = (assessmentData: any, oracleAssessmentData: any) => {
    let tableData: any = [];
    const idRef = { value: 1 };
    const state = store.getState();
    const { inventoryTableData, getDatabaseHosts, getOracleDatabaseHosts } = state.inventoryV2;
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    const uniqueResourceList: Array<string> = [];
    const uniqueInstanceList: Array<string> = [];

    assessmentData.forEach((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList,
                inventoryTableData
            )
        ) {
            return;
        }
        appendAssessedHostInstances({
            databaseHost,
            dbType: DBType.MSSQL,
            inventoryTableData,
            tableData,
            idRef,
            uniqueInstanceList
        });
    });

    oracleAssessmentData.forEach((databaseHost: any) => {
        if (
            shouldSkipDatabaseHost(
                databaseHost,
                headerSelectedMultiCredIdsList,
                headerSelectedMultiRegionIdsList,
                uniqueResourceList,
                inventoryTableData
            )
        ) {
            return;
        }
        appendAssessedHostInstances({
            databaseHost,
            dbType: DBType.ORACLE,
            inventoryTableData,
            tableData,
            idRef,
            uniqueInstanceList
        });
    });

    appendInventoryMergedUnregisteredAssessments({
        inventoryTableData,
        tableData,
        idRef,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList,
        uniqueInstanceList
    });

    const isLoading =
        getDatabaseHosts?.fullHostDataLoading ||
        getDatabaseHosts?.databaseHostsLoading ||
        getOracleDatabaseHosts?.fullHostDataLoading ||
        getOracleDatabaseHosts?.databaseHostsLoading;
    tableData = mapHostStatusToAssessmentData(inventoryTableData, tableData, isLoading);
    return sortAnalyzedResourceData(tableData);
};

/** Navigates from the Well-architected tab to GetWell; resolves WAD vs unregistered vs registered flow and the correct resourceId (EC2 for unregistered, managed resourceId for registered). */
export const redirectToGetWellPage = (dispatch: any, selectedAssessmentRow: any) => {
    const state = store.getState();
    const { inventoryTableData } = state.inventoryV2;
    const flow = resolveWellArchAssessmentFlow({
        rowData: selectedAssessmentRow,
        inventoryTableData,
        resourceId: selectedAssessmentRow?.databaseHostId,
        credId: selectedAssessmentRow?.credentialId,
        regionId: selectedAssessmentRow?.regionId,
        instanceId: selectedAssessmentRow?.instanceId,
        instanceName: selectedAssessmentRow?.serverInstanceName
    });
    const isWad = flow === WELL_ARCH_ASSESSMENT_FLOW.WAD;
    const isUnregistered = flow === WELL_ARCH_ASSESSMENT_FLOW.UNREGISTERED;
    const resourceId =
        isUnregistered && selectedAssessmentRow?.ec2InstanceId
            ? selectedAssessmentRow.ec2InstanceId
            : resolveRegisteredAssessmentHostId({
                  inventoryTableData,
                  databaseHostId: selectedAssessmentRow?.databaseHostId,
                  credentialId: selectedAssessmentRow?.credentialId,
                  regionId: selectedAssessmentRow?.regionId,
                  instanceId: selectedAssessmentRow?.instanceId,
                  instanceName: selectedAssessmentRow?.serverInstanceName
              });

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
            resourceId,
            instanceId: selectedAssessmentRow?.instanceId,
            instanceName: selectedAssessmentRow?.serverInstanceName,
            credId: selectedAssessmentRow?.credentialId,
            regionId: selectedAssessmentRow?.regionId,
            storageType: selectedAssessmentRow?.sqlServerDeploymentType,
            isWad,
            isUnregistered,
            hostManageReadiness: selectedAssessmentRow?.hostManageReadiness,
            instanceStatus: selectedAssessmentRow?.status
        })
    );

    dispatch(setSelectedHostname(selectedAssessmentRow?.hostName));
    dispatch(
        setSelectedResourcePageHostData({
            resourceId,
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
