import i18next from 'i18next';
import store from '../../../../store/store';
import { getRecommendation } from '../../../../utils/recommendations';
import {
    setCardData,
    setDriftAssessmentData,
    setGwRefreshTimestamp,
    setGwTimestamp,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizationBreakDown,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { addAllOracleHostAssessmentData } from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    ASSESSMENT_CONFIG_IDS,
    ASSESSMENT_METADATA_SOURCE,
    BLOCK_SIX_LABELS,
    CONFIG_STATES,
    CONFIG_STATE_ACTIONS,
    DBType,
    GETWELL_STATUS,
    GETWELL_VALUES,
    isConfigIdMatch,
    isConfigIdInList,
    OPTIMIZE_PAYLOAD_TYPES,
    ORACLE_COMPUTE_COUNT_CONFIG_IDS,
    ORACLE_PLACEMENT_CONFIG_IDS,
    ORACLE_STORAGE_SIZING_CONFIG_IDS,
    WA_FLAG_SKIP,
    WELL_ARCHITECTED_CATEGORIES,
    WELL_ARCHITECTED_CATEGORY_LABELS,
    WELL_ARCHITECTED_STATUS,
    oracleCategoryOptions
} from '../../../../utils/consts';
import { groupByType, mapDismissedValues } from '../../../../utils/resourceUtils';
import { AssessmentResponseInterface, PerConfigInterface } from '../../../../utils/types/getWellTypes';
import {
    backupStartTime,
    formatDateWithTime,
    formatNumberWithCustomComma,
    getCurrentDateTime
} from '../../../../utils/utilityFunctions';
import { handleOptimizeStorageJob } from '../../../GetWell/GetWellUtils';
import { isExcludedFromOptimizationCountForCard } from '../../../WellArchitectedTab/assessmentFormatUtils';
import { createFailedOptimizationMessage, fixingProcessNotification } from './OracleCardComponent/OracleCardComponent';
import { getOptimizeApiConfig, sortConfigsByPriority } from '../../../../utils/configRegistry';

// Factory function for creating base block structure
// Helper functions for card formatting
// Function to format host OS patch configuration
// Helper function to group Oracle configurations by category for dynamic rendering
export const groupOracleConfigurationsByCategory = (cardData: any): Record<string, any[]> => {
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
        if (WA_FLAG_SKIP.includes(key)) {
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
        sortConfigsByPriority(grouped[category], category, DBType.ORACLE);
    });

    return grouped;
};

// Helper function to check if a category has configurations
export const hasOracleCategoryConfigs = (groupedConfigs: Record<string, any[]>, category: string): boolean =>
    groupedConfigs[category] && groupedConfigs[category].length > 0;

// Helper to determine how block_six should be displayed for Oracle configs
const getBlockSixDisplayType = (itemName: string, categoryVal: string): 'count' | 'value' | 'patch' | 'smallfont' => {
    // Placement configs use count format (large "X out of Y")
    if (isConfigIdInList(itemName, ORACLE_PLACEMENT_CONFIG_IDS)) {
        return 'count';
    }

    // Storage sizing configs that show percentage or GB values in large font
    if (isConfigIdInList(itemName, ORACLE_STORAGE_SIZING_CONFIG_IDS)) {
        return 'value';
    }

    // Compute configs that show impacted resources with count (large "X out of Y")
    if (isConfigIdInList(itemName, ORACLE_COMPUTE_COUNT_CONFIG_IDS)) {
        return 'count';
    }

    // Patch configs show value with tooltip (no count, no smallFont, needs patch objects)
    if (
        isConfigIdMatch(itemName, ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH) ||
        isConfigIdMatch(itemName, ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH)
    ) {
        return 'patch';
    }

    // All other configs use large count format (default for Oracle)
    return 'count';
};

// Map category to the Oracle sub-header text shown under the card title
const getOracleBlockOneType = (category: string): string =>
    WELL_ARCHITECTED_CATEGORY_LABELS[category?.toLowerCase() as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS] ||
    category ||
    '';

