import store from '../../../../store/store';
import {
    setCardData,
    setGwRefreshTimestamp,
    setGwTimestamp,
    setOntapConfigTableData,
    setOptimizationBreakDown,
    setOsConfigTableData
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

// Factory function for creating base block structure
const createBaseBlocks = () => ({
    block_two: { type: 'Status', value: '' },
    block_four: { type: 'Severity', value: '' },
    block_five: { type: 'Resource type', value: 'Volume' },
    tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization']
});

// Factory function for creating storage layout cards
const createStorageLayoutCard = (
    id: string,
    configName: string,
    title: string,
    description: string,
    blockSixType: string,
    smallFont: boolean = false
) => ({
    id,
    mapName: configName,
    category: 'storage',
    block_one: {
        value: configName,
        type: 'Storage layout'
    },
    ...createBaseBlocks(),
    block_six: {
        type: blockSixType,
        value: '',
        ...(smallFont && { smallFont: true })
    },
    recommendation: {
        title,
        description
    }
});

// Card configuration interface
interface CardConfig {
    id: string;
    configName: string;
    title: string;
    description: string;
    smallFont?: boolean;
}

// Configuration data for all storage layout cards
const cardConfigurations: Record<string, CardConfig> = {
    redologs_placement: {
        id: 'redologs-placement',
        configName: ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
        title: 'Redo Logs Placement Recommendation',
        description:
            "Placing redo logs, whether multiplexed or not, on a dedicated volume or shared with temp/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed redo log copy should reside on a separate volume for redundancy. Frequent changes make redo logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Redo logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storage's slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.",
        smallFont: true
    },
    templogs_placement: {
        id: 'templogs-placement',
        configName: ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
        title: 'Temp Placement Recommendation',
        description:
            "Placing temp files on a dedicated volume or with redo/control files isolates their high-write I/O from data files, improving performance. Temp tablespaces change frequently but don't require restoration, so it's best to avoid placing them on snapshotted volumes, such as data volumes, to prevent bloated snapshots. Temp files must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates can degrade database performance.",
        smallFont: true
    },
    archive_placement: {
        id: 'archive-placement',
        configName: ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
        title: 'Archive Placement Recommendation',
        description:
            'Placing archive logs on a dedicated volume ensures efficient backup and recovery processes and helps reduce storage cost.\nBy separating archive logs, you can apply specific storage configurations, such as compression and tiering policies, to optimize cost and performance.\nThis separation also facilitates efficient snapshot and backup strategies, ensuring that archive logs are readily available for recovery without impacting\nthe performance of redo logs, data files, or control files.',
        smallFont: true
    },
    datafiles_placement: {
        id: 'datafiles-placement',
        configName: ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
        title: 'Data Files Placement Recommendation',
        description:
            'Placing data files on a dedicated volume or shared with control files boosts performance by isolating their random I/O from redo or archive log writes, reducing contention. This separation allows you to benefit from customized snapshot configurations, tiering policies, and efficiency mechanisms to optimize performance and cost.'
    },
    controlfiles_placement: {
        id: 'controlfiles-placement',
        configName: ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
        title: 'Control Files Placement Recommendation',
        description:
            'Oracle strongly recommends multiplexing control files to avoid a single point of failure in production environments. Maintain at least two, preferably three, control file copies across separate volumes or disks to enhance redundancy and reduce the risk of losing all copies. Control files can be placed on a dedicated volume or shared with redo logs or data files, but avoid placing them on volumes tiered to object storage, such as archive volumes, as its slower access pattern is incompatible with control file performance needs.'
    },
    oracle_binary_placement: {
        id: 'oracle-binary-placement',
        configName: ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
        title: 'Oracle Binary Placement Recommendation',
        description:
            'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files.\nThis separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.'
    }
};

// Generate oracle card data dynamically
const generateStorageLayoutCards = () => {
    const cards: any = {};

    Object.entries(cardConfigurations).forEach(([key, config]) => {
        cards[key] = createStorageLayoutCard(
            config.id,
            config.configName,
            config.title,
            config.description,
            'Impacted volumes',
            config.smallFont || false
        );
    });

    return cards;
};

export const oracleCardData: any = {
    ...generateStorageLayoutCards(),
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
    },
    os_configuration: {
        category: 'storage',
        mapName: ASSESSMENT_CONFIG_NAMES.OS,
        block_one: {
            value: 'Operating system',
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

        tags: ['Reliability', 'Operational excellence', 'Performance efficiency', 'Security']
    }
};

// Helper functions for card formatting
const formatValue = (value: string): string => GETWELL_VALUES?.[value] || value;

const isPlacementConfig = (itemName: string): boolean =>
    [
        'redologs_placement',
        'templogs_placement',
        'archive_placement',
        'datafiles_placement',
        'controlfiles_placement',
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
const processStorageConfigItem = (
    item: PerConfigInterface,
    optimizingData: Record<string, string>,
    type: 'volume' | 'lun' | 'os'
) => {
    let name = item?.name;
    if (item?.name === 'snapshot-policy') {
        name = 'snapshot-policy-vol';
    }
    const status = optimizingData?.[item?.name || ''] || item?.status || '';
    return {
        ...item,
        id: item?.name,
        type,
        name: GETWELL_CONFIG?.[name || ''] || name,
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
            const processedItem = processStorageConfigItem(item, optimizingData, index === 0 ? 'volume' : 'lun');
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

// Optimized function to format OS configuration data
export const formatOSConfig = (data: AssessmentResponseInterface, optimizingData: Record<string, string>) => {
    const osList = data?.storage?.configuration?.os;

    if (!osList?.length || osList[0]?.errorMessage) {
        return {
            formatOSConfigList: [],
            osTagsList: [],
            osOptimizedConfig: 0,
            osNotOptimizedConfig: 0,
            highestOsSeverity: 'None'
        };
    }

    const formatOsConfigList: PerConfigInterface[] = [];
    const allTags: string[] = [];
    let osOptimizedConfig = 0;
    let osNotOptimizedConfig = 0;
    let hasCritical = false;
    let hasWarning = false;

    osList?.forEach((item: PerConfigInterface) => {
        const processedItem = processStorageConfigItem(item, optimizingData, 'os');
        formatOsConfigList.push(processedItem);

        // Count optimized vs not optimized
        if (processedItem.originalStatus === 'optimized') {
            osOptimizedConfig++;
        } else {
            osNotOptimizedConfig++;
        }

        // Track severities
        if (item?.severity === 'critical') hasCritical = true;
        if (item?.severity === 'warning') hasWarning = true;

        // Collect tags
        if (item?.tags) allTags.push(...item.tags);
    });

    return {
        formatOsConfigList,
        osTagsList: allTags,
        osOptimizedConfig,
        osNotOptimizedConfig,
        highestOsSeverity: getHighestSeverity(hasCritical, hasWarning)
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

// Helper function to create ONTAP configuration block
const createOsConfigurationBlock = (
    osOptimizedConfig: number,
    osNotOptimizedConfig: number,
    highestOsSeverity: string,
    osTagsList: string[]
) => {
    const totalConfigs = osOptimizedConfig + osNotOptimizedConfig;
    const hasConfigs = totalConfigs > 0;

    return {
        ...oracleCardData?.os_configuration,
        block_two: {
            ...oracleCardData?.os_configuration?.block_two,
            value: hasConfigs ? (osNotOptimizedConfig > 0 ? 'Not optimized' : 'Optimized') : ''
        },
        block_three: {
            ...oracleCardData?.os_configuration?.block_three,
            value:
                osNotOptimizedConfig !== 0
                    ? `${formatNumberWithCustomComma((osNotOptimizedConfig / totalConfigs) * 100)}%`
                    : '0%'
        },
        block_four: {
            ...oracleCardData?.os_configuration?.block_four,
            value: highestOsSeverity
        },
        block_five: {
            ...oracleCardData?.os_configuration?.block_five,
            value: `${osNotOptimizedConfig} out of ${totalConfigs}`,
            count: {
                totalObjectsAssessed: totalConfigs,
                totalObjectsInViolation: osNotOptimizedConfig
            }
        },
        tags: [...new Set(osTagsList)], // Remove duplicates
        category: 'storage'
    };
};

// Optimized function to get cards data
export const getOracleCardsData = (data: AssessmentResponseInterface, optimizingData: Record<string, string>) => {
    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData);

    const { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity } =
        formatOSConfig(data, optimizingData);

    const cardsData = {
        ...formatIndividualCardMainConfig(data, optimizingData),
        deploymentType: data?.deploymentType || '',
        ontap_configuration: createOntapConfigurationBlock(
            ontapOptimizedConfig,
            ontapNotOptimizedConfig,
            highestOntapSeverity,
            ontapTagsList
        ),
        os_configuration: createOsConfigurationBlock(
            osOptimizedConfig,
            osNotOptimizedConfig,
            highestOsSeverity,
            osTagsList
        )
    };

    return { cardsData, formatOntapConfigList, formatOsConfigList };
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
export const formatOracleOptimizationBreakDown = (cardsData: Record<string, any>) => {
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
    const { cardsData, formatOntapConfigList, formatOsConfigList } = getOracleCardsData(assessmentData, optimizingData);
    const optBreakDown = formatOracleOptimizationBreakDown(cardsData);

    // Batch dispatch all data to store
    const dispatchActions = [
        () => dispatch(setCardData(cardsData)),
        () => dispatch(setOntapConfigTableData(formatOntapConfigList)),
        () => dispatch(setOsConfigTableData(formatOsConfigList)),
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
        redologs_placement: { category: 'Storage', subCategory: 'Storage layout' },
        templogs_placement: { category: 'Storage', subCategory: 'Storage layout' },
        archive_placement: { category: 'Storage', subCategory: 'Storage layout' },
        datafiles_placement: { category: 'Storage', subCategory: 'Storage layout' },
        controlfiles_placement: { category: 'Storage', subCategory: 'Storage layout' },
        oracle_binary_placement: { category: 'Storage', subCategory: 'Storage layout' },
        ontap_configuration: { category: 'Storage', subCategory: 'Storage configuration' },
        os_configuration: { category: 'Storage', subCategory: 'Storage configuration' }
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
            (filters.resourceType.includes('EC2 instance') ||
                filters.resourceType.includes('Volume') ||
                filters.resourceType.includes('Database'))
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
