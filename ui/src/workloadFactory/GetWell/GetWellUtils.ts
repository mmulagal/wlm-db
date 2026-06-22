import { TFunction } from 'i18next';
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
    setGwDatabaseStorageType,
    setGwDatabaseAoagStorageType
} from '../../store/workloadFactory/getWellOptimizeSlice';
import {
    addAllMssqlHostAssessmentData,
    addAllOracleHostAssessmentData,
    setSelectedHeaderTab
} from '../../store/workloadFactory/inventoryV2Slice';
import { setInstanceDetailsData } from '../../store/workloadFactory/workloadFactoryResourceSlice';
import { GENERAL } from '../../utils/appConstants';
import {
    AOAG_NOT_SUPPORTED_CONFIGS,
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_NAME_TO_ID_MAPPING,
    CONFIG_NAMES,
    CONFIG_STATES,
    CONFIG_STATES_UI,
    CONFIG_STATE_ACTIONS,
    DATABASE_DEPLOYMENT_MODE,
    DBType,
    FINDINGS,
    GETWELL_CONFIG,
    GETWELL_STATUS,
    GETWELL_VALUES,
    INVENTORY_STATUS,
    JOB_MONITORING_STATUS,
    OPTIMIZE_POLLING_INTERVAL,
    SQL_DEPLOYMENT_MODE,
    STATUS_CONST,
    WAD_EXCLUDED_CONFIGS_MSSQL,
    WAD_EXCLUDED_CONFIGS_ORACLE,
    isConfigKeyWadExcluded,
    ORACLE_ISCSI_ONLY_API_KEYS,
    WA_FLAG_SKIP,
    WELL_ARCHITECTED_CATEGORIES,
    WELL_ARCHITECTED_CATEGORY_LABELS,
    WLF_TABS
} from '../../utils/consts';
import { groupByType, mapDismissedValues } from '../../utils/resourceUtils';
import {
    AssessmentResponseInterface,
    GwCardDataInterface,
    GwSqlServerInstanceInterface,
    PerConfigInterface,
    RSSConfigAdapterInterface
} from '../../utils/types/getWellTypes';
import {
    dashboardRedirection,
    formatDateWithTime,
    formatNumberWithCustomComma,
    getCurrentDateTime,
    sortListOfDict
} from '../../utils/utilityFunctions';
import { isOptimized } from '../DatabaseHomePage/DatabaseHomeUtils';
import {
    getConfigSeverity,
    getConfigStateList,
    getConfigStatsBucket,
    hasConfigStats,
    resolveConfigDisplayName
} from '../WellArchitectedTab/assessmentFormatUtils';
import { formatOracleWellArchitectedData } from '../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

/**
 * Checks if a configuration should be skipped for AOAG deployments.
 * Use this utility to centralize the AOAG not-supported configuration check.
 */
export const isConfigSkippedForAoag = (configName: string, deploymentType?: string): boolean => {
    if (!configName || !deploymentType) {
        return false;
    }
    const displayName = CONFIG_NAMES[configName as keyof typeof CONFIG_NAMES] || configName;
    return AOAG_NOT_SUPPORTED_CONFIGS.includes(displayName) && deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG_CAPS;
};

/**
 * Checks if the deployment type is AOAG.
 */
export const isAoagDeployment = (deploymentType?: string): boolean =>
    deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG_CAPS;

/**
 * Checks if the deployment type supports MSSQL High Availability features.
 * This includes both FCI (Failover Cluster Instance) and AOAG (Always On Availability Group).
 */
export const isMssqlHaDeployment = (deploymentType?: string): boolean =>
    deploymentType === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE_CAPS ||
    deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG_CAPS;

// Category and subcategory mapping for configurations
export const getCategoryData = () => ({
    file_system_headroom: { category: 'Storage' },
    storage_tier: { category: 'Storage' },
    transaction_log_drive_size: { category: 'Storage' },
    tempdb_drive_size: { category: 'Storage' },
    user_data_files: { category: 'Storage' },
    transaction_log_files: { category: 'Storage' },
    tempdb_files: { category: 'Storage' },
    ontap_configuration: { category: 'Storage' },
    os_configuration: { category: 'Storage' },
    compute_rightsizing: { category: 'Compute' },
    host_os_patch: { category: 'Compute' },
    transparent_hugepages: { category: 'Compute' },
    tcp_advanced_options: { category: 'Compute' },
    filesystems_io_options: { category: 'Compute' },
    multiblock_readcount: { category: 'Compute' },
    rss_config: { category: 'Compute' },
    mtu: { category: 'Compute' },
    sql_licenses: { category: 'Application' },
    microsoft_sql_patch: { category: 'Application' },
    maxdop: { category: 'Application' },
    scheduled_local_snapshot: { category: 'Resiliency' },
    scheduled_fsx_for_ontap_backups: { category: 'Resiliency' },
    crr: { category: 'Resiliency' },
    clone_management: { category: 'Cloning' },
    mssql_high_availability: { category: 'Resiliency' }
});

/**
 * Checks if a configuration is excluded for WAD (offline assessment) instances.
 * These configurations require online connectivity and are not available for WAD instances.
 * If a config is removed from WAD_EXCLUDED_CONFIGS_MSSQL or WAD_EXCLUDED_CONFIGS_ORACLE, it will be shown normally.
 *
 * @param configMapName - The configuration map name to check
 * @param isWad - Whether this is a WAD (offline assessment) instance
 * @param dbType - Optional database type (DBType.MSSQL, DBType.ORACLE). Defaults to MSSQL if not provided.
 */
export const isWadExcludedConfig = (configMapName: string | undefined, isWad: boolean, dbType?: string): boolean => {
    if (!isWad || !configMapName) return false;

    if (dbType === DBType.ORACLE) {
        return WAD_EXCLUDED_CONFIGS_ORACLE.includes(configMapName);
    }

    // Default to MSSQL for backward compatibility
    return WAD_EXCLUDED_CONFIGS_MSSQL.includes(configMapName);
};

// Generate dynamic filter options based on actual card data
export const generateDynamicFilterOptions = (cardData: any, deploymentType?: string) => {
    const availableCategories = new Set();
    const availableSeverities = new Set();
    const availableTags = new Set();
    const availableResourceTypes = new Set();
    const availableStatuses = new Set();

    Object.keys(cardData).forEach((key: any) => {
        if (WA_FLAG_SKIP.includes(key)) {
            return; // Skip deploymentType as it is not a card
        }

        // Skip MSSQL High Availability for non-HA instances (only show for FCI and AOAG)
        const isMSSQLHighAvailability = key === GETWELL_CONFIG.mssqlhighavailability;
        if (isMSSQLHighAvailability && !isMssqlHaDeployment(deploymentType)) {
            return; // Skip this card for non-HA instances
        }

        const config = cardData[key];

        // Skip configurations not supported for AOAG deployments (compare by mapName)
        if (isConfigSkippedForAoag(config?.mapName, deploymentType)) {
            return; // Skip this card for AOAG instances
        }

        if (config.category) {
            availableCategories.add(config.category);
        }

        // Add severity if available
        if (config.block_four?.value) {
            availableSeverities.add(config.block_four.value);
        }

        // Add tags if available
        if (config.tags) {
            config.tags.forEach((tag: string) => availableTags.add(tag));
        }

        // Add resource type if available but do not add for ONTAP and OS as these do not have resource type
        if (config.block_five?.value) {
            if (
                config?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS &&
                config?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
            ) {
                availableResourceTypes.add(config.block_five.value);
            }
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

// This is strutcure of cardDataDefault. It is used to set the default values for the card data.
export const cardDataDefault: any = {
    deploymentType: '',
    isWad: false,
    storage_tier: {
        id: 'performance-tier',
        mapName: ASSESSMENT_CONFIG_NAMES.STORAGE_TIER,
        category: 'storage',
        block_one: {
            type: 'Storage sizing',
            value: ASSESSMENT_CONFIG_NAMES.STORAGE_TIER
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Performance tier',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted volumes',
            value: ''
        },
        recommendation: {
            title: 'Storage tier recommendation',
            description:
                'For optimal storage performance, provision FSx for ONTAP volumes on the primary SSD tier.\nUsing the capacity pool tier may result in slower performance and higher latency.'
        },
        tags: ['Performance efficiency']
    },
    file_system_headroom: {
        id: 'headroom',
        mapName: ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'File system headroom',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'File system headroom ',
            value: ''
        },
        recommendation: {
            title: 'File system headroom recommendation',
            description:
                'To optimize storage performance, provision file system capacity as 1.35 times of total size of provisioned volume.',
            valuesHeading: 'File system headroom percentages are as follows:',
            values: ['Under-provisioned: <35%', 'Optimized: 35-50%', 'Over-provisioned: >50%']
        },
        tags: ['Performance efficiency']
    },
    transaction_log_drive_size: {
        id: 'log-drive-size',
        mapName: ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Percentage of data drive size',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted drives',
            value: ''
        },
        recommendation: {
            title: 'Log drive size recommendation',
            description:
                'Ensure accurate sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, \ndatabase unavailability, data corruption, and performance degradation caused by a full log drive.\nAn additional 20% buffer is required if the drive is hosting a primary replica of Always On Availability Group.',
            valuesHeading: 'Log drive size (relative to data drive size):',
            values: ['Under-provisioned: <20%', 'Optimized: 20-30%', 'Over-provisioned: >30%']
        },
        tags: ['Operational excellence']
    },
    tempdb_drive_size: {
        id: 'tempdb-drive-size',
        mapName: ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Percentage of data drive size',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted drives',
            value: ''
        },
        recommendation: {
            title: 'TempDB drive size recommendation',
            description:
                'Ensure accurate sizing and regular monitoring of the SQL Server TempDB to well-architect performance and maintain overall stability.\nProperly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
            valuesHeading: 'TempDB drive size (relative to data drive size):',
            values: ['Under-provisioned: <10%', 'Optimized: 10-20%', 'Over-provisioned: >20%']
        },
        tags: ['Operational excellence']
    },
    user_data_files: {
        id: 'data-files-location',
        mapName: ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
        category: 'storage',
        block_one: {
            value: 'Data files (.mdf) placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Data files',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Data files (.mdf) placement recommendation',
            description:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality. \nWe recommend separating data and log LUN paths into different volumes for smaller databases. \nThis separation is required when there is more than one large database (> 500 GiB).'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    transaction_log_files: {
        id: 'log-files-location',
        mapName: ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF,
        category: 'storage',
        block_one: {
            value: 'Log files (.ldf) placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Log files',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: 'Volumes'
        },
        block_six: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Log files (.ldf) placement recommendation',
            description:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality. \nWe recommend separating data and log LUN paths into different volumes for smaller databases. \nThis separation is required when there is more than one large database (> 500 GiB).'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    tempdb_files: {
        id: 'tempdb-files-location',
        mapName: ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'TempDB placement',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'TempDB placement recommendation',
            description:
                'Isolate TempDB I/O and avoid I/O contention from other databases by placing TempDB on its own dedicated drive.\nThis optimization improves overall SQL Server performance and stability.\nFailure to do so can result in significant I/O bottlenecks, slower query performance, and potential system instability.'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    ontap_configuration: {
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

        tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency', 'Reliability']
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
        tags: ['Performance efficiency', 'Reliability']
    },
    compute_rightsizing: {
        id: 'compute-rightsizing',
        mapName: ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
        category: 'compute',
        block_one: {
            type: 'Compute',
            value: ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Finding reasons',
            value: '',
            list: null
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Finding reasons',
            value: '',
            list: null
        },
        recommendation: {
            title: 'Compute rightsizing recommendation',
            description:
                'To ensure optimal performance and cost efficiency for your SQL Server EC2 instance, we recommend rightsizing based on your workload demands.\nIf your current instance is under-provisioned, upgrading will enhance CPU, memory, and I/O capacity.\nIf it is over-provisioned, downgrading will maintain performance while reducing costs.\nClick Fix to compare costs between your current and recommended instance types and to identify potential savings.'
        },
        tags: ['Cost optimization', 'Performance efficiency']
    },
    rss_config: {
        id: 'rss-config',
        mapName: ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
        category: 'compute',
        block_one: {
            type: 'Compute',
            value: GENERAL.RSS_CONFIGURATION
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Finding reasons',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted network adapters',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Network adapter settings recommendation',
            descriptionRssConfig: {
                first: 'Accurate configuration of receive side scaling (RSS) is essential for optimal network performance in Microsoft SQL Server \ninstances. RSS distributes network processing across multiple processors, preventing bottlenecks and enhancing system \nperformance.',
                second: 'Recommended RSS settings:',
                points: [
                    'Disable TCP Offloading Features: Ensure all TCP offloading features are disabled.',
                    'Number of Receive Queues: Set to 8 if vCPUs > 8. Set to the number of vCPUs if vCPUs ≤ 8.',
                    'RSS Profile: Set to NUMAStatic.',
                    'Base Processor Number: Set to 2.'
                ],
                last: 'Following these settings will improve the performance and reliability of your Microsoft SQL Server instances. We suggest that \nyou test the recommended settings to determine performance improvements before making changes to your production environment.'
            }
        },
        tags: ['Performance efficiency'],
        rssOptimizedRows: {},
        rssOptimizedValues: {}
    },
    mtu: {
        id: 'mtu-alignment',
        mapName: ASSESSMENT_CONFIG_NAMES.MTU,
        category: 'compute',
        block_one: {
            type: 'Compute',
            value: ASSESSMENT_CONFIG_NAMES.MTU
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'mtu-alignment',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted network interfaces',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'MTU alignment recommendation',
            description:
                'Workload Factory recommends aligning EC2 instance Maximum Transmission Unit (MTU) settings with your \nFSx for ONTAP file system to prevent network fragmentation and optimize SQL Server performance. \nFixing MTU misalignment ensures consistent MTU configuration across all nodes and network paths.'
        },
        tags: ['Performance efficiency', 'Reliability']
    },
    host_os_patch: {
        id: 'host-os-patch',
        mapName: ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
        category: 'compute',
        block_one: {
            type: 'Compute',
            value: GENERAL.OPERATING_SYSTEM_PATCH
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Missing patches',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Finding reasons',
            value: '',
            list: null,
            smallFont: true
        },
        recommendation: {
            title: 'Operating system patch recommendation',
            description:
                'Whenever possible, apply the latest patches to ensure security and stability. Applying the latest patch helps protect your SQL \nserver databases from vulnerabilities and significantly improves overall system reliability.'
        },
        tags: ['Security', 'Reliability']
    },
    sql_licenses: {
        id: 'sql-license',
        mapName: ASSESSMENT_CONFIG_NAMES.LICENSE,
        category: 'application',
        block_one: {
            type: GENERAL.APPLICATION,
            value: GENERAL.LICENSE_SQL_SERVER
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'License edition',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'License edition',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'License recommendation',
            descriptionList: [
                {
                    title: 'Not optimized: ',
                    description:
                        'The SQL Server license assessment is at the host level. A license is considered "not optimized" when \nWorkload Factory detects that any instance running on the host is not using the Enterprise license features you\'re \npaying for. An unoptimized license might result in unnecessary costs.'
                },
                {
                    title: 'Optimized: ',
                    description:
                        'A license is considered "optimized" when every instance on the host that uses an Enterprise license \nuses Enterprise features, or when the commercial software license for your databases meets your performance \nrequirements.'
                }
            ],
            info: 'The SQL Server license assessment is at the host level. If any instance running on the host is not using the Enterprise license features, the license is considered not optimized.'
        },
        tags: ['Cost optimization']
    },
    microsoft_sql_patch: {
        id: 'microsoft-sql-patch',
        mapName: ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
        category: 'application',
        block_one: {
            type: GENERAL.APPLICATION,
            value: GENERAL.MICROSOFT_SQL_PATCH
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Missing patches',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Missing patches',
            value: ''
        },
        recommendation: {
            title: 'Microsoft SQL assessment recommendation',
            description:
                'Whenever possible, apply the latest patches to ensure security and stability. Applying the latest patch helps protect \nyour SQL server databases from vulnerabilities and significantly improves overall system reliability.'
        },
        tags: ['Security', 'Reliability']
    },
    maxdop: {
        id: 'maxdop',
        mapName: ASSESSMENT_CONFIG_NAMES.MAXDOP,
        category: 'application',
        block_one: {
            type: GENERAL.APPLICATION,
            value: GENERAL.MAXDOP_PATCH
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'MAXDOP',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'MAXDOP',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'MAXDOP recommendation',
            descriptionRssConfig: {
                first: 'Set the Maximum Degree of Parallelism (MAXDOP) to optimize query performance by balancing parallel processing. \nAccurate MAXDOP configuration enhances performance and efficiency. Setting MAXDOP to 4, 8, or 16 generally \nprovides the best results in most use cases. We recommend that you test your workload and monitor for any \nparallelism-related wait types such as CXPACKET.'
            }
        },
        tags: ['Performance efficiency']
    },
    scheduled_local_snapshot: {
        id: 'snapshot-policy',
        mapName: ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
        category: 'application',
        block_one: {
            type: GENERAL.RESILIENCY,
            value: GENERAL.SCHEDULED_LOCAL_SNAPSHOT
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Snapshot policy',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted volumes',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Scheduled local snapshot recommendation',
            description:
                'Local snapshots allows you to create instantaneous capacity efficient point-in-time images of your data volumes.\nUse local snapshots as an additional backup mechanism for quick restores or for testing.'
        },
        tags: ['Reliability']
    },
    crr: {
        id: 'crr',
        mapName: ASSESSMENT_CONFIG_NAMES.CRR,
        category: 'application',
        block_one: {
            type: GENERAL.RESILIENCY,
            value: ASSESSMENT_CONFIG_NAMES.CRR
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Snapshot policy',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted volumes',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Cross-Region Replication (CRR) recommendation',
            aoagDescription:
                'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. In AOAG distributed groups, use CRR with SnapMirror replication in addition to availability group replication (automatic seeding) to ensure effective redundancy with multi-region support.',
            description:
                'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. It is recommended to configure CRR for disaster recovery and compliance requirements.'
        },
        tags: ['Reliability']
    },
    scheduled_fsx_for_ontap_backups: {
        id: 'backup-configuration',
        mapName: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
        category: 'application',
        block_one: {
            type: GENERAL.RESILIENCY,
            value: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'AWS backup policy',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted volumes',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Backup Configuration recommendation',
            description:
                'Enable FSx Backup or AWS Backup for SQL Server volumes to support data retention and compliance. \nIf using both, consider removing redundant backups manually.'
        },
        tags: ['Reliability']
    },
    mssql_high_availability: {
        id: 'mssql-high-availability',
        mapName: ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY,
        category: 'application',
        block_one: {
            type: GENERAL.RESILIENCY,
            value: GENERAL.MSSQL_HIGH_AVAILABILITY
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'High availability',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Not optimized configurations',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Microsoft SQL Server High Availability recommendation',
            description:
                'To ensure high availability and disaster recovery for your SQL Server databases, we recommend implementing a high availability solution such as Always On Availability Groups or Failover Cluster Instances. This will help minimize downtime and data loss in the event of a failure.'
        },
        tags: ['Reliability']
    },
    clone_management: {
        id: 'clone',
        mapName: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
        category: 'cloning',
        block_one: {
            type: GENERAL.CLONING,
            value: GENERAL.CLONE_MANAGEMENT
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Clone',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        block_five: {
            type: 'Resource type',
            value: ''
        },
        block_six: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: `${GENERAL.CLONE_MANAGEMENT} recommendation`,
            description:
                'Old clones can incur significant costs.\nConsider deleting or refreshing these clones to optimize your storage expenses.'
        },
        tags: ['Cost Efficiency']
    }
};

export const formatAssessmentData = (engineType: string | undefined, dispatch: any) => {
    if (engineType === DBType.ORACLE) {
        formatOracleWellArchitectedData(dispatch);
    } else {
        // Format data call for MSSQL
        formatGetWellData(dispatch);
    }
};

export const formatApplicationCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.license;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.APPLICATION;
    let itemName = item?.name || 'sql-license';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let licenseVal = '';
    const state = store.getState();
    const selectedDatabaseInstanceName = state.getWellOptimize.selectedDatabaseInstanceName || '';
    const instance = item?.sqlServerInstances?.find(
        (instance: GwSqlServerInstanceInterface) => instance?.sqlServerInstance === selectedDatabaseInstanceName
    );
    const selectedDatabaseLicense = instance?.sqlServerEdition || '';
    if (selectedDatabaseLicense.includes('Standard')) {
        licenseVal = 'Standard';
    } else if (selectedDatabaseLicense.includes('Enterprise')) {
        licenseVal = 'Enterprise';
    } else if (selectedDatabaseLicense.includes('Developer')) {
        licenseVal = 'Developer';
    } else {
        licenseVal = selectedDatabaseLicense;
    }

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: licenseVal
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: licenseVal
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'sql-license',
            category: categoryVal,
            recommendationText: item?.recommendation,
            dismissedObj: data?.dismissedConfigurations?.license
        }
    };
    return cardsData;
};

export const formatMicrosoftSqlPatchCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.mssqlPatch;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.APPLICATION;
    let itemName = item?.name || 'mssql-patch';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let totalPatches = 0;
    let criticalPatches = 0;
    let importantPatches = 0;
    data?.mssqlPatch?.missingPatchesInEc2Instances?.map(perInstance => {
        totalPatches += perInstance?.criticalMissingPatchesCount || 0;
        totalPatches += perInstance?.importantMissingPatchesCount || 0;
        criticalPatches += perInstance?.criticalMissingPatchesCount || 0;
        importantPatches += perInstance?.importantMissingPatchesCount || 0;
    });

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: String(totalPatches)
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: String(totalPatches)
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'mssql-patch',
            category: categoryVal,
            sqlPatchMissingPatches: {
                critical: criticalPatches,
                important: importantPatches
            },
            recommendationText: item?.recommendation,
            dismissedObj: data?.dismissedConfigurations?.mssqlPatch
        }
    };
    return cardsData;
};

export const formatMaxdopPatchCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.maxDOP;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.APPLICATION;
    let itemName = item?.name || 'maxdop';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: item?.current || 0
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: item?.current || 0
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'maxdop',
            category: categoryVal,
            recommendationText: item?.recommendation,
            dismissedObj: data?.dismissedConfigurations?.maxDOP
        }
    };
    return cardsData;
};

export const formatSnapshotPolicyCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.snapshotPolicy;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.RESILIENCY;
    let itemName = 'snapshot-policy';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: item?.current || 0
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: item?.current || 0,
                count: {
                    totalObjectsAssessed: item?.totalObjectsAssessed,
                    totalObjectsInViolation: item?.totalObjectsInViolation
                }
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'snapshot-policy',
            category: categoryVal,
            recommendationText: item?.recommendation || cardsData?.[itemName]?.recommendation?.description,
            objectsInViolation: item?.objectsInViolation,
            dismissedObj: data?.dismissedConfigurations?.snapshotPolicy
        }
    };
    return cardsData;
};

export const formatAWSBackUpPolicyCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.awsBackup;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.RESILIENCY;
    let itemName = item?.name || 'backup-configuration';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }

    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: item?.current || 0
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: item?.current || 0,
                count: {
                    totalObjectsAssessed: item?.totalObjectsAssessed,
                    totalObjectsInViolation: item?.totalObjectsInViolation
                }
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'backup-configuration',
            category: categoryVal,
            recommendationText: item?.recommendation || cardsData?.[itemName]?.recommendation?.description,
            objectsInViolation: item?.objectsInViolation,
            dismissedObj: data?.dismissedConfigurations?.awsBackup
        }
    };
    return cardsData;
};

export const formatCRRCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.crr;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.RESILIENCY;
    let itemName = item?.name || 'crr';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: item?.current || 0
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: item?.current || 0,
                count: {
                    totalObjectsAssessed: item?.totalObjectsAssessed,
                    totalObjectsInViolation: item?.totalObjectsInViolation
                }
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'crr',
            category: categoryVal,
            recommendationText: item?.recommendation || cardsData?.[itemName]?.recommendation?.description,
            violations: item?.violations,
            objectsInViolation: item?.objectsInViolation,
            dismissedObj: data?.dismissedConfigurations?.crr
        }
    };
    return cardsData;
};

export const formatCloneCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.clone;
    const categoryVal = 'cloning';
    let itemName = item?.name || 'clone-management';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: item?.current || 0
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: item?.current || 0,
                count: {
                    totalObjectsAssessed: item?.totalObjectsAssessed,
                    totalObjectsInViolation: item?.totalObjectsInViolation
                }
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'clone-management',
            category: categoryVal,
            recommendationText: item?.recommendation,
            cloneDetails: item?.cloneDetails,
            objectsInViolation: item?.objectsInViolation,
            dismissedObj: data?.dismissedConfigurations?.clone
        }
    };
    return cardsData;
};

export const formatOsPatchCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.hostOsPatch;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.COMPUTE;
    let itemName = item?.name || 'host-os-patch';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let totalViolations = 0;
    let criticalViolations = 0;
    let securityViolations = 0;
    let otherViolations = 0;
    data?.hostOsPatch?.ec2InstancesToPatch?.map(perInstance => {
        totalViolations += perInstance?.criticalNonCompliantCount || 0;
        totalViolations += perInstance?.securityNonCompliantCount || 0;
        totalViolations += perInstance?.otherNonCompliantCount || 0;

        criticalViolations += perInstance?.criticalNonCompliantCount || 0;
        securityViolations += perInstance?.securityNonCompliantCount || 0;
        otherViolations += perInstance?.otherNonCompliantCount || 0;
    });

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: String(totalViolations)
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: String(totalViolations)
            },
            tags: item?.tags || cardDataDefault?.[itemName]?.tags,
            id: item?.name || 'host-os-patch',
            category: categoryVal,
            errorMessage: item?.errorMessage,
            osPatchMissingPatches: {
                critical: criticalViolations,
                security: securityViolations,
                other: otherViolations
            },
            recommendationText: item?.recommendation,
            dismissedObj: data?.dismissedConfigurations?.hostOsPatch
        }
    };
    return cardsData;
};