// Helper function to format flat assessment to card format
const formatOracleFlatAssessmentToCard = (assessment: any, optimizingData: Record<string, string>): any => {
    const configId = assessment.id;
    const displayName = assessment.name || configId;

    // Map status
    let status = '';
    if (assessment.status === WELL_ARCHITECTED_STATUS.OPTIMIZED) {
        status = GETWELL_STATUS.OPTIMIZED;
    } else if (assessment.status === WELL_ARCHITECTED_STATUS.NOT_OPTIMIZED) {
        status = GETWELL_STATUS.NOT_OPTIMIZED;
    } else if (assessment.status === WELL_ARCHITECTED_STATUS.UNDER_PROVISIONED) {
        status = GETWELL_STATUS.UNDER_PROVISIONED;
    } else if (assessment.status === WELL_ARCHITECTED_STATUS.OVER_PROVISIONED) {
        status = GETWELL_STATUS.OVER_PROVISIONED;
    } else {
        status = GETWELL_STATUS.NOT_APPLICABLE;
    }

    // Map status to display format using GETWELL_VALUES (like MSSQL does)
    // This ensures backend status keys ('not-applicable') are shown as display labels ('Not applicable')
    const displayStatus = (status && GETWELL_VALUES[status]) || status;

    // Capitalize severity to match constants
    const severity = assessment.severity
        ? assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)
        : '';

    // Dismiss state will be populated by processOracleFlatAssessments from the dismissedConfigurations array
    // Do not try to read it here as dismissedConfigurations is an array, not an object keyed by configId

    // Get category from type
    const category = assessment.type || WELL_ARCHITECTED_CATEGORIES.STORAGE;

    // Determine block_six display type and formatting
    const displayType = getBlockSixDisplayType(configId, category);
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
        // Show value in small font for resiliency, network, license, etc.
        const violation = assessment.totalObjectsInViolation ?? 0;
        const assessed = assessment.totalObjectsAssessed ?? 0;
        blockSixValue = `${violation} out of ${assessed}`;
        blockSixSmallFont = true;
    }

    // Handle special patch objects for tooltip display
    let osPatchMissingPatches;
    let oracleSecurityPatchMissingPatches;

    if (isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH)) {
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
            blockSixCount = { totalObjectsInViolation: totalPatches };
        }
    } else if (
        isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH) &&
        assessment.missingPatchesCount !== undefined
    ) {
        oracleSecurityPatchMissingPatches = {
            critical: assessment.missingPatchesCount
        };

        // Update blockSixValue to show total patch count
        blockSixValue = String(assessment.missingPatchesCount);
        blockSixCount = { totalObjectsInViolation: assessment.missingPatchesCount };
    }

    // Get correct block_six.type label based on config
    let blockSixType = '';
    if (isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH)) {
        blockSixType = BLOCK_SIX_LABELS.MISSING_PATCHES;
    } else if (isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.ORACLE_SECURITY_PATCH)) {
        blockSixType = BLOCK_SIX_LABELS.MISSING_PATCHES;
    } else if (isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM)) {
        blockSixType = BLOCK_SIX_LABELS.FILE_SYSTEM_HEADROOM;
    } else if (isConfigIdMatch(configId, ASSESSMENT_CONFIG_IDS.SWAP_SPACE)) {
        blockSixType = BLOCK_SIX_LABELS.SWAP_SPACE;
    } else if (assessment.resourceType) {
        blockSixType = `${assessment.resourceType}s`;
    } else {
        blockSixType = displayName;
    }

    const card = {
        id: configId,
        configurationId: configId, // Store for dismiss flow and tooltip matching
        name: displayName, // Display name from flat API
        displayName,
        category,
        block_one: {
            value: displayName,
            type: getOracleBlockOneType(category)
        },
        block_two: {
            type: 'Status',
            value: assessment.errorMessage ? i18next.t('databases.general.unavailable') : displayStatus
        },
        block_three: {
            type: 'Current',
            value: assessment.current ?? ''
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
            const staticRecommendation = getRecommendation(configId, DBType.ORACLE);

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
            const staticRecommendation = getRecommendation(configId, DBType.ORACLE);
            return staticRecommendation?.description || assessment.recommendation;
        })(),
        categories: assessment.categories || [], // Categories from flat API
        tags: assessment.categories || [], // Map categories to tags for rendering
        errorMessage: assessment.errorMessage,
        objectsInViolation: assessment.objectsInViolation || [],
        violationDetails: assessment.violationDetails || [],
        // Per sub-config recommendations, used to build Current/Recommended columns for nested configs
        configDetails: assessment.configDetails,
        totalObjectsAssessed: assessment.totalObjectsAssessed ?? 0,
        totalObjectsInViolation: assessment.totalObjectsInViolation ?? 0,
        status: optimizingData[configId] || '',
        ...(assessment.ec2InstancesToPatch && { ec2InstancesToPatch: assessment.ec2InstancesToPatch }),
        ...(assessment.cloneDetails && { cloneDetails: assessment.cloneDetails }),
        ...(assessment.oldCloneDetails && { oldCloneDetails: assessment.oldCloneDetails }),
        ...(assessment.oldCloneDatabaseNames && { oldCloneDatabaseNames: assessment.oldCloneDatabaseNames }),
        ...(assessment.cloneDriftMessage && { cloneDriftMessage: assessment.cloneDriftMessage }),
        ...(assessment.missingPatchesCount !== undefined && { missingPatchesCount: assessment.missingPatchesCount }),
        ...(assessment.recommendedSizeInGib && { recommendedSizeInGib: assessment.recommendedSizeInGib }),
        ...(assessment.missingPermissions && { missingPermissions: assessment.missingPermissions }),
        // Add patch objects for tooltip display
        ...(osPatchMissingPatches !== undefined && { osPatchMissingPatches }),
        ...(oracleSecurityPatchMissingPatches !== undefined && { oracleSecurityPatchMissingPatches })
    };

    return card;
};

