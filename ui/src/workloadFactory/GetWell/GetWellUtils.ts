import i18next, { TFunction } from 'i18next';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import store from '../../store/store';
import { setSelectedConfigSummary } from '../../store/workloadFactory/databaseHomeSlice';
import { getRecommendation } from '../../utils/recommendations';
import {
    setCardData,
    setCloneDashboardData,
    setCloneIsOptimizedRows,
    setDriftAssessmentData,
    setGwRefreshTimestamp,
    setGwTimestamp,
    setInProgressHostData,
    setInProgressOptimizationData,
    setInProgressResourceOptimizeData,
    setIsInnerPageOptimize,
    setOptimizationBreakDown,
    setOptimizingData,
    setOptimizingInstanceData,
    setGwRefreshPage
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { setRefreshOracleWellArchitect } from '../../store/workloadFactory/oracleSlice';
import {
    addAllMssqlHostAssessmentData,
    addAllOracleHostAssessmentData,
    setSelectedHeaderTab
} from '../../store/workloadFactory/inventoryV2Slice';
import { setInstanceDetailsData } from '../../store/workloadFactory/workloadFactoryResourceSlice';
import { GENERAL } from '../../utils/appConstants';
import {
    ASSESSMENT_CONFIG_NAMES,
    ASSESSMENT_CONFIG_IDS,
    BLOCK_SIX_LABELS,
    CONFIG_STATES,
    CONFIG_STATES_UI,
    CONFIG_STATE_ACTIONS,
    DATABASE_DEPLOYMENT_MODE,
    DBType,
    FINDINGS,
    GETWELL_STATUS,
    GETWELL_VALUES,
    INVENTORY_STATUS,
    isConfigIdMatch,
    isConfigIdInList,
    JOB_MONITORING_STATUS,
    MSSQL_STORAGE_COUNT_CONFIG_IDS,
    OPTIMIZE_POLLING_INTERVAL,
    STATUS_CONST,
    WA_FLAG_SKIP,
    WELL_ARCHITECTED_CATEGORIES,
    WELL_ARCHITECTED_CATEGORY_LABELS,
    WELL_ARCHITECTED_CATEGORY_ORDER,
    WLF_TABS,
    WELL_ARCHITECTED_STATUS
} from '../../utils/consts';
import { groupByType, mapDismissedValues } from '../../utils/resourceUtils';
import { AssessmentResponseInterface } from '../../utils/types/getWellTypes';
import {
    dashboardRedirection,
    formatDateWithTime,
    formatNumberWithCustomComma,
    getCurrentDateTime
} from '../../utils/utilityFunctions';
import { isOptimized } from '../DatabaseHomePage/DatabaseHomeUtils';
import {
    getConfigSeverity,
    getConfigStateList,
    getConfigStatsBucket,
    hasConfigStats,
    resolveConfigDisplayName
} from '../WellArchitectedTab/assessmentFormatUtils';
import { sortConfigsByPriority } from '../../utils/configRegistry';

/**
 * Checks if the deployment type is AOAG.
 */
export const isAoagDeployment = (deploymentType?: string): boolean =>
    deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG_CAPS;

// This function is used to format the optimization breakdown data.
export const formatOptimizationBreakDown = (cardsData: any, assessmentData?: any) => {
    let optimizedStorage = 0;
    let notOptimizedStorage = 0;
    let optimizedCompute = 0;
    let notOptimizedCompute = 0;
    let optimizedApplication = 0;
    let notOptimizedApplication = 0;
    let optimizedResiliency = 0;
    let notOptimizedResiliency = 0;
    let optimizedCloning = 0;
    let notOptimizedCloning = 0;

    // For warning and critical
    let warningStorage = 0;
    let criticalStorage = 0;
    let warningCompute = 0;
    let criticalCompute = 0;
    let warningApplication = 0;
    let criticalApplication = 0;
    let warningResiliency = 0;
    let criticalResiliency = 0;
    let warningCloning = 0;
    let criticalCloning = 0;

    // Combined counts for dismissed and postponed
    let dismissedOrPostponedStorage = 0;
    let dismissedOrPostponedCompute = 0;
    let dismissedOrPostponedApplication = 0;
    let dismissedOrPostponedResiliency = 0;
    let dismissedOrPostponedCloning = 0;

    // Arrays to store dismissed/postponed configuration IDs
    const dismissedStorageIds: string[] = [];
    const dismissedComputeIds: string[] = [];
    const dismissedApplicationIds: string[] = [];
    const dismissedResiliencyIds: string[] = [];
    const dismissedCloningIds: string[] = [];

    let hasDismissedOrPostponedStorage = false;
    let hasDismissedOrPostponedCompute = false;
    let hasDismissedOrPostponedApplication = false;
    let hasDismissedOrPostponedResiliency = false;
    let hasDismissedOrPostponedCloning = false;

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardsData?.isWad || false;

    Object.keys(cardsData).forEach(key => {
        const nestedObject = cardsData[key];

        const dismissedState = nestedObject?.dismissedObj?.configState;
        const isDismissed = dismissedState === CONFIG_STATES.DISMISSED;
        const isPostponed = dismissedState === CONFIG_STATES.POSTPONED;
        const isOptimizedViaDismissal = dismissedState === CONFIG_STATES.ACTIVATING;

        // For dismissedIds, use configurationId if available (flat API), otherwise use mapName (nested API)
        // This ensures proper matching in tooltip helper functions
        const dismissedId = nestedObject?.configurationId || nestedObject?.mapName;

        if (nestedObject?.category === WELL_ARCHITECTED_CATEGORIES.STORAGE) {
            if (isDismissed || isPostponed) {
                dismissedOrPostponedStorage++;
                hasDismissedOrPostponedStorage = true;
                dismissedStorageIds.push(dismissedId);
            } else if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedStorage++;
                if (isOptimizedViaDismissal) hasDismissedOrPostponedStorage = true;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.CRITICAL) {
                notOptimizedStorage++;
                criticalStorage++;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.WARNING) {
                notOptimizedStorage++;
                warningStorage++;
            } else {
                notOptimizedStorage++;
            }
        } else if (nestedObject?.category === WELL_ARCHITECTED_CATEGORIES.COMPUTE) {
            if (isDismissed || isPostponed) {
                dismissedOrPostponedCompute++;
                hasDismissedOrPostponedCompute = true;
                dismissedComputeIds.push(dismissedId);
            } else if (
                nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED ||
                nestedObject?.block_two?.value === GETWELL_STATUS.ANALYZING ||
                isOptimizedViaDismissal
            ) {
                optimizedCompute++;
                if (isOptimizedViaDismissal) hasDismissedOrPostponedCompute = true;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.CRITICAL) {
                notOptimizedCompute++;
                criticalCompute++;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.WARNING) {
                notOptimizedCompute++;
                warningCompute++;
            } else {
                notOptimizedCompute++;
            }
        } else if (nestedObject?.category === WELL_ARCHITECTED_CATEGORIES.APPLICATION) {
            if (isDismissed || isPostponed) {
                dismissedOrPostponedApplication++;
                hasDismissedOrPostponedApplication = true;
                dismissedApplicationIds.push(dismissedId);
            } else if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedApplication++;
                if (isOptimizedViaDismissal) hasDismissedOrPostponedApplication = true;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.CRITICAL) {
                notOptimizedApplication++;
                criticalApplication++;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.WARNING) {
                notOptimizedApplication++;
                warningApplication++;
            } else {
                notOptimizedApplication++;
            }
        } else if (nestedObject?.category === WELL_ARCHITECTED_CATEGORIES.RESILIENCY) {
            if (isDismissed || isPostponed) {
                dismissedOrPostponedResiliency++;
                hasDismissedOrPostponedResiliency = true;
                dismissedResiliencyIds.push(dismissedId);
            } else if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedResiliency++;
                if (isOptimizedViaDismissal) hasDismissedOrPostponedResiliency = true;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.CRITICAL) {
                notOptimizedResiliency++;
                criticalResiliency++;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.WARNING) {
                notOptimizedResiliency++;
                warningResiliency++;
            } else {
                notOptimizedResiliency++;
            }
        } else if (nestedObject?.category === WELL_ARCHITECTED_CATEGORIES.CLONING) {
            if (isDismissed || isPostponed) {
                dismissedOrPostponedCloning++;
                hasDismissedOrPostponedCloning = true;
                dismissedCloningIds.push(dismissedId);
            } else if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedCloning++;
                if (isOptimizedViaDismissal) hasDismissedOrPostponedCloning = true;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.CRITICAL) {
                notOptimizedCloning++;
                criticalCloning++;
            } else if (nestedObject?.block_four?.value === GETWELL_STATUS.WARNING) {
                notOptimizedCloning++;
                warningCloning++;
            } else {
                notOptimizedCloning++;
            }
        }
    });

    const storageCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedStorage,
        total: optimizedStorage + notOptimizedStorage,
        critical: criticalStorage,
        warning: warningStorage,
        optimized: optimizedStorage,
        notOptimized: notOptimizedStorage,
        dismissedOrPostponed: dismissedOrPostponedStorage,
        dismissedIds: dismissedStorageIds,
        percent: optimizedStorage
            ? formatNumberWithCustomComma((optimizedStorage / (optimizedStorage + notOptimizedStorage)) * 100)
            : 0
    };
    const computeCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedCompute,
        total: optimizedCompute + notOptimizedCompute,
        critical: criticalCompute,
        warning: warningCompute,
        optimized: optimizedCompute,
        notOptimized: notOptimizedCompute,
        dismissedOrPostponed: dismissedOrPostponedCompute,
        dismissedIds: dismissedComputeIds,
        percent: optimizedCompute
            ? formatNumberWithCustomComma((optimizedCompute / (optimizedCompute + notOptimizedCompute)) * 100)
            : 0
    };
    const applicationCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedApplication,
        total: optimizedApplication + notOptimizedApplication,
        critical: criticalApplication,
        warning: warningApplication,
        optimized: optimizedApplication,
        notOptimized: notOptimizedApplication,
        dismissedOrPostponed: dismissedOrPostponedApplication,
        dismissedIds: dismissedApplicationIds,
        percent: optimizedApplication
            ? formatNumberWithCustomComma(
                  (optimizedApplication / (optimizedApplication + notOptimizedApplication)) * 100
              )
            : 0
    };

    const resiliencyCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedResiliency,
        total: optimizedResiliency + notOptimizedResiliency,
        critical: criticalResiliency,
        warning: warningResiliency,
        optimized: optimizedResiliency,
        notOptimized: notOptimizedResiliency,
        dismissedOrPostponed: dismissedOrPostponedResiliency,
        dismissedIds: dismissedResiliencyIds,
        percent: optimizedResiliency
            ? formatNumberWithCustomComma((optimizedResiliency / (optimizedResiliency + notOptimizedResiliency)) * 100)
            : 0
    };

    const cloningCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedCloning,
        total: optimizedCloning + notOptimizedCloning,
        critical: criticalCloning,
        warning: warningCloning,
        optimized: optimizedCloning,
        notOptimized: notOptimizedCloning,
        dismissedOrPostponed: dismissedOrPostponedCloning,
        dismissedIds: dismissedCloningIds,
        percent: optimizedCloning
            ? formatNumberWithCustomComma((optimizedCloning / (optimizedCloning + notOptimizedCloning)) * 100)
            : 0
    };

    const optBreakDown = {
        storage: storageCount,
        compute: computeCount,
        application: applicationCount,
        resiliency: resiliencyCount,
        cloning: cloningCount,
        total: {
            // Total configuration will be calculated by adding the total number of configurations in the storage layout and sizing
            total:
                storageCount?.total +
                computeCount?.total +
                applicationCount?.total +
                resiliencyCount?.total +
                cloningCount?.total,
            optimized:
                storageCount?.optimized +
                computeCount?.optimized +
                applicationCount?.optimized +
                resiliencyCount?.optimized +
                cloningCount?.optimized,
            critical:
                storageCount?.critical +
                computeCount?.critical +
                applicationCount?.critical +
                resiliencyCount?.critical +
                cloningCount?.critical,
            warning:
                storageCount?.warning +
                computeCount?.warning +
                applicationCount?.warning +
                resiliencyCount?.warning +
                cloningCount?.warning,
            notOptimized:
                storageCount?.notOptimized +
                computeCount?.notOptimized +
                applicationCount?.notOptimized +
                resiliencyCount?.notOptimized +
                cloningCount?.notOptimized,
            dismissedOrPostponed:
                storageCount?.dismissedOrPostponed +
                computeCount?.dismissedOrPostponed +
                applicationCount?.dismissedOrPostponed +
                resiliencyCount?.dismissedOrPostponed +
                cloningCount?.dismissedOrPostponed,
            dismissedIds: [
                ...(storageCount?.dismissedIds || []),
                ...(computeCount?.dismissedIds || []),
                ...(applicationCount?.dismissedIds || []),
                ...(resiliencyCount?.dismissedIds || []),
                ...(cloningCount?.dismissedIds || [])
            ],
            percent:
                storageCount?.optimized ||
                computeCount?.optimized ||
                applicationCount?.optimized ||
                resiliencyCount?.optimized ||
                cloningCount?.optimized
                    ? formatNumberWithCustomComma(
                          ((storageCount?.optimized +
                              computeCount?.optimized +
                              applicationCount?.optimized +
                              resiliencyCount?.optimized +
                              cloningCount?.optimized || 0) /
                              (storageCount?.total +
                                  computeCount?.total +
                                  applicationCount?.total +
                                  resiliencyCount?.total +
                                  cloningCount?.total || 1)) *
                              100
                      )
                    : 0
        }
    };
    return optBreakDown;
};