export const formatRssConfigCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.rssConfig;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.COMPUTE;
    let itemName = item?.name || 'rss-config';
    let status = item?.status || '';
    const severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let findingReasons = 0;
    const optimizedRows: any = {
        tcpOffloading: GENERAL.FINDINGS.OPTIMIZED,
        receiveQueues: GENERAL.FINDINGS.OPTIMIZED,
        rssProfile: GENERAL.FINDINGS.OPTIMIZED,
        rssStatus: GENERAL.FINDINGS.OPTIMIZED,
        baseProcessorNumber: GENERAL.FINDINGS.OPTIMIZED
    };
    const optimizedValue: any = {
        tcpOffloading: item?.tcpOffloadState,
        receiveQueues: item?.recommendedAdapterSettings?.recommendedReceiveQueues,
        rssProfile: item?.recommendedAdapterSettings?.recommendedRssProfile,
        rssStatus: 'Enabled',
        baseProcessorNumber: item?.recommendedAdapterSettings?.recommendedBaseProcessorNumber
    };

    const totalAdapters = item?.rssAdapters?.length || 0;
    let nonOptimizedAdapters = 0;
    const notOptimizedAdapters: any = [];

    if (item?.tcpOffloadState?.toLowerCase() === 'enabled') {
        findingReasons++;
        optimizedRows.tcpOffloading = GENERAL.FINDINGS.NOT_OPTIMIZED;
        optimizedValue.tcpOffloading = 'Enabled';
    }

    item?.rssAdapters?.map((adapter: RSSConfigAdapterInterface) => {
        if (!adapter?.rssEnabled) {
            findingReasons++;
            nonOptimizedAdapters++;
            notOptimizedAdapters.push({
                ...adapter,
                rssEnabled: adapter?.rssEnabled ? 'Enabled' : 'Disabled',
                rssProfileStatus: GENERAL.FINDINGS.NOT_OPTIMIZED,
                rssEnabledStatus: GENERAL.FINDINGS.NOT_OPTIMIZED,
                baseProcessorNumberStatus: GENERAL.FINDINGS.NOT_OPTIMIZED,
                receiveQueuesStatus: GENERAL.FINDINGS.NOT_OPTIMIZED,
                tcpOffloadState: optimizedValue?.tcpOffloading,
                tcpOffloadStateStatus: optimizedRows?.tcpOffloading
            });
            optimizedRows.rssProfile = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue.rssProfile = adapter?.rssProfile;
            optimizedRows.rssStatus = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue.rssStatus = 'Disabled';
            optimizedRows.baseProcessorNumber = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue.baseProcessorNumber = adapter?.baseProcessorNumber;
            optimizedRows.receiveQueues = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue.receiveQueues = adapter?.numberOfReceiveQueues;
        } else {
            if (adapter?.rssProfile !== item?.recommendedAdapterSettings?.recommendedRssProfile) {
                findingReasons++;
                if (optimizedRows?.rssProfile === GENERAL.FINDINGS.NOT_OPTIMIZED) {
                    optimizedValue.rssProfile = GENERAL.MULTIPLE_VALUES;
                } else {
                    optimizedRows.rssProfile = GENERAL.FINDINGS.NOT_OPTIMIZED;
                    optimizedValue.rssProfile = adapter?.rssProfile;
                }
            }
            if (adapter?.baseProcessorNumber !== item?.recommendedAdapterSettings?.recommendedBaseProcessorNumber) {
                findingReasons++;
                if (optimizedRows?.baseProcessorNumber === GENERAL.FINDINGS.NOT_OPTIMIZED) {
                    optimizedValue.baseProcessorNumber = GENERAL.MULTIPLE_VALUES;
                } else {
                    optimizedRows.baseProcessorNumber = GENERAL.FINDINGS.NOT_OPTIMIZED;
                    optimizedValue.baseProcessorNumber = adapter?.baseProcessorNumber;
                }
            }
            if (adapter?.numberOfReceiveQueues !== item?.recommendedAdapterSettings?.recommendedReceiveQueues) {
                findingReasons++;
                if (optimizedRows?.receiveQueues === GENERAL.FINDINGS.NOT_OPTIMIZED) {
                    optimizedValue.receiveQueues = GENERAL.MULTIPLE_VALUES;
                } else {
                    optimizedRows.receiveQueues = GENERAL.FINDINGS.NOT_OPTIMIZED;
                    optimizedValue.receiveQueues = adapter?.numberOfReceiveQueues;
                }
            }

            if (
                adapter?.rssProfile !== item?.recommendedAdapterSettings?.recommendedRssProfile ||
                adapter?.baseProcessorNumber !== item?.recommendedAdapterSettings?.recommendedBaseProcessorNumber ||
                adapter?.numberOfReceiveQueues !== item?.recommendedAdapterSettings?.recommendedReceiveQueues
            ) {
                nonOptimizedAdapters++;
                // notOptimizedAdapters.push(adapter);
                notOptimizedAdapters.push({
                    ...adapter,
                    rssEnabled: adapter?.rssEnabled ? 'Enabled' : 'Disabled',
                    rssProfileStatus:
                        adapter?.rssProfile !== item?.recommendedAdapterSettings?.recommendedRssProfile
                            ? GENERAL.FINDINGS.NOT_OPTIMIZED
                            : GENERAL.FINDINGS.OPTIMIZED,
                    rssEnabledStatus: GENERAL.FINDINGS.OPTIMIZED,
                    baseProcessorNumberStatus:
                        adapter?.baseProcessorNumber !==
                        item?.recommendedAdapterSettings?.recommendedBaseProcessorNumber
                            ? GENERAL.FINDINGS.NOT_OPTIMIZED
                            : GENERAL.FINDINGS.OPTIMIZED,
                    receiveQueuesStatus:
                        adapter?.numberOfReceiveQueues !== item?.recommendedAdapterSettings?.recommendedReceiveQueues
                            ? GENERAL.FINDINGS.NOT_OPTIMIZED
                            : GENERAL.FINDINGS.OPTIMIZED,
                    tcpOffloadState: optimizedValue?.tcpOffloading,
                    tcpOffloadStateStatus: optimizedRows?.tcpOffloading
                });
            }
        }
    });

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: findingReasons
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: item?.resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: findingReasons,
                count: {
                    totalObjectsAssessed: item?.totalObjectsAssessed,
                    totalObjectsInViolation: item?.totalObjectsInViolation
                }
            },
            tags: item?.tags || cardDataDefault?.[itemName]?.tags,
            id: item?.name || 'rss-config',
            category: categoryVal,
            errorMessage: item?.errorMessage,
            rssAdapters: item?.rssAdapters,
            recommendedAdapterSettings: item?.recommendedAdapterSettings,
            notOptimizedAdapters,
            tcpOffloadState: item?.tcpOffloadState,
            rssOptimizedRows: optimizedRows,
            rssOptimizedValues: optimizedValue,
            recommendationText: item?.recommendation,
            dismissedObj: data?.dismissedConfigurations?.rssConfig
        }
    };
    return cardsData;
};

export const formatMTUCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    const item: any = data?.mtuAlignment;
    const categoryVal = WELL_ARCHITECTED_CATEGORIES.COMPUTE;
    let itemName = item?.name || 'mtu-alignment';
    let status = item?.status || '';
    const severity = item?.severity || '';
    const resourceType = item?.resourceType || '';

    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;
    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: item?.recommended || ''
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            block_five: {
                ...(cardDataDefault?.[itemName]?.block_five || {}),
                value: resourceType
            },
            block_six: {
                ...(cardDataDefault?.[itemName]?.block_six || {}),
                value: `${item?.totalObjectsInViolation || 0} out of ${item?.totalObjectsAssessed || 0}`,
                count: {
                    totalObjectsAssessed: item?.totalObjectsAssessed || 0,
                    totalObjectsInViolation: item?.totalObjectsInViolation || 0
                }
            },
            errorMessage: item?.errorMessage,
            tags: item?.tags,
            id: item?.name || 'mtu-alignment',
            category: categoryVal,
            recommendationText: item?.recommendation || cardDataDefault?.[itemName]?.recommendation?.description,
            objectsInViolation: item?.objectsInViolation,
            violationDetails: item?.violationDetails || [],
            ec2InterfacesToFix: item?.ec2InterfacesToFix || [],
            dismissedObj: data?.dismissedConfigurations?.mtuAlignment
        }
    };
    return cardsData;
};
// This function is used to format the data for the individual card main config.
export const formatIndividualCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string }
) => {
    let cardsData: any = cardDataDefault;
    const cardMainConfig = [data?.storage?.sizing, data?.storage?.layout];
    let computeMissingPermissions = false;
    if (data?.compute?.name === 'compute-rightsizing') {
        cardMainConfig?.push([data?.compute]);
    } else if (data?.compute?.errorMessage && data?.compute?.errorMessage.includes('is not authorized to perform: ')) {
        computeMissingPermissions = true;
        cardMainConfig?.push([
            {
                ...data?.compute,
                name: 'compute-rightsizing',
                errorMessage: data?.compute?.errorMessage
            }
        ]);
    } else {
        cardMainConfig?.push([
            {
                ...data?.compute,
                name: 'compute-rightsizing',
                errorMessage: data?.compute?.errorMessage
            }
        ]);
    }

    cardMainConfig?.map((category, index) => {
        let categoryVal = '';
        if (index === 0 || index === 1) {
            categoryVal = WELL_ARCHITECTED_CATEGORIES.STORAGE;
        } else if (index === 2) {
            categoryVal = WELL_ARCHITECTED_CATEGORIES.COMPUTE;
        }

        category?.map((item: PerConfigInterface) => {
            let itemName = item?.name || '';
            let status = item?.status || '';
            const severity = item?.severity || '';
            if (optimizingData?.[itemName] && optimizingData?.[itemName] !== '') {
                status = optimizingData?.[itemName];
            }
            itemName = GETWELL_CONFIG?.[itemName] || itemName;

            let blockThreeValue = '';
            if (categoryVal === WELL_ARCHITECTED_CATEGORIES.STORAGE) {
                blockThreeValue = GETWELL_VALUES?.[item?.current || ''] || item?.current;
            } else {
                blockThreeValue = GETWELL_VALUES?.[item?.recommended || ''] || item?.recommended;
            }

            let blockSixValue: string | undefined = '';
            let blockSixCountObject = null;
            if (
                itemName === 'storage_tier' ||
                itemName === 'transaction_log_drive_size' ||
                itemName === 'tempdb_drive_size' ||
                itemName === 'user_data_files' ||
                itemName === 'transaction_log_files' ||
                itemName === 'tempdb_files'
            ) {
                blockSixValue = `${item?.totalObjectsInViolation || 0} out of ${item?.totalObjectsAssessed || 0}`;
                blockSixCountObject = {
                    totalObjectsInViolation: item?.totalObjectsInViolation || 0,
                    totalObjectsAssessed: item?.totalObjectsAssessed || 0
                };
            } else if (itemName === 'file_system_headroom') {
                blockSixValue = GETWELL_VALUES?.[item?.current || ''] || item?.current;
            } else if (categoryVal === WELL_ARCHITECTED_CATEGORIES.STORAGE) {
                blockSixValue = GETWELL_VALUES?.[item?.current || ''] || item?.current;
            } else {
                blockSixValue = GETWELL_VALUES?.[item?.recommended || ''] || item?.recommended;
            }

            cardsData = {
                ...cardsData,
                [itemName]: {
                    ...(cardDataDefault?.[itemName] || {}),
                    block_two: {
                        ...(cardDataDefault?.[itemName]?.block_two || {}),
                        value: GETWELL_VALUES?.[status] || status
                    },
                    block_three: {
                        ...(cardDataDefault?.[itemName]?.block_three || {}),
                        value: blockThreeValue,
                        list: item?.objectsInViolation ? item?.objectsInViolation : null
                    },
                    block_four: {
                        ...(cardDataDefault?.[itemName]?.block_four || {}),
                        value: GETWELL_VALUES?.[severity] || severity
                    },
                    block_five: {
                        ...(cardDataDefault?.[itemName]?.block_five || {}),
                        value: item?.resourceType
                    },
                    block_six: {
                        ...(cardDataDefault?.[itemName]?.block_six || {}),
                        value: blockSixValue,
                        count: blockSixCountObject,
                        list: item?.objectsInViolation ? item?.objectsInViolation : null
                    },
                    errorMessage: item?.errorMessage,
                    tags: item?.tags,
                    id: item?.name,
                    category: categoryVal,
                    recommendationOptions: index === 2 ? item?.recommendationOptions || [] : null,
                    isMissingPermissions: index === 2 ? computeMissingPermissions : null,
                    missingPermissions: item?.missingPermissions,
                    recommendedSizeInGib: item?.recommendedSizeInGib,
                    sizingViolations: item?.sizingViolations,
                    violationDetails: item?.violationDetails,
                    objectsInViolation: item?.objectsInViolation,
                    recommendationText: item?.recommendation,
                    dismissedObj:
                        index === 2
                            ? data?.dismissedConfigurations?.compute
                            : mapDismissedValues(data?.dismissedConfigurations?.storage, item?.name)
                }
            };
        });
    });
    return cardsData;
};

// Helper function to get individual configuration dismiss state
const getIndividualConfigDismissState = (
    configName: string,
    type: 'volume' | 'lun' | 'os' | 'mssqlHighAvailability',
    dismissedConfigurations: any
): any => {
    let dismissedConfigs: any[] = [];

    if (type === 'mssqlHighAvailability') {
        if (!dismissedConfigurations?.highAvailability && !dismissedConfigurations?.['high-availability'])
            return undefined;
        dismissedConfigs =
            dismissedConfigurations?.highAvailability || dismissedConfigurations?.['high-availability'] || [];
    } else {
        if (!dismissedConfigurations?.storage?.configuration) return undefined;
        if (type === 'volume') {
            dismissedConfigs = dismissedConfigurations.storage.configuration.volumes || [];
        } else if (type === 'lun') {
            dismissedConfigs = dismissedConfigurations.storage.configuration.luns || [];
        } else if (type === 'os') {
            dismissedConfigs = dismissedConfigurations.storage.configuration.os || [];
        }
    }

    const technicalName = getConfigurationTechnicalName(GETWELL_CONFIG?.[configName] || configName, type);
    const dismissedConfig = dismissedConfigs.find((config: any) => config.configurationName === technicalName);

    // Only return the dismiss state if the config is actually dismissed or postponed
    if (
        dismissedConfig &&
        (dismissedConfig.configState === CONFIG_STATE_ACTIONS.DISMISS ||
            dismissedConfig.configState === CONFIG_STATE_ACTIONS.POSTPONED)
    ) {
        return dismissedConfig;
    }

    return undefined;
};

// Helper function to map display names to technical names for ONTAP/OS/Sizing configurations
export const getConfigurationTechnicalName = (displayName: string, type: string): string => {
    // Mapping from display names to technical names based on STORAGE_CONFIG_MAP
    const nameMapping: { [key: string]: string } = {
        // Volume configurations
        'Thin provisioning': 'thin-provision',
        Autosize: 'autosize',
        'Autosize-mode': 'autosize-mode',
        'Fractional reserve': 'fractional-reserve',
        'Snapshot copy reserve': 'snapshot-copy-reserve',
        'Snapshot autodelete': 'snapshot-autodelete',
        'Space management': 'space-mgmt-try-first',
        'Tiering policy': 'tiering-policy',
        'Tiering minimum cooling days': 'tiering-min-cooling-days',

        // LUN configurations
        'OS type': 'os-type',
        'Space reservation': 'space-reservation-enabled',
        'Space allocation': 'space-allocation-allocated',

        // OS configurations
        'Multipath I/O Policy': 'mpio-load-balance-policy',
        'Multipath I/O Sessions': 'mpio-iscsi-count',
        'Multipath I/O Status': 'mpio-enabled',
        'Multipath I/O Timeout': 'mpio-timeout',
        'NTFS allocation unit size': 'ntfs-allocation-unit-size',

        // MSSQL High Availability configurations
        'Shared Storage': 'shared-storage',
        'SQL Server Service': 'sqlServer-service',
        'Shared storage': 'shared-storage',
        'Drive Letter': 'drive-letter',
        'Heartbeat Settings': 'heartbeat-settings',
        'Cluster Quorum': 'cluster-quorum',

        // Storage sizing configurations
        file_system_headroom: 'headroom',
        storage_tier: 'performance-tier',
        transaction_log_drive_size: 'log-drive-size',
        tempdb_drive_size: 'tempdb-drive-size',

        // Oracle storage sizing configurations
        'Swap space': 'swap-space',

        // Storage efficiency configurations
        Compression: 'compression',
        Deduplication: 'deduplication',
        Compaction: 'compaction',
        'Snapshot policy': 'snapshot-policy',
        'NFS rootonly': 'nfs-rootonly',
        'Binaries export policy': 'export-policy',

        // OS configurations for Oracle
        'TCP slot table': 'kernel-parameters',
        'NFS mount options - database files': 'nfs-mount-options-databasefiles',
        'NFS mount options - ADR home': 'nfs-mount-options-adrhome',
        'NFS caching options': 'nfs-caching-options',
        'NFSv4 domain name': 'nfsv4-domain-name',

        // ASM configurations
        'ASM setup': 'asm-setup',
        'ASM external redundancy': 'asm-external-redundancy',
        'ASM filter driver logical block size alignment': 'afd-logical-block-size',
        'ASMLib logical block size alignment': 'asmlib-logical-block-size',

        // Oracle multipath and OS configurations
        'Multipath I/O': 'multipath-io',
        'Host utilities': 'host-utilities',
        'Transparent hugepages': 'transparent-hugepages',
        SELinux: 'selinux',
        'ISCSI replacement timeout': 'iscsi-replacement-timeout',
        'Multipath friendly names': 'multipath-friendly-names',
        'TCP advanced options': 'tcp-advanced-options',
        'Filesystem I/O options': 'filesystems-io-options',
        'Multiblock read count': 'multiblock-readcount',
        'Multipath I/O sessions': 'multipath-io-sessions',
        'Multipath config file': 'multipath-configuration',

        // Oracle placement configurations
        'Redo logs placement': 'redologs-placement',
        'Temp placement': 'templogs-placement',
        'Archive placement': 'archive-placement',
        'Data files placement': 'datafiles-placement',
        'Control files placement': 'controlfiles-placement',
        'Oracle binary placement': 'oracle-binary-placement',
        'ASM data disk group LUNs': 'data-dg-lun-layout',
        'ASM logs disk group LUNs': 'redolog-dg-lun-layout',
        'ASM FRA disk group LUNs': 'fra-dg-lun-layout',
        'ASM archive log disk group LUNs': 'archivelog-dg-lun-layout',

        // dnfs configurations
        'dNFS consistent IP resolution': 'dnfs-consistent-ip-resolution',
        'dNFS enablement': 'dnfs-enabled',
        'dNFS configuration file': 'dnfs-configuration-file',
        'dNFS no shared cache': 'dnfs-no-shared-cache'
    };

    return nameMapping[displayName] || displayName;
};