// Helper function to process flat Oracle assessments
const processOracleFlatAssessments = (data: any, optimizingData: Record<string, string>): Record<string, any> => {
    // Start with EMPTY cardsData — flat API provides all data, no template needed
    const cardsData: Record<string, any> = {};

    if (!data.assessments || !Array.isArray(data.assessments)) {
        return cardsData;
    }

    // Process each assessment - use id directly as the card key
    data.assessments.forEach((assessment: any) => {
        const configKey = assessment.id;
        if (!configKey) return;
        cardsData[configKey] = formatOracleFlatAssessmentToCard(assessment, optimizingData);
    });

    // Map dismissedConfigurations to cards (critical for dismiss/reactivate/activating states)
    if (data.dismissedConfigurations && Array.isArray(data.dismissedConfigurations)) {
        data.dismissedConfigurations.forEach((dismissedConfig: any) => {
            // Use id as the primary key for matching
            const configId = dismissedConfig.id;

            // First try direct match with id (card key)
            let matchingCardKey = Object.keys(cardsData).find(key => key === configId);

            // If not found, try matching by the card's name field
            if (!matchingCardKey) {
                matchingCardKey = Object.keys(cardsData).find(key => {
                    const card = cardsData[key];
                    return card?.name === configId || card?.block_one?.value === configId;
                });
            }

            // If no matching card exists, create one from dismissedConfigurations data
            // This handles configs dismissed from different categories that may not be re-assessed
            if (!matchingCardKey) {
                const syntheticAssessment = {
                    id: dismissedConfig.id,
                    name: dismissedConfig.name,
                    type: dismissedConfig.type,
                    severity: dismissedConfig.severity,
                    recommendation: dismissedConfig.recommendation,
                    categories: dismissedConfig.categories || [],
                    status: WELL_ARCHITECTED_STATUS.NOT_OPTIMIZED,
                    current: '',
                    resourceType: dismissedConfig.subType || dismissedConfig.type || '',
                    objectsInViolation: [],
                    totalObjectsAssessed: 0,
                    totalObjectsInViolation: 0
                };
                cardsData[configId] = formatOracleFlatAssessmentToCard(syntheticAssessment, optimizingData);
                matchingCardKey = configId;
            }

            if (matchingCardKey && cardsData[matchingCardKey]) {
                // Add dismissedObj to the card
                // Prioritize card's displayName since it's the human-readable name
                const configName =
                    cardsData[matchingCardKey].displayName ||
                    cardsData[matchingCardKey].name ||
                    dismissedConfig.name ||
                    dismissedConfig.configurationName ||
                    matchingCardKey;

                cardsData[matchingCardKey].dismissedObj = {
                    configState: dismissedConfig.configState,
                    startTime: dismissedConfig.startTime,
                    endTime: dismissedConfig.endTime,
                    configurationName: configName
                };
            }
        });
    }

    // Add metadata
    cardsData.storageProtocol = data.metadata?.storageProtocol || '';
    cardsData.isWad = data.metadata?.isWad || false;
    cardsData.isUnregistered = data.metadata?.source === ASSESSMENT_METADATA_SOURCE.UNREGISTERED;
    cardsData.deploymentType = data.metadata?.deploymentType || '';
    cardsData.baseDeploymentType = data.metadata?.baseDeploymentType || '';

    return cardsData;
};

export const getOracleCardsData = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>,
    showDismissedView: boolean = false
) => {
    // Oracle now uses flat API only - process flat assessments
    const cardsData = processOracleFlatAssessments(data, optimizingData);
    return {
        cardsData,
        formatOntapConfigList: [],
        formatOsConfigList: []
    };
};

// Helper function to process storage card item
const processStorageCardItem = (cardItem: any) => {
    const dismissedState = cardItem?.dismissedObj?.configState;
    const isDismissed = dismissedState === CONFIG_STATES.DISMISSED;
    const isPostponed = dismissedState === CONFIG_STATES.POSTPONED;
    const isOptimizedViaDismissal = dismissedState === CONFIG_STATES.ACTIVATING;
    const isOptimized = cardItem?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal;
    const severity = cardItem?.block_four?.value;

    return {
        isDismissed,
        isPostponed,
        isOptimizedViaDismissal,
        isOptimized,
        isCritical: severity === GETWELL_STATUS.CRITICAL,
        isWarning: severity === GETWELL_STATUS.WARNING
    };
};

