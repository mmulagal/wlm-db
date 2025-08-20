import store from '../../../../store/store';
import {
    setCardData,
    setGwRefreshTimestamp,
    setGwTimestamp,
    setOntapConfigTableData,
    setOptimizationBreakDown
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    GETWELL_CONFIG,
    GETWELL_STATUS,
    GETWELL_VALUES
} from '../../../../utils/consts';
import { groupByType, mapDismissedValues } from '../../../../utils/resourceUtils';
import { AssessmentResponseInterface, PerConfigInterface } from '../../../../utils/types/getWellTypes';
import {
    formatDateWithTime,
    formatNumberWithCustomComma,
    getCurrentDateTime
} from '../../../../utils/utilityFunctions';
import { isOptimized } from '../../../DatabaseHomePage/DatabaseHomeUtils';

export const oracleCardData: any = {
    redologs_temp_placement: {
        id: 'redologs-temp-placement',
        mapName: ASSESSMENT_CONFIG_NAMES.REDO_LOGS_TEMP_PLACEMENT,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.REDO_LOGS_TEMP_PLACEMENT,
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },

        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: 'Database'
        },
        block_six: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Redo Logs and Temp Placement Recommendation',
            description:
                'Placing redo logs and temp files on a dedicated volume enhances performance and recovery processes. \nThis isolation prevents high I/O demands from interfering with other operations, ensuring efficient logging, sorting, and reliable backup and recovery.'
        },
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization']
    },
    archive_placement: {
        id: 'archive-placement',
        mapName: ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },

        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: 'Database'
        },
        block_six: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Archive Placement Recommendation',
            description:
                'Placing archive logs on a dedicated volume enhances performance and recovery processes. \nThis isolation prevents high I/O demands from interfering with other operations, ensuring efficient logging, sorting, and reliable backup and recovery.'
        },
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization']
    },
    datafiles_controlfiles_placement: {
        id: 'datafiles-controlfiles-placement',
        mapName: ASSESSMENT_CONFIG_NAMES.DATAFILES_CONTROLFILES_PLACEMENT,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.DATAFILES_CONTROLFILES_PLACEMENT,
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },

        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: 'Database'
        },
        block_six: {
            type: 'Impacted databases',
            value: ''
        },
        recommendation: {
            title: 'Data Files and Control Files Placement Recommendation',
            description:
                'Data files and control files should reside on a dedicated volume to optimize performance and maintain data integrity. \nIsolating these files allows for efficient read/write operations and ensures critical control file accessibility, reducing the risk of corruption and enhancing database robustness.'
        },
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization']
    },
    oracle_binary_placement: {
        id: 'oracle-binary-placement',
        mapName: ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },

        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: 'Database'
        },
        block_six: {
            type: 'Impacted databases',
            value: ''
        },
        recommendation: {
            title: 'Oracle Binary Placement Recommendation',
            description:
                'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files. \nThis separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.'
        },
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization']
    },
    ontap_configuration: {
        id: 'ontap',
        category: 'storage',
        mapName: ASSESSMENT_CONFIG_NAMES.ONTAP,
        block_one: {
            value: 'ONTAP',
            type: 'Configuration'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Not optimized configurations',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        },
        block_five: {
            type: 'Not optimized configurations',
            value: '',
            minWidth: '200px'
        },

        tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency']
    }
};

// Helper functions for card formatting
const formatValue = (value: string): string => GETWELL_VALUES?.[value] || value;

const isPlacementConfig = (itemName: string): boolean =>
    [
        'redologs_temp_placement',
        'archive_placement',
        'datafiles_controlfiles_placement',
        'oracle_binary_placement'
    ].includes(itemName);

const calculateBlockValues = (item: PerConfigInterface, itemName: string, categoryVal: string) => {
    const blockThreeValue = categoryVal === 'storage' ? formatValue(item?.current || '') : '';

    let blockSixValue = '';
    let blockSixCountObject = null;

    if (isPlacementConfig(itemName)) {
        const violation = item?.totalObjectsInViolation || 0;
        const assessed = item?.totalObjectsAssessed || 0;
        blockSixValue = `${violation} out of ${assessed}`;
        blockSixCountObject = { totalObjectsInViolation: violation, totalObjectsAssessed: assessed };
    } else if (categoryVal === 'storage') {
        blockSixValue = formatValue(item?.current || '');
    }

    return { blockThreeValue, blockSixValue, blockSixCountObject };
};