// Helper function to map technical configuration names to display names
export const getConfigurationDisplayName = (technicalName: string): string => {
    if (technicalName === 'snapshot-policy') {
        technicalName = 'snapshot-policy-vol';
    }
    // Use existing GETWELL_CONFIG mappings which already contain the technical to display name mappings
    return GETWELL_CONFIG?.[technicalName] || technicalName;
};

// Helper function to filter individual ONTAP/OS configurations based on dismissed state
export const filterIndividualOntapOsConfigurations = (
    tableData: any[],
    assessmentData: any,
    showDismissedView: boolean = false
): any[] => {
    if (!Array.isArray(tableData)) return [];

    const filteredResult = tableData.filter((item: any) => {
        if (!item || !item.name || !item.type) return true; // Keep non-ontap/os items

        // Get dismissed configurations for the subcategory
        let dismissedConfigs: any[] = [];

        if (item.type === 'volume') {
            dismissedConfigs = assessmentData?.dismissedConfigurations?.storage?.configuration?.volumes || [];
        } else if (item.type === 'lun') {
            dismissedConfigs = assessmentData?.dismissedConfigurations?.storage?.configuration?.luns || [];
        } else if (item.type === 'os') {
            dismissedConfigs = assessmentData?.dismissedConfigurations?.storage?.configuration?.os || [];
        } else {
            return true; // Keep non-ontap/os items
        }

        // Map display name to technical name for comparison
        const technicalName = getConfigurationTechnicalName(item.name, item.type);

        // Find if this specific configuration is dismissed or postponed using technical name
        const dismissedConfig = dismissedConfigs.find((config: any) => config.configurationName === technicalName);
        const isConfigDismissed = dismissedConfig?.configState === CONFIG_STATE_ACTIONS.DISMISS;
        const isConfigPostponed = dismissedConfig?.configState === CONFIG_STATE_ACTIONS.POSTPONED;
        const isConfigDismissedOrPostponed = isConfigDismissed || isConfigPostponed;

        // In dismissed view, show only dismissed or postponed configurations
        // In normal view, show only active (non-dismissed, non-postponed) configurations
        return showDismissedView ? isConfigDismissedOrPostponed : !isConfigDismissedOrPostponed;
    });

    return filteredResult;
};

// Helper function to determine if ONTAP/OS cards should be shown based on dismissal state
export const shouldShowOntapOsCard = (
    cardKey: 'ontap_configuration' | 'os_configuration',
    assessmentData: any,
    showDismissedView: boolean = false
): boolean => {
    if (!assessmentData || !assessmentData.dismissedConfigurations) return true;

    const dismissedConfig = assessmentData.dismissedConfigurations;

    if (cardKey === 'ontap_configuration') {
        // Check volumes and luns
        const volumeConfigs = assessmentData?.storage?.configuration?.volumes || [];
        const lunConfigs = assessmentData?.storage?.configuration?.luns || [];
        const dismissedVolumeConfigs = dismissedConfig?.storage?.configuration?.volumes || [];
        const dismissedLunConfigs = dismissedConfig?.storage?.configuration?.luns || [];

        const allVolumesAreDismissed =
            volumeConfigs.length > 0
                ? areAllSubcategoryConfigurationsDismissed(volumeConfigs, dismissedVolumeConfigs, 'volumes')
                : true;
        const allLunsAreDismissed =
            lunConfigs.length > 0
                ? areAllSubcategoryConfigurationsDismissed(lunConfigs, dismissedLunConfigs, 'luns')
                : true;

        // Check if there are any dismissed or postponed configurations in volumes or luns
        const hasAnyDismissedVolumes = dismissedVolumeConfigs.some(
            (c: any) => c.configState === CONFIG_STATE_ACTIONS.DISMISS
        );
        const hasAnyDismissedLuns =
            dismissedLunConfigs.length > 0
                ? dismissedLunConfigs.some((c: any) => c.configState === CONFIG_STATE_ACTIONS.DISMISS)
                : false;
        const hasAnyPostponedVolumes = dismissedVolumeConfigs.some(
            (c: any) => c.configState === CONFIG_STATE_ACTIONS.POSTPONED
        );
        const hasAnyPostponedLuns =
            dismissedLunConfigs.length > 0
                ? dismissedLunConfigs.some((c: any) => c.configState === CONFIG_STATE_ACTIONS.POSTPONED)
                : false;

        // Show ONTAP card in dismissed view if any subcategory has dismissed or postponed configurations
        // Show ONTAP card in normal view if not all subcategories are fully dismissed/postponed
        if (showDismissedView) {
            return hasAnyDismissedVolumes || hasAnyDismissedLuns || hasAnyPostponedVolumes || hasAnyPostponedLuns;
        }
        return !(allVolumesAreDismissed && allLunsAreDismissed);
    }
    if (cardKey === 'os_configuration') {
        // Check OS configurations
        const osConfigs = assessmentData?.storage?.configuration?.os || [];
        const dismissedOsConfigs = dismissedConfig?.storage?.configuration?.os || [];

        const allOsAreDismissed =
            osConfigs.length > 0 &&
            areAllSubcategoryConfigurationsDismissed(osConfigs, dismissedOsConfigs, ASSESSMENT_CONFIG_NAMES.OS);

        // Check if there are any dismissed or postponed OS configurations
        const hasAnyDismissedOs = dismissedOsConfigs.some((c: any) => c.configState === CONFIG_STATE_ACTIONS.DISMISS);
        const hasAnyPostponedOs = dismissedOsConfigs.some((c: any) => c.configState === CONFIG_STATE_ACTIONS.POSTPONED);

        // Show OS card in dismissed view if there are any dismissed or postponed OS configs
        // Show OS card in normal view if not all OS configs are dismissed/postponed
        if (showDismissedView) {
            return hasAnyDismissedOs || hasAnyPostponedOs;
        }
        return !allOsAreDismissed;
    }

    return true;
};

// Helper function to filter individual MSSQL High Availability configurations based on dismissed state
export const filterIndividualMssqlHighAvailabilityConfigurations = (
    tableData: any[],
    assessmentData: any,
    showDismissedView: boolean
): any[] => {
    if (!tableData || tableData.length === 0) return [];

    return tableData.filter((item: any) => {
        const dismissedConfig = assessmentData?.dismissedConfigurations;
        const dismissedMssqlHAConfigs =
            dismissedConfig?.highAvailability || dismissedConfig?.['high-availability'] || [];

        // Find the dismissed configuration for this specific item
        // Match by either configurationName directly or through technical name mapping
        const dismissedItemConfig = dismissedMssqlHAConfigs.find((config: any) => {
            // Try direct match with configurationName
            if (config.configurationName === item.id) return true;

            // Try matching with display name to technical name conversion
            const technicalName = getConfigurationTechnicalName(item.name || '', 'mssqlHighAvailability');
            if (config.configurationName === technicalName) return true;

            return false;
        });

        const isConfigDismissed = dismissedItemConfig?.configState === CONFIG_STATE_ACTIONS.DISMISS;
        const isConfigPostponed = dismissedItemConfig?.configState === CONFIG_STATE_ACTIONS.POSTPONED;
        const isConfigDismissedOrPostponed = isConfigDismissed || isConfigPostponed;

        // In dismissed view: show dismissed/postponed items
        // In normal view: show non-dismissed items
        return showDismissedView ? isConfigDismissedOrPostponed : !isConfigDismissedOrPostponed;
    });
};

// Helper function to determine if MSSQL High Availability cards should be shown based on dismissal state
export const shouldShowMssqlHighAvailabilityCard = (assessmentData: any, showDismissedView: boolean): boolean => {
    if (!assessmentData) return false;

    const dismissedConfig = assessmentData.dismissedConfigurations;
    if (!dismissedConfig) return true;

    const mssqlHAConfigs = assessmentData?.highAvailability || assessmentData?.['high-availability'] || [];
    const dismissedMssqlHAConfigs = dismissedConfig?.highAvailability || dismissedConfig?.['high-availability'] || [];

    // If there are no active configs but we have dismissed configs, we should show in dismissed view
    if (mssqlHAConfigs.length === 0 && dismissedMssqlHAConfigs.length === 0) return false;

    const allMssqlHAAreDismissed =
        mssqlHAConfigs.length === 0
            ? true
            : areAllSubcategoryConfigurationsDismissed(
                  mssqlHAConfigs,
                  dismissedMssqlHAConfigs,
                  'mssqlHighAvailability'
              );

    const hasAnyDismissedMssqlHA = dismissedMssqlHAConfigs.some(
        (c: any) => c.configState === CONFIG_STATE_ACTIONS.DISMISS
    );
    const hasAnyPostponedMssqlHA = dismissedMssqlHAConfigs.some(
        (c: any) => c.configState === CONFIG_STATE_ACTIONS.POSTPONED
    );

    // Show MSSQL HA card in dismissed view if there are any dismissed or postponed MSSQL HA configs
    // Show MSSQL HA card in normal view if not all MSSQL HA configs are dismissed/postponed
    if (showDismissedView) {
        return hasAnyDismissedMssqlHA || hasAnyPostponedMssqlHA;
    }
    return !allMssqlHAAreDismissed;
};

// Helper function to get the dismiss state for ONTAP/OS cards based on subcategory logic
export const getOntapOsCardDismissState = (
    cardKey: 'ontap_configuration' | 'os_configuration',
    assessmentData: any
): { configState?: string; startTime?: string; endTime?: string } | undefined => {
    if (!assessmentData || !assessmentData.dismissedConfigurations) return undefined;

    const dismissedConfig = assessmentData.dismissedConfigurations;

    if (cardKey === 'ontap_configuration') {
        // Check volumes and luns
        const volumeConfigs = assessmentData?.storage?.configuration?.volumes || [];
        const lunConfigs = assessmentData?.storage?.configuration?.luns || [];
        const dismissedVolumeConfigs = dismissedConfig?.storage?.configuration?.volumes || [];
        const dismissedLunConfigs = dismissedConfig?.storage?.configuration?.luns || [];

        const allVolumesAreDismissed =
            volumeConfigs.length > 0 &&
            areAllSubcategoryConfigurationsDismissed(volumeConfigs, dismissedVolumeConfigs, 'volumes');
        const allLunsAreDismissed =
            lunConfigs.length > 0 && areAllSubcategoryConfigurationsDismissed(lunConfigs, dismissedLunConfigs, 'luns');

        // If all subcategories are dismissed, the card should be dismissed
        if (
            (volumeConfigs.length === 0 || allVolumesAreDismissed) &&
            (lunConfigs.length === 0 || allLunsAreDismissed)
        ) {
            // Check if we have any specific dismiss state from the dismissed configurations
            const volumeDismissStates = dismissedVolumeConfigs.map((config: any) => config.configState);
            const lunDismissStates = dismissedLunConfigs.map((config: any) => config.configState);
            const allDismissStates = [...volumeDismissStates, ...lunDismissStates];

            // If we have dismiss states, use the most common one, otherwise default to DISMISSED
            if (allDismissStates.length > 0) {
                const dismissedCount = allDismissStates.filter(
                    (state: any) => state === CONFIG_STATES.DISMISSED
                ).length;
                const postponedCount = allDismissStates.filter(
                    (state: any) => state === CONFIG_STATES.POSTPONED
                ).length;

                const finalState = dismissedCount >= postponedCount ? CONFIG_STATES.DISMISSED : CONFIG_STATES.POSTPONED;

                // If the final state is postponed, get the timestamp from one of the postponed configurations
                if (finalState === CONFIG_STATES.POSTPONED) {
                    const postponedConfig = [...dismissedVolumeConfigs, ...dismissedLunConfigs].find(
                        (config: any) => config.configState === CONFIG_STATES.POSTPONED
                    );

                    return {
                        configState: finalState,
                        startTime: postponedConfig?.startTime,
                        endTime: postponedConfig?.endTime
                    };
                }

                return {
                    configState: finalState
                };
            }
        }
    } else if (cardKey === 'os_configuration') {
        // Check OS configurations
        const osConfigs = assessmentData?.storage?.configuration?.os || [];
        const dismissedOsConfigs = dismissedConfig?.storage?.configuration?.os || [];

        const allOsAreDismissed =
            osConfigs.length > 0 &&
            areAllSubcategoryConfigurationsDismissed(osConfigs, dismissedOsConfigs, ASSESSMENT_CONFIG_NAMES.OS);

        // If all OS configs are dismissed, the card should be dismissed
        if (allOsAreDismissed) {
            const osDismissStates = dismissedOsConfigs.map((config: any) => config.configState);
            if (osDismissStates.length > 0) {
                const dismissedCount = osDismissStates.filter((state: any) => state === CONFIG_STATES.DISMISSED).length;
                const postponedCount = osDismissStates.filter((state: any) => state === CONFIG_STATES.POSTPONED).length;

                const finalState = dismissedCount >= postponedCount ? CONFIG_STATES.DISMISSED : CONFIG_STATES.POSTPONED;

                // If the final state is postponed, get the timestamp from one of the postponed configurations
                if (finalState === CONFIG_STATES.POSTPONED) {
                    const postponedConfig = dismissedOsConfigs.find(
                        (config: any) => config.configState === CONFIG_STATES.POSTPONED
                    );

                    return {
                        configState: finalState,
                        startTime: postponedConfig?.startTime,
                        endTime: postponedConfig?.endTime
                    };
                }

                return {
                    configState: finalState
                };
            }
        }
    }

    return undefined;
};

