import store from '../../../../store/store';
import {
    setCardData,
    setDriftAssessmentData,
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
import { shouldShowOntapOsCard } from '../../../GetWell/GetWellUtils';

// Helper function to get individual configuration dismiss state (similar to MSSQL version)
const getIndividualConfigDismissState = (
    configName: string,
    type: 'volume' | 'lun' | 'os',
    dismissedConfigurations: any
): any => {
    let dismissedConfigs: any[] = [];

    if (type === 'volume' || type === 'lun') {
        dismissedConfigs =
            dismissedConfigurations?.storage?.configuration?.[type === 'volume' ? 'volumes' : 'luns'] || [];
    } else if (type === 'os') {
        dismissedConfigs = dismissedConfigurations?.storage?.configuration?.os || [];
    }

    const dismissedConfig = dismissedConfigs.find((config: any) => config.configurationName === configName);

    if (dismissedConfig) {
        return {
            configState: dismissedConfig.configState,
            startTime: dismissedConfig.startTime,
            endTime: dismissedConfig.endTime
        };
    }

    return null;
};

// Factory function for creating base block structure
const createBaseBlocks = (tags: Array<string>, resourceType: string) => ({
    block_two: { type: 'Status', value: '' },
    block_four: { type: 'Severity', value: '' },
    block_five: { type: 'Resource type', value: resourceType },
    tags
});

// Factory function for creating storage layout cards
const createStorageLayoutCard = (
    id: string,
    configName: string,
    title: string,
    description: string,
    tags: Array<string>,
    resourceType: string,
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
    ...createBaseBlocks(tags, resourceType),
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
    resourceImpact: string;
    resourceType: string;
    tags: Array<string>;
    description: string;
    smallFont?: boolean;
}

// Configuration data for all storage layout cards
const cardConfigurations: Record<string, CardConfig> = {
    redologs_placement: {
        id: 'redologs-placement',
        configName: ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
        title: 'Redo Logs Placement Recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            "Placing redo logs, whether multiplexed or not, on a dedicated volume or shared with temp/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed redo log copy should reside on a separate volume for redundancy. Frequent changes make redo logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Redo logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storage's slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.",
        smallFont: true
    },
    templogs_placement: {
        id: 'templogs-placement',
        configName: ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
        title: 'Temp Placement Recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            "Placing temp files on a dedicated volume or with redo/control files isolates their high-write I/O from data files, improving performance. Temp tablespaces change frequently but don't require restoration, so it's best to avoid placing them on snapshotted volumes, such as data volumes, to prevent bloated snapshots. Temp files must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates can degrade database performance.",
        smallFont: true
    },
    archive_placement: {
        id: 'archive-placement',
        configName: ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
        title: 'Archive Placement Recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Placing archive logs on a dedicated volume ensures efficient backup and recovery processes and helps reduce storage cost.\nBy separating archive logs, you can apply specific storage configurations, such as compression and tiering policies, to optimize cost and performance.\nThis separation also facilitates efficient snapshot and backup strategies, ensuring that archive logs are readily available for recovery without impacting\nthe performance of redo logs, data files, or control files.',
        smallFont: true
    },
    datafiles_placement: {
        id: 'datafiles-placement',
        configName: ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
        title: 'Data Files Placement Recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Placing data files on a dedicated volume or shared with control files boosts performance by isolating their random I/O from redo or archive log writes, reducing contention. This separation allows you to benefit from customized snapshot configurations, tiering policies, and efficiency mechanisms to optimize performance and cost.'
    },
    controlfiles_placement: {
        id: 'controlfiles-placement',
        configName: ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
        title: 'Control Files Placement Recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Oracle strongly recommends multiplexing control files to avoid a single point of failure in production environments. Maintain at least two, preferably three, control file copies across separate volumes or disks to enhance redundancy and reduce the risk of losing all copies. Control files can be placed on a dedicated volume or shared with redo logs or data files, but avoid placing them on volumes tiered to object storage, such as archive volumes, as its slower access pattern is incompatible with control file performance needs.'
    },
    oracle_binary_placement: {
        id: 'oracle-binary-placement',
        configName: ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
        title: 'Oracle Binary Placement Recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files.\nThis separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.'
    },
    data_dg_lun_layout: {
        id: 'data-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT,
        title: 'ASM Data Disk Group LUNs layout recommendation',
        resourceImpact: 'Impacted disk groups',
        resourceType: 'Disk group',
        tags: ['Performance efficiency', 'Operational excellence'],
        description:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.\nIt is recommended that ASM Disk Group that contains data files will consist of at least 4-8 LUNs.'
    },
    log_dg_lun_layout: {
        id: 'redolog-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT,
        title: 'ASM Logs Disk Group LUNs layout recommendation',
        resourceImpact: 'Impacted disk groups',
        resourceType: 'Disk group',
        tags: ['Performance efficiency', 'Operational excellence'],
        description:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.\nIt is recommended that ASM Disk Group that contains redo logs will consist of at least 2-8 LUNs.'
    },
    fra_dg_lun_layout: {
        id: 'fra-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT,
        title: 'ASM FRA Disk Group LUNs layout recommendation',
        resourceImpact: 'Impacted disk groups',
        resourceType: 'Disk group',
        tags: ['Performance efficiency', 'Operational excellence'],
        description:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.\nIt is recommended that ASM Disk Group for archive logs will consist of at least 2-8 LUNs.'
    },
    archivelog_dg_lun_layout: {
        id: 'archivelog-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT,
        title: 'ASM Archive Disk Group LUNs layout recommendation',
        resourceImpact: 'Impacted disk groups',
        resourceType: 'Disk group',
        tags: ['Performance efficiency', 'Operational excellence'],
        description:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.\nIt is recommended that ASM Disk Group for archive logs will consist of at least 2-8 LUNs.'
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
            config.tags,
            config.resourceType,
            config.resourceImpact,
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
    },
    isASMManaged: false,
    isStorageLayoutFra: false
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
        'oracle_binary_placement',
        'data_dg_lun_layout',
        'log_dg_lun_layout',
        'fra_dg_lun_layout',
        'archivelog_dg_lun_layout'
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
    type: 'volume' | 'lun' | 'os',
    dismissedConfigurations?: any
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
        originalStatus: status,
        dismissedObj: getIndividualConfigDismissState(item?.name || '', type, dismissedConfigurations)
    };
};