const formatCardItem = (
    item: PerConfigInterface,
    optimizingData: Record<string, string>,
    data: AssessmentResponseInterface
): any => {
    const originalName = item?.name || '';
    const itemName = GETWELL_CONFIG?.[originalName] || originalName;
    const status = optimizingData?.[originalName] || item?.status || '';
    const severity = item?.severity || '';
    const categoryVal = 'storage';

    const { blockThreeValue, blockSixValue, blockSixCountObject } = calculateBlockValues(item, itemName, categoryVal);

    return {
        ...oracleCardData?.[itemName],
        block_two: { ...oracleCardData?.[itemName]?.block_two, value: formatValue(status) },
        block_three: {
            ...oracleCardData?.[itemName]?.block_three,
            value: blockThreeValue,
            list: item?.objectsInViolation || null
        },
        block_four: { ...oracleCardData?.[itemName]?.block_four, value: formatValue(severity) },
        block_five: {
            ...oracleCardData?.[itemName]?.block_five,
            value: item?.resourceType || oracleCardData?.[itemName]?.block_five?.value || ''
        },
        block_six: {
            ...oracleCardData?.[itemName]?.block_six,
            value: blockSixValue,
            count: blockSixCountObject,
            list: item?.objectsInViolation || null
        },
        errorMessage: item?.errorMessage,
        tags: item?.tags,
        id: item?.name,
        category: categoryVal,
        missingPermissions: item?.missingPermissions,
        recommendedSizeInGib: item?.recommendedSizeInGib,
        sizingViolations: item?.sizingViolations,
        violationDetails: item?.violationDetails,
        objectsInViolation: item?.objectsInViolation,
        recommendationText: item?.recommendation,
        dismissedObj: mapDismissedValues(data?.dismissedConfigurations?.storage, item?.name)
    };
};

// Optimized function to format individual card main config
export const formatIndividualCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): Record<string, any> => {
    const layoutItems = data?.storage?.layout || [];
    const cardsData = { ...oracleCardData };

    layoutItems.forEach((item: PerConfigInterface) => {
        const itemName = GETWELL_CONFIG?.[item?.name || ''] || item?.name || '';
        cardsData[itemName] = formatCardItem(item, optimizingData, data);
    });

    return cardsData;
};

// Helper function to determine highest severity
const getHighestSeverity = (hasCritical: boolean, hasWarning: boolean): string => {
    if (hasCritical) return 'Critical';
    if (hasWarning) return 'Warning';
    return 'None';
};

// Helper function to process volume item
const processOntapItem = (item: PerConfigInterface, optimizingData: Record<string, string>, type: 'volume' | 'lun') => {
    const status = optimizingData?.[item?.name || ''] || item?.status || '';
    return {
        ...item,
        id: item?.name,
        type,
        name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
        status: formatValue(status),
        severity: formatValue(item?.severity || ''),
        originalStatus: status
    };
};

// Optimized function to format ONTAP configuration data
export const formatOntapConfig = (data: AssessmentResponseInterface, optimizingData: Record<string, string>) => {
    const volumesList = data?.storage?.configuration?.volumes;
    const lunsList = data?.storage?.configuration?.luns;
    const fullList = [volumesList, lunsList];

    if ((!volumesList?.length || volumesList[0]?.errorMessage) && (!lunsList?.length || lunsList[0]?.errorMessage)) {
        return {
            formatOntapConfigList: [],
            ontapTagsList: [],
            ontapOptimizedConfig: 0,
            ontapNotOptimizedConfig: 0,
            highestOntapSeverity: 'None'
        };
    }

    const formatOntapConfigList: PerConfigInterface[] = [];
    const allTags: string[] = [];
    let ontapOptimizedConfig = 0;
    let ontapNotOptimizedConfig = 0;
    let hasCritical = false;
    let hasWarning = false;

    fullList?.forEach((list: any, index: number) => {
        list?.forEach((item: PerConfigInterface) => {
            const processedItem = processOntapItem(item, optimizingData, index === 0 ? 'volume' : 'lun');
            formatOntapConfigList.push(processedItem);

            // Count optimized vs not optimized
            if (processedItem.originalStatus === 'optimized') {
                ontapOptimizedConfig++;
            } else {
                ontapNotOptimizedConfig++;
            }

            // Track severities
            if (item?.severity === 'critical') hasCritical = true;
            if (item?.severity === 'warning') hasWarning = true;

            // Collect tags
            if (item?.tags) allTags.push(...item.tags);
        });
    });

    return {
        formatOntapConfigList,
        ontapTagsList: allTags,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity: getHighestSeverity(hasCritical, hasWarning)
    };
};