// Helper function to get MSSQL High Availability card dismiss state
export const getMssqlHighAvailabilityCardDismissState = (
    assessmentData: any
): { configState?: string; startTime?: string; endTime?: string } | undefined => {
    if (!assessmentData || !assessmentData.dismissedConfigurations) return undefined;

    const dismissedConfig = assessmentData.dismissedConfigurations;
    const mssqlHAConfigs = assessmentData?.highAvailability || assessmentData?.['high-availability'] || [];
    const dismissedMssqlHAConfigs = dismissedConfig?.highAvailability || dismissedConfig?.['high-availability'] || [];

    // If there are no active configs but no dismissed configs either, return undefined
    if (mssqlHAConfigs.length === 0 && dismissedMssqlHAConfigs.length === 0) return undefined;

    const allMssqlHAAreDismissed =
        mssqlHAConfigs.length === 0
            ? true
            : areAllSubcategoryConfigurationsDismissed(
                  mssqlHAConfigs,
                  dismissedMssqlHAConfigs,
                  'mssqlHighAvailability'
              );

    // If all MSSQL HA configs are dismissed, the card should be dismissed
    if (allMssqlHAAreDismissed) {
        const mssqlHADismissStates = dismissedMssqlHAConfigs.map((config: any) => config.configState);
        if (mssqlHADismissStates.length > 0) {
            const dismissedCount = mssqlHADismissStates.filter(
                (state: any) => state === CONFIG_STATES.DISMISSED
            ).length;
            const postponedCount = mssqlHADismissStates.filter(
                (state: any) => state === CONFIG_STATES.POSTPONED
            ).length;

            const finalState = dismissedCount >= postponedCount ? CONFIG_STATES.DISMISSED : CONFIG_STATES.POSTPONED;

            // If the final state is postponed, get the timestamp from one of the postponed configurations
            if (finalState === CONFIG_STATES.POSTPONED) {
                const postponedConfig = dismissedMssqlHAConfigs.find(
                    (config: any) => config.configState === CONFIG_STATES.POSTPONED
                );

                return {
                    configState: finalState,
                    startTime: postponedConfig?.startTime,
                    endTime: postponedConfig?.endTime
                };
            }

            return {
                configState: finalState
            };
        }
    }

    return undefined;
};

// Helper function to check if all configurations in a subcategory are dismissed or postponed
export const areAllSubcategoryConfigurationsDismissed = (
    configurations: any[],
    dismissedConfigurations: any[],
    subcategory: string
): boolean => {
    if (!configurations || configurations.length === 0) return false;
    if (!dismissedConfigurations || dismissedConfigurations.length === 0) return false;

    const dismissedOrPostponedConfigNames = dismissedConfigurations
        .filter(
            config =>
                config.configState === CONFIG_STATE_ACTIONS.DISMISS ||
                config.configState === CONFIG_STATE_ACTIONS.POSTPONED
        )
        .map(config => config.configurationName);

    return configurations.every(config => dismissedOrPostponedConfigNames.includes(config.name));
};

// Oracle-specific filtering functions for handling active/dismissed configurations

// Helper function to filter individual Oracle ONTAP/OS configurations based on dismissed state
export const filterIndividualOracleOntapOsConfigurations = (
    tableData: any[],
    assessmentData: any,
    showDismissedView: boolean = false
): any[] => {
    if (!Array.isArray(tableData)) return [];

    const filteredResult = tableData.filter((item: any) => {
        if (!item || !item.name || !item.type) return true; // Keep non-ontap/os items

        // Get dismissed configurations for the subcategory
        let dismissedConfigs: any[] = [];

        if (item.type === 'volume') {
            dismissedConfigs = assessmentData?.dismissedConfigurations?.storage?.configuration?.volumes || [];
        } else if (item.type === 'lun') {
            dismissedConfigs = assessmentData?.dismissedConfigurations?.storage?.configuration?.luns || [];
        } else if (item.type === 'os') {
            dismissedConfigs = assessmentData?.dismissedConfigurations?.storage?.configuration?.os || [];
        } else {
            return true; // Keep non-ontap/os items
        }

        // Map display name to technical name for comparison
        const technicalName = getConfigurationTechnicalName(item.name, item.type);

        // Find if this specific configuration is dismissed or postponed using technical name
        const dismissedConfig = dismissedConfigs.find((config: any) => config.configurationName === technicalName);
        const isConfigDismissed = dismissedConfig?.configState === CONFIG_STATE_ACTIONS.DISMISS;
        const isConfigPostponed = dismissedConfig?.configState === CONFIG_STATE_ACTIONS.POSTPONED;
        const isConfigDismissedOrPostponed = isConfigDismissed || isConfigPostponed;

        // In dismissed view, show only dismissed or postponed configurations
        // In normal view, show only active (non-dismissed, non-postponed) configurations
        return showDismissedView ? isConfigDismissedOrPostponed : !isConfigDismissedOrPostponed;
    });

    return filteredResult;
};

// Helper function to determine if Oracle ONTAP/OS cards should be shown based on dismissal state
export const shouldShowOracleOntapOsCard = (
    cardKey: 'ontap_configuration' | 'os_configuration',
    assessmentData: any,
    showDismissedView: boolean = false
): boolean => {
    if (!assessmentData || !assessmentData.dismissedConfigurations) return true;

    const dismissedConfig = assessmentData.dismissedConfigurations;

    if (cardKey === 'ontap_configuration') {
        // Check volumes and luns for Oracle
        const volumeConfigs = assessmentData?.storage?.configuration?.volumes || [];
        const lunConfigs = assessmentData?.storage?.configuration?.luns || [];
        const dismissedVolumeConfigs = dismissedConfig?.storage?.configuration?.volumes || [];
        const dismissedLunConfigs = dismissedConfig?.storage?.configuration?.luns || [];

        const allVolumesAreDismissed =
            volumeConfigs.length > 0 &&
            areAllSubcategoryConfigurationsDismissed(volumeConfigs, dismissedVolumeConfigs, 'volumes');
        const allLunsAreDismissed =
            lunConfigs.length > 0 && areAllSubcategoryConfigurationsDismissed(lunConfigs, dismissedLunConfigs, 'luns');

        // Check if there are any dismissed or postponed configurations in volumes or luns
        const hasAnyDismissedVolumes = dismissedVolumeConfigs.some(
            (c: any) => c.configState === CONFIG_STATE_ACTIONS.DISMISS
        );
        const hasAnyDismissedLuns = dismissedLunConfigs.some(
            (c: any) => c.configState === CONFIG_STATE_ACTIONS.DISMISS
        );
        const hasAnyPostponedVolumes = dismissedVolumeConfigs.some(
            (c: any) => c.configState === CONFIG_STATE_ACTIONS.POSTPONED
        );
        const hasAnyPostponedLuns = dismissedLunConfigs.some(
            (c: any) => c.configState === CONFIG_STATE_ACTIONS.POSTPONED
        );

        // Show ONTAP card in dismissed view if any subcategory has dismissed or postponed configurations
        // Show ONTAP card in normal view if not all subcategories are fully dismissed/postponed
        if (showDismissedView) {
            return hasAnyDismissedVolumes || hasAnyDismissedLuns || hasAnyPostponedVolumes || hasAnyPostponedLuns;
        }
        return !(allVolumesAreDismissed && allLunsAreDismissed);
    }
    if (cardKey === 'os_configuration') {
        // Check OS configurations for Oracle
        const osConfigs = assessmentData?.storage?.configuration?.os || [];
        const dismissedOsConfigs = dismissedConfig?.storage?.configuration?.os || [];

        const allOsAreDismissed =
            osConfigs.length > 0 &&
            areAllSubcategoryConfigurationsDismissed(osConfigs, dismissedOsConfigs, ASSESSMENT_CONFIG_NAMES.OS);

        // Check if there are any dismissed or postponed OS configurations
        const hasAnyDismissedOs = dismissedOsConfigs.some((c: any) => c.configState === CONFIG_STATE_ACTIONS.DISMISS);
        const hasAnyPostponedOs = dismissedOsConfigs.some((c: any) => c.configState === CONFIG_STATE_ACTIONS.POSTPONED);

        // Show OS card in dismissed view if there are any dismissed or postponed OS configs
        // Show OS card in normal view if not all OS configs are dismissed/postponed
        if (showDismissedView) {
            return hasAnyDismissedOs || hasAnyPostponedOs;
        }
        return !allOsAreDismissed;
    }

    return true;
};

// Helper function to check if all Oracle ONTAP sub-configurations are in ACTIVATING state
export const areAllOracleOntapSubConfigurationsActivating = (assessmentData: any): boolean => {
    if (!assessmentData || !assessmentData.dismissedConfigurations) return false;

    const dismissedConfig = assessmentData.dismissedConfigurations;
    const dismissedVolumeConfigs = dismissedConfig?.storage?.configuration?.volumes || [];
    const dismissedLunConfigs = dismissedConfig?.storage?.configuration?.luns || [];

    // If there are no dismissed configs, they're not activating
    if (dismissedVolumeConfigs.length === 0 && dismissedLunConfigs.length === 0) return false;

    // Check if all dismissed volume configs are activating
    const allVolumesActivating = dismissedVolumeConfigs.every(
        (config: any) => config.configState === CONFIG_STATES.ACTIVATING
    );

    // Check if all dismissed lun configs are activating
    const allLunsActivating = dismissedLunConfigs.every(
        (config: any) => config.configState === CONFIG_STATES.ACTIVATING
    );

    // Return true only if there are configs and they're all activating
    return (
        (dismissedVolumeConfigs.length > 0 ? allVolumesActivating : true) &&
        (dismissedLunConfigs.length > 0 ? allLunsActivating : true)
    );
};

// Helper function to check if all Oracle OS sub-configurations are in ACTIVATING state
export const areAllOracleOsSubConfigurationsActivating = (assessmentData: any): boolean => {
    if (!assessmentData || !assessmentData.dismissedConfigurations) return false;

    const dismissedConfig = assessmentData.dismissedConfigurations;
    const dismissedOsConfigs = dismissedConfig?.storage?.configuration?.os || [];

    // If there are no dismissed configs, they're not activating
    if (dismissedOsConfigs.length === 0) return false;

    // Check if all dismissed OS configs are activating
    return dismissedOsConfigs.every((config: any) => config.configState === CONFIG_STATES.ACTIVATING);
};

// Helper function to check if we should filter storage subcategory based on view
export const shouldFilterStorageSubcategory = (
    configurations: any[],
    dismissedConfigurations: any[],
    subcategory: string,
    showDismissedView: boolean
): boolean => {
    if (!configurations || configurations.length === 0) return true; // Hide if no configs

    const allDismissed = areAllSubcategoryConfigurationsDismissed(configurations, dismissedConfigurations, subcategory);

    // If we're in dismissed view, show only if all are dismissed
    // If we're in normal view, show only if not all are dismissed
    return showDismissedView ? !allDismissed : allDismissed;
};

// This function is used to format the ONTAP configuration data.
export const formatOntapConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    showDismissedView: boolean = false
) => {
    let ontapTagsList: Array<string> = [];
    let highestOntapSeverity = 'None';
    const formatOntapConfigList: PerConfigInterface[] = [];
    let ontapCritical = 0;
    let ontapWarning = 0;
    const volumesList = data?.storage?.configuration?.volumes;
    // Check if we should include volumes based on dismissal state
    const volumeConfigs = data?.storage?.configuration?.volumes || [];
    const dismissedVolumeConfigs = data?.dismissedConfigurations?.storage?.configuration?.volumes || [];
    // For ONTAP/OS configurations, we always include all configurations
    // and let the RecommendationTable handle individual filtering
    const shouldIncludeVolumes = true; // Always include - filtering handled at table level

    if (volumesList && !volumesList?.[0]?.errorMessage && shouldIncludeVolumes) {
        data?.storage?.configuration?.volumes?.map((item: PerConfigInterface) => {
            // For subcategory-level filtering, we include all items from the subcategory
            // Individual filtering will be handled at the table level
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            const configItem = {
                ...item,
                id: item?.name,
                type: 'volume',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity,
                dismissedObj: getIndividualConfigDismissState(item?.name || '', 'volume', data?.dismissedConfigurations)
            } as any;
            formatOntapConfigList.push(configItem);
            if (item?.severity === 'critical') {
                ontapCritical = 1;
            } else if (item?.severity === 'warning') {
                ontapWarning = 1;
            }
            ontapTagsList = [...ontapTagsList, ...(item?.tags || [])];
        });
    }

    const lunsList = data?.storage?.configuration?.luns;
    // Check if we should include luns based on dismissal state
    const lunConfigs = data?.storage?.configuration?.luns || [];
    const dismissedLunConfigs = data?.dismissedConfigurations?.storage?.configuration?.luns || [];
    // For ONTAP/OS configurations, we always include all configurations
    // and let the RecommendationTable handle individual filtering
    const shouldIncludeLuns = true; // Always include - filtering handled at table level

    if (lunsList && !lunsList?.[0]?.errorMessage && shouldIncludeLuns) {
        data?.storage?.configuration?.luns?.map((item: PerConfigInterface) => {
            // For subcategory-level filtering, we include all items from the subcategory
            // Individual filtering will be handled at the table level
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            formatOntapConfigList.push({
                ...item,
                id: item?.name,
                type: 'lun',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity,
                dismissedObj: getIndividualConfigDismissState(item?.name || '', 'lun', data?.dismissedConfigurations)
            } as any);
            if (item?.severity === 'critical') {
                ontapCritical = 1;
            } else if (item?.severity === 'warning') {
                ontapWarning = 1;
            }
            ontapTagsList = [...ontapTagsList, ...(item?.tags || [])];
        });
    }

    if (ontapCritical === 1) {
        highestOntapSeverity = 'Critical';
    } else if (ontapWarning === 1) {
        highestOntapSeverity = 'Warning';
    }

    let ontapOptimizedConfig = 0;
    let ontapNotOptimizedConfig = 0;

    const ontapVolAndLunList = [];
    if (volumesList && !volumesList?.[0]?.errorMessage) {
        ontapVolAndLunList.push({ configs: data?.storage?.configuration?.volumes, type: 'volume' });
    }
    if (lunsList && !lunsList?.[0]?.errorMessage) {
        ontapVolAndLunList.push({ configs: data?.storage?.configuration?.luns, type: 'lun' });
    }
    ontapVolAndLunList?.map(({ configs, type }) => {
        configs?.map((item: PerConfigInterface) => {
            // Get the dismiss state for this configuration
            const dismissedObj = getIndividualConfigDismissState(
                item?.name || '',
                type as any,
                data?.dismissedConfigurations
            );
            const configState = dismissedObj?.configState;

            // Skip dismissed and postponed configurations from counts
            if (configState === CONFIG_STATE_ACTIONS.DISMISS || configState === CONFIG_STATE_ACTIONS.POSTPONED) {
                return;
            }

            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }

            // If the configuration is in activating state, count it as optimized
            if (configState === CONFIG_STATES.ACTIVATING) {
                ontapOptimizedConfig++;
            } else if (status === 'optimized') {
                ontapOptimizedConfig++;
            } else {
                ontapNotOptimizedConfig++;
            }
        });
    });

    return {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    };
};