// Optimized function to format optimization breakdown data
export const formatOracleOptimizationBreakDown = (
    cardsData: Record<string, any>,
    assessmentData?: AssessmentResponseInterface
) => {
    const storageCount = {
        hasDismissedOrPostponed: false,
        total: 0,
        critical: 0,
        warning: 0,
        optimized: 0,
        notOptimized: 0,
        dismissedOrPostponed: 0,
        dismissedIds: [] as string[],
        percent: 0
    };

    const computeCount = {
        hasDismissedOrPostponed: false,
        total: 0,
        critical: 0,
        warning: 0,
        optimized: 0,
        notOptimized: 0,
        dismissedOrPostponed: 0,
        dismissedIds: [] as string[],
        percent: 0
    };

    const applicationCount = {
        hasDismissedOrPostponed: false,
        total: 0,
        critical: 0,
        warning: 0,
        optimized: 0,
        notOptimized: 0,
        dismissedOrPostponed: 0,
        dismissedIds: [] as string[],
        percent: 0
    };

    const resiliencyCount = {
        hasDismissedOrPostponed: false,
        total: 0,
        critical: 0,
        warning: 0,
        optimized: 0,
        notOptimized: 0,
        dismissedOrPostponed: 0,
        dismissedIds: [] as string[],
        percent: 0
    };

    const cloningCount = {
        hasDismissedOrPostponed: false,
        total: 0,
        critical: 0,
        warning: 0,
        optimized: 0,
        notOptimized: 0,
        dismissedOrPostponed: 0,
        dismissedIds: [] as string[],
        percent: 0
    };

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardsData?.isWad || false;

    Object.values(cardsData).forEach((cardItem: any) => {
        if (WA_FLAG_SKIP.includes(cardItem)) {
            return; // Skip WA_FLAG_SKIP as they are not cards
        }

        if (isExcludedFromOptimizationCountForCard(cardItem)) {
            return;
        }

        if (cardItem?.category === 'storage') {
            const { isDismissed, isPostponed, isOptimizedViaDismissal, isOptimized, isCritical, isWarning } =
                processStorageCardItem(cardItem);

            if (isDismissed || isPostponed) {
                storageCount.dismissedOrPostponed++;
                storageCount.hasDismissedOrPostponed = true;
                // Use registry key consistently
                storageCount.dismissedIds.push(cardItem?.id);
            } else if (isOptimized) {
                storageCount.optimized++;
                if (isOptimizedViaDismissal) {
                    storageCount.hasDismissedOrPostponed = true;
                }
            } else {
                storageCount.notOptimized++;
                if (isCritical) storageCount.critical++;
                else if (isWarning) storageCount.warning++;
            }
        }

        if (cardItem?.category === 'compute') {
            // If the card has no assessment data, count it as not optimized
            if (!cardItem?.block_two?.value) {
                computeCount.notOptimized++;
                return;
            }

            const { isDismissed, isPostponed, isOptimizedViaDismissal, isOptimized, isCritical, isWarning } =
                processStorageCardItem(cardItem);

            if (isDismissed || isPostponed) {
                computeCount.dismissedOrPostponed++;
                computeCount.hasDismissedOrPostponed = true;
                computeCount.dismissedIds.push(cardItem?.id);
            } else if (isOptimized) {
                computeCount.optimized++;
                if (isOptimizedViaDismissal) {
                    computeCount.hasDismissedOrPostponed = true;
                }
            } else {
                computeCount.notOptimized++;
                if (isCritical) computeCount.critical++;
                else if (isWarning) computeCount.warning++;
            }
        }

        if (cardItem?.category === 'application') {
            if (!cardItem?.block_two?.value) {
                applicationCount.notOptimized++;
                return;
            }

            const { isDismissed, isPostponed, isOptimizedViaDismissal, isOptimized, isCritical, isWarning } =
                processStorageCardItem(cardItem);

            if (isDismissed || isPostponed) {
                applicationCount.dismissedOrPostponed++;
                applicationCount.hasDismissedOrPostponed = true;
                applicationCount.dismissedIds.push(cardItem?.id);
            } else if (isOptimized) {
                applicationCount.optimized++;
                if (isOptimizedViaDismissal) {
                    applicationCount.hasDismissedOrPostponed = true;
                }
            } else {
                applicationCount.notOptimized++;
                if (isCritical) applicationCount.critical++;
                else if (isWarning) applicationCount.warning++;
            }
        }

        if (cardItem?.category === 'resiliency') {
            if (!cardItem?.block_two?.value) {
                resiliencyCount.notOptimized++;
                return;
            }

            const { isDismissed, isPostponed, isOptimizedViaDismissal, isOptimized, isCritical, isWarning } =
                processStorageCardItem(cardItem);

            if (isDismissed || isPostponed) {
                resiliencyCount.dismissedOrPostponed++;
                resiliencyCount.hasDismissedOrPostponed = true;
                resiliencyCount.dismissedIds.push(cardItem?.id);
            } else if (isOptimized) {
                resiliencyCount.optimized++;
                if (isOptimizedViaDismissal) {
                    resiliencyCount.hasDismissedOrPostponed = true;
                }
            } else {
                resiliencyCount.notOptimized++;
                if (isCritical) resiliencyCount.critical++;
                else if (isWarning) resiliencyCount.warning++;
            }
        }

        if (cardItem?.category === 'cloning') {
            if (!cardItem?.block_two?.value) {
                cloningCount.notOptimized++;
                return;
            }

            const { isDismissed, isPostponed, isOptimizedViaDismissal, isOptimized, isCritical, isWarning } =
                processStorageCardItem(cardItem);

            if (isDismissed || isPostponed) {
                cloningCount.dismissedOrPostponed++;
                cloningCount.hasDismissedOrPostponed = true;
                cloningCount.dismissedIds.push(cardItem?.id);
            } else if (isOptimized) {
                cloningCount.optimized++;
                if (isOptimizedViaDismissal) {
                    cloningCount.hasDismissedOrPostponed = true;
                }
            } else {
                cloningCount.notOptimized++;
                if (isCritical) cloningCount.critical++;
                else if (isWarning) cloningCount.warning++;
            }
        }
    });

    // Count sub-configurations from assessment data
    if (assessmentData?.dismissedConfigurations) {
        const dismissedConfigs = assessmentData.dismissedConfigurations;
    }

    storageCount.total = storageCount.optimized + storageCount.notOptimized;
    storageCount.percent =
        storageCount.optimized && storageCount.total > 0
            ? formatNumberWithCustomComma((storageCount.optimized / storageCount.total) * 100)
            : 0;

    computeCount.total = computeCount.optimized + computeCount.notOptimized;
    computeCount.percent =
        computeCount.optimized && computeCount.total > 0
            ? formatNumberWithCustomComma((computeCount.optimized / computeCount.total) * 100)
            : 0;

    resiliencyCount.total = resiliencyCount.optimized + resiliencyCount.notOptimized;
    resiliencyCount.percent =
        resiliencyCount.optimized && resiliencyCount.total > 0
            ? formatNumberWithCustomComma((resiliencyCount.optimized / resiliencyCount.total) * 100)
            : 0;

    applicationCount.total = applicationCount.optimized + applicationCount.notOptimized;
    applicationCount.percent =
        applicationCount.optimized && applicationCount.total > 0
            ? formatNumberWithCustomComma((applicationCount.optimized / applicationCount.total) * 100)
            : 0;

    cloningCount.total = cloningCount.optimized + cloningCount.notOptimized;
    cloningCount.percent =
        cloningCount.optimized && cloningCount.total > 0
            ? formatNumberWithCustomComma((cloningCount.optimized / cloningCount.total) * 100)
            : 0;

    const totalOptimized =
        storageCount.optimized +
        computeCount.optimized +
        applicationCount.optimized +
        resiliencyCount.optimized +
        cloningCount.optimized;
    const totalAll =
        storageCount.total + computeCount.total + applicationCount.total + resiliencyCount.total + cloningCount.total;

    return {
        storage: storageCount,
        compute: computeCount,
        application: applicationCount,
        resiliency: resiliencyCount,
        cloning: cloningCount,
        total: {
            hasDismissedOrPostponed:
                storageCount.hasDismissedOrPostponed ||
                computeCount.hasDismissedOrPostponed ||
                applicationCount.hasDismissedOrPostponed ||
                resiliencyCount.hasDismissedOrPostponed ||
                cloningCount.hasDismissedOrPostponed,
            total: totalAll,
            critical:
                storageCount.critical +
                computeCount.critical +
                applicationCount.critical +
                resiliencyCount.critical +
                cloningCount.critical,
            warning:
                storageCount.warning +
                computeCount.warning +
                applicationCount.warning +
                resiliencyCount.warning +
                cloningCount.warning,
            optimized: totalOptimized,
            notOptimized:
                storageCount.notOptimized +
                computeCount.notOptimized +
                applicationCount.notOptimized +
                resiliencyCount.notOptimized +
                cloningCount.notOptimized,
            dismissedOrPostponed:
                storageCount.dismissedOrPostponed +
                computeCount.dismissedOrPostponed +
                applicationCount.dismissedOrPostponed +
                resiliencyCount.dismissedOrPostponed +
                cloningCount.dismissedOrPostponed,
            dismissedIds: [
                ...storageCount.dismissedIds,
                ...computeCount.dismissedIds,
                ...applicationCount.dismissedIds,
                ...resiliencyCount.dismissedIds,
                ...cloningCount.dismissedIds
            ],
            percent: totalAll > 0 ? Math.round((totalOptimized / totalAll) * 100) : 0
        }
    };
};