// Optimized function to format ONTAP configuration data
export const formatOntapConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>,
    showDismissedView: boolean = false
) => {
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
            const processedItem = processStorageConfigItem(
                item,
                optimizingData,
                index === 0 ? 'volume' : 'lun',
                data?.dismissedConfigurations
            );
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
export const formatOSConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>,
    showDismissedView: boolean = false
) => {
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
        const processedItem = processStorageConfigItem(item, optimizingData, 'os', data?.dismissedConfigurations);
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
export const getOracleCardsData = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>,
    showDismissedView: boolean = false
) => {
    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData, showDismissedView);

    const { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity } =
        formatOSConfig(data, optimizingData, showDismissedView);

    const isFraCheck = data?.storage?.layout?.some((item: any) => item?.name === 'fra-dg-lun-layout') || false;

    const cardsData = {
        ...formatIndividualCardMainConfig(data, optimizingData),
        isASMManaged: data?.isASMManaged || false,
        isStorageLayoutFra: isFraCheck,
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

    Object.values(cardsData).forEach((cardItem: any) => {
        if (cardItem === 'isASMManaged' || cardItem === 'deploymentType' || cardItem === 'isStorageLayoutFra') {
            return; // Skip isASMManaged, deploymentType and isStorageLayoutFra as they are not cards
        }
        if (cardItem?.category !== 'storage') return;

        if (
            !cardsData?.isASMManaged &&
            (cardItem?.id === 'data-dg-lun-layout' ||
                cardItem?.id === 'redolog-dg-lun-layout' ||
                cardItem?.id === 'fra-dg-lun-layout' ||
                cardItem?.id === 'archivelog-dg-lun-layout')
        ) {
            return;
        }

        if (!cardsData?.isStorageLayoutFra && cardItem?.id === 'fra-dg-lun-layout') {
            return;
        }

        if (cardsData?.isStorageLayoutFra && cardItem?.id === 'archivelog-dg-lun-layout') {
            return;
        }

        const { isDismissed, isPostponed, isOptimizedViaDismissal, isOptimized, isCritical, isWarning } =
            processStorageCardItem(cardItem);

        if (isDismissed || isPostponed) {
            storageCount.dismissedOrPostponed++;
            storageCount.hasDismissedOrPostponed = true;
            // Use proper display names for parent cards
            if (cardItem?.id === 'ontap_configuration') {
                storageCount.dismissedIds.push(ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS);
            } else if (cardItem?.id === 'os_configuration') {
                storageCount.dismissedIds.push(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM);
            } else {
                storageCount.dismissedIds.push(cardItem?.mapName || cardItem?.id);
            }
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
    });

    // Count sub-configurations from assessment data
    if (assessmentData?.dismissedConfigurations) {
        const dismissedConfigs = assessmentData.dismissedConfigurations;

        // Handle ONTAP sub-configurations (Storage category)
        const ontapSubConfigs = [
            ...(dismissedConfigs.storage?.configuration?.volumes || []),
            ...(dismissedConfigs.storage?.configuration?.luns || [])
        ];

        const ontapCardDismissed =
            cardsData?.ontap_configuration?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            cardsData?.ontap_configuration?.dismissedObj?.configState === CONFIG_STATES.POSTPONED;

        if (ontapCardDismissed) {
            // Bulk dismissal - parent card name is already added in the main loop above
            // Don't add individual sub-config names
        } else {
            // Individual sub-config dismissals - add individual names
            ontapSubConfigs.forEach((config: any) => {
                if (config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED) {
                    storageCount.dismissedOrPostponed++;
                    storageCount.hasDismissedOrPostponed = true;
                    storageCount.dismissedIds.push(config.configurationName);
                }
            });
        }

        // Handle OS sub-configurations (Storage category)
        const osSubConfigs = dismissedConfigs.storage?.configuration?.os || [];

        const osCardDismissed =
            cardsData?.os_configuration?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            cardsData?.os_configuration?.dismissedObj?.configState === CONFIG_STATES.POSTPONED;

        if (osCardDismissed) {
            // Bulk dismissal - parent card name is already added in the main loop above
            // Don't add individual sub-config names
        } else {
            // Individual sub-config dismissals - add individual names
            osSubConfigs.forEach((config: any) => {
                if (config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED) {
                    storageCount.dismissedOrPostponed++;
                    storageCount.hasDismissedOrPostponed = true;
                    storageCount.dismissedIds.push(config.configurationName);
                }
            });
        }
    }

    storageCount.total = storageCount.optimized + storageCount.notOptimized;
    storageCount.percent =
        storageCount.optimized && storageCount.total > 0
            ? formatNumberWithCustomComma((storageCount.optimized / storageCount.total) * 100)
            : 0;

    return {
        storage: storageCount,
        total: {
            ...storageCount,
            dismissedOrPostponed: storageCount.dismissedOrPostponed,
            dismissedIds: storageCount.dismissedIds
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
    showDismissedView: boolean = false
) => {
    const state = store.getState();
    const optimizingData = state.getWellOptimize.optimizingData || {};
    const assessmentData = data || state.getWellOptimize.driftAssessmentData;

    if (!assessmentData) return;

    // Process data and get formatted results
    const { cardsData, formatOntapConfigList, formatOsConfigList } = getOracleCardsData(
        assessmentData,
        optimizingData,
        showDismissedView
    );
    const optBreakDown = formatOracleOptimizationBreakDown(cardsData, assessmentData);

    // Batch dispatch all data to store
    const dispatchActions = [
        () => dispatch(setCardData(cardsData)),
        () => dispatch(setOntapConfigTableData(formatOntapConfigList)),
        () => dispatch(setOsConfigTableData(formatOsConfigList)),
        () => dispatch(setOptimizationBreakDown(optBreakDown)),
        () => dispatch(setGwTimestamp(formatTimestamp(assessmentData?.lastAssessmentTimestamp))),
        () => dispatch(setGwRefreshTimestamp(getCurrentDateTime())),
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

    const categoryData = getOracleCategoryData();

    Object.keys(cardData)?.forEach((key: any) => {
        if (key === 'deploymentType' || key === 'isASMManaged' || key === 'isStorageLayoutFra') {
            return; // Skip deploymentType, isASMManaged and isStorageLayoutFra as they are not cards
        }

        const categoryInfo = categoryData[key as keyof typeof categoryData];
        const checkCategory = !filters['all-catagories'] || filters['all-catagories']?.includes(categoryInfo?.category);
        const checkSubCategory =
            !filters['sub-catagories'] || filters['sub-catagories']?.includes(categoryInfo?.subCategory);

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

        const resourceType = cardData[key].block_five.value;
        let checkResourceType: boolean;
        if ((key === 'ontap_configuration' || key === 'os_configuration') && filters.resourceType) {
            checkResourceType = false;
        } else {
            checkResourceType = !filters.resourceType || filters.resourceType?.includes(resourceType);
        }

        // Handle dismissed configuration toggle filtering
        const configState = cardData[key].dismissedObj?.configState;
        let checkDismissedFilter = true;

        if (showDismissedConfigurations !== undefined) {
            // Special handling for ONTAP and OS configurations with subcategory logic
            if (key === 'ontap_configuration' || key === 'os_configuration') {
                checkDismissedFilter = shouldShowOntapOsCard(
                    key as 'ontap_configuration' | 'os_configuration',
                    driftAssessmentData,
                    showDismissedConfigurations
                );
            } else {
                // Standard logic for other Oracle configurations
                if (showDismissedConfigurations) {
                    // Show only dismissed and postponed configurations
                    checkDismissedFilter =
                        configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED;
                } else {
                    // Show only active configurations (excluding dismissed and postponed)
                    checkDismissedFilter =
                        !configState ||
                        configState === CONFIG_STATES.ACTIVE ||
                        configState === CONFIG_STATES.ACTIVATING;
                }
            }
        }

        if (
            checkCategory &&
            checkSubCategory &&
            checkStatus &&
            checkSeverity &&
            checkTags &&
            checkConfigState &&
            checkResourceType &&
            checkDismissedFilter
        ) {
            filteredCardData[key] = cardData[key];
            const categoryInfo = categoryData[key as keyof typeof categoryData];
            if (
                categoryInfo &&
                (cardData[key].block_two.value || key === 'ontap_configuration' || key === 'os_configuration')
            ) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};

// Oracle-specific category data mapping
export const getOracleCategoryData = () => ({
    // Storage Layout cards
    oracle_binary_placement: { category: 'Storage', subCategory: 'Storage layout' },
    datafiles_placement: { category: 'Storage', subCategory: 'Storage layout' },
    controlfiles_placement: { category: 'Storage', subCategory: 'Storage layout' },
    redologs_placement: { category: 'Storage', subCategory: 'Storage layout' },
    templogs_placement: { category: 'Storage', subCategory: 'Storage layout' },
    archive_placement: { category: 'Storage', subCategory: 'Storage layout' },
    // ASM LUN Layout cards (Storage Layout)
    data_dg_lun_layout: { category: 'Storage', subCategory: 'Storage layout' },
    log_dg_lun_layout: { category: 'Storage', subCategory: 'Storage layout' },
    fra_dg_lun_layout: { category: 'Storage', subCategory: 'Storage layout' },
    archivelog_dg_lun_layout: { category: 'Storage', subCategory: 'Storage layout' },
    // Storage Configuration cards
    ontap_configuration: { category: 'Storage', subCategory: 'Storage configuration' },
    os_configuration: { category: 'Storage', subCategory: 'Storage configuration' }
});

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
    const categoryData = getOracleCategoryData();
    const availableCategories = new Set();
    const availableSubCategories = new Set();
    const availableSeverities = new Set();
    const availableTags = new Set();
    const availableResourceTypes = new Set();
    const availableStatuses = new Set();

    Object.keys(cardData).forEach((key: any) => {
        // Skip non-card keys
        if (['deploymentType', 'isASMManaged', 'isStorageLayoutFra'].includes(key)) {
            return;
        }

        const config = cardData[key];
        const categoryInfo = categoryData[key as keyof typeof categoryData];

        // Only process cards that have actual assessment data (block_two.value exists)
        if (!config?.block_two?.value) {
            return;
        }

        if (categoryInfo) {
            availableCategories.add(categoryInfo.category);
            availableSubCategories.add(categoryInfo.subCategory);
        }

        // Add severity if available
        if (config.block_four?.value) {
            availableSeverities.add(config.block_four.value);
        }

        // Add tags if available
        if (config.tags) {
            config.tags.forEach((tag: string) => availableTags.add(tag));
        }

        // Add resource type if available
        if (config.block_five?.value) {
            if (
                config?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS &&
                config?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
            ) {
                availableResourceTypes.add(config.block_five.value);
            }
        }

        // Add status based on optimization state
        const isOptimizedStatus = isOracleConfigOptimized(config.block_two?.value, config.dismissedObj?.configState);
        availableStatuses.add(isOptimizedStatus ? GETWELL_STATUS.OPTIMIZED : GETWELL_STATUS.NOT_OPTIMIZED);
    });

    return {
        categories: Array.from(availableCategories).map(category => ({
            id: category as string,
            label: category as string,
            value: category as string
        })),
        subCategories: Array.from(availableSubCategories).map(subCategory => ({
            id: subCategory as string,
            label: subCategory as string,
            value: subCategory as string,
            category: getOracleCategoryForSubCategory(subCategory as string)
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

// Helper function to get category for a subcategory (Oracle version)
const getOracleCategoryForSubCategory = (subCategory: string) => {
    const categoryData = getOracleCategoryData();
    const entry = Object.values(categoryData).find((item: any) => item.subCategory === subCategory);
    return entry ? entry.category : '';
};