// This function is used to format the OS configuration data.
export const formatOsConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    showDismissedView: boolean = false
) => {
    let osTagsList: Array<string> = [];
    let highestOsSeverity = 'None';
    let formatOsConfigList: PerConfigInterface[] = [];
    let osCritical = 0;
    let osWarning = 0;
    const osList = data?.storage?.configuration?.os;
    // Check if we should include os based on dismissal state
    const osConfigs = data?.storage?.configuration?.os || [];
    const dismissedOsConfigs = data?.dismissedConfigurations?.storage?.configuration?.os || [];

    // For ONTAP/OS configurations, we always include all configurations
    // and let the RecommendationTable handle individual filtering
    const shouldIncludeOs = true; // Always include - filtering handled at table level

    if (osList && !osList?.[0]?.errorMessage && shouldIncludeOs) {
        data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
            // For subcategory-level filtering, we include all items from the subcategory
            // Individual filtering will be handled at the table level
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            formatOsConfigList.push({
                ...item,
                id: item?.name,
                type: ASSESSMENT_CONFIG_NAMES.OS,
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity,
                dismissedObj: getIndividualConfigDismissState(item?.name || '', 'os', data?.dismissedConfigurations)
            } as any);
            if (item?.severity === 'critical') {
                osCritical = 1;
            } else if (item?.severity === 'warning') {
                osWarning = 1;
            }
            osTagsList = [...osTagsList, ...(item?.tags || [])];
        });
    }

    formatOsConfigList = sortListOfDict(formatOsConfigList, 'name');

    if (osCritical === 1) {
        highestOsSeverity = 'Critical';
    } else if (osWarning === 1) {
        highestOsSeverity = 'Warning';
    }

    let osOptimizedConfig = 0;
    let osNotOptimizedConfig = 0;
    if (osList && !osList?.[0]?.errorMessage) {
        data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
            // Get the dismiss state for this configuration
            const dismissedObj = getIndividualConfigDismissState(item?.name || '', 'os', data?.dismissedConfigurations);
            const configState = dismissedObj?.configState;

            // Skip dismissed and postponed configurations from counts
            if (configState === CONFIG_STATE_ACTIONS.DISMISS || configState === CONFIG_STATE_ACTIONS.POSTPONED) {
                return;
            }

            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }

            // If the configuration is in activating state, count it as optimized
            if (configState === CONFIG_STATES.ACTIVATING) {
                osOptimizedConfig++;
            } else if (status === 'optimized') {
                osOptimizedConfig++;
            } else {
                osNotOptimizedConfig++;
            }
        });
    }

    return { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity };
};

// This function is used to format the MSSQL High Availability configuration data.
export const formatMssqlHighAvailabilityConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    showDismissedView: boolean = false
) => {
    let mssqlHATagsList: Array<string> = [];
    let highestMssqlHASeverity = 'None';
    const formatMssqlHighAvailabilityConfigList: PerConfigInterface[] = [];
    let mssqlHACritical = 0;
    let mssqlHAWarning = 0;

    // Check for data in both possible structures
    const mssqlHAData = data?.highAvailability || (data as any)?.['high-availability'];

    // For MSSQL HA configurations, we always include all configurations
    // and let the RecommendationTable handle individual filtering (like OS does)
    const shouldIncludeMssqlHA = true; // Always include - filtering handled at table level

    // Process MSSQL HA configurations (active only, like OS does)
    if (mssqlHAData && shouldIncludeMssqlHA) {
        mssqlHAData?.forEach((item: PerConfigInterface) => {
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }

            formatMssqlHighAvailabilityConfigList.push({
                ...item,
                id: item?.name,
                type: 'mssqlHighAvailability',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity,
                dismissedObj: getIndividualConfigDismissState(
                    item?.name || '',
                    'mssqlHighAvailability',
                    data?.dismissedConfigurations
                )
            } as any);

            if (item?.severity === 'critical') {
                mssqlHACritical = 1;
            } else if (item?.severity === 'warning') {
                mssqlHAWarning = 1;
            }
            mssqlHATagsList = [...mssqlHATagsList, ...(item?.tags || [])];
        });
    }

    // Add postponed MSSQL HA configurations that might not be in active data
    const dismissedMssqlHAConfigs =
        data?.dismissedConfigurations?.highAvailability ||
        (data?.dismissedConfigurations as any)?.['high-availability'] ||
        [];

    dismissedMssqlHAConfigs?.forEach((dismissedConfig: any) => {
        if (dismissedConfig.configState === CONFIG_STATES.POSTPONED) {
            const configName = dismissedConfig.configurationName;

            // Check if this config is not already in the active list
            const existsInActive = formatMssqlHighAvailabilityConfigList.some(
                config =>
                    config.id === configName ||
                    getConfigurationTechnicalName(config.name || '', 'mssqlHighAvailability') === configName
            );

            if (!existsInActive) {
                // Map technical names to display names for MSSQL HA
                const displayNameMapping: { [key: string]: string } = {
                    'shared-storage': 'Shared Storage',
                    'sqlServer-service': 'SQL Server Service',
                    'drive-letter': 'Drive Letter',
                    'heartbeat-settings': 'Heartbeat Settings',
                    'cluster-quorum': 'Cluster Quorum'
                };

                const displayName = displayNameMapping[configName] || configName;

                formatMssqlHighAvailabilityConfigList.push({
                    id: configName,
                    name: displayName,
                    type: 'mssqlHighAvailability',
                    status: 'N/A', // Postponed configs don't have active status
                    severity: dismissedConfig?.severity || 'info',
                    dismissedObj: dismissedConfig // Use the dismissed config directly since we already have it
                } as any);
            }
        }
    });

    // Sort the list after adding all configurations
    formatMssqlHighAvailabilityConfigList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (mssqlHACritical === 1) {
        highestMssqlHASeverity = 'Critical';
    } else if (mssqlHAWarning === 1) {
        highestMssqlHASeverity = 'Warning';
    }

    let mssqlHAOptimizedConfig = 0;
    let mssqlHANotOptimizedConfig = 0;

    // Count optimized vs not optimized configurations from active configs
    if (mssqlHAData) {
        mssqlHAData?.forEach((item: PerConfigInterface) => {
            // Skip items with errorMessage (assessment data not available for this config)
            if ((item as any)?.errorMessage) {
                return;
            }

            // Get the dismiss state for this configuration
            const dismissedObj = getIndividualConfigDismissState(
                item?.name || '',
                'mssqlHighAvailability',
                data?.dismissedConfigurations
            );
            const configState = dismissedObj?.configState;

            // Skip dismissed and postponed configurations from counts
            if (configState === CONFIG_STATE_ACTIONS.DISMISS || configState === CONFIG_STATE_ACTIONS.POSTPONED) {
                return;
            }

            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }

            // If the configuration is in activating state, count it as optimized
            if (configState === CONFIG_STATES.ACTIVATING) {
                mssqlHAOptimizedConfig++;
            } else if (status === 'optimized') {
                mssqlHAOptimizedConfig++;
            } else {
                mssqlHANotOptimizedConfig++;
            }
        });
    }

    return {
        formatMssqlHighAvailabilityConfigList,
        mssqlHATagsList,
        mssqlHAOptimizedConfig,
        mssqlHANotOptimizedConfig,
        highestMssqlHASeverity
    };
};

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

        // Skip WAD excluded configurations - they should not be counted in optimization breakdown
        if (isWadExcludedConfig(nestedObject?.mapName, isWad)) {
            return;
        }

        // Skip configurations not supported for AOAG deployments (compare by mapName)
        if (isConfigSkippedForAoag(nestedObject?.mapName, cardsData?.deploymentType)) {
            return; // Skip this card for AOAG instances
        }

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
            // Skip MSSQL High Availability for non-HA instances (only show for FCI and AOAG)
            const isMSSQLHighAvailability =
                key === 'mssql_high_availability' || nestedObject?.id === 'mssql-high-availability';
            if (isMSSQLHighAvailability && !isMssqlHaDeployment(cardsData?.deploymentType)) {
                return; // Skip this card for non-HA instances
            }

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
    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData, showDismissedView);

    let cardsData = formatIndividualCardMainConfig(data, optimizingData);

    cardsData = {
        ...cardsData,
        deploymentType: data?.deploymentType || '',
        baseDeploymentType: data?.baseDeploymentType || '',
        isWad: data?.isWad || false
    };

    // Skip License (Application) card for AOAG deployments - not supported for AOAG
    if (!isAoagDeployment(data?.deploymentType)) {
        cardsData = formatApplicationCardMainConfig(data, optimizingData, cardsData);
    }

    cardsData = formatOsPatchCardConfig(data, optimizingData, cardsData);

    cardsData = formatRssConfigCardConfig(data, optimizingData, cardsData);

    cardsData = formatMTUCardConfig(data, optimizingData, cardsData);

    cardsData = formatMicrosoftSqlPatchCardConfig(data, optimizingData, cardsData);

    cardsData = formatMaxdopPatchCardConfig(data, optimizingData, cardsData);

    cardsData = formatSnapshotPolicyCardConfig(data, optimizingData, cardsData);

    cardsData = formatAWSBackUpPolicyCardConfig(data, optimizingData, cardsData);

    cardsData = formatCRRCardConfig(data, optimizingData, cardsData);

    cardsData = formatCloneCardConfig(data, optimizingData, cardsData);

    // Conditionally add ONTAP configuration card based on dismissed state and view
    const hasVolumeConfigs = (data?.storage?.configuration?.volumes?.length || 0) > 0;
    const hasLunConfigs = (data?.storage?.configuration?.luns?.length || 0) > 0;
    const shouldShowOntapCard = hasVolumeConfigs || hasLunConfigs;

    if (
        shouldShowOntapCard &&
        (!showDismissedView ||
            (showDismissedView &&
                (formatOntapConfigList.length > 0 ||
                    areAllSubcategoryConfigurationsDismissed(
                        data?.storage?.configuration?.volumes || [],
                        data?.dismissedConfigurations?.storage?.configuration?.volumes,
                        'volumes'
                    ) ||
                    areAllSubcategoryConfigurationsDismissed(
                        data?.storage?.configuration?.luns || [],
                        data?.dismissedConfigurations?.storage?.configuration?.luns,
                        'luns'
                    ))))
    ) {
        const ontapDismissedObj = getOntapOsCardDismissState('ontap_configuration', data);
        const isOntapDismissedOrPostponed =
            ontapDismissedObj?.configState && ontapDismissedObj.configState !== CONFIG_STATES.ACTIVE;

        cardsData = {
            ...cardsData,
            ontap_configuration: {
                ...cardDataDefault?.ontap_configuration,
                block_two: {
                    ...cardDataDefault?.ontap_configuration?.block_two,
                    value: isOntapDismissedOrPostponed
                        ? GENERAL.NOT_AVAILABLE
                        : (ontapOptimizedConfig || 0) + (ontapNotOptimizedConfig || 0) !== 0
                        ? ontapNotOptimizedConfig > 0
                            ? 'Not optimized'
                            : 'Optimized'
                        : ''
                },
                block_three: {
                    ...cardDataDefault?.ontap_configuration?.block_three,
                    value: isOntapDismissedOrPostponed
                        ? GENERAL.NOT_AVAILABLE
                        : ontapNotOptimizedConfig !== 0
                        ? `${formatNumberWithCustomComma(
                              (ontapNotOptimizedConfig / (ontapOptimizedConfig + ontapNotOptimizedConfig)) * 100
                          )}%`
                        : '0%'
                },
                block_four: {
                    ...cardDataDefault?.ontap_configuration?.block_four,
                    value: highestOntapSeverity
                },
                block_five: {
                    ...cardDataDefault?.ontap_configuration?.block_five,
                    value: isOntapDismissedOrPostponed
                        ? GENERAL.NOT_AVAILABLE
                        : `${ontapNotOptimizedConfig || 0} out of ${
                              (ontapOptimizedConfig || 0) + (ontapNotOptimizedConfig || 0)
                          }`,
                    count: {
                        totalObjectsAssessed: (ontapOptimizedConfig || 0) + (ontapNotOptimizedConfig || 0),
                        totalObjectsInViolation: ontapNotOptimizedConfig || 0
                    }
                },
                tags: ontapTagsList.filter(
                    (value: any, index: any, self: string | any[]) => self.indexOf(value) === index
                ),
                category: 'storage',
                dismissedObj: ontapDismissedObj
            }
        };
    }

    const { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity } =
        formatOsConfig(data, optimizingData, showDismissedView);
    const {
        formatMssqlHighAvailabilityConfigList,
        mssqlHATagsList,
        mssqlHAOptimizedConfig,
        mssqlHANotOptimizedConfig,
        highestMssqlHASeverity
    } = formatMssqlHighAvailabilityConfig(data, optimizingData, showDismissedView);

    // Conditionally add OS configuration card based on dismissed state and view
    const hasOsConfigs = (data?.storage?.configuration?.os?.length || 0) > 0;
    const shouldShowOsCard = hasOsConfigs;

    if (
        shouldShowOsCard &&
        (!showDismissedView ||
            (showDismissedView &&
                (formatOsConfigList.length > 0 ||
                    areAllSubcategoryConfigurationsDismissed(
                        data?.storage?.configuration?.os || [],
                        data?.dismissedConfigurations?.storage?.configuration?.os,
                        ASSESSMENT_CONFIG_NAMES.OS
                    ))))
    ) {
        const osDismissedObj = getOntapOsCardDismissState('os_configuration', data);
        const isOsDismissedOrPostponed =
            osDismissedObj?.configState && osDismissedObj.configState !== CONFIG_STATES.ACTIVE;

        cardsData = {
            ...cardsData,
            os_configuration: {
                ...cardDataDefault?.os_configuration,
                block_two: {
                    ...cardDataDefault?.os_configuration?.block_two,
                    value: isOsDismissedOrPostponed
                        ? GENERAL.NOT_AVAILABLE
                        : (osOptimizedConfig || 0) + (osNotOptimizedConfig || 0) !== 0
                        ? osNotOptimizedConfig > 0
                            ? 'Not optimized'
                            : 'Optimized'
                        : ''
                },
                block_three: {
                    ...cardDataDefault?.os_configuration?.block_three,
                    value: isOsDismissedOrPostponed
                        ? GENERAL.NOT_AVAILABLE
                        : osNotOptimizedConfig !== 0
                        ? `${formatNumberWithCustomComma(
                              (osNotOptimizedConfig / (osOptimizedConfig + osNotOptimizedConfig)) * 100
                          )}%`
                        : '0%'
                },
                block_four: {
                    ...cardDataDefault?.os_configuration?.block_four,
                    value: highestOsSeverity
                },
                block_five: {
                    ...cardDataDefault?.os_configuration?.block_five,
                    value: isOsDismissedOrPostponed
                        ? GENERAL.NOT_AVAILABLE
                        : `${osNotOptimizedConfig || 0} out of ${
                              (osOptimizedConfig || 0) + (osNotOptimizedConfig || 0)
                          }`,
                    count: {
                        totalObjectsAssessed: (osOptimizedConfig || 0) + (osNotOptimizedConfig || 0),
                        totalObjectsInViolation: osNotOptimizedConfig || 0
                    }
                },
                tags: osTagsList.filter(
                    (value: any, index: any, self: string | any[]) => self.indexOf(value) === index
                ),
                category: 'storage',
                dismissedObj: osDismissedObj
            }
        };
    }

    // Get MSSQL High Availability dismiss state
    const mssqlHADismissedObj = getMssqlHighAvailabilityCardDismissState(data);
    const isMssqlHADismissedOrPostponed =
        mssqlHADismissedObj?.configState && mssqlHADismissedObj.configState !== CONFIG_STATES.ACTIVE;

    cardsData = {
        ...cardsData,
        mssql_high_availability: {
            ...cardDataDefault?.mssql_high_availability,
            block_two: {
                ...cardDataDefault?.mssql_high_availability?.block_two,
                value: isMssqlHADismissedOrPostponed
                    ? GENERAL.NOT_AVAILABLE
                    : (mssqlHAOptimizedConfig || 0) + (mssqlHANotOptimizedConfig || 0) !== 0
                    ? mssqlHANotOptimizedConfig > 0
                        ? 'Not optimized'
                        : 'Optimized'
                    : ''
            },
            block_three: {
                ...cardDataDefault?.mssql_high_availability?.block_three,
                value: isMssqlHADismissedOrPostponed
                    ? GENERAL.NOT_AVAILABLE
                    : mssqlHANotOptimizedConfig !== 0
                    ? `${formatNumberWithCustomComma(
                          (mssqlHANotOptimizedConfig / (mssqlHAOptimizedConfig + mssqlHANotOptimizedConfig)) * 100
                      )}%`
                    : '0%'
            },
            block_four: {
                ...cardDataDefault?.mssql_high_availability?.block_four,
                value: highestMssqlHASeverity
            },
            block_five: {
                ...cardDataDefault?.mssql_high_availability?.block_five,
                value: 'EC2 instance'
            },
            block_six: {
                ...cardDataDefault?.mssql_high_availability?.block_six,
                value: isMssqlHADismissedOrPostponed
                    ? GENERAL.NOT_AVAILABLE
                    : `${mssqlHANotOptimizedConfig || 0} out of ${
                          (mssqlHAOptimizedConfig || 0) + (mssqlHANotOptimizedConfig || 0)
                      }`,
                count: {
                    totalObjectsAssessed: (mssqlHAOptimizedConfig || 0) + (mssqlHANotOptimizedConfig || 0),
                    totalObjectsInViolation: mssqlHANotOptimizedConfig || 0
                }
            },
            tags: mssqlHATagsList.filter(
                (value: any, index: any, self: string | any[]) => self.indexOf(value) === index
            ),
            category: 'resiliency',
            dismissedObj: mssqlHADismissedObj
        }
    };

    // Update CRR recommendation description for AOAG deployments
    if (isAoagDeployment(data?.deploymentType)) {
        cardsData = {
            ...cardsData,
            crr: {
                ...cardsData?.crr,
                recommendation: {
                    ...cardsData?.crr?.recommendation,
                    description: cardsData?.crr?.recommendation?.aoagDescription
                }
            }
        };
    }

    return { cardsData, formatOntapConfigList, formatOsConfigList, formatMssqlHighAvailabilityConfigList };
};