export const getCardsData = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    showDismissedView: boolean = false
) => {
    const { cardsData } = formatFlatAssessments(data as any, optimizingData, showDismissedView, i18next.t);

    return {
        cardsData,
        formatOntapConfigList: [],
        formatOsConfigList: [],
        formatMssqlHighAvailabilityConfigList: []
    };
};

export const generateDate = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}`;
};

// Generate dynamic filter options from flat API card data
export const generateDynamicFilterOptions = (cardData: any, deploymentType?: string) => {
    const availableCategories = new Set();
    const availableSeverities = new Set();
    const availableTags = new Set();
    const availableResourceTypes = new Set();
    const availableStatuses = new Set();

    Object.keys(cardData).forEach((key: any) => {
        if (WA_FLAG_SKIP.includes(key)) {
            return; // Skip metadata fields like deploymentType, isWad, etc.
        }

        const config = cardData[key];

        // Add category from flat API (directly in config, not from lookup)
        if (config.category) {
            availableCategories.add(config.category);
        }

        // Add severity
        if (config.block_four?.value) {
            availableSeverities.add(config.block_four.value);
        }

        // Add tags
        if (config.tags && Array.isArray(config.tags)) {
            config.tags.forEach((tag: string) => availableTags.add(tag));
        }

        // Add resource type
        if (config.block_five?.value) {
            availableResourceTypes.add(config.block_five.value);
        }

        // Add status based on optimization state
        const isOptimizedStatus = isOptimized(config.block_two?.value, config.dismissedObj?.configState);
        availableStatuses.add(isOptimizedStatus ? GETWELL_STATUS.OPTIMIZED : GETWELL_STATUS.NOT_OPTIMIZED);
    });

    return {
        categories: Array.from(availableCategories).map(category => ({
            id: category as string,
            label:
                WELL_ARCHITECTED_CATEGORY_LABELS[
                    (category as string)?.toLowerCase() as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS
                ] || (category as string),
            value: category as string
        })),
        subCategories: [], // Flat API doesn't use subcategories
        severities: Array.from(availableSeverities).map(severity => ({
            id: severity as string,
            label: severity as string,
            value: severity as string
        })),
        tags: Array.from(availableTags).map(tag => ({
            id: tag as string,
            label: tag as string,
            value: tag as string
        })),
        resourceTypes: Array.from(availableResourceTypes).map(resourceType => ({
            id: resourceType as string,
            label: resourceType as string,
            value: resourceType as string
        })),
        statuses: Array.from(availableStatuses).map(status => ({
            id: status as string,
            label: status as string,
            value: status as string
        }))
    };
};

// filters card data based on filter tags
export const applyFilter = (
    cardData: any,
    optimizeFilterTags: any,
    selectedDatabaseStorageType?: string,
    showDismissedConfigurations?: boolean,
    driftAssessmentData?: any
) => {
    const filteredCardData: any = {};
    let configCount = 0;
    const filters = groupByType(optimizeFilterTags, 'value');

    // getCategoryData removed - flat API provides category directly in each config

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    Object.keys(cardData).map((key: any) => {
        if (WA_FLAG_SKIP.includes(key)) {
            return; // Skip deploymentType as it is not a card
        }
        // WAD excluded configs already filtered by backend, no frontend filtering needed
        const isWadExcluded = false;
        if (isWadExcluded) {
            filteredCardData[key] = { ...cardData[key], isWadExcluded: true };
            // Do NOT count WAD excluded configs as they are not part of the assessment
            return;
        }

        const checkCategory =
            !filters['all-catagories'] || filters['all-catagories']?.includes(cardData[key]?.category);

        const isOptmized = isOptimized(cardData[key]?.block_two?.value, cardData[key].dismissedObj?.configState);
        const checkStatus =
            !filters.status ||
            (filters.status?.includes(GETWELL_VALUES.optimized) && isOptmized) ||
            (filters.status?.includes('Not optimized') && !isOptmized);

        const checkSeverity = !filters.severity || filters.severity?.includes(cardData[key].block_four.value);

        const checkTags =
            !filters.tags || filters.tags.filter((tag: string) => cardData[key].tags?.includes(tag)).length > 0;

        let configVal = '';
        if (!cardData[key].dismissedObj?.configState) {
            configVal = CONFIG_STATES.ACTIVE;
        } else if (cardData[key].dismissedObj?.configState === CONFIG_STATES.ACTIVATING) {
            configVal = CONFIG_STATES.ACTIVE;
        } else {
            configVal = cardData[key].dismissedObj?.configState;
        }
        const checkConfigState = !filters.configState || filters.configState?.includes(configVal);

        // Flat API: all configs have resource types
        const resourceType = cardData[key]?.block_five?.value;
        const checkResourceType = !filters.resourceType || filters.resourceType?.includes(resourceType);

        // Handle dismissed configuration toggle filtering
        const configState = cardData[key].dismissedObj?.configState;
        let checkDismissedFilter = true;

        if (showDismissedConfigurations !== undefined) {
            // Standard logic for all configurations (flat API structure)
            if (showDismissedConfigurations) {
                // Show only dismissed and postponed configurations
                checkDismissedFilter =
                    configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED;
            } else {
                // Show only active configurations (excluding dismissed and postponed)
                checkDismissedFilter =
                    !configState || configState === CONFIG_STATES.ACTIVE || configState === CONFIG_STATES.ACTIVATING;
            }
        }

        if (
            checkCategory &&
            checkStatus &&
            checkSeverity &&
            checkTags &&
            checkConfigState &&
            checkResourceType &&
            checkDismissedFilter
        ) {
            filteredCardData[key] = cardData[key];
            // Count configurations - flat API provides category directly in each config
            if (cardData[key]?.category) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};

export const resetGwValuesOnRefresh = (dispatch: any) => {
    dispatch(setDriftAssessmentData(null));
    dispatch(setCardData({}));
    dispatch(setOptimizationBreakDown(null));
    dispatch(setOptimizingData({}));
    dispatch(setOptimizingInstanceData(false));
};

// This function is used to update the progress of the Fixing process for assessment confif resource level jobs.
// Currently it is only written for clone cleanup.
const updateProgressResourceForBulk = (
    dispatch: any,
    type: string,
    jobId: string,
    inProgressOptimizationData: any,
    jobToInstanceMapForBulk: any,
    inProgressHostData: any,
    inProgressResourceOptimizeData: any
) => {
    const state = store.getState();
    const { cloneDashboardData, cloneIsOptimizedRows } = state.getWellOptimize;
    const uniqueRanList: any = [];
    const newInProgressResourceOptimizationData: any = {
        ...inProgressResourceOptimizeData,
        [type]: inProgressResourceOptimizeData?.[type]?.filter((instanceId: any) => {
            const jobInstances =
                jobToInstanceMapForBulk[jobId]?.databaseHosts.flatMap((host: any) => {
                    const instances = host?.sqlServerInstances || host?.oracleInstances || host?.databases;
                    return instances?.flatMap((instance: any) =>
                        instance?.clones?.map((clone: any) => {
                            uniqueRanList.push(`${host?.id}_${instance?.instanceId}_${clone?.cloneDatabaseName}`);
                            return `${host?.id}_${instance?.instanceId}_${clone?.cloneDatabaseName}`;
                        })
                    );
                }) || [];
            return !jobInstances.includes(instanceId);
        })
    };
    dispatch(setInProgressResourceOptimizeData(newInProgressResourceOptimizationData));

    let cloneIsOptimizedRowsList = {};
    const newCloneDashboardData = cloneDashboardData?.objectsInViolation?.map((row: any) => {
        if (uniqueRanList.includes(`${row?.resourceId}_${row?.instanceId}_${row?.cloneDatabaseName}`)) {
            cloneIsOptimizedRowsList = {
                ...cloneIsOptimizedRowsList,
                [`${row?.resourceId}_${row?.instanceId}_${row?.cloneDatabaseName}`]: true
            };
            return {
                ...row,
                isOptimized: true
            };
        }
        return row;
    });
    dispatch(
        setCloneIsOptimizedRows({
            ...cloneIsOptimizedRows,
            ...cloneIsOptimizedRowsList
        })
    );

    dispatch(
        setCloneDashboardData({
            ...cloneDashboardData,
            objectsInViolation: newCloneDashboardData
        })
    );

    const newInProgressOptimizationData = {
        ...inProgressOptimizationData,
        [type]: inProgressOptimizationData?.[type]?.filter((instanceId: any) => {
            const jobInstances =
                jobToInstanceMapForBulk[jobId]?.databaseHosts.flatMap((host: any) => {
                    const instances = host.sqlServerInstances || host.oracleInstances || host.databases;
                    return instances.map((instance: any) => `${host.id}_${instance?.instanceId}`);
                }) || [];
            return !jobInstances.includes(instanceId);
        })
    };
    dispatch(setInProgressOptimizationData(newInProgressOptimizationData));

    const newInProgressHostData = {
        ...inProgressHostData,
        [type]: inProgressHostData?.[type]?.filter(
            // Data host id to check
            (hostId: any) => {
                const jobHostIds = jobToInstanceMapForBulk[jobId]?.databaseHosts.map((host: any) => host.id) || [];

                return !jobHostIds.includes(hostId);
            }
        )
    };
    dispatch(setInProgressHostData(newInProgressHostData));
};

const updateProgressForBulk = (
    dispatch: any,
    type: string,
    jobId: string,
    inProgressOptimizationData: any,
    jobToInstanceMapForBulk: any,
    inProgressHostData: any
) => {
    dispatch(
        setInProgressOptimizationData({
            ...inProgressOptimizationData,
            [type]: inProgressOptimizationData?.[type]?.filter((instanceId: any) => {
                const jobInstances =
                    jobToInstanceMapForBulk[jobId]?.databaseHosts.flatMap((host: any) => {
                        const instances = host.sqlServerInstances || host.oracleInstances || host.databases;
                        return instances.map((instance: any) => `${host.id}_${instance}`);
                    }) || [];
                return !jobInstances.includes(instanceId);
            })
        })
    );
    dispatch(
        setInProgressHostData({
            ...inProgressHostData,
            [type]: inProgressHostData?.[type]?.filter(
                // Data host id to check
                (hostId: any) => {
                    const jobHostIds = jobToInstanceMapForBulk[jobId]?.databaseHosts.map((host: any) => host.id) || [];

                    return !jobHostIds.includes(hostId);
                }
            )
        })
    );
};

const updateProgressForSingle = (
    dispatch: any,
    type: string,
    jobId: string,
    inProgressOptimizationData: any,
    jobToInstanceMap: any,
    inProgressHostData: any
) => {
    dispatch(
        setInProgressOptimizationData({
            ...inProgressOptimizationData,
            [type]: inProgressOptimizationData?.[type]?.filter(
                (instanceId: any) =>
                    instanceId !== `${jobToInstanceMap[jobId]?.hostId}_${jobToInstanceMap[jobId]?.instanceId}`
            )
        })
    );
    dispatch(
        setInProgressHostData({
            ...inProgressHostData,
            [type]: inProgressHostData?.[type]?.filter((hostId: any) => hostId !== jobToInstanceMap[jobId]?.hostId)
        })
    );
};

const updateAssessmentWithCompletedJobs = (
    dispatch: any,
    operation: string | undefined,
    type: string,
    jobId: string,
    rowData: any,
    bulkRowData: any,
    engineType: string | undefined,
    isOptimizeInnerPage?: boolean
) => {
    const state = store.getState();
    const { allmssqlHostAssessmentData, allOracleHostAssessmentData } = state.inventoryV2;
    const {
        jobToInstanceMap,
        jobToInstanceMapForBulk,
        inProgressOptimizationData,
        inProgressHostData,
        optimizingData
    } = state.getWellOptimize;
    if (engineType === DBType.ORACLE) {
        dispatch(addAllOracleHostAssessmentData(allOracleHostAssessmentData));
    } else {
        dispatch(addAllMssqlHostAssessmentData(allmssqlHostAssessmentData));
    }

    if (operation === 'bulk') {
        updateProgressForBulk(
            dispatch,
            type,
            jobId,
            inProgressOptimizationData,
            jobToInstanceMapForBulk,
            inProgressHostData
        );
        bulkRowData?.map((row: any) => {
            updateFlatAssessmentStatus(row, dispatch, engineType);
        });
        setTimeout(() => {
            // Refresh assessment data from store after optimization completes
            const refreshedData = store.getState().getWellOptimize.driftAssessmentData;
            if (refreshedData) {
                formatGetWellDataFlat(dispatch, refreshedData as any, false, false, false, i18next.t);
            }
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: `${bulkRowData?.[0]?.name} instances fixed successfully.`
                })
            );
        }, 0);
    } else {
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [rowData?.id]: WELL_ARCHITECTED_STATUS.OPTIMIZED
            })
        );
        updateProgressForSingle(
            dispatch,
            type,
            jobId,
            inProgressOptimizationData,
            jobToInstanceMap,
            inProgressHostData
        );

        if (isOptimizeInnerPage) {
            updateFlatAssessmentStatus(rowData, dispatch, engineType);
        } else {
            const currentCardData = store.getState().getWellOptimize.cardData;
            if (currentCardData && rowData?.id && currentCardData[rowData.id]) {
                dispatch(
                    setCardData({
                        ...currentCardData,
                        [rowData.id]: {
                            ...currentCardData[rowData.id],
                            block_two: {
                                ...currentCardData[rowData.id].block_two,
                                value: GETWELL_STATUS.OPTIMIZED
                            }
                        }
                    })
                );
            }
        }

        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.SUCCESS,
                message: `${rowData?.name} fixed successfully.`
            })
        );
    }
};

const updateAssessmentWithWarningJobs = (
    dispatch: any,
    operation: string | undefined,
    type: string,
    jobId: string,
    rowData: any,
    bulkRowData: any,
    subjobs: any,
    engineType?: string | undefined,
    isOptimizeInnerPage?: boolean
) => {
    const state = store.getState();
    const { allmssqlHostAssessmentData, allOracleHostAssessmentData } = state.inventoryV2;
    const {
        jobToInstanceMap,
        jobToInstanceMapForBulk,
        inProgressOptimizationData,
        inProgressHostData,
        optimizingData
    } = state.getWellOptimize;
    if (engineType === DBType.ORACLE) {
        dispatch(addAllOracleHostAssessmentData(allOracleHostAssessmentData));
    } else {
        dispatch(addAllMssqlHostAssessmentData(allmssqlHostAssessmentData));
    }

    if (operation === 'bulk') {
        updateProgressForBulk(
            dispatch,
            type,
            jobId,
            inProgressOptimizationData,
            jobToInstanceMapForBulk,
            inProgressHostData
        );
        let successJobCount = 0;
        bulkRowData?.map((row: any) => {
            const isSuccess = subjobs?.filter((subjob: any) => {
                if (subjob?.status !== JOB_MONITORING_STATUS.COMPLETED) return false;
                if (subjob?.hostsToOptimize?.[0]?.resourceId !== row?.hostId) return false;
                const sqlServerInstances = subjob?.hostsToOptimize?.[0]?.sqlServerInstances?.[0];
                const databases = subjob?.hostsToOptimize?.[0]?.databases?.[0];
                return sqlServerInstances.includes(row?.instanceId) || databases.includes(row?.instanceId);
            });
            if (isSuccess?.length) {
                successJobCount++;
                updateFlatAssessmentStatus(row, dispatch, engineType);
            }
        });
        setTimeout(() => {
            // Refresh assessment data from store after optimization completes
            const refreshedData = store.getState().getWellOptimize.driftAssessmentData;
            if (refreshedData) {
                formatGetWellDataFlat(dispatch, refreshedData as any, false, false, false, i18next.t);
            }
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: `${successJobCount} out of ${bulkRowData?.length} ${bulkRowData?.[0]?.name} instances fixed successfully.`
                })
            );
        }, 0);
    } else {
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [rowData?.id]: WELL_ARCHITECTED_STATUS.OPTIMIZED
            })
        );
        updateProgressForSingle(
            dispatch,
            type,
            jobId,
            inProgressOptimizationData,
            jobToInstanceMap,
            inProgressHostData
        );

        if (isOptimizeInnerPage) {
            updateFlatAssessmentStatus(rowData, dispatch, engineType);
        } else {
            const currentCardData = store.getState().getWellOptimize.cardData;
            if (currentCardData && rowData?.id && currentCardData[rowData.id]) {
                dispatch(
                    setCardData({
                        ...currentCardData,
                        [rowData.id]: {
                            ...currentCardData[rowData.id],
                            block_two: {
                                ...currentCardData[rowData.id].block_two,
                                value: GETWELL_STATUS.OPTIMIZED
                            }
                        }
                    })
                );
            }
        }

        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.SUCCESS,
                message: `${rowData?.name} fixed successfully.`
            })
        );
    }
};

const updateAssessmentWithFailedJobs = (
    dispatch: any,
    operation: string | undefined,
    type: string,
    jobId: string,
    rowData: any,
    bulkRowData: any,
    failedMsgData: any,
    engineType?: string,
    isOptimizeInnerPage?: boolean
) => {
    const state = store.getState();
    const {
        jobToInstanceMap,
        jobToInstanceMapForBulk,
        inProgressOptimizationData,
        inProgressHostData,
        optimizingData
    } = state.getWellOptimize;
    if (operation === 'bulk') {
        updateProgressForBulk(
            dispatch,
            type,
            jobId,
            inProgressOptimizationData,
            jobToInstanceMapForBulk,
            inProgressHostData
        );

        setTimeout(() => {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: failedMsgData
                })
            );
        }, 0);
    } else {
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [rowData?.id]: ''
            })
        );
        updateProgressForSingle(
            dispatch,
            type,
            jobId,
            inProgressOptimizationData,
            jobToInstanceMap,
            inProgressHostData
        );

        if (isOptimizeInnerPage) {
            // Trigger assessment refresh even on failure to show updated status
            if (engineType === DBType.ORACLE) {
                dispatch(setRefreshOracleWellArchitect(true));
            } else {
                dispatch(setGwRefreshPage(true));
            }
        } else {
            // Clear cardData.block_two status to prevent stuck "Optimizing" display after failure
            const currentCardData = store.getState().getWellOptimize.cardData;
            if (currentCardData && rowData?.id && currentCardData[rowData.id]) {
                dispatch(
                    setCardData({
                        ...currentCardData,
                        [rowData.id]: {
                            ...currentCardData[rowData.id],
                            block_two: {
                                ...currentCardData[rowData.id].block_two,
                                value: ''
                            }
                        }
                    })
                );
            }
        }

        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: failedMsgData
            })
        );
    }
};

// This function is used to handle the optimization job for resources.
// Currently only applicable for clone cleanup optimize job
export const handleOptimizeResourceJob = (
    res: any,
    failedMsgData: any,
    getJobDetailApi: any,
    dispatch: any,
    type?: any,
    bulkRowData?: any,
    engineType?: string
) => {
    const state = store.getState();
    const optimizingData = state.getWellOptimize.optimizingData || {};
    setTimeout(() => {
        if (res?.data) {
            const jobInterval = setInterval(() => {
                getJobDetailApi({
                    id: res?.data?.jobId
                }).then((jobRes: any) => {
                    const status = jobRes?.data?.status;
                    const jobId = jobRes?.data?.id;
                    const subjobs = jobRes?.data?.subJobs;
                    const state = store.getState();
                    const {
                        jobToInstanceMapForBulk,
                        inProgressOptimizationData,
                        inProgressHostData,
                        inProgressResourceOptimizeData
                    } = state.getWellOptimize;
                    if (status === JOB_MONITORING_STATUS.COMPLETED) {
                        updateProgressResourceForBulk(
                            dispatch,
                            type,
                            jobId,
                            inProgressOptimizationData,
                            jobToInstanceMapForBulk,
                            inProgressHostData,
                            inProgressResourceOptimizeData
                        );
                        bulkRowData?.map((row: any) => {
                            updateFlatAssessmentStatus(row, dispatch, engineType);
                        });
                        setTimeout(() => {
                            // Refresh assessment data from store after optimization completes
                            const refreshedData = store.getState().getWellOptimize.driftAssessmentData;
                            if (refreshedData) {
                                formatGetWellDataFlat(dispatch, refreshedData as any, false, false, false, i18next.t);
                            }
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                                    message: 'Clone databases fixed successfully.'
                                })
                            );
                        }, 0);

                        // Clear optimizingData for Clone Management
                        const currentOptimizingData = store.getState().getWellOptimize.optimizingData || {};
                        if (type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
                            dispatch(
                                setOptimizingData({
                                    ...currentOptimizingData,
                                    [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: ''
                                })
                            );
                            // Trigger assessment refresh based on engine type
                            if (engineType === DBType.ORACLE) {
                                dispatch(setRefreshOracleWellArchitect(true));
                            } else {
                                dispatch(setGwRefreshPage(true));
                            }
                        }

                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                    } else if (status === JOB_MONITORING_STATUS.WARNING) {
                        updateProgressResourceForBulk(
                            dispatch,
                            type,
                            jobId,
                            inProgressOptimizationData,
                            jobToInstanceMapForBulk,
                            inProgressHostData,
                            inProgressResourceOptimizeData
                        );

                        let successJobCount = 0;
                        bulkRowData?.map((row: any) => {
                            const isSuccess = subjobs?.filter((subjob: any) => {
                                if (subjob?.status !== JOB_MONITORING_STATUS.COMPLETED) return false;
                                if (subjob?.hostsToOptimize?.[0]?.resourceId !== row?.hostId) return false;
                                const sqlServerInstances = subjob?.hostsToOptimize?.[0]?.sqlServerInstances?.[0];
                                const oracleInstances = subjob?.hostsToOptimize?.[0]?.oracleInstances?.[0];
                                const databases = subjob?.hostsToOptimize?.[0]?.databases?.[0];

                                return (
                                    sqlServerInstances?.includes(row?.instanceId) ||
                                    oracleInstances?.includes(row?.instanceId) ||
                                    databases?.includes(row?.instanceId)
                                );
                            });
                            if (isSuccess?.length) {
                                successJobCount++;
                                updateFlatAssessmentStatus(row, dispatch, engineType);
                            }
                        });
                        setTimeout(() => {
                            // Refresh assessment data from store after optimization completes
                            const refreshedData = store.getState().getWellOptimize.driftAssessmentData;
                            if (refreshedData) {
                                formatGetWellDataFlat(dispatch, refreshedData as any, false, false, false, i18next.t);
                            }
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.INFO,
                                    message: `${successJobCount} out of ${bulkRowData?.length} ${bulkRowData?.[0]?.name} instances fixed successfully.`
                                })
                            );
                        }, 0);

                        // Clear optimizingData for Clone Management
                        const currentOptimizingDataWarning = store.getState().getWellOptimize.optimizingData || {};
                        if (type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
                            dispatch(
                                setOptimizingData({
                                    ...currentOptimizingDataWarning,
                                    [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: ''
                                })
                            );
                            // Trigger assessment refresh based on engine type
                            if (engineType === DBType.ORACLE) {
                                dispatch(setRefreshOracleWellArchitect(true));
                            } else {
                                dispatch(setGwRefreshPage(true));
                            }
                        }

                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                        updateProgressResourceForBulk(
                            dispatch,
                            type,
                            jobId,
                            inProgressOptimizationData,
                            jobToInstanceMapForBulk,
                            inProgressHostData,
                            inProgressResourceOptimizeData
                        );

                        setTimeout(() => {
                            // Refresh assessment data from store after optimization completes
                            const refreshedData = store.getState().getWellOptimize.driftAssessmentData;
                            if (refreshedData) {
                                formatGetWellDataFlat(dispatch, refreshedData as any, false, false, false, i18next.t);
                            }
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: failedMsgData
                                })
                            );
                        }, 0);

                        // Clear optimizingData for Clone Management
                        const currentOptimizingDataFailed = store.getState().getWellOptimize.optimizingData || {};
                        if (type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
                            dispatch(
                                setOptimizingData({
                                    ...currentOptimizingDataFailed,
                                    [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: ''
                                })
                            );

                            // Clear cardData status to prevent stuck "Optimizing" display after failure
                            const currentCardData = store.getState().getWellOptimize.cardData;
                            if (currentCardData && currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]) {
                                dispatch(
                                    setCardData({
                                        ...currentCardData,
                                        [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: {
                                            ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT],
                                            block_two: {
                                                ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT].block_two,
                                                value: ''
                                            }
                                        }
                                    })
                                );
                            }

                            // Trigger assessment refresh based on engine type
                            if (engineType === DBType.ORACLE) {
                                dispatch(setRefreshOracleWellArchitect(true));
                            } else {
                                dispatch(setGwRefreshPage(true));
                            }
                        }

                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                    }
                });
            }, OPTIMIZE_POLLING_INTERVAL);
        } else {
            const { inProgressOptimizationData, inProgressHostData, inProgressResourceOptimizeData } =
                state.getWellOptimize;
            if (bulkRowData?.[0]?.id) {
                dispatch(
                    setOptimizingData({
                        ...optimizingData,
                        [bulkRowData?.[0]?.id]: ''
                    })
                );
            }

            dispatch(
                setInProgressResourceOptimizeData({
                    ...inProgressResourceOptimizeData,
                    [type]: inProgressResourceOptimizeData?.[type]?.filter((instanceId: any) => {
                        const jobResource =
                            bulkRowData?.flatMap(
                                (instance: any) =>
                                    instance?.clones?.map(
                                        (clone: any) =>
                                            `${instance?.hostId}_${instance?.instanceId}_${clone?.cloneDatabaseName}`
                                    ) || []
                            ) || [];
                        return !jobResource.includes(instanceId);
                    })
                })
            );

            dispatch(
                setInProgressOptimizationData({
                    ...inProgressOptimizationData,
                    [type]: inProgressOptimizationData?.[type]?.filter((instanceId: any) => {
                        const jobInstances =
                            bulkRowData?.map((instance: any) => `${instance?.hostId}_${instance?.instanceId}`) || [];
                        return !jobInstances.includes(instanceId);
                    })
                })
            );
            dispatch(
                setInProgressHostData({
                    ...inProgressHostData,
                    [type]: inProgressHostData?.[type]?.filter(
                        // Data host id to check
                        (hostId: any) => {
                            const jobHostIds = bulkRowData?.map((host: any) => host?.hostId) || [];
                            return !jobHostIds.includes(hostId);
                        }
                    )
                })
            );

            dispatch(setOptimizingInstanceData(false));
        }
    }, 10);
};

export const handleOptimizeStorageJob = (
    res: any,
    rowData: any,
    failedMsgData: any,
    getJobDetailApi: any,
    dispatch: any,
    type?: any,
    operation?: string,
    bulkRowData?: any,
    isOptimizeInnerPage?: boolean,
    engineType?: string
) => {
    const state = store.getState();
    const optimizingData = state.getWellOptimize.optimizingData || {};

    setTimeout(() => {
        if (res?.data) {
            // Navigate back to well arch page immediately when called from inner page
            if (isOptimizeInnerPage) {
                dispatch(setIsInnerPageOptimize(true));
            }

            const jobInterval = setInterval(() => {
                getJobDetailApi({
                    id: res?.data?.jobId
                }).then((jobRes: any) => {
                    const status = jobRes?.data?.status;
                    const jobId = jobRes?.data?.id;
                    const subjobs = jobRes?.data?.subJobs;
                    if (status === JOB_MONITORING_STATUS.COMPLETED) {
                        updateAssessmentWithCompletedJobs(
                            dispatch,
                            operation,
                            type,
                            jobId,
                            rowData,
                            bulkRowData,
                            engineType,
                            isOptimizeInnerPage
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                        // Trigger assessment refresh when job completes
                        if (isOptimizeInnerPage) {
                            if (engineType === DBType.ORACLE) {
                                dispatch(setRefreshOracleWellArchitect(true));
                            } else {
                                dispatch(setGwRefreshPage(true));
                            }
                        }
                    } else if (status === JOB_MONITORING_STATUS.WARNING) {
                        updateAssessmentWithWarningJobs(
                            dispatch,
                            operation,
                            type,
                            jobId,
                            rowData,
                            bulkRowData,
                            subjobs,
                            engineType,
                            isOptimizeInnerPage
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                        // Trigger assessment refresh when job completes with warnings
                        if (isOptimizeInnerPage) {
                            if (engineType === DBType.ORACLE) {
                                dispatch(setRefreshOracleWellArchitect(true));
                            } else {
                                dispatch(setGwRefreshPage(true));
                            }
                        }
                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                        updateAssessmentWithFailedJobs(
                            dispatch,
                            operation,
                            type,
                            jobId,
                            rowData,
                            bulkRowData,
                            failedMsgData,
                            engineType,
                            isOptimizeInnerPage
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                    }
                });
            }, OPTIMIZE_POLLING_INTERVAL);
        } else {
            const { inProgressOptimizationData, inProgressHostData } = state.getWellOptimize;
            if (operation === 'bulk') {
                if (bulkRowData?.[0]?.id) {
                    dispatch(
                        setOptimizingData({
                            ...optimizingData,
                            [bulkRowData?.[0]?.id]: ''
                        })
                    );
                }

                dispatch(
                    setInProgressOptimizationData({
                        ...inProgressOptimizationData,
                        [type]: inProgressOptimizationData?.[type]?.filter((instanceId: any) => {
                            const jobInstances =
                                bulkRowData?.map((instance: any) => `${instance?.hostId}_${instance?.instanceId}`) ||
                                [];
                            return !jobInstances.includes(instanceId);
                        })
                    })
                );
                dispatch(
                    setInProgressHostData({
                        ...inProgressHostData,
                        [type]: inProgressHostData?.[type]?.filter(
                            // Data host id to check
                            (hostId: any) => {
                                const jobHostIds = bulkRowData?.map((host: any) => host?.hostId) || [];
                                return !jobHostIds.includes(hostId);
                            }
                        )
                    })
                );

                dispatch(setOptimizingInstanceData(false));
            } else {
                const selectedDatabaseInstance = state.getWellOptimize.selectedDatabaseInstance || '';
                const selectedResourceId = state.getWellOptimize.selectedResourceId || '';
                dispatch(
                    setOptimizingData({
                        ...optimizingData,
                        [rowData?.id]: ''
                    })
                );
                dispatch(
                    setInProgressOptimizationData({
                        ...inProgressOptimizationData,
                        [type]: inProgressOptimizationData?.[type]?.filter(
                            (instanceId: any) => instanceId !== `${selectedResourceId}_${selectedDatabaseInstance}`
                        )
                    })
                );
                dispatch(
                    setInProgressHostData({
                        ...inProgressHostData,
                        [type]: inProgressHostData?.[type]?.filter((hostId: any) => hostId !== selectedResourceId)
                    })
                );
                dispatch(setOptimizingInstanceData(false));
                // Error message for failed optimization API will be returned here
            }
        }
    }, 10);
};

/**
 * Clone management only becomes "optimized" once every clone object flagged in violation for
 * that instance has been resolved; a single fixed database doesn't mean the instance is clean.
 */
const isCloneManagementRow = (rowData: any): boolean =>
    rowData?.id === ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT || rowData?.id === 'clone';

const resolveCloneManagementStatus = (rowData: any): string => {
    const { cloneDashboardData } = store.getState().getWellOptimize;
    const hasUnresolvedViolation = cloneDashboardData?.objectsInViolation?.some(
        (row: any) =>
            row?.resourceId === rowData?.hostId && row?.instanceId === rowData?.instanceId && !row?.isOptimized
    );
    return hasUnresolvedViolation ? WELL_ARCHITECTED_STATUS.NOT_OPTIMIZED : WELL_ARCHITECTED_STATUS.OPTIMIZED;
};

/**
 * Patches the flat `assessments[]` array (account-level API format) used by both the Dashboard
 * and the GetWell tab after a fix completes, so both views stay in sync.
 */
export const updateFlatAssessmentStatus = (rowData: any, dispatch: any, engineType?: string) => {
    const state = store.getState();
    const assessmentData =
        engineType === DBType.ORACLE
            ? state.inventoryV2.allOracleHostAssessmentData
            : state.inventoryV2.allmssqlHostAssessmentData;

    const isClone = isCloneManagementRow(rowData);
    const newStatus = isClone ? resolveCloneManagementStatus(rowData) : WELL_ARCHITECTED_STATUS.OPTIMIZED;
    // CloneTabs builds its rows with id: 'clone' (the API payload's configurationName), not the
    // 'clone-management' id used in the flat assessments[] array, so match on the canonical id instead.
    const matchId = isClone ? ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT : rowData?.id;

    const updatedData = assessmentData?.map((hostData: any) => {
        if (
            hostData?.databaseHostId !== rowData?.hostId ||
            hostData?.credentialId !== rowData?.credentialId ||
            hostData?.regionId !== rowData?.regionId
        ) {
            return hostData;
        }
        const updatedInstances = hostData?.instancesAssessment?.map((instance: any) => {
            if (instance?.databaseInstanceId !== rowData?.instanceId) return instance;
            const flatAssessments: any[] | undefined = instance?.assessments?.assessments;
            if (!Array.isArray(flatAssessments)) return instance;
            return {
                ...instance,
                assessments: {
                    ...instance.assessments,
                    assessments: flatAssessments.map((item: any) =>
                        item?.id === matchId ? { ...item, status: newStatus } : item
                    )
                }
            };
        });
        return { ...hostData, instancesAssessment: updatedInstances };
    });

    if (engineType === DBType.ORACLE) {
        dispatch(addAllOracleHostAssessmentData(updatedData));
    } else {
        dispatch(addAllMssqlHostAssessmentData(updatedData));
    }
};

export const updateConfigStateStatus = (rowList: any, dispatch: any, action: any, engineType?: string) => {
    let setAction = '';
    if (action === CONFIG_STATE_ACTIONS.DISMISS) {
        setAction = CONFIG_STATES.DISMISSED;
    } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
        setAction = CONFIG_STATES.POSTPONED;
    } else if (action === CONFIG_STATE_ACTIONS.ACTIVE || action === CONFIG_STATES.ACTIVATING) {
        setAction = CONFIG_STATES.ACTIVATING;
    }

    const state = store.getState();
    const isOracle = engineType === DBType.ORACLE;
    const assessmentSource = isOracle
        ? state.inventoryV2.allOracleHostAssessmentData
        : state.inventoryV2.allmssqlHostAssessmentData;
    let updatedAsessmentData = [...assessmentSource];

    rowList?.forEach((rowData: any) => {
        updatedAsessmentData = updatedAsessmentData?.map((hostData: any) => {
            if (
                hostData?.databaseHostId === rowData?.hostId &&
                hostData?.credentialId === rowData?.credentialId &&
                hostData?.regionId === rowData?.regionId
            ) {
                const updatedInstancesAssessment = hostData?.instancesAssessment?.map((instance: any) => {
                    if (instance?.databaseInstanceId === rowData?.instanceId) {
                        // Step 1: Get the config id from the row being acted on
                        const configId = rowData?.id as string | undefined;

                        // Guard: skip the upsert when no id is supplied to avoid inserting
                        // an undefined-keyed entry that would corrupt future lookups.
                        if (!configId) return instance;

                        type DismissedEntry = {
                            id: string;
                            configState: string;
                            startTime?: number;
                            endTime?: number;
                        };

                        // Step 2: Get the current flat dismissed array (or empty array if none yet)
                        const existingDismissed: DismissedEntry[] = instance.assessments?.dismissedConfigurations ?? [];

                        // Step 3: Check if this config already has an entry in the array
                        const existingEntryIndex = existingDismissed.findIndex(
                            dismissedItem => dismissedItem.id === configId
                        );

                        // Step 4: Build the new/updated entry.
                        // Timestamps are only spread when the caller provides them so that
                        // merging with an existing entry never overwrites a stored endTime /
                        // startTime with undefined — which would break postpone-expiry and
                        // activation-timing UI that depends on these values.
                        const updatedEntry: DismissedEntry = {
                            id: configId,
                            configState: setAction, // e.g. DISMISSED / POSTPONED / ACTIVE
                            ...(rowData?.startTime !== undefined && { startTime: rowData.startTime }),
                            ...(rowData?.endTime !== undefined && { endTime: rowData.endTime })
                        };

                        // Step 5: Upsert — update in place if found, otherwise append
                        const updatedDismissed =
                            existingEntryIndex >= 0
                                ? existingDismissed.map((dismissedItem, index) =>
                                      index === existingEntryIndex
                                          ? { ...dismissedItem, ...updatedEntry } // update existing entry
                                          : dismissedItem
                                  )
                                : [...existingDismissed, updatedEntry]; // insert new entry

                        // Step 6: Return the updated instance with the new flat dismissed array
                        return {
                            ...instance,
                            assessments: {
                                ...instance.assessments,
                                dismissedConfigurations: updatedDismissed
                            }
                        };
                    }
                    return instance;
                });
                return { ...hostData, instancesAssessment: updatedInstancesAssessment };
            }
            return hostData;
        });
    });
    if (engineType === DBType.ORACLE) {
        dispatch(addAllOracleHostAssessmentData(updatedAsessmentData));
    } else {
        dispatch(addAllMssqlHostAssessmentData(updatedAsessmentData));
    }
};

export const updateAccountLevelAssessmentData = (
    dispatch: any,
    freshAssessmentData: any,
    identifiers: {
        databaseHostId: string;
        databaseInstanceId: string;
        credentialId: string;
        regionId: string;
    },
    engineType?: string
) => {
    const state = store.getState();
    const isOracle = engineType === DBType.ORACLE;
    const assessmentData = isOracle
        ? state.inventoryV2.allOracleHostAssessmentData
        : state.inventoryV2.allmssqlHostAssessmentData;

    if (!assessmentData?.length) return;

    const updatedData = assessmentData.map((hostData: any) => {
        if (
            hostData?.databaseHostId === identifiers.databaseHostId &&
            hostData?.credentialId === identifiers.credentialId &&
            hostData?.regionId === identifiers.regionId
        ) {
            const updatedInstances = hostData?.instancesAssessment?.map((instance: any) => {
                if (instance?.databaseInstanceId === identifiers.databaseInstanceId) {
                    return {
                        ...instance,
                        assessments: freshAssessmentData
                    };
                }
                return instance;
            });
            return { ...hostData, instancesAssessment: updatedInstances };
        }
        return hostData;
    });

    if (isOracle) {
        dispatch(addAllOracleHostAssessmentData(updatedData));
    } else {
        dispatch(addAllMssqlHostAssessmentData(updatedData));
    }
};

export const updateConfigStatePerInstance = (setAction: any, configId: string, endTime: any, startTime: any) => {
    const state = store.getState();
    const { driftAssessmentData } = state.getWellOptimize;

    // dismissedConfigurations is a flat array at root level
    const existingDismissed: any[] = (driftAssessmentData?.dismissedConfigurations as any[]) || [];

    // Find if this config already exists in dismissedConfigurations
    const existingIndex = existingDismissed.findIndex((item: any) => item?.id === configId);

    let updatedDismissedConfigs;
    if (existingIndex !== -1) {
        // Update existing entry
        updatedDismissedConfigs = existingDismissed.map((item: any, index: number) =>
            index === existingIndex
                ? {
                      ...item,
                      configState: setAction,
                      endTime,
                      startTime
                  }
                : item
        );
    } else {
        // Add new entry with id
        updatedDismissedConfigs = [
            ...existingDismissed,
            {
                id: configId,
                configState: setAction,
                endTime,
                startTime
            }
        ];
    }

    return {
        ...driftAssessmentData,
        dismissedConfigurations: updatedDismissedConfigs
    };
};
export const checkIfDisableForOptimize = (
    inProgressHostData: any,
    name: string,
    rowData: any,
    translation: TFunction,
    selectedRowsForOptimize?: any,
    dbType?: string
) => {
    name = resolveConfigDisplayName(name);
    let isDisabled = false;
    let errorMessage = '';
    if (inProgressHostData?.[name]?.includes(rowData?.databaseHostId)) {
        isDisabled = true;
        errorMessage = translation('databases.well-architect.optimization-in-progress-for-host');
    } else if (rowData?.status?.toLowerCase() !== STATUS_CONST.UP.toLowerCase()) {
        isDisabled = true;
        // Use specific WAD message if this is a WAD (offline assessment) row
        if (rowData?.isWad) {
            errorMessage =
                dbType === DBType.ORACLE
                    ? translation('databases.wad.tab-disabled-message-oracle')
                    : translation('databases.wad.tab-disabled-message');
        } else {
            errorMessage = translation('databases.well-architect.only-online-resource-fix');
        }
    } else if (rowData?.configState && rowData?.configState === CONFIG_STATES.ACTIVATING) {
        isDisabled = true;
        errorMessage = '';
    } else if (
        !rowData?.assessmentStatus ||
        rowData?.assessmentStatus?.toLowerCase() === FINDINGS.NOT_APPLICABLE.toLowerCase()
    ) {
        isDisabled = true;
        errorMessage = `${name} ${translation('databases.well-architect.assessment-not-available')}`;
    } else if (
        name === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE &&
        (rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
            (rowData?.sizingViolations?.overProvisionedDrives?.length &&
                !rowData?.sizingViolations?.underProvisionedDrives?.length))
    ) {
        isDisabled = true;
        errorMessage = translation('databases.well-architect.log-drive-over-provisioned-error');
    } else if (
        name === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE &&
        (rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
            (rowData?.sizingViolations?.overProvisionedDrives?.length &&
                !rowData?.sizingViolations?.underProvisionedDrives?.length))
    ) {
        isDisabled = true;
        errorMessage = translation('databases.well-architect.tempdb-drive-over-provisioned-error');
    } else if (
        (name === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            name === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE ||
            name === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) &&
        rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.NOT_OPTIMIZED.toLowerCase() &&
        !rowData?.sizingViolations?.underProvisionedDrives?.length &&
        rowData?.sizingViolations?.ignoredDrives?.length
    ) {
        isDisabled = true;
        errorMessage = translation('databases.well-architect.not-optimized-shared-drive');
    } else if (selectedRowsForOptimize && selectedRowsForOptimize.length > 0) {
        isDisabled = true;
        errorMessage = '';
    }

    return { isDisabled, errorMessage };
};

export const checkIfDisableFullRow = (inProgressHostData: any, name: string, rowData: any, translation: TFunction) => {
    let isDisabled = false;
    let errorMessage = '';
    if (inProgressHostData?.[name]?.includes(rowData?.databaseHostId)) {
        isDisabled = true;
        errorMessage = translation('databases.well-architect.optimization-in-progress-for-host');
    }
    return { isDisabled, errorMessage };
};

export const checkIfDisableForDismiss = (rowData: any, selectedRowsForDismiss?: any) => {
    let isDisabled = false;
    let errorMessage = '';
    if (selectedRowsForDismiss && selectedRowsForDismiss.length > 0) {
        isDisabled = true;
        errorMessage = '';
    }

    return { isDisabled, errorMessage };
};

export const disableOptimizeCheckBoxForErrCase = (tableData: any, type: string, translation: TFunction) => {
    const state = store.getState();
    const { inProgressHostData, configEngineType } = state.getWellOptimize;

    // If no rows are selected, reset `isDisabled` for all rows
    return tableData.map((row: any) => {
        let { isDisabled, errorMessage } = checkIfDisableFullRow(inProgressHostData, type, row, translation);

        // Disable checkbox for WAD (offline assessment) rows
        if (!isDisabled && row?.isWad) {
            isDisabled = true;
            errorMessage =
                configEngineType === DBType.ORACLE
                    ? translation('databases.wad.tab-disabled-message-oracle')
                    : translation('databases.wad.tab-disabled-message');
        }

        return {
            ...row,
            cellProps: {
                ...row.cellProps,
                isDisabled,
                selectionProps: {
                    title: errorMessage,
                    titleProps: {
                        placement: 'bottom'
                    }
                }
            }
        };
    });
};

export const disableDismissCheckBoxForErrCase = (tableData: any, type: string) =>
    // If no rows are selected, reset `isDisabled` for all rows
    tableData.map((row: any) => {
        const { isDisabled, errorMessage } = checkIfDisableForDismiss(row);
        return {
            ...row,
            cellProps: {
                ...row.cellProps,
                isDisabled: row?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP || isDisabled,
                selectionProps: {
                    title: errorMessage,
                    titleProps: {
                        placement: 'bottom'
                    }
                }
            }
        };
    });

// This function is used to disable the checkboxes for the selected rows in the optimize resource page table
export const disableOptimizeResourceCheckBoxForOptimizeCase = (
    tableData: any,
    type: string,
    selectedRowsForOptimize: any
) => {
    const state = store.getState();
    const { inProgressResourceOptimizeData } = state.getWellOptimize;

    // Extract IDs of rows currently selected for optimization
    const selectedDatabaseRows = selectedRowsForOptimize.map((row: any) => row.id);

    return tableData?.map((row: any) => {
        // Check if the current row is being optimized
        const isBeingOptimized =
            selectedDatabaseRows.includes(row.id) && inProgressResourceOptimizeData?.[type]?.includes(row.id);

        // Combine both conditions
        const isDisabled = isBeingOptimized;
        const errorMessage = '';

        return {
            ...row,
            cellProps: {
                ...row.cellProps,
                isDisabled,
                selectionProps: {
                    title: errorMessage,
                    titleProps: {
                        placement: 'bottom'
                    }
                }
            }
        };
    });
};

export const disableOptimizeCheckBoxForOptimizeCase = (
    tableData: any,
    type: string,
    selectedRowsForOptimize: any,
    translation: TFunction
) => {
    const state = store.getState();
    const { inProgressHostData, inProgressOptimizationData, configEngineType } = state.getWellOptimize;

    // Extract IDs of rows currently selected for optimization
    const selectedInstanceIds = selectedRowsForOptimize.map((row: any) => row.id);

    return tableData.map((row: any) => {
        // Check if the current row is being optimized
        const isBeingOptimized =
            selectedInstanceIds.includes(row.id) && inProgressOptimizationData?.[type]?.includes(row.id);

        const hasStatusOffline = row?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP;

        // Combine both conditions
        let isDisabled = isBeingOptimized;
        let errorMessage = '';
        if (!isDisabled) {
            ({ isDisabled, errorMessage } = checkIfDisableFullRow(inProgressHostData, type, row, translation));
        }

        // Disable checkbox for WAD (offline assessment) rows
        if (!isDisabled && row?.isWad) {
            isDisabled = true;
            errorMessage =
                configEngineType === DBType.ORACLE
                    ? translation('databases.wad.tab-disabled-message-oracle')
                    : translation('databases.wad.tab-disabled-message');
        }

        return {
            ...row,
            cellProps: {
                ...row.cellProps,
                isDisabled,
                selectionProps: {
                    title: errorMessage,
                    titleProps: {
                        placement: 'bottom'
                    }
                }
            }
        };
    });
};

// @TODO: check this is used in clone tabs so see it can also be removed
export const nameToIdConfigMapping = (name: string) =>
    name === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE
        ? 'log-drive-size'
        : name === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM
        ? 'headroom'
        : name === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
        ? 'tempdb-drive-size'
        : name === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER
        ? 'performance-tier'
        : name === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING
        ? 'compute-rightsizing'
        : name === ASSESSMENT_CONFIG_NAMES.MTU
        ? 'mtu-alignment'
        : name === ASSESSMENT_CONFIG_NAMES.MAXDOP
        ? 'max-dop'
        : name === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
        ? 'clone'
        : name === ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION
        ? 'rss-config'
        : name === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT
        ? 'data-dg-lun-layout'
        : name === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT
        ? 'redolog-dg-lun-layout'
        : name === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT
        ? 'fra-dg-lun-layout'
        : name === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT
        ? 'archivelog-dg-lun-layout'
        : name === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES
        ? 'transparent-hugepages'
        : name === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS
        ? 'tcp-advanced-options'
        : name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT
        ? 'multiblock-readcount'
        : '';

export const setOptimizeInnerpageSummary = (type: string, configData: any, dispatch: any, dbType?: string) => {
    if (!hasConfigStats(configData, type, dbType)) {
        return;
    }

    const configKey = type;
    const configStats = getConfigStatsBucket(configData, configKey, dbType);
    const optimizedInstances = configStats?.optimized ?? 0;
    const dismissedInstances = configStats?.dismissed ?? 0;
    const activatingInstances = configStats?.activating ?? 0;
    const partialDismissInstances = configStats?.partiallyDismissed ?? 0;
    const configStateList = getConfigStateList(configData, configKey, dbType);
    let configStateValue = '';
    if (!configStateList || configStateList.includes(CONFIG_STATES.ACTIVE)) {
        configStateValue = CONFIG_STATES_UI.ACTIVE;
    } else if (configStateList.includes(CONFIG_STATES.POSTPONED)) {
        configStateValue = CONFIG_STATES_UI.POSTPONED;
    } else if (configStateList.includes(CONFIG_STATES.DISMISSED)) {
        configStateValue = CONFIG_STATES_UI.DISMISSED;
    }

    let tooltipText = '';
    if (
        configStateList?.includes(CONFIG_STATES.ACTIVE) &&
        (configStateList.includes(CONFIG_STATES.POSTPONED) || configStateList.includes(CONFIG_STATES.DISMISSED))
    ) {
        tooltipText = GENERAL.DISMISS_MIX_CASE_TOOLTIP;
    }

    const totalInstances = configStats?.total || 0;
    dispatch(
        setSelectedConfigSummary({
            totalInstances,
            optimizedInstances,
            dismissedInstances,
            activatingInstances,
            partialDismissInstances,
            notOptimizedInstances: totalInstances - (optimizedInstances + dismissedInstances + activatingInstances),
            optimizationScore: `${Math.round((optimizedInstances / (totalInstances || 1)) * 100)}%`,
            severity: getConfigSeverity(configData, configKey, dbType),
            configState: configStateValue,
            tooltipText
        })
    );
};

/**
 * Dynamically generates Oracle storage mock data based on dismissed configurations in the assessment response.
 * This is used for Oracle databases where the configuration can vary based on protocol (NFS, ASM, iSCSI)
 * and deployment type. Instead of using hardcoded mock data like in MSSQL, this function constructs
 * the storage structure based on what configurations were actually dismissed.
 */
export const instanceBreadCrumbSelectedFrom = (breadCrumbSelectedFrom: string) => {
    let tab: string = '';
    if (breadCrumbSelectedFrom === WLF_TABS.INVENTORY) {
        tab = 'Inventory';
    } else if (breadCrumbSelectedFrom === WLF_TABS.WELL_ARCHITECTED_TAB) {
        tab = 'Well-architected';
    } else {
        tab = 'Dashboard';
    }
    return tab;
};

export const selectHeaderTabFromBreadCrumb = (breadCrumbSelectedFrom: string, dispatch: any) => {
    if (breadCrumbSelectedFrom === WLF_TABS.INVENTORY) {
        dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
    } else if (breadCrumbSelectedFrom === WLF_TABS.WELL_ARCHITECTED_TAB) {
        dispatch(setSelectedHeaderTab(WLF_TABS.WELL_ARCHITECTED_TAB));
    } else {
        dashboardRedirection('dashboard');
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
    }
};

/**
 * Creates cellProps for table rows with WAD (offline assessment) support.
 * When isWad is true, returns disabled props with WAD tooltip message.
 * When isWad is false, returns the provided fallback props.
 *
 * @param isWad - Whether the instance is a WAD (offline assessment) instance
 * @param t - The translation function from useTranslation hook
 * @param fallbackCellProps - The cellProps to use when not in WAD mode (optional, defaults to undefined)
 * @returns Cell props object for table row selection handling
 *
 * @example
 * // Pattern 1: With undefined fallback
 * cellProps: getWadCellProps(isWad, t)
 *
 * @example
 * // Pattern 2: With row.cellProps spread and isDisabled: true
 * cellProps: getWadCellProps(isWad, t, { ...row.cellProps, isDisabled: true })
 *
 * @example
 * // Pattern 3: With row.cellProps spread and isDisabled: false
 * cellProps: getWadCellProps(isWad, t, { ...row.cellProps, isDisabled: false })
 */
export const getWadCellProps = (
    isWad: boolean,
    t: TFunction,
    fallbackCellProps?: Record<string, unknown>
): Record<string, unknown> | undefined =>
    // It is added in multiple files so commenting out for now. Will remove when we will create single file for Inner tables.
    // if (isWad) {
    //     return {
    //         isDisabled: true,
    //         selectionProps: {
    //             title: t('databases.wad.tab-disabled-message')
    //         }
    //     };
    // }
    fallbackCellProps;

/**
 * Helper function to get block_one.type based on configurationId and category
 * For flat structure, we use top-level categories only (Storage, Compute, Application, Resiliency, Cloning)
 */
const getBlockOneType = (configId: string, category: string): string =>
    // Map category to display name using constants
    WELL_ARCHITECTED_CATEGORY_LABELS[category as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS] ||
    (category ? category.charAt(0).toUpperCase() + category.slice(1) : '');

/**
 * Determines the display type for block_six based on configuration and category for MSSQL
 * @returns 'count' | 'value' | 'patch' | 'smallfont'
 * - 'count': Shows "X out of Y" format with large numbers (for storage tier, drive sizing)
 * - 'value': Shows the actual value in large font (percentages, GB, etc.)
 * - 'patch': Shows value with tooltip (Missing patches) - no count, no smallFont, HAS patch object
 * - 'smallfont': Shows value in small font (Semibold_14) for resiliency, network, placement, etc.
 */
const getMssqlBlockSixDisplayType = (configId: string, category: string): 'count' | 'value' | 'patch' | 'smallfont' => {
    // Storage sizing configs that show percentage or GB values in large font
    if (isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM)) {
        return 'value';
    }

    // Storage tier and drive sizing configs show large count (NO smallFont)
    if (isConfigIdInList(configId, MSSQL_STORAGE_COUNT_CONFIG_IDS)) {
        return 'count';
    }

    // Patch configs show value with tooltip (no count, no smallFont, needs patch objects)
    if (
        isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH) ||
        isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH) ||
        isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.COMPUTE_RIGHTSIZING)
    ) {
        return 'patch';
    }

    // MaxDOP shows current value in large font (e.g., "4")
    if (isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.MAXDOP)) {
        return 'value';
    }

    // All other configs use large count format (default for MSSQL)
    // This includes: thin provisioning, autosize, snapshot reserve, space management, placement, network, resiliency, license, HA, clone, etc.
    return 'count';
};

/**
 * Format flat assessment response into cardData structure
 * This replaces getCardsData() for the new flat API response
 */
export const formatFlatAssessments = (
    data: import('../../utils/types/getWellTypes').FlatAssessmentResponse,
    optimizingData: any,
    showDismissedView: boolean = false,
    t: TFunction
): { cardsData: any } => {
    const cardsData: any = {
        deploymentType: data.metadata.deploymentType || '',
        baseDeploymentType: data.metadata.baseDeploymentType || '',
        isWad: data.metadata.isWad || false
    };

    // Always process assessments array, not dismissedConfigurations
    // dismissedConfigurations is used to add dismiss state to cards, not as the source of cards
    const allConfigs = data.assessments || [];

    allConfigs.forEach(assessment => {
        // Use id as the key (e.g., storage_tier, compute_rightsizing)
        const configKey = assessment.id;
        if (!configKey) {
            return;
        }

        // Get display name from name
        const displayName = assessment.name || '';

        // Map status using GETWELL_VALUES to handle all supported statuses consistently
        const status = (assessment.status && GETWELL_VALUES[assessment.status]) || t('databases.general.unavailable');

        // Capitalize severity to match constants
        const severity = assessment.severity
            ? assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)
            : '';

        // Get category from type
        const category = assessment.type || '';

        // Get the correct block_one type based on configuration
        const blockOneType = getBlockOneType(configKey, category);

        // Determine block_six display type and formatting
        const displayType = getMssqlBlockSixDisplayType(configKey, category);
        let blockSixValue = '';
        let blockSixCount;
        let blockSixSmallFont = false;

        if (displayType === 'count') {
            // Show "X out of Y" format with count object (triggers large number display)
            const violation = assessment.totalObjectsInViolation ?? 0;
            const assessed = assessment.totalObjectsAssessed ?? 0;
            blockSixValue = `${violation} out of ${assessed}`;
            blockSixCount = { totalObjectsInViolation: violation, totalObjectsAssessed: assessed };
        } else if (displayType === 'value') {
            // Show percentage or GB value in large font (no count object, no smallFont)
            blockSixValue = assessment.current ?? '';
        } else if (displayType === 'patch') {
            // Show patch count - no count object, no smallFont (renders as Semibold_14 with tooltip)
            blockSixValue = String(assessment.totalObjectsInViolation ?? 0);
        } else if (displayType === 'smallfont') {
            // Show value in small font for resiliency, network, placement, etc.
            const violation = assessment.totalObjectsInViolation ?? 0;
            const assessed = assessment.totalObjectsAssessed ?? 0;
            blockSixValue = `${violation} out of ${assessed}`;
            blockSixSmallFont = true;
        }

        // Handle special patch objects for tooltip display (MSSQL)
        let osPatchMissingPatches;
        let sqlPatchMissingPatches;
        let computeRightsizingViolations;

        if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH)) {
            if (assessment.ec2InstancesToPatch) {
                // Calculate total violations by summing up all instances
                let criticalViolations = 0;
                let securityViolations = 0;
                let otherViolations = 0;

                assessment.ec2InstancesToPatch.forEach((instance: any) => {
                    criticalViolations += instance?.criticalNonCompliantCount || 0;
                    securityViolations += instance?.securityNonCompliantCount || 0;
                    otherViolations += instance?.otherNonCompliantCount || 0;
                });

                osPatchMissingPatches = {
                    critical: criticalViolations,
                    security: securityViolations,
                    other: otherViolations
                };

                // Update blockSixValue to show total patch count, not EC2 instance count
                const totalPatches = criticalViolations + securityViolations + otherViolations;
                blockSixValue = String(totalPatches);
            }
        } else if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH)) {
            if (assessment.missingPatchesInEc2Instances) {
                // Calculate total violations by summing up all instances (like OS patch)
                let criticalViolations = 0;
                let importantViolations = 0;

                assessment.missingPatchesInEc2Instances.forEach((instance: any) => {
                    criticalViolations += instance.criticalMissingPatchesCount || 0;
                    importantViolations += instance.importantMissingPatchesCount || 0;
                });

                const totalPatchCount = criticalViolations + importantViolations;
                blockSixValue = String(totalPatchCount);

                sqlPatchMissingPatches = {
                    critical: criticalViolations,
                    important: importantViolations,
                    total: totalPatchCount
                };
            }
        } else if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.COMPUTE_RIGHTSIZING)) {
            // For compute rightsizing, store violations array (like osPatchMissingPatches pattern)
            // Only set violations if there's no error message (no permission issues)
            if (
                assessment.objectsInViolation &&
                Array.isArray(assessment.objectsInViolation) &&
                !assessment.errorMessage
            ) {
                computeRightsizingViolations = assessment.objectsInViolation;
                blockSixValue = String(assessment.objectsInViolation.length);
            }
        }

        // Check if compute rightsizing has missing permissions
        const isMissingPermissions =
            isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.COMPUTE_RIGHTSIZING) &&
            assessment.errorMessage &&
            (assessment.errorMessage.includes('not authorized') ||
                assessment.errorMessage.includes('not enabled for the account'));

        // Get correct block_six.type label based on config
        let blockSixType = '';
        if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH)) {
            blockSixType = BLOCK_SIX_LABELS.MISSING_PATCHES;
        } else if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH)) {
            blockSixType = BLOCK_SIX_LABELS.MISSING_PATCHES;
        } else if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.COMPUTE_RIGHTSIZING)) {
            blockSixType = BLOCK_SIX_LABELS.FINDING_REASONS;
        } else if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM)) {
            blockSixType = BLOCK_SIX_LABELS.FILE_SYSTEM_HEADROOM;
        } else if (isConfigIdMatch(configKey, ASSESSMENT_CONFIG_IDS.MAXDOP)) {
            blockSixType = BLOCK_SIX_LABELS.MAXDOP;
        } else if (assessment.resourceType) {
            blockSixType = `${assessment.resourceType}s`;
        } else {
            blockSixType = BLOCK_SIX_LABELS.IMPACTED_RESOURCES;
        }

        // Create card structure matching existing format
        cardsData[configKey] = {
            id: configKey,
            configurationId: configKey, // Store the config id for dismiss flow
            name: displayName, // Display name from flat API
            category,
            block_one: {
                value: displayName,
                type: blockOneType
            },
            block_two: {
                type: 'Status',
                value: assessment.errorMessage ? t('databases.general.unavailable') : status
            },
            block_three: {
                type: 'Current',
                value: assessment.current ?? t('databases.general.unavailable')
            },
            block_four: {
                type: 'Severity',
                value: severity
            },
            block_five: {
                type: 'Resource type',
                value: assessment.resourceType || ''
            },
            block_six: {
                type: blockSixType,
                value: blockSixValue,
                count: blockSixCount,
                smallFont: blockSixSmallFont
            },
            recommendation: (() => {
                // Use static recommendations from UI files instead of API response
                // API team cannot provide all recommendation details
                const staticRecommendation = getRecommendation(configKey, DBType.MSSQL);

                if (staticRecommendation) {
                    return {
                        title: staticRecommendation.title || `${displayName} recommendation`,
                        description: staticRecommendation.description,
                        descriptionList: staticRecommendation.descriptionList,
                        descriptionRssConfig: staticRecommendation.descriptionRssConfig,
                        info: staticRecommendation.info,
                        valuesHeading: staticRecommendation.valuesHeading,
                        values: staticRecommendation.values
                    };
                }

                // Fallback to API response if no static recommendation exists
                return assessment.recommendation
                    ? {
                          title: `${displayName} recommendation`,
                          description: assessment.recommendation
                      }
                    : undefined;
            })(),
            recommendationText: (() => {
                const staticRecommendation = getRecommendation(configKey, DBType.MSSQL);
                return staticRecommendation?.description || assessment.recommendation;
            })(),
            recommendationOptions: assessment.recommendationOptions,
            categories: assessment.categories || [], // Categories from flat API
            tags: assessment.categories || [], // Map categories to tags for rendering
            errorMessage: assessment.errorMessage,
            violationDetails: assessment.violationDetails,
            // Per sub-config recommendations, used to build Current/Recommended columns for nested configs
            configDetails: assessment.configDetails,
            objectsInViolation: assessment.objectsInViolation,
            sizingViolations: (assessment as any).sizingViolations,
            rssAdapters: (assessment as any).rssAdapters,
            recommendedAdapterSettings: (assessment as any).recommendedAdapterSettings,
            tcpOffloadState: (assessment as any).tcpOffloadState,
            recommended: assessment.recommended,
            // Clone management fields
            cloneDetails: (assessment as any).cloneDetails,
            oldCloneDetails: (assessment as any).oldCloneDetails,
            // Preserve optimizing state if present
            status: optimizingData?.[configKey] || '',
            // Add patch objects for tooltip display
            ...(osPatchMissingPatches !== undefined && { osPatchMissingPatches }),
            ...(sqlPatchMissingPatches !== undefined && { sqlPatchMissingPatches }),
            ...(computeRightsizingViolations !== undefined && { computeRightsizingViolations }),
            // Add missing permissions for dialog handling
            missingPermissions: assessment.missingPermissions || [],
            // Add isMissingPermissions flag for compute rightsizing
            ...(isMissingPermissions && { isMissingPermissions: true })
        };

        // Only add dismissedObj if the card is actually dismissed/postponed/activating
        const dismissState = getDismissedState(assessment, data.dismissedConfigurations || []);
        if (dismissState.configState && dismissState.configState !== CONFIG_STATES.ACTIVE) {
            cardsData[configKey].dismissedObj = dismissState;
        }
    });

    // Handle configs that exist in dismissedConfigurations but not in assessments
    // This happens when configs are dismissed from different categories and not re-assessed
    if (data.dismissedConfigurations && Array.isArray(data.dismissedConfigurations)) {
        data.dismissedConfigurations.forEach((dismissedConfig: any) => {
            const configId = dismissedConfig.id;

            // Check if card already exists
            if (!cardsData[configId]) {
                // Create synthetic card from dismissedConfigurations data
                const displayName = dismissedConfig.name || configId;
                const category = dismissedConfig.type || '';
                const severity = dismissedConfig.severity
                    ? dismissedConfig.severity.charAt(0).toUpperCase() + dismissedConfig.severity.slice(1)
                    : '';
                const blockOneType = getBlockOneType(configId, category);

                // Create the card with available data from dismissedConfigurations
                cardsData[configId] = {
                    id: configId,
                    configurationId: configId,
                    name: displayName,
                    category,
                    block_one: {
                        value: displayName,
                        type: blockOneType
                    },
                    block_two: {
                        type: 'Status',
                        value: GETWELL_STATUS.NOT_OPTIMIZED
                    },
                    block_three: {
                        type: 'Current',
                        value: ''
                    },
                    block_four: {
                        type: 'Severity',
                        value: severity
                    },
                    block_five: {
                        type: 'Resource type',
                        value: dismissedConfig.subType || dismissedConfig.type || ''
                    },
                    block_six: {
                        type: BLOCK_SIX_LABELS.IMPACTED_RESOURCES,
                        value: '0 out of 0',
                        count: { totalObjectsInViolation: 0, totalObjectsAssessed: 0 },
                        smallFont: false
                    },
                    recommendation: (() => {
                        const staticRecommendation = getRecommendation(configId, DBType.MSSQL);

                        if (staticRecommendation) {
                            return {
                                title: staticRecommendation.title || `${displayName} recommendation`,
                                description: staticRecommendation.description,
                                descriptionList: staticRecommendation.descriptionList,
                                descriptionRssConfig: staticRecommendation.descriptionRssConfig,
                                info: staticRecommendation.info,
                                valuesHeading: staticRecommendation.valuesHeading,
                                values: staticRecommendation.values
                            };
                        }

                        return dismissedConfig.recommendation
                            ? {
                                  title: `${displayName} recommendation`,
                                  description: dismissedConfig.recommendation
                              }
                            : undefined;
                    })(),
                    recommendationText: (() => {
                        const staticRecommendation = getRecommendation(configId, DBType.MSSQL);
                        return staticRecommendation?.description || dismissedConfig.recommendation;
                    })(),
                    categories: dismissedConfig.categories || [],
                    tags: dismissedConfig.categories || [],
                    objectsInViolation: [],
                    violationDetails: [],
                    status: '',
                    missingPermissions: []
                };

                // Add dismissedObj to the synthetic card
                const configName = displayName || dismissedConfig.configurationName || configId;
                cardsData[configId].dismissedObj = {
                    configState: dismissedConfig.configState,
                    startTime: dismissedConfig.startTime,
                    endTime: dismissedConfig.endTime,
                    configurationName: configName
                };
            } else {
                // Card exists, just ensure dismissedObj is added if not already present
                const dismissState = getDismissedState(dismissedConfig, [dismissedConfig]);
                if (dismissState.configState && dismissState.configState !== CONFIG_STATES.ACTIVE) {
                    cardsData[configId].dismissedObj = dismissState;
                }
            }
        });
    }

    return { cardsData };
};

/**
 * Helper to get dismissed state for a configuration
 */
const getDismissedState = (
    assessment: import('../../utils/types/getWellTypes').FlatAssessmentItem,
    dismissedConfigurations: import('../../utils/types/getWellTypes').FlatAssessmentItem[]
): any => {
    const dismissed = dismissedConfigurations.find(d => d.id === assessment.id);

    if (!dismissed) {
        return { configState: CONFIG_STATES.ACTIVE };
    }

    // Return the dismiss state if found in dismissed array
    // Handle both old format (status) and new format (configState)
    const state = (dismissed as any).configState || (dismissed as any).status;

    // Normalize state to uppercase for comparison with CONFIG_STATES constants
    const normalizedState = state?.toUpperCase();
    const mappedState =
        normalizedState === CONFIG_STATES.DISMISSED
            ? CONFIG_STATES.DISMISSED
            : normalizedState === CONFIG_STATES.POSTPONED
            ? CONFIG_STATES.POSTPONED
            : normalizedState === CONFIG_STATES.ACTIVATING
            ? CONFIG_STATES.ACTIVATING
            : CONFIG_STATES.ACTIVE;

    return {
        configState: mappedState,
        startTime: (dismissed as any).startTime,
        endTime: (dismissed as any).endTime,
        configurationName: assessment.name
    };
};

/**
 * Format and dispatch flat API assessment data to Redux store
 * All APIs now return flat structure with assessments array
 */
export const formatGetWellDataFlat = (
    dispatch: any,
    data: import('../../utils/types/getWellTypes').FlatAssessmentResponse | undefined,
    showDismissedView: boolean = false,
    isRefresh: boolean = false,
    skipDriftDataDispatch: boolean = false,
    t: TFunction
) => {
    if (!data) {
        return;
    }

    // Get optimizing data from store if not a refresh
    const optimizingData = isRefresh ? {} : store.getState().getWellOptimize?.optimizingData || {};

    const { cardsData } = formatFlatAssessments(data, optimizingData, showDismissedView, t);

    // Calculate optimization breakdown
    const optBreakDown = formatOptimizationBreakDown(cardsData, data as any);

    // Dispatch to Redux
    dispatch(setCardData(cardsData));
    dispatch(setOptimizationBreakDown(optBreakDown));

    // Only dispatch drift assessment data if this is fresh data from API
    // Skip if we're just reformatting for dismissed view toggle to prevent infinite loop
    if (!skipDriftDataDispatch) {
        dispatch(setDriftAssessmentData(data));
    }

    // Set timestamps
    // Format and dispatch the assessment timestamp
    // ponytail: if lastAssessmentTimestamp is 0/null/undefined, pass '0' to show "No analysis performed" in UI
    const timestampValue = data.metadata?.lastAssessmentTimestamp;
    const formattedTimestamp =
        timestampValue !== undefined &&
        timestampValue !== null &&
        !isNaN(Number(timestampValue)) &&
        Number(timestampValue) !== 0
            ? formatDateWithTime(timestampValue)
            : '0';

    dispatch(setGwTimestamp(formattedTimestamp));

    // Only update refresh timestamp when processing fresh API data (not when reformatting for dismissed view toggle)
    if (!skipDriftDataDispatch) {
        dispatch(setGwRefreshTimestamp(formattedTimestamp));
    }

    // Set deployment type via instance details
    if (data.metadata.deploymentType) {
        dispatch(
            setInstanceDetailsData({
                deploymentType: data.metadata.deploymentType,
                baseDeploymentType: data.metadata.baseDeploymentType
            })
        );
    }
};

/**
 * Group card data by category for dynamic rendering
 * @param cardData - The card data object with all configurations
 * @returns Object with configurations grouped by category
 */
export const groupConfigurationsByCategory = (cardData: any): Record<string, any[]> => {
    const grouped: Record<string, any[]> = {
        storage: [],
        compute: [],
        application: [],
        resiliency: [],
        cloning: []
    };

    if (!cardData) return grouped;

    // Iterate through all keys in cardData (except metadata fields)
    Object.keys(cardData).forEach(key => {
        // Skip metadata fields
        if (key === 'deploymentType' || key === 'baseDeploymentType' || key === 'isWad') {
            return;
        }

        const config = cardData[key];
        if (config && config.category) {
            const category = config.category.toLowerCase();
            if (grouped[category]) {
                grouped[category].push({
                    key,
                    config
                });
            }
        }
    });

    // Sort configurations within each category by category-specific priority
    Object.keys(grouped).forEach(category => {
        sortConfigsByPriority(grouped[category], category, DBType.MSSQL);
    });

    return grouped;
};

/**
 * Order assessment IDs by Well-Architected category, matching UI section order.
 * Within each category, order follows cardsData insertion order.
 */
export const getOrderedAssessmentIdsByCategory = (
    assessmentIds: string[],
    cardData: Record<string, { category?: string }> | null | undefined
): string[] => {
    const idSet = new Set(assessmentIds);
    const ordered: string[] = [];
    const grouped = groupConfigurationsByCategory(cardData);

    WELL_ARCHITECTED_CATEGORY_ORDER.forEach(category => {
        (grouped[category] || []).forEach(({ key }) => {
            if (idSet.has(key)) {
                ordered.push(key);
                idSet.delete(key);
            }
        });
    });

    idSet.forEach(id => ordered.push(id));
    return ordered;
};

/**
 * Get category translation key
 */
export const getCategoryTranslationKey = (category: string): string => {
    const categoryMap: Record<string, string> = {
        storage: 'databases.well-architect.sections.storage',
        compute: 'databases.well-architect.sections.compute',
        application: 'databases.well-architect.sections.application',
        resiliency: 'databases.well-architect.sections.resiliency',
        cloning: 'databases.well-architect.sections.cloning'
    };

    return categoryMap[category.toLowerCase()] || category;
};