// Helper function to format timestamp
const formatTimestamp = (timestamp: any): any => {
    if (!timestamp) return timestamp;
    return timestamp && isNaN(Date.parse(timestamp)) ? formatDateWithTime(timestamp) : timestamp;
};

// Optimized main function to format Oracle Well Architected data
export const formatOracleWellArchitectedData = (
    dispatch: any,
    data?: AssessmentResponseInterface,
    showDismissedView: boolean = false,
    isRefresh: boolean = false
) => {
    const state = store.getState();
    const assessmentData = data || state.getWellOptimize.driftAssessmentData;
    if (!assessmentData) return;
    let optimizingData = state.getWellOptimize.optimizingData || {};

    // If this is a refresh (fresh assessment data), clear optimistic state to show actual API status
    if (isRefresh && data) {
        optimizingData = {};
        dispatch(setOptimizingData({}));
    }

    const { cardsData, formatOntapConfigList, formatOsConfigList } = getOracleCardsData(
        assessmentData,
        optimizingData,
        showDismissedView
    );
    const optBreakDown = formatOracleOptimizationBreakDown(cardsData, assessmentData);

    const timestamp = assessmentData?.metadata?.lastAssessmentTimestamp;

    // Batch dispatch all data to store
    // ponytail: if lastAssessmentTimestamp is 0/null/undefined, pass '0' to show "No analysis performed" in UI
    const formattedTimestamp =
        timestamp !== undefined && timestamp !== null && Number(timestamp) !== 0 ? formatTimestamp(timestamp) : '0';
    const dispatchActions = [
        () => dispatch(setCardData(cardsData)),
        () => dispatch(setOptimizationBreakDown(optBreakDown)),
        () => dispatch(setGwTimestamp(formattedTimestamp)),
        () => dispatch(setGwRefreshTimestamp(formattedTimestamp)),
        () => dispatch(setDriftAssessmentData(assessmentData))
    ];

    dispatchActions.forEach(action => action());
};