// This function is used to format the get well data.
export const formatGetWellData = (
    dispatch: any,
    data?: AssessmentResponseInterface | undefined,
    showDismissedView: boolean = false,
    isRefresh: boolean = false
) => {
    const state = store.getState();
    let optimizingData = state.getWellOptimize.optimizingData || {};

    // If this is a refresh (fresh assessment data), clear optimistic state to show actual API status
    if (isRefresh && data) {
        optimizingData = {};
        dispatch(setOptimizingData({}));
    }

    if (!data) {
        data = state.getWellOptimize.driftAssessmentData || undefined;
    }
    const { cardsData, formatOntapConfigList, formatOsConfigList, formatMssqlHighAvailabilityConfigList } =
        getCardsData(data || ({} as AssessmentResponseInterface), optimizingData, showDismissedView);

    const optBreakDown = formatOptimizationBreakDown(cardsData, data);
    dispatch(setGwDatabaseStorageType(data?.deploymentType || ''));
    dispatch(setGwDatabaseAoagStorageType(data?.baseDeploymentType || ''));

    // For Reset Password data
    dispatch(
        setInstanceDetailsData({
            fsxId: data?.fileSystemId,
            ec2InstanceId: data?.ec2InstanceId,
            databaseInstanceName: data?.databaseInstanceName
        })
    );

    // Dispatch the formatted cards data to the store
    dispatch(setCardData(cardsData));

    // Dispatch the formatted optimization breakdown data to the store
    dispatch(setOptimizationBreakDown(optBreakDown));

    // Dispatch the timestamp to the store
    dispatch(
        setGwTimestamp(
            data?.lastAssessmentTimestamp && isNaN(Date.parse(data?.lastAssessmentTimestamp))
                ? formatDateWithTime(data?.lastAssessmentTimestamp)
                : data?.lastAssessmentTimestamp
        )
    );

    // Dispatch timestamp for every get API call
    dispatch(setGwRefreshTimestamp(getCurrentDateTime()));
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

    const categoryData = getCategoryData();

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    Object.keys(cardData).map((key: any) => {
        if (WA_FLAG_SKIP.includes(key)) {
            return; // Skip deploymentType as it is not a card
        }
        // Skip MSSQL High Availability for non-HA instances (only show for FCI and AOAG)
        const isMSSQLHighAvailability = key === 'mssql_high_availability';
        if (isMSSQLHighAvailability && !isMssqlHaDeployment(cardData?.deploymentType)) {
            return; // Skip this card for non-HA instances
        }

        // Check if this config is excluded for WAD instances
        const isWadExcluded = isWadExcludedConfig(cardData[key]?.mapName, isWad);

        // WAD excluded configs should not be shown in dismissed view as they have no dismiss functionality
        if (isWadExcluded && showDismissedConfigurations) {
            return;
        }

        // For WAD excluded configs, include them with isWadExcluded flag but skip filter checks
        if (isWadExcluded) {
            filteredCardData[key] = { ...cardData[key], isWadExcluded: true };
            // Do NOT count WAD excluded configs as they are not part of the assessment
            return;
        }

        const checkCategory =
            !filters['all-catagories'] ||
            filters['all-catagories']?.includes(cardData[key]?.category) ||
            filters['all-catagories']?.includes(categoryData[key as keyof typeof categoryData]?.category);

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

        const resourceType = cardData[key]?.block_five?.value;
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
            } else if (key === 'mssql_high_availability') {
                // Special handling for MSSQL High Availability configurations with subcategory logic
                checkDismissedFilter = shouldShowMssqlHighAvailabilityCard(
                    driftAssessmentData,
                    showDismissedConfigurations
                );
            } else {
                // Standard logic for other configurations
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
            checkStatus &&
            checkSeverity &&
            checkTags &&
            checkConfigState &&
            checkResourceType &&
            checkDismissedFilter
        ) {
            filteredCardData[key] = cardData[key];
            // Count configurations - for flat structure, any valid config should be counted
            // For nested structure, check if it exists in category mapping
            if (cardData[key]?.category || categoryData[key as keyof typeof categoryData]) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};

export const resetGwValuesOnRefresh = (dispatch: any) => {
    dispatch(setDriftAssessmentData(null));
    dispatch(setCardData(cardDataDefault));
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
    engineType: string | undefined
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
            updateOptimizationStatus(row, dispatch, engineType);
        });
        setTimeout(() => {
            formatAssessmentData(engineType, dispatch);
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
                [rowData?.id]: 'optimized'
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

        updateOptimizationStatus(rowData, dispatch, engineType);
        formatAssessmentData(engineType, dispatch);
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
    engineType?: string | undefined
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
                updateOptimizationStatus(row, dispatch, engineType);
            }
        });
        setTimeout(() => {
            formatAssessmentData(engineType, dispatch);
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
                [rowData?.id]: 'optimized'
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
        updateOptimizationStatus(rowData, dispatch, engineType);
        formatAssessmentData(engineType, dispatch);
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
    engineType?: string
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
            formatAssessmentData(engineType, dispatch);
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
        formatAssessmentData(engineType, dispatch);
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
                            updateOptimizationStatus(row, dispatch, engineType);
                        });
                        setTimeout(() => {
                            formatGetWellData(dispatch);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                                    message: 'Clone databases fixed successfully.'
                                })
                            );
                        }, 0);

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
                                updateOptimizationStatus(row, dispatch, engineType);
                            }
                        });
                        setTimeout(() => {
                            formatGetWellData(dispatch);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.INFO,
                                    message: `${successJobCount} out of ${bulkRowData?.length} ${bulkRowData?.[0]?.name} instances fixed successfully.`
                                })
                            );
                        }, 0);

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
                            formatGetWellData(dispatch);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: failedMsgData
                                })
                            );
                        }, 0);

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

            // formatGetWellData(dispatch);
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
                            engineType
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                        if (isOptimizeInnerPage) {
                            dispatch(setIsInnerPageOptimize(true));
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
                            engineType
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                        if (isOptimizeInnerPage) {
                            dispatch(setIsInnerPageOptimize(true));
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
                            engineType
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

                // formatGetWellData(dispatch);
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
                // formatGetWellData(dispatch);
                dispatch(setOptimizingInstanceData(false));
                // Error message for failed optimization API will be returned here
            }
        }
    }, 10);
};