// Helper function to create ONTAP configuration block
const createOntapConfigurationBlock = (
    ontapOptimizedConfig: number,
    ontapNotOptimizedConfig: number,
    highestOntapSeverity: string,
    ontapTagsList: string[]
) => {
    const totalConfigs = ontapOptimizedConfig + ontapNotOptimizedConfig;
    const hasConfigs = totalConfigs > 0;

    return {
        ...oracleCardData?.ontap_configuration,
        block_two: {
            ...oracleCardData?.ontap_configuration?.block_two,
            value: hasConfigs ? (ontapNotOptimizedConfig > 0 ? 'Not optimized' : 'Optimized') : ''
        },
        block_three: {
            ...oracleCardData?.ontap_configuration?.block_three,
            value:
                ontapNotOptimizedConfig !== 0
                    ? `${formatNumberWithCustomComma((ontapNotOptimizedConfig / totalConfigs) * 100)}%`
                    : '0%'
        },
        block_four: {
            ...oracleCardData?.ontap_configuration?.block_four,
            value: highestOntapSeverity
        },
        block_five: {
            ...oracleCardData?.ontap_configuration?.block_five,
            value: `${ontapNotOptimizedConfig} out of ${totalConfigs}`,
            count: {
                totalObjectsAssessed: totalConfigs,
                totalObjectsInViolation: ontapNotOptimizedConfig
            }
        },
        tags: [...new Set(ontapTagsList)], // Remove duplicates
        category: 'storage'
    };
};

// Optimized function to get cards data
export const getCardsData = (data: AssessmentResponseInterface, optimizingData: Record<string, string>) => {
    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData);

    const cardsData = {
        ...formatIndividualCardMainConfig(data, optimizingData),
        deploymentType: data?.deploymentType || '',
        ontap_configuration: createOntapConfigurationBlock(
            ontapOptimizedConfig,
            ontapNotOptimizedConfig,
            highestOntapSeverity,
            ontapTagsList
        )
    };

    return { cardsData, formatOntapConfigList };
};

// Helper function to check if item is optimized via dismissal
const isOptimizedViaDismissal = (dismissedState: string): boolean =>
    [CONFIG_STATES.DISMISSED, CONFIG_STATES.POSTPONED, CONFIG_STATES.ACTIVATING].includes(dismissedState);

// Helper function to process storage card item
const processStorageCardItem = (cardItem: any) => {
    const dismissedState = cardItem?.dismissedObj?.configState;
    const isDismissed = isOptimizedViaDismissal(dismissedState);
    const isOptimized = cardItem?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isDismissed;
    const severity = cardItem?.block_four?.value;

    return {
        isDismissed,
        isOptimized,
        isCritical: severity === GETWELL_STATUS.CRITICAL,
        isWarning: severity === GETWELL_STATUS.WARNING
    };
};