// filters card data based on filter tags
export const oracleApplyFilter = (
    cardData: any,
    optimizeFilterTags: any,
    showDismissedConfigurations?: boolean,
    driftAssessmentData?: any
) => {
    const filteredCardData: any = {};
    let configCount = 0;
    const filters = groupByType(optimizeFilterTags, 'value');

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    Object.keys(cardData)?.forEach((key: any) => {
        if (WA_FLAG_SKIP.includes(key)) {
            return;
        }

        // Skip if cardData[key] is null/undefined
        if (!cardData[key]) {
            return;
        }

        // Flat API: category is directly on the card
        const currentCategory = cardData[key].category;

        const checkCategory = !filters['all-catagories'] || filters['all-catagories']?.includes(currentCategory);

        const isOptmized = isOracleConfigOptimized(
            cardData[key].block_two.value,
            cardData[key].dismissedObj?.configState
        );
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
        const resourceType = cardData[key].block_five.value;
        const checkResourceType = !filters.resourceType || filters.resourceType?.includes(resourceType);

        // Handle dismissed configuration toggle filtering
        const configState = cardData[key].dismissedObj?.configState;
        let checkDismissedFilter = true;

        if (showDismissedConfigurations !== undefined) {
            // Standard logic for all Oracle configurations (flat API structure)
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
            // Flat API: count all configs with categories
            if (currentCategory && cardData[key].block_two.value) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};

// Static Oracle category data mapping (for fallback)
// Check if configuration is optimized (Oracle version)
const isOracleConfigOptimized = (blockTwoValue: string, configState?: string): boolean => {
    // If dismissed/postponed, it's not optimized
    if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
        return false;
    }

    // If activating, consider it optimized (being worked on)
    if (configState === CONFIG_STATES.ACTIVATING) {
        return true;
    }

    // Based on block_two value for active configs
    return blockTwoValue === GETWELL_VALUES.OPTIMIZED || blockTwoValue === 'Optimized';
};

// Generate dynamic filter options for Oracle cards
export const generateOracleDynamicFilterOptions = (cardData: any, instanceDeploymentType?: string) => {
    const availableCategories = new Set();
    const availableSeverities = new Set();
    const availableTags = new Set();
    const availableResourceTypes = new Set();
    const availableStatuses = new Set();

    Object.keys(cardData).forEach((key: any) => {
        // Skip non-card keys
        if (WA_FLAG_SKIP.includes(key)) {
            return;
        }

        const config = cardData[key];
        // Skip if config is null/undefined
        if (!config) {
            return;
        }

        // Flat API: category is directly on the card
        if (config.category) {
            availableCategories.add(config.category);
        }

        if (!config?.block_two?.value) {
            return;
        }

        // Add severity if available
        if (config.block_four?.value) {
            availableSeverities.add(config.block_four.value);
        }

        // Add tags if available
        if (config.tags) {
            config.tags.forEach((tag: string) => availableTags.add(tag));
        }

        // Add resource type if available (flat API: all configs have resource types)
        if (config.block_five?.value) {
            availableResourceTypes.add(config.block_five.value);
        }

        // Add status based on optimization state
        const isOptimizedStatus = isOracleConfigOptimized(config.block_two?.value, config.dismissedObj?.configState);
        availableStatuses.add(isOptimizedStatus ? GETWELL_STATUS.OPTIMIZED : GETWELL_STATUS.NOT_OPTIMIZED);
    });

    const sortedCategories = Array.from(availableCategories).sort(
        (a, b) => oracleCategoryOptions.indexOf(a as string) - oracleCategoryOptions.indexOf(b as string)
    );

    return {
        categories: sortedCategories.map(category => ({
            id: category as string,
            label:
                WELL_ARCHITECTED_CATEGORY_LABELS[
                    (category as string)?.toLowerCase() as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS
                ] || (category as string),
            value: category as string
        })),
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

export const updateConfigStateStatusOracle = (rowList: any, dispatch: any, action: any) => {
    let setAction = '';
    if (action === CONFIG_STATE_ACTIONS.DISMISS) {
        setAction = CONFIG_STATES.DISMISSED;
    } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
        setAction = CONFIG_STATES.POSTPONED;
    } else if (action === CONFIG_STATE_ACTIONS.ACTIVE || action === CONFIG_STATES.ACTIVATING) {
        setAction = CONFIG_STATES.ACTIVATING;
    }

    const state = store.getState();
    const { allOracleHostAssessmentData } = state.inventoryV2;
    let updatedAsessmentData = [...allOracleHostAssessmentData]; // Clone the original data

    rowList?.forEach((rowData: any) => {
        updatedAsessmentData = updatedAsessmentData?.map((hostData: any) => {
            if (
                hostData?.databaseHostId === rowData?.hostId &&
                hostData?.credentialId === rowData?.credentialId &&
                hostData?.regionId === rowData?.regionId
            ) {
                const updatedInstancesAssessment = hostData?.instancesAssessment?.map((instance: any) => {
                    if (instance?.databaseInstanceId === rowData?.instanceId) {
                        // Flat API: upsert into the flat dismissedConfigurations array by id
                        const configId = rowData?.id;
                        const existingDismissed: any[] = instance.assessments?.dismissedConfigurations ?? [];
                        const idx = existingDismissed.findIndex((d: any) => d.id === configId);
                        const entry = {
                            id: configId,
                            configState: setAction,
                            endTime: rowData?.endTime,
                            startTime: rowData?.startTime
                        };
                        const updatedDismissed =
                            idx >= 0
                                ? existingDismissed.map((d: any, i: number) => (i === idx ? { ...d, ...entry } : d))
                                : [...existingDismissed, entry];
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
    dispatch(addAllOracleHostAssessmentData(updatedAsessmentData));
};

// Helper function to check if all Oracle configurations are dismissed (dismissed or postponed)
export const checkAllOracleConfigurationsDismissed = (cardData: any): boolean => {
    if (!cardData) {
        return false;
    }

    let totalConfigs = 0;
    let dismissedConfigs = 0;

    // All dismiss states are captured in cardData[key].dismissedObj (built from the flat API).
    // Iterate every config key and count how many are dismissed or postponed.
    Object.keys(cardData).forEach((key: string) => {
        // Skip metadata keys
        if (WA_FLAG_SKIP.includes(key)) {
            return;
        }

        const config = cardData[key];
        if (!config) return;

        // Only count configurations that have actual assessment data (block_two.value exists)
        if (!config?.block_two?.value) return;

        totalConfigs++;
        const configState = config?.dismissedObj?.configState;
        if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
            dismissedConfigs++;
        }
    });

    // Return true only if there are configurations and ALL of them are dismissed
    return totalConfigs > 0 && dismissedConfigs === totalConfigs;
};

// Helper function to call Oracle optimize API
export const callOptimizeOracleApi = ({
    configId,
    cardData,
    optimizeOracleOs,
    getJobDetailApi,
    dispatch,
    isWorkloadFactory,
    t
}: {
    configId: any;
    cardData: any;
    optimizeOracleOs: any;
    getJobDetailApi: any;
    dispatch: any;
    isWorkloadFactory: boolean;
    t: any;
}) => {
    let apiCall = null;
    let payload: null | object = {};
    const state = store.getState();
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceRegionId,
        selectedGwInstanceCredId,
        optimizingData,
        inProgressOptimizationData,
        inProgressHostData
    } = state.getWellOptimize;

    // Try to get API config from registry first (registry-driven approach)
    const apiConfig = getOptimizeApiConfig(configId, DBType.ORACLE);

    if (apiConfig && apiConfig.mutation === 'optimizeOracleOperatingSystem') {
        apiCall = optimizeOracleOs;
        const { oracleOsType } = apiConfig;

        // Build payload based on oracleOsType from registry
        // Only special-case truly unique payloads; use default structure for everything else
        if (oracleOsType === OPTIMIZE_PAYLOAD_TYPES.STORAGE_SIZING) {
            // Special case: FILE_SYSTEM_HEADROOM uses hardcoded 'headroom' configurationName
            payload = {
                type: OPTIMIZE_PAYLOAD_TYPES.STORAGE_SIZING,
                hostsToOptimize: [
                    {
                        configurationName: ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM,
                        databaseHosts: [
                            {
                                id: selectedResourceId,
                                databases: [selectedDatabaseInstance],
                                credentialsId: selectedGwInstanceCredId,
                                region: selectedGwInstanceRegionId
                            }
                        ]
                    }
                ]
            };
        } else if (oracleOsType === OPTIMIZE_PAYLOAD_TYPES.AWS_BACKUP) {
            // Special case: AWS backup needs additional Redux state (fsxFileSystemId, backupRetentionDays, backupStartTime)
            const { selectedAWSBackup, selectedRowFsxId, driftAssessmentData } = state.getWellOptimize;
            const fileSystemId = selectedRowFsxId || driftAssessmentData?.metadata?.fileSystemId;
            payload = {
                type: OPTIMIZE_PAYLOAD_TYPES.AWS_BACKUP,
                hostsToOptimize: [
                    {
                        configurationName: OPTIMIZE_PAYLOAD_TYPES.AWS_BACKUP,
                        databaseHosts: [
                            {
                                id: selectedResourceId,
                                region: selectedGwInstanceRegionId,
                                credentialsId: selectedGwInstanceCredId,
                                databases: [selectedDatabaseInstance],
                                fsxFileSystemId: fileSystemId,
                                backupRetentionDays: selectedAWSBackup?.numberOfDays,
                                backupStartTime: backupStartTime(selectedAWSBackup)
                            }
                        ]
                    }
                ]
            };
        } else {
            // Default payload structure - works for compute-host-os, storage-operating-system, and any future standard types
            // No need to add new if-else blocks when new oracleOsType values are added to the registry
            payload = {
                type: oracleOsType,
                hostsToOptimize: [
                    {
                        configurationName: configId,
                        databaseHosts: [
                            {
                                id: selectedResourceId,
                                databases: [selectedDatabaseInstance],
                                credentialsId: selectedGwInstanceCredId,
                                region: selectedGwInstanceRegionId
                            }
                        ]
                    }
                ]
            };
        }
    }

    // call optimize api
    dispatch(setOptimizingInstanceData(true));
    dispatch(
        setOptimizingData({
            ...optimizingData,
            [cardData?.id]: 'optimizing'
        })
    );

    // Update cardData to show "Optimizing" status immediately
    const currentCardData = store.getState().getWellOptimize.cardData;
    if (currentCardData && cardData?.id && currentCardData[cardData.id]) {
        dispatch(
            setCardData({
                ...currentCardData,
                [cardData.id]: {
                    ...currentCardData[cardData.id],
                    block_two: {
                        ...currentCardData[cardData.id].block_two,
                        value: GETWELL_STATUS.OPTIMIZING
                    }
                }
            })
        );
    }

    dispatch(
        setInProgressOptimizationData({
            ...inProgressOptimizationData,
            [configId]: [
                ...(inProgressOptimizationData[configId] || []),
                `${selectedResourceId}_${selectedDatabaseInstance}`
            ]
        })
    );
    dispatch(
        setInProgressHostData({
            ...inProgressHostData,
            [configId]: [...(inProgressHostData[configId] || []), selectedResourceId]
        })
    );

    // Use the centralized notification function
    fixingProcessNotification(configId, dispatch, isWorkloadFactory, t);

    // Build API call object based on payload type
    let apiCallObj = {};
    if (apiConfig?.oracleOsType === OPTIMIZE_PAYLOAD_TYPES.STORAGE_SIZING) {
        // FILE_SYSTEM_HEADROOM needs extra fields
        apiCallObj = {
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload
        };
    } else {
        // All other configs just need payload
        apiCallObj = { payload };
    }

    apiCall(apiCallObj).then((res: any) => {
        const failedMsgData = createFailedOptimizationMessage(configId, dispatch, isWorkloadFactory, t);

        if (!res.error) {
            dispatch(
                setJobToInstanceMap({
                    ...state.getWellOptimize.jobToInstanceMap,
                    [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                })
            );
        }

        handleOptimizeStorageJob(
            res,
            {
                id: cardData?.id,
                name: configId,
                hostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                credentialId: selectedGwInstanceCredId,
                regionId: selectedGwInstanceRegionId
            },
            failedMsgData,
            getJobDetailApi,
            dispatch,
            configId,
            '',
            {},
            false,
            DBType.ORACLE
        );
    });
};