export const updateOptimizationStatus = (rowData: any, dispatch: any, engineType?: string) => {
    const state = store.getState();
    let assessmentData = null;
    if (engineType === DBType.ORACLE) {
        assessmentData = state.inventoryV2.allOracleHostAssessmentData;
    } else {
        assessmentData = state.inventoryV2.allmssqlHostAssessmentData;
    }
    const updatedAsessmentData = assessmentData?.map((hostData: any) => {
        if (
            hostData?.databaseHostId === rowData?.hostId &&
            hostData?.credentialId === rowData?.credentialId &&
            hostData?.regionId === rowData?.regionId
        ) {
            const updatedInstancesAssessment = hostData?.instancesAssessment?.map((instance: any) => {
                if (instance?.databaseInstanceId === rowData?.instanceId) {
                    const storageSizingMap: any = CONFIG_NAME_TO_ID_MAPPING.STORAGE_SIZING_MAP;
                    const storageLayoutMap: any = CONFIG_NAME_TO_ID_MAPPING.STORAGE_LAYOUT_MAP;
                    const storageConfigurationMap: any = CONFIG_NAME_TO_ID_MAPPING.STORAGE_CONFIG_MAP;
                    let newStorageConfigurationMap: any;
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT) {
                        newStorageConfigurationMap = { ...storageConfigurationMap }; // Create a copy to avoid mutating original
                        delete newStorageConfigurationMap['snapshot-policy'];
                    } else {
                        newStorageConfigurationMap = { ...storageConfigurationMap };
                    }
                    const haMssqlMap: any = CONFIG_NAME_TO_ID_MAPPING.HA_MSSQL;
                    if (storageSizingMap[rowData?.name]) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                storage: {
                                    ...instance?.assessments?.storage,
                                    sizing: instance?.assessments?.storage?.sizing.map((item: any) => {
                                        if (item?.name === storageSizingMap[rowData?.name]) {
                                            return {
                                                ...item,
                                                status: 'optimized'
                                            };
                                        }
                                        return item;
                                    })
                                }
                            }
                        };
                    }
                    if (storageLayoutMap[rowData?.name]) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                storage: {
                                    ...instance?.assessments?.storage,
                                    layout: instance?.assessments?.storage?.layout.map((item: any) => {
                                        if (item?.name === storageLayoutMap[rowData?.name]) {
                                            return {
                                                ...item,
                                                status: 'optimized'
                                            };
                                        }
                                        return item;
                                    })
                                }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                rssConfig: { ...instance.assessments.rssConfig, status: 'optimized' }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                compute: { ...instance.assessments.compute, status: 'optimized' }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                maxDOP: { ...instance.assessments.maxDOP, status: 'optimized' }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.MTU) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                mtuAlignment: { ...instance.assessments.mtuAlignment, status: 'optimized' }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                awsBackup: { ...instance.assessments.awsBackup, status: 'optimized' }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                transparentHugepages: {
                                    ...instance.assessments.transparentHugepages,
                                    status: 'optimized'
                                }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                tcpAdvancedOptions: { ...instance.assessments.tcpAdvancedOptions, status: 'optimized' }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                multiblockReadcount: {
                                    ...instance.assessments.multiblockReadcount,
                                    status: 'optimized'
                                }
                            }
                        };
                    }
                    if (newStorageConfigurationMap[rowData?.id]) {
                        const key = newStorageConfigurationMap[rowData?.id];
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                storage: {
                                    ...instance?.assessments?.storage,
                                    configuration: {
                                        ...instance?.assessments?.storage?.configuration,
                                        [key]: instance?.assessments?.storage?.configuration[key]?.map((item: any) => {
                                            if (item.name === rowData?.id) {
                                                return { ...item, status: 'optimized' };
                                            }
                                            return item;
                                        })
                                    }
                                }
                            }
                        };
                    }
                    if (rowData?.name === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
                        const state = store.getState();
                        const { cloneDashboardData } = state.getWellOptimize;

                        let isInstanceOptimized = true;
                        cloneDashboardData?.objectsInViolation?.map((row: any) => {
                            if (
                                row?.resourceId === rowData?.hostId &&
                                row?.instanceId === rowData?.instanceId &&
                                !row?.isOptimized
                            ) {
                                isInstanceOptimized = false;
                            }
                        });
                        if (isInstanceOptimized) {
                            // If all clone databases are optimized for a instance
                            return {
                                ...instance,
                                assessments: {
                                    ...instance?.assessments,
                                    clone: { ...instance.assessments.clone, status: 'optimized' }
                                }
                            };
                        }
                        // If not all clone databases are optimized for a instance
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                clone: { ...instance.assessments.clone, status: 'not-optimized' }
                            }
                        };
                    }
                    if (haMssqlMap[rowData?.name]) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                highAvailability: instance?.assessments?.highAvailability?.map((item: any) => {
                                    if (item?.name === haMssqlMap[rowData?.name]) {
                                        return {
                                            ...item,
                                            status: 'optimized'
                                        };
                                    }
                                    return item;
                                })
                            }
                        };
                    }
                    return instance;
                }
                return instance;
            });
            return { ...hostData, instancesAssessment: updatedInstancesAssessment };
        }
        return hostData;
    });
    if (engineType === DBType.ORACLE) {
        dispatch(addAllOracleHostAssessmentData(updatedAsessmentData));
    } else {
        dispatch(addAllMssqlHostAssessmentData(updatedAsessmentData));
    }
};

export const updateConfigStateStatus = (
    rowList: any,
    dispatch: any,
    action: any,
    engineType?: string
) => {
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
                        const existingDismissed: DismissedEntry[] =
                            instance.assessments?.dismissedConfigurations ?? [];

                        // Step 3: Check if this config already has an entry in the array
                        const existingEntryIndex = existingDismissed.findIndex(
                            (dismissedItem) => dismissedItem.id === configId
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

export const updateConfigStatePerInstance = (
    setAction: any,
    configId: string,
    endTime: any,
    startTime: any,
    engineType?: string
) => {
    const state = store.getState();
    const { driftAssessmentData } = state.getWellOptimize;

    // Auto-detect engine type if not provided by checking for Oracle-specific fields
    let detectedEngineType = engineType;
    if (!detectedEngineType) {
        // Check for Oracle-specific fields in driftAssessmentData
        if (driftAssessmentData?.isASMManaged !== undefined || driftAssessmentData?.isStorageLayoutFra !== undefined) {
            detectedEngineType = DBType.ORACLE;
        } else {
            // Default to MSSQL if no Oracle-specific fields found
            detectedEngineType = DBType.MSSQL;
        }
    }

    // Check if using flat API structure (has assessments array)
    const isFlatApi =
        !!(driftAssessmentData as any)?.assessments && Array.isArray((driftAssessmentData as any).assessments);

    // For flat API, dismissedConfigurations is a flat array at root level
    if (isFlatApi) {
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
    }


    return driftAssessmentData;
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
        name === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM &&
        (rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
            (rowData?.sizingViolations?.overProvisionedDrives?.length &&
                !rowData?.sizingViolations?.underProvisionedDrives?.length))
    ) {
        isDisabled = true;
        errorMessage = translation('databases.well-architect.file-system-headroom-over-provisioned-error');
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

// storageMockData used when all the storage configurations are dismissed then storage object will not be coming in the Assessment response so will add mock storage object
export const storageMockData = {
    storage: {
        configuration: {
            volumes: [
                {
                    name: 'thin-provision'
                },
                {
                    name: 'autosize'
                },
                {
                    name: 'autosize-mode'
                },
                {
                    name: 'fractional-reserve'
                },
                {
                    name: 'snapshot-copy-reserve'
                },
                {
                    name: 'snapshot-autodelete'
                },
                {
                    name: 'space-mgmt-try-first'
                },
                {
                    name: 'tiering-policy'
                },
                {
                    name: 'tiering-min-cooling-days'
                }
            ],
            luns: [
                {
                    name: 'os-type'
                },
                {
                    name: 'space-reservation-enabled'
                },
                {
                    name: 'space-allocation-allocated'
                }
            ],
            os: [
                {
                    name: 'mpio-enabled'
                },
                {
                    name: 'mpio-timeout'
                },
                {
                    name: 'mpio-iscsi-count'
                },
                {
                    name: 'ntfs-allocation-unit-size'
                },
                {
                    name: 'mpio-load-balance-policy'
                }
            ]
        },
        sizing: [
            {
                name: 'performance-tier'
            },
            {
                name: 'log-drive-size'
            },
            {
                name: 'tempdb-drive-size'
            },
            {
                name: 'headroom'
            }
        ],
        layout: [
            {
                name: 'tempdb-files-location'
            },
            {
                name: 'data-files-location'
            },
            {
                name: 'log-files-location'
            }
        ]
    }
};

// storageMockOracleData used when all the storage configurations are dismissed then storage object will not be coming in the Assessment response so will add mock storage object for Oracle
export const storageMockOracleData = {
    storage: {
        configuration: {
            volumes: [
                {
                    name: 'thin-provision'
                },
                {
                    name: 'autosize'
                },
                {
                    name: 'autosize-mode'
                },
                {
                    name: 'fractional-reserve'
                },
                {
                    name: 'snapshot-copy-reserve'
                },
                {
                    name: 'snapshot-autodelete'
                },
                {
                    name: 'space-mgmt-try-first'
                },
                {
                    name: 'tiering-policy'
                },
                {
                    name: 'tiering-min-cooling-days'
                },
                {
                    name: 'compression'
                }
            ],
            luns: [
                {
                    name: 'os-type'
                },
                {
                    name: 'space-reservation-enabled'
                },
                {
                    name: 'space-allocation-allocated'
                }
            ],
            os: [
                {
                    name: 'multipath-io'
                },
                {
                    name: 'host-utilities'
                },
                {
                    name: 'selinux'
                },
                {
                    name: 'iscsi-replacement-timeout'
                },
                {
                    name: 'multipath-friendly-names'
                },
                {
                    name: 'multipath-io-sessions'
                },
                {
                    name: 'multipath-configuration'
                },
                {
                    name: 'kernel-parameters'
                },
                {
                    name: 'nfs-mount-options-databasefiles'
                },
                {
                    name: 'nfs-mount-options-adrhome'
                },
                {
                    name: 'nfs-caching-options'
                },
                {
                    name: 'nfsv4-domain-name'
                },
                {
                    name: 'asm-setup'
                },
                {
                    name: 'asm-external-redundancy'
                },
                {
                    name: 'afd-logical-block-size'
                },
                {
                    name: 'asmlib-logical-block-size'
                }
            ]
        },
        layout: [
            {
                name: 'data-dg-lun-layout'
            },
            {
                name: 'redolog-dg-lun-layout'
            },
            {
                name: 'fra-dg-lun-layout'
            },
            {
                name: 'archivelog-dg-lun-layout'
            },
            {
                name: 'archive-placement'
            },
            {
                name: 'datafiles-placement'
            },
            {
                name: 'controlfiles-placement'
            },
            {
                name: 'redologs-placement'
            },
            {
                name: 'templogs-placement'
            },
            {
                name: 'oracle-binary-placement'
            }
        ]
    }
};

/**
 * Dynamically generates Oracle storage mock data based on dismissed configurations in the assessment response.
 * This is used for Oracle databases where the configuration can vary based on protocol (NFS, ASM, iSCSI)
 * and deployment type. Instead of using hardcoded mock data like in MSSQL, this function constructs
 * the storage structure based on what configurations were actually dismissed.
 */
export const generateDynamicOracleStorageMockData = (assessmentData: any) => {
    const dismissedConfigurations = assessmentData?.dismissedConfigurations?.storage;

    if (!dismissedConfigurations) {
        // Fallback to static mock data if no dismissed configurations
        return storageMockOracleData;
    }

    const dynamicStorageData: any = {
        storage: {
            configuration: {},
            layout: []
        }
    };

    // Process configuration sections (volumes, luns, os)
    if (dismissedConfigurations.configuration) {
        Object.keys(dismissedConfigurations.configuration).forEach(configType => {
            const configurations = dismissedConfigurations.configuration[configType];
            if (Array.isArray(configurations) && configurations.length > 0) {
                dynamicStorageData.storage.configuration[configType] = configurations.map((config: any) => ({
                    name: config.configurationName
                }));
            }
        });
    }

    // Process layout section
    if (dismissedConfigurations.layout && Array.isArray(dismissedConfigurations.layout)) {
        dynamicStorageData.storage.layout = dismissedConfigurations.layout.map((config: any) => ({
            name: config.configurationName
        }));
    }

    // If no valid configuration was found, fallback to static mock data
    if (
        Object.keys(dynamicStorageData.storage.configuration).length === 0 &&
        dynamicStorageData.storage.layout.length === 0
    ) {
        return storageMockOracleData;
    }

    return dynamicStorageData;
};

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

export interface OracleCategorySectionProps {
    styles: Record<string, string>;
    isAccordionExpanded: (id: string, printState: boolean) => boolean | undefined;
    setClickedAccordionId: (id: string) => void;
    loading: boolean | null;
    handleAccordionExpanded: (id: string, isExpanded: boolean) => void;
    isDarkTheme: boolean;
    optimizePrintState: boolean;
    oracleCardData: GwCardDataInterface;
    showDismissedConfigurations: boolean;
    setShowDismissedConfigurations: (value: boolean) => void;
    driftAssessmentData: AssessmentResponseInterface | null;
}

export const getOracleCardStates = (
    oracleCardData: Record<string, any> | null | undefined,
    cardKeys: string[]
): { hasActiveCards: boolean; hasDismissedCards: boolean } => {
    if (!oracleCardData) return { hasActiveCards: false, hasDismissedCards: false };

    let hasActiveCards = false;
    let hasDismissedCards = false;

    cardKeys.forEach(key => {
        const card = oracleCardData[key];
        if (!card) return;

        const configState = card.dismissedObj?.configState;
        const hasValidAssessment = card.block_two?.value;

        if (!hasValidAssessment && configState !== CONFIG_STATES.DISMISSED) {
            hasActiveCards = true;
        }

        if (!hasValidAssessment) return;

        if (!configState || configState === CONFIG_STATES.ACTIVE || configState === CONFIG_STATES.ACTIVATING) {
            hasActiveCards = true;
        } else if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
            hasDismissedCards = true;
        }
    });

    return { hasActiveCards, hasDismissedCards };
};

export const getShouldShowHeader = (
    showDismissedConfigurations: boolean,
    cardStates: { hasActiveCards: boolean; hasDismissedCards: boolean }
): boolean => {
    if (showDismissedConfigurations) {
        return cardStates.hasDismissedCards;
    }
    return cardStates.hasActiveCards;
};

/**
 * Helper function to get block_one.type based on configurationId and category
 * For flat structure, we use top-level categories only (Storage, Compute, Application, Resiliency, Cloning)
 */
const getBlockOneType = (configId: string, category: string): string =>
    // Map category to display name using constants
    WELL_ARCHITECTED_CATEGORY_LABELS[category as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS] ||
    (category ? category.charAt(0).toUpperCase() + category.slice(1) : '');
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

        // Get tags from categories
        const tags = assessment.categories || [];

        // Create card structure matching existing format
        cardsData[configKey] = {
            id: configKey,
            configurationId: configKey, // Store the config id for dismiss flow
            mapName: displayName,
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
                value: assessment.resourceType || '',
                count: {
                    totalObjectsInViolation: assessment.totalObjectsInViolation || 0,
                    totalObjectsAssessed: assessment.totalObjectsAssessed || 0
                }
            },
            block_six: {
                type: 'Impacted resources',
                value: assessment.objectsInViolation?.length ? `${assessment.objectsInViolation.length}` : '0'
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
            tags,
            errorMessage: assessment.errorMessage,
            violationDetails: assessment.violationDetails,
            // Preserve optimizing state if present
            status: optimizingData?.[configKey] || ''
        };

        // Only add dismissedObj if the card is actually dismissed/postponed/activating
        const dismissState = getDismissedState(assessment, data.dismissedConfigurations || []);
        if (dismissState.configState && dismissState.configState !== CONFIG_STATES.ACTIVE) {
            cardsData[configKey].dismissedObj = dismissState;
        }
    });

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
        endTime: (dismissed as any).endTime
    };
};

/**
 * New formatGetWellData for flat structure
 * This replaces the existing formatGetWellData when using flat API
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
    const formattedTimestamp =
        data.metadata?.lastAssessmentTimestamp && !isNaN(Number(data.metadata?.lastAssessmentTimestamp))
            ? formatDateWithTime(data.metadata?.lastAssessmentTimestamp)
            : getCurrentDateTime();

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

    return grouped;
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