// Optimized function to format optimization breakdown data
export const formatOptimizationBreakDown = (cardsData: Record<string, any>) => {
    const storageCount = {
        hasDismissedOrPostponed: false,
        total: 0,
        critical: 0,
        warning: 0,
        optimized: 0,
        notOptimized: 0,
        percent: 0
    };

    Object.values(cardsData).forEach((cardItem: any) => {
        if (cardItem?.category !== 'storage') return;

        const { isDismissed, isOptimized, isCritical, isWarning } = processStorageCardItem(cardItem);

        if (isDismissed) storageCount.hasDismissedOrPostponed = true;

        if (isOptimized) {
            storageCount.optimized++;
        } else {
            storageCount.notOptimized++;
            if (isCritical) storageCount.critical++;
            else if (isWarning) storageCount.warning++;
        }
    });

    storageCount.total = storageCount.optimized + storageCount.notOptimized;
    storageCount.percent =
        storageCount.optimized && storageCount.total > 0
            ? formatNumberWithCustomComma((storageCount.optimized / storageCount.total) * 100)
            : 0;

    return {
        storage: storageCount,
        total: { ...storageCount } // Same as storage for Oracle
    };
};

// Helper function to format timestamp
const formatTimestamp = (timestamp: any): any => {
    if (!timestamp) return timestamp;
    return timestamp && isNaN(Date.parse(timestamp)) ? formatDateWithTime(timestamp) : timestamp;
};

// Optimized main function to format Oracle Well Architected data
export const formatOracleWellArchitectedData = (dispatch: any, data?: AssessmentResponseInterface) => {
    const state = store.getState();
    const optimizingData = state.getWellOptimize.optimizingData || {};
    const assessmentData = data || state.getWellOptimize.driftAssessmentData;

    if (!assessmentData) return;

    // Process data and get formatted results
    const { cardsData, formatOntapConfigList } = getCardsData(assessmentData, optimizingData);
    const optBreakDown = formatOptimizationBreakDown(cardsData);

    // Batch dispatch all data to store
    const dispatchActions = [
        () => dispatch(setCardData(cardsData)),
        () => dispatch(setOntapConfigTableData(formatOntapConfigList)),
        () => dispatch(setOptimizationBreakDown(optBreakDown)),
        () => dispatch(setGwTimestamp(formatTimestamp(assessmentData?.lastAssessmentTimestamp))),
        () => dispatch(setGwRefreshTimestamp(getCurrentDateTime()))
    ];

    dispatchActions.forEach(action => action());
};

// filters card data based on filter tags
export const oracleApplyFilter = (cardData: any, optimizeFilterTags: any) => {
    const filteredCardData: any = {};
    let configCount = 0;
    const filters = groupByType(optimizeFilterTags, 'value');

    const categoryData: any = {
        redologs_temp_placement: { category: 'Storage', subCategory: 'Storage layout' },
        archive_placement: { category: 'Storage', subCategory: 'Storage layout' },
        datafiles_controlfiles_placement: { category: 'Storage', subCategory: 'Storage layout' },
        oracle_binary_placement: { category: 'Storage', subCategory: 'Storage layout' },
        ontap_configuration: { category: 'Storage', subCategory: 'Storage configuration' }
    };

    Object.keys(cardData)?.forEach((key: any) => {
        if (key === 'deploymentType') {
            return; // Skip deploymentType as it is not a card
        }

        const checkCategory =
            !filters['all-catagories'] || filters['all-catagories']?.includes(categoryData[key]?.category);
        const checkSubCategory =
            !filters['sub-catagories'] || filters['sub-catagories']?.includes(categoryData[key]?.subCategory);

        const isOptmized = isOptimized(cardData[key].block_two.value, cardData[key].dismissedObj?.configState);
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

        let resourceType = cardData[key].block_five.value;
        if (
            key === 'ontap_configuration' &&
            filters.resourceType &&
            (filters.resourceType.includes('Volume') || filters.resourceType.includes('LUN path'))
        ) {
            resourceType = filters.resourceType[0];
        } else if (
            key === 'os_configuration' &&
            filters.resourceType &&
            (filters.resourceType.includes('Drive') || filters.resourceType.includes('Storage multipath'))
        ) {
            resourceType = filters.resourceType[0];
        }
        const checkResourceType = !filters.resourceType || filters.resourceType?.includes(resourceType);

        if (
            checkCategory &&
            checkSubCategory &&
            checkStatus &&
            checkSeverity &&
            checkTags &&
            checkConfigState &&
            checkResourceType
        ) {
            filteredCardData[key] = cardData[key];
            if (categoryData[key] && cardData[key].block_two.value) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};
