import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import store from '../../store/store';
import { setSelectedConfigSummary } from '../../store/workloadFactory/databaseHomeSlice';
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
    setOntapConfigTableData,
    setOptimizationBreakDown,
    setOptimizingData,
    setOptimizingInstanceData,
    setOsConfigTableData
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { addAllMssqlHostAssessmentData } from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_NAME_TO_ID_MAPPING,
    CONFIG_STATES,
    CONFIG_STATES_UI,
    CONFIG_STATE_ACTIONS,
    FINDINGS,
    GETWELL_CONFIG,
    GETWELL_STATUS,
    GETWELL_VALUES,
    INVENTORY_STATUS,
    JOB_MONITORING_STATUS,
    OPTIMIZE_POLLING_INTERVAL,
    STATUS_CONST
} from '../../utils/consts';
import {
    AssessmentResponseInterface,
    GwCardDataInterface,
    GwSqlServerInstanceInterface,
    PerConfigInterface,
    RSSConfigAdapterInterface
} from '../../utils/types/getWellTypes';
import {
    formatDateWithTime,
    formatNumberWithCustomComma,
    getCurrentDateTime,
    sortListOfDict
} from '../../utils/utilityFunctions';

// This is strutcure of cardDataDefault. It is used to set the default values for the card data.
export const cardDataDefault: GwCardDataInterface = {
    storage_tier: {
        id: 'performance-tier',
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
            values: ['Under-provisioned: <35%', 'Optimized: 35-100%', 'Over-provisioned: >100%']
        },
        tags: ['Performance efficiency']
    },
    transaction_log_drive_size: {
        id: 'log-drive-size',
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
                'Ensure accurate sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, \ndatabase unavailability, data corruption, and performance degradation caused by a full log drive.',
            valuesHeading: 'Log drive size percentages are as follows:',
            values: ['Under-provisioned: <20%', 'Optimized: 20-30%', 'Over-provisioned: >30%']
        },
        tags: ['Operational excellence']
    },
    tempdb_drive_size: {
        id: 'tempdb-drive-size',
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
            type: 'TempDB drive size',
            value: ''
        },
        recommendation: {
            title: 'TempDB drive size recommendation',
            description:
                'Ensure accurate sizing and regular monitoring of the SQL Server TempDB to optimize performance and maintain overall stability.\nProperly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
            valuesHeading: 'TempDB drive size percentages are as follows:',
            values: ['Under-provisioned: <10%', 'Optimized: 10-20%', 'Over-provisioned: >20%']
        },
        tags: ['Operational excellence']
    },
    user_data_files: {
        id: 'data-files-location',
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
            type: 'TempDB placement',
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
    Latency: {
        block_one: {
            value: 'Latency',
            type: 'Storage performance '
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Latency',
            value: '< 20 ms'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        },
        tags: []
    },
    Throughput: {
        block_one: {
            value: 'Throughput',
            type: 'Storage performance '
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Throughput',
            value: '> 80%'
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        tags: []
    },
    IOPS: {
        block_one: {
            value: 'IOPS',
            type: 'Storage performance '
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Throughput',
            value: '> 80%'
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        tags: []
    },
    compute_rightsizing: {
        id: 'compute-rightsizing',
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
                'To ensure optimal performance and cost efficiency for your SQL Server EC2 instance, we recommend rightsizing based on your workload demands.\nIf your current instance is under-provisioned, upgrading will enhance CPU, memory, and I/O capacity.\nIf it is over-provisioned, downgrading will maintain performance while reducing costs.\nClick Optimize to compare costs between your current and recommended instance types and to identify potential savings.'
        },
        tags: ['Cost optimization', 'Performance efficiency']
    },
    rss_config: {
        id: 'rss-config',
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
    host_os_patch: {
        id: 'host-os-patch',
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
                        'A license is considered "not optimized" when Workload Factory detects that your database \ninfrastructure doesn\'t use any of the commercial software license features you\'re paying for. An unoptimized license \nmight result in unnecessary costs.'
                },
                {
                    title: 'Optimized: ',
                    description:
                        'A license is considered "optimized" when the commercial software license for your databases meets your \nperformance requirements.'
                }
            ],
            info: 'The SQL Server license assessment and recommendation are provided at the host level.'
        },
        tags: ['Cost optimization']
    },
    microsoft_sql_patch: {
        id: 'microsoft-sql-patch',
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
            title: 'MAXDOP assessment recommendation',
            descriptionRssConfig: {
                first: 'Set the Maximum Degree of Parallelism (MAXDOP) to optimize query performance by balancing parallel processing. \nAccurate MAXDOP configuration enhances performance and efficiency. Setting MAXDOP to 4, 8, or 16 generally \nprovides the best results in most use cases. We recommend that you test your workload and monitor for any \nparallelism-related wait types such as CXPACKET.'
            }
        },
        tags: ['Performance efficiency']
    },
    scheduled_local_snapshot: {
        id: 'snapshot-policy',
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
            title: 'Scheduled local snapshot assessment recommendation',
            description:
                'Local snapshots allows you to create instantaneous capacity efficient point-in-time images of your data volumes.\nUse local snapshots as an additional backup mechanism for quick restores or for testing.'
        },
        tags: ['Reliability']
    },
    crr: {
        id: 'crr',
        category: 'application',
        block_one: {
            type: GENERAL.RESILIENCY,
            value: GENERAL.CRR
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
            title: 'Cross-Region Replication (CRR) assessment recommendation',
            description:
                'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. It is recommended to configure CRR for disaster recovery and compliance requirements.'
        },
        tags: ['Reliability']
    },
    scheduled_FSx_for_ONTAP_backups: {
        id: 'aws-backup-policy',
        category: 'application',
        block_one: {
            type: GENERAL.RESILIENCY,
            value: GENERAL.SCHEDULED_FSX_FOR_ONTAP_BACKUPS
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
            type: 'File system',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Scheduled FSx for ONTAP backups recommendation',
            description:
                'Backing up your SQL Server volumes is crucial for supporting your data retention and compliance requirements. \nUse FSx for ONTAP backup to implement a centrally managed, automated backup and retention strategy for your SQL Server data.'
        },
        tags: ['Reliability']
    },
    clone_management: {
        id: 'clone',
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
                'Old clones can incur significant costs. Consider deleting or refreshing these clones to optimize your storage expenses.'
        },
        tags: ['Cost Efficiency']
    }
};

export const formatApplicationCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    let item: any = data?.license;
    let categoryVal = 'application';
    let itemName = item?.name || 'sql-license';
    let status = item?.status || '';
    let severity = item?.severity || '';
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
            id: item?.name,
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
    let item: any = data?.mssqlPatch;
    let categoryVal = 'application';
    let itemName = item?.name || 'mssql-patch';
    let status = item?.status || '';
    let severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let totalPatches = 0;
    let criticalPatches = 0;
    let importantPatches = 0;
    let missingPatchList: any = [];
    data?.mssqlPatch?.missingPatchesInEc2Instances?.map(perInstance => {
        totalPatches += perInstance?.criticalMissingPatchesCount || 0;
        totalPatches += perInstance?.importantMissingPatchesCount || 0;
        criticalPatches += perInstance?.criticalMissingPatchesCount || 0;
        importantPatches += perInstance?.importantMissingPatchesCount || 0;
        missingPatchList = [...missingPatchList, ...(perInstance?.missingPatchDetails || [])];
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
            id: item?.name,
            category: categoryVal,
            sqlPatchMissingPatches: {
                critical: criticalPatches,
                important: importantPatches
            },
            recommendationText: item?.recommendation,
            missingPatchList: missingPatchList,
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
    let item: any = data?.maxDOP;
    let categoryVal = 'application';
    let itemName = item?.name || 'maxdop';
    let status = item?.status || '';
    let severity = item?.severity || '';
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
            id: item?.name,
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
    let item: any = data?.snapshotPolicy;
    let categoryVal = 'resiliency';
    let itemName = 'snapshot-policy';
    let status = item?.status || '';
    let severity = item?.severity || '';
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
            id: item?.name,
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
    let item: any = data?.awsBackup;
    let categoryVal = 'resiliency';
    let itemName = 'aws-backup-policy';
    let status = item?.status || '';
    let severity = item?.severity || '';
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
            id: item?.name,
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
    let item: any = data?.crr;
    let categoryVal = 'resiliency';
    let itemName = item?.name || 'crr';
    let status = item?.status || '';
    let severity = item?.severity || '';
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
            id: item?.name,
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
    let item: any = data?.clone;
    let categoryVal = 'cloning';
    let itemName = item?.name || 'clone';
    let status = item?.status || '';
    let severity = item?.severity || '';
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
            id: item?.name,
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
    let item: any = data?.hostOsPatch;
    let categoryVal = 'compute';
    let itemName = item?.name || 'host-os-patch';
    let status = item?.status || '';
    let severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let totalViolations = 0;
    let criticalViolations = 0;
    let securityViolations = 0;
    let otherViolations = 0;
    let missingPatchList: any = [];
    data?.hostOsPatch?.ec2InstancesToPatch?.map(perInstance => {
        totalViolations += perInstance?.criticalNonCompliantCount || 0;
        totalViolations += perInstance?.securityNonCompliantCount || 0;
        totalViolations += perInstance?.otherNonCompliantCount || 0;
        criticalViolations += perInstance?.criticalNonCompliantCount || 0;
        securityViolations += perInstance?.securityNonCompliantCount || 0;
        otherViolations += perInstance?.otherNonCompliantCount || 0;
        missingPatchList = [...missingPatchList, ...(perInstance?.missingPatchDetails || [])];
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
            id: item?.name,
            category: categoryVal,
            errorMessage: item?.errorMessage,
            osPatchMissingPatches: {
                critical: criticalViolations,
                security: securityViolations,
                other: otherViolations
            },
            recommendationText: item?.recommendation,
            missingPatchList: missingPatchList,
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
    let item: any = data?.rssConfig;
    let categoryVal = 'compute';
    let itemName = item?.name || 'rss-config';
    let status = item?.status || '';
    let severity = item?.severity || '';
    if (optimizingData?.[itemName]) {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let findingReasons = 0;
    let optimizedRows: any = {
        tcpOffloading: GENERAL.FINDINGS.OPTIMIZED,
        receiveQueues: GENERAL.FINDINGS.OPTIMIZED,
        rssProfile: GENERAL.FINDINGS.OPTIMIZED,
        rssStatus: GENERAL.FINDINGS.OPTIMIZED,
        baseProcessorNumber: GENERAL.FINDINGS.OPTIMIZED
    };
    let optimizedValue: any = {
        tcpOffloading: item?.tcpOffloadState,
        receiveQueues: item?.recommendedAdapterSettings?.recommendedReceiveQueues,
        rssProfile: item?.recommendedAdapterSettings?.recommendedRssProfile,
        rssStatus: 'Enabled',
        baseProcessorNumber: item?.recommendedAdapterSettings?.recommendedBaseProcessorNumber
    };

    let totalAdapters = item?.rssAdapters?.length || 0;
    let nonOptimizedAdapters = 0;
    let notOptimizedAdapters: any = [];

    if (item?.tcpOffloadState?.toLowerCase() === 'enabled') {
        findingReasons++;
        optimizedRows['tcpOffloading'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
        optimizedValue['tcpOffloading'] = 'Enabled';
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
            optimizedRows['rssProfile'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue['rssProfile'] = adapter?.rssProfile;
            optimizedRows['rssStatus'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue['rssStatus'] = 'Disabled';
            optimizedRows['baseProcessorNumber'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue['baseProcessorNumber'] = adapter?.baseProcessorNumber;
            optimizedRows['receiveQueues'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
            optimizedValue['receiveQueues'] = adapter?.numberOfReceiveQueues;
        } else {
            if (adapter?.rssProfile !== item?.recommendedAdapterSettings?.recommendedRssProfile) {
                findingReasons++;
                if (optimizedRows?.['rssProfile'] === GENERAL.FINDINGS.NOT_OPTIMIZED) {
                    optimizedValue['rssProfile'] = GENERAL.MULTIPLE_VALUES;
                } else {
                    optimizedRows['rssProfile'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
                    optimizedValue['rssProfile'] = adapter?.rssProfile;
                }
            }
            if (adapter?.baseProcessorNumber !== item?.recommendedAdapterSettings?.recommendedBaseProcessorNumber) {
                findingReasons++;
                if (optimizedRows?.['baseProcessorNumber'] === GENERAL.FINDINGS.NOT_OPTIMIZED) {
                    optimizedValue['baseProcessorNumber'] = GENERAL.MULTIPLE_VALUES;
                } else {
                    optimizedRows['baseProcessorNumber'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
                    optimizedValue['baseProcessorNumber'] = adapter?.baseProcessorNumber;
                }
            }
            if (adapter?.numberOfReceiveQueues !== item?.recommendedAdapterSettings?.recommendedReceiveQueues) {
                findingReasons++;
                if (optimizedRows?.['receiveQueues'] === GENERAL.FINDINGS.NOT_OPTIMIZED) {
                    optimizedValue['receiveQueues'] = GENERAL.MULTIPLE_VALUES;
                } else {
                    optimizedRows['receiveQueues'] = GENERAL.FINDINGS.NOT_OPTIMIZED;
                    optimizedValue['receiveQueues'] = adapter?.numberOfReceiveQueues;
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
            id: item?.name,
            category: categoryVal,
            errorMessage: item?.errorMessage,
            rssAdapters: item?.rssAdapters,
            recommendedAdapterSettings: item?.recommendedAdapterSettings,
            notOptimizedAdapters: notOptimizedAdapters,
            tcpOffloadState: item?.tcpOffloadState,
            rssOptimizedRows: optimizedRows,
            rssOptimizedValues: optimizedValue,
            recommendationText: item?.recommendation,
            dismissedObj: data?.dismissedConfigurations?.rssConfig
        }
    };
    return cardsData;
};

/** Function to map the dismissed values */
const mapDismissedValues = (data: any, itemName: string | any) => {
    for (const key in data) {
        const section = data[key];
        if (Array.isArray(section)) {
            //For sizing and layout
            for (const item of section) {
                if (item.name === itemName) {
                    return item;
                }
            }
        } else if (typeof section === 'object') {
            //For configuration
            for (const subKey in section) {
                const subSection = section[subKey];
                if (Array.isArray(subSection)) {
                    for (const item of subSection) {
                        if (item.name === itemName) {
                            return item;
                        }
                    }
                }
            }
        }
    }
    return null;
};

// This function is used to format the data for the individual card main config.
export const formatIndividualCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string }
) => {
    let cardsData: any = cardDataDefault;
    let cardMainConfig = [data?.storage?.sizing, data?.storage?.layout];
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
            categoryVal = 'storage';
        } else if (index === 2) {
            categoryVal = 'compute';
        }

        category?.map((item: PerConfigInterface) => {
            let itemName = item?.name || '';
            let status = item?.status || '';
            let severity = item?.severity || '';
            if (optimizingData?.[itemName] && optimizingData?.[itemName] !== '') {
                status = optimizingData?.[itemName];
            }
            itemName = GETWELL_CONFIG?.[itemName] || itemName;

            let blockThreeValue = '';
            if (categoryVal === 'storage') {
                blockThreeValue = GETWELL_VALUES?.[item?.current || ''] || item?.current;
            } else {
                blockThreeValue = GETWELL_VALUES?.[item?.recommended || ''] || item?.recommended;
            }

            let blockSixValue: string | undefined = '';
            let blockSixCountObject = null;
            if (
                itemName === 'storage_tier' ||
                itemName === 'transaction_log_drive_size' ||
                itemName === 'user_data_files' ||
                itemName === 'transaction_log_files'
            ) {
                blockSixValue = (item?.totalObjectsInViolation || 0) + ' out of ' + (item?.totalObjectsAssessed || 0);
                blockSixCountObject = {
                    totalObjectsInViolation: item?.totalObjectsInViolation || 0,
                    totalObjectsAssessed: item?.totalObjectsAssessed || 0
                };
            } else if (
                itemName === 'file_system_headroom' ||
                itemName === 'tempdb_drive_size' ||
                itemName === 'tempdb_files'
            ) {
                blockSixValue = GETWELL_VALUES?.[item?.current || ''] || item?.current;
            } else if (categoryVal === 'storage') {
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

// This function is used to format the ONTAP configuration data.
export const formatOntapConfig = (data: AssessmentResponseInterface, optimizingData: { [key: string]: string }) => {
    let ontapTagsList: Array<string> = [];
    let highestOntapSeverity = 'None';
    let formatOntapConfigList: PerConfigInterface[] = [];
    let ontapCritical = 0;
    let ontapWarning = 0;
    let volumesList = data?.storage?.configuration?.volumes;
    if (volumesList && !volumesList?.[0]?.errorMessage) {
        data?.storage?.configuration?.volumes?.map((item: PerConfigInterface) => {
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            formatOntapConfigList.push({
                ...item,
                id: item?.name,
                type: 'volume',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            });
            if (item?.severity === 'critical') {
                ontapCritical = 1;
            } else if (item?.severity === 'warning') {
                ontapWarning = 1;
            }
            ontapTagsList = [...ontapTagsList, ...(item?.tags || [])];
        });
    }

    let lunsList = data?.storage?.configuration?.luns;
    if (lunsList && !lunsList?.[0]?.errorMessage) {
        data?.storage?.configuration?.luns?.map((item: PerConfigInterface) => {
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
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            });
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

    let ontapVolAndLunList = [];
    if (volumesList && !volumesList?.[0]?.errorMessage) {
        ontapVolAndLunList.push(data?.storage?.configuration?.volumes);
    }
    if (lunsList && !lunsList?.[0]?.errorMessage) {
        ontapVolAndLunList.push(data?.storage?.configuration?.luns);
    }
    ontapVolAndLunList?.map(type => {
        type?.map((item: PerConfigInterface) => {
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            if (status === 'optimized') {
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
export const formatOsConfig = (data: AssessmentResponseInterface, optimizingData: { [key: string]: string }) => {
    let osTagsList: Array<string> = [];
    let highestOsSeverity = 'None';
    let formatOsConfigList: PerConfigInterface[] = [];
    let osCritical = 0;
    let osWarning = 0;
    let osList = data?.storage?.configuration?.os;
    if (osList && !osList?.[0]?.errorMessage) {
        data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            formatOsConfigList.push({
                ...item,
                id: item?.name,
                type: 'os',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            });
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
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            if (status === 'optimized') {
                osOptimizedConfig++;
            } else {
                osNotOptimizedConfig++;
            }
        });
    }
    return { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity };
};

// This function is used to format the optimization breakdown data.
export const formatOptimizationBreakDown = (cardsData: any) => {
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

    let hasDismissedOrPostponedStorage = false;
    let hasDismissedOrPostponedCompute = false;
    let hasDismissedOrPostponedApplication = false;
    let hasDismissedOrPostponedResiliency = false;
    let hasDismissedOrPostponedCloning = false;

    Object.keys(cardsData).forEach(key => {
        const nestedObject = cardsData[key];
        const dismissedState = nestedObject?.dismissedObj?.state;
        const isOptimizedViaDismissal =
            dismissedState === CONFIG_STATES.DISMISSED || dismissedState === CONFIG_STATES.POSTPONED;
        if (nestedObject?.category === 'storage') {
            if (isOptimizedViaDismissal) hasDismissedOrPostponedStorage = true;
            if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedStorage++;
            } else {
                notOptimizedStorage++;
            }
        } else if (nestedObject?.category === 'compute') {
            if (isOptimizedViaDismissal) hasDismissedOrPostponedCompute = true;
            if (
                nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED ||
                nestedObject?.block_two?.value === GETWELL_STATUS.ANALYZING ||
                isOptimizedViaDismissal
            ) {
                optimizedCompute++;
            } else {
                notOptimizedCompute++;
            }
        } else if (nestedObject?.category === 'application') {
            if (isOptimizedViaDismissal) hasDismissedOrPostponedApplication = true;
            if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedApplication++;
            } else {
                notOptimizedApplication++;
            }
        } else if (nestedObject?.category === 'resiliency') {
            if (isOptimizedViaDismissal) hasDismissedOrPostponedResiliency = true;
            if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedResiliency++;
            } else {
                notOptimizedResiliency++;
            }
        } else if (nestedObject?.category === 'cloning') {
            if (isOptimizedViaDismissal) hasDismissedOrPostponedCloning = true;
            if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED || isOptimizedViaDismissal) {
                optimizedCloning++;
            } else {
                notOptimizedCloning++;
            }
        }
    });

    let storageCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedStorage,
        total: optimizedStorage + notOptimizedStorage,
        optimized: optimizedStorage,
        notOptimized: notOptimizedStorage,
        percent: optimizedStorage
            ? formatNumberWithCustomComma((optimizedStorage / (optimizedStorage + notOptimizedStorage)) * 100)
            : 0
    };
    let computeCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedCompute,
        total: optimizedCompute + notOptimizedCompute,
        optimized: optimizedCompute,
        notOptimized: notOptimizedCompute,
        percent: optimizedCompute
            ? formatNumberWithCustomComma((optimizedCompute / (optimizedCompute + notOptimizedCompute)) * 100)
            : 0
    };
    let applicationCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedApplication,
        total: optimizedApplication + notOptimizedApplication,
        optimized: optimizedApplication,
        notOptimized: notOptimizedApplication,
        percent: optimizedApplication
            ? formatNumberWithCustomComma(
                  (optimizedApplication / (optimizedApplication + notOptimizedApplication)) * 100
              )
            : 0
    };

    let resiliencyCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedResiliency,
        total: optimizedResiliency + notOptimizedResiliency,
        optimized: optimizedResiliency,
        notOptimized: notOptimizedResiliency,
        percent: optimizedResiliency
            ? formatNumberWithCustomComma((optimizedResiliency / (optimizedResiliency + notOptimizedResiliency)) * 100)
            : 0
    };

    let cloningCount = {
        hasDismissedOrPostponed: hasDismissedOrPostponedCloning,
        total: optimizedCloning + notOptimizedCloning,
        optimized: optimizedCloning,
        notOptimized: notOptimizedCloning,
        percent: optimizedCloning
            ? formatNumberWithCustomComma((optimizedCloning / (optimizedCloning + notOptimizedCloning)) * 100)
            : 0
    };

    let optBreakDown = {
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
            notOptimized:
                storageCount?.notOptimized +
                computeCount?.notOptimized +
                applicationCount?.notOptimized +
                resiliencyCount?.notOptimized +
                cloningCount?.notOptimized,
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

export const getCardsData = (data: AssessmentResponseInterface, optimizingData: { [key: string]: string }) => {
    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData);

    let cardsData = formatIndividualCardMainConfig(data, optimizingData);

    cardsData = formatApplicationCardMainConfig(data, optimizingData, cardsData);

    cardsData = formatOsPatchCardConfig(data, optimizingData, cardsData);

    cardsData = formatRssConfigCardConfig(data, optimizingData, cardsData);

    cardsData = formatMicrosoftSqlPatchCardConfig(data, optimizingData, cardsData);

    cardsData = formatMaxdopPatchCardConfig(data, optimizingData, cardsData);

    cardsData = formatSnapshotPolicyCardConfig(data, optimizingData, cardsData);

    cardsData = formatAWSBackUpPolicyCardConfig(data, optimizingData, cardsData);

    cardsData = formatCRRCardConfig(data, optimizingData, cardsData);

    cardsData = formatCloneCardConfig(data, optimizingData, cardsData);

    cardsData = {
        ...cardsData,
        ['ontap_configuration']: {
            ...cardDataDefault?.ontap_configuration,
            block_two: {
                ...cardDataDefault?.ontap_configuration?.block_two,
                value:
                    (ontapOptimizedConfig || 0) + (ontapNotOptimizedConfig || 0) !== 0
                        ? ontapNotOptimizedConfig > 0
                            ? 'Not optimized'
                            : 'Optimized'
                        : ''
            },
            block_three: {
                ...cardDataDefault?.ontap_configuration?.block_three,
                value:
                    ontapNotOptimizedConfig !== 0
                        ? formatNumberWithCustomComma(
                              (ontapNotOptimizedConfig / (ontapOptimizedConfig + ontapNotOptimizedConfig)) * 100
                          ) + '%'
                        : '0%'
            },
            block_four: {
                ...cardDataDefault?.ontap_configuration?.block_four,
                value: highestOntapSeverity
            },
            block_five: {
                ...cardDataDefault?.ontap_configuration?.block_five,
                value:
                    (ontapNotOptimizedConfig || 0) +
                    ' out of ' +
                    ((ontapOptimizedConfig || 0) + (ontapNotOptimizedConfig || 0)),
                count: {
                    totalObjectsAssessed: (ontapOptimizedConfig || 0) + (ontapNotOptimizedConfig || 0),
                    totalObjectsInViolation: ontapNotOptimizedConfig || 0
                }
            },
            tags: ontapTagsList.filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index),
            category: 'storage'
        }
    };

    const { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity } =
        formatOsConfig(data, optimizingData);

    cardsData = {
        ...cardsData,
        ['os_configuration']: {
            ...cardDataDefault?.os_configuration,
            block_two: {
                ...cardDataDefault?.os_configuration?.block_two,
                value:
                    (osOptimizedConfig || 0) + (osNotOptimizedConfig || 0) !== 0
                        ? osNotOptimizedConfig > 0
                            ? 'Not optimized'
                            : 'Optimized'
                        : ''
            },
            block_three: {
                ...cardDataDefault?.os_configuration?.block_three,
                value:
                    osNotOptimizedConfig !== 0
                        ? formatNumberWithCustomComma(
                              (osNotOptimizedConfig / (osOptimizedConfig + osNotOptimizedConfig)) * 100
                          ) + '%'
                        : '0%'
            },
            block_four: {
                ...cardDataDefault?.os_configuration?.block_four,
                value: highestOsSeverity
            },
            block_five: {
                ...cardDataDefault?.os_configuration?.block_five,
                value:
                    (osNotOptimizedConfig || 0) + ' out of ' + ((osOptimizedConfig || 0) + (osNotOptimizedConfig || 0)),
                count: {
                    totalObjectsAssessed: (osOptimizedConfig || 0) + (osNotOptimizedConfig || 0),
                    totalObjectsInViolation: osNotOptimizedConfig || 0
                }
            },
            tags: osTagsList.filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index),
            category: 'storage'
        }
    };

    return { cardsData, formatOntapConfigList, formatOsConfigList };
};

// This function is used to format the get well data.
export const formatGetWellData = (dispatch: any, data?: AssessmentResponseInterface | undefined) => {
    const state = store.getState();
    const optimizingData = state.getWellOptimize.optimizingData || {};
    if (!data) {
        data = state.getWellOptimize.driftAssessmentData || {};
    }
    let { cardsData, formatOntapConfigList, formatOsConfigList } = getCardsData(data, optimizingData);

    let optBreakDown = formatOptimizationBreakDown(cardsData);

    // Dispatch the formatted cards data to the store
    dispatch(setCardData(cardsData));

    // Dispatch the formatted ONTAP configuration data to the store
    dispatch(setOntapConfigTableData(formatOntapConfigList));

    // Dispatch the formatted OS configuration data to the store
    dispatch(setOsConfigTableData(formatOsConfigList));

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

export const getUniqueEntries = (arrays: any) => {
    const combinedArray = [].concat(...arrays);
    const seen = new Set();
    return combinedArray.filter(item => {
        const serializedItem = JSON.stringify(item);
        if (seen.has(serializedItem)) {
            return false;
        } else {
            seen.add(serializedItem);
            return true;
        }
    });
};

export const groupByType = (array: any, returnType: string = 'id') => {
    return array.reduce((acc: any, item: any) => {
        const { type, id, value } = item;
        if (!acc[type]) {
            acc[type] = [];
        }
        const retValue = returnType === 'id' ? id : value;
        if (!acc[type].includes(retValue)) {
            acc[type].push(retValue);
        }
        return acc;
    }, {});
};

export const removeEntry = (input: any, obj: any) => {
    const { id, type } = obj;

    // Create a new object to avoid mutating the original input object
    const updatedInput = { ...input };

    // Check if the type exists in the input object and filter out the id
    if (updatedInput[type]) {
        updatedInput[type] = updatedInput[type].filter((item: any) => item !== id);
    }

    return updatedInput;
};

export const removeObjectFromArray = (array: any, obj: any) => {
    return array.filter((item: any) => {
        return !(item.id === obj.id && item.label === obj.label && item.value === obj.value && item.type === obj.type);
    });
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
export const applyFilter = (cardData: any, optimizeFilterTags: any) => {
    let filteredCardData: any = {};
    let configCount = 0;
    const filters = groupByType(optimizeFilterTags, 'value');

    const categoryData: any = {
        file_system_headroom: { category: 'Storage', subCategory: 'Storage sizing' },
        storage_tier: { category: 'Storage', subCategory: 'Storage sizing' },
        transaction_log_drive_size: { category: 'Storage', subCategory: 'Storage sizing' },
        tempdb_drive_size: { category: 'Storage', subCategory: 'Storage sizing' },
        user_data_files: { category: 'Storage', subCategory: 'Storage layout' },
        transaction_log_files: { category: 'Storage', subCategory: 'Storage layout' },
        tempdb_files: { category: 'Storage', subCategory: 'Storage layout' },
        ontap_configuration: { category: 'Storage', subCategory: 'Storage configuration' },
        os_configuration: { category: 'Storage', subCategory: 'Storage configuration' },
        compute_rightsizing: { category: 'Compute', subCategory: 'Compute_sub' },
        host_os_patch: { category: 'Compute', subCategory: 'Compute_sub' },
        rss_config: { category: 'Compute', subCategory: 'Compute_sub' },
        sql_licenses: { category: 'Application', subCategory: 'Application_sub' },
        microsoft_sql_patch: { category: 'Application', subCategory: 'Application_sub' },
        maxdop: { category: 'Application', subCategory: 'Application_sub' },
        scheduled_local_snapshot: { category: 'Resiliency', subCategory: 'Protection' },
        scheduled_FSx_for_ONTAP_backups: { category: 'Resiliency', subCategory: 'Protection' },
        crr: { category: 'Resiliency', subCategory: 'Protection' },
        clone_management: { category: 'Cloning', subCategory: 'Cloning' }
    };

    Object.keys(cardData).map((key: any) => {
        const checkCategory =
            !filters['all-catagories'] || filters['all-catagories']?.includes(categoryData[key]?.category);
        const checkSubCategory =
            !filters['sub-catagories'] || filters['sub-catagories']?.includes(categoryData[key]?.subCategory);

        const isOptmized = cardData[key]['block_two'].value === GETWELL_VALUES.optimized;
        const checkStatus =
            !filters.status ||
            (filters.status?.includes(GETWELL_VALUES.optimized) && isOptmized) ||
            (filters.status?.includes('Not optimized') && !isOptmized);

        const checkSeverity = !filters.severity || filters.severity?.includes(cardData[key]['block_four'].value);

        const checkTags =
            !filters.tags || filters.tags.filter((tag: string) => cardData[key].tags?.includes(tag)).length > 0;

        const checkConfigState =
            !filters.configState ||
            (!cardData[key]['dismissedObj']?.state && filters.configState.includes(CONFIG_STATES.ACTIVE)) ||
            filters.configState?.includes(cardData[key]['dismissedObj']?.state);

        if (checkCategory && checkSubCategory && checkStatus && checkSeverity && checkTags && checkConfigState) {
            filteredCardData[key] = cardData[key];
            if (categoryData[key] && cardData[key]['block_two'].value) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};

export const resetGwValuesOnRefresh = (dispatch: any) => {
    dispatch(setDriftAssessmentData(null));
    dispatch(setCardData(cardDataDefault));
    dispatch(setOsConfigTableData(null));
    dispatch(setOntapConfigTableData(null));
    dispatch(setOptimizationBreakDown(null));
    dispatch(setOptimizingData({}));
    dispatch(setOptimizingInstanceData(false));
};

// This function is used to update the progress of the optimization process for assessment confif resource level jobs.
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
    let uniqueRanList: any = [];
    let newInProgressResourceOptimizationData: any = {
        ...inProgressResourceOptimizeData,
        [type]: inProgressResourceOptimizeData?.[type]?.filter((instanceId: any) => {
            const jobInstances =
                jobToInstanceMapForBulk[jobId]?.databaseHosts.flatMap((host: any) =>
                    host?.sqlServerInstances?.flatMap((instance: any) =>
                        instance?.clones?.map((clone: any) => {
                            uniqueRanList.push(`${host?.id}_${instance?.instanceId}_${clone?.cloneDatabaseName}`);
                            return `${host?.id}_${instance?.instanceId}_${clone?.cloneDatabaseName}`;
                        })
                    )
                ) || [];
            return !jobInstances.includes(instanceId);
        })
    };
    dispatch(setInProgressResourceOptimizeData(newInProgressResourceOptimizationData));

    let cloneIsOptimizedRowsList = {};
    let newCloneDashboardData = cloneDashboardData?.objectsInViolation?.map((row: any) => {
        if (uniqueRanList.includes(`${row?.resourceId}_${row?.instanceId}_${row?.cloneDatabaseName}`)) {
            cloneIsOptimizedRowsList = {
                ...cloneIsOptimizedRowsList,
                [`${row?.resourceId}_${row?.instanceId}_${row?.cloneDatabaseName}`]: true
            };
            return {
                ...row,
                isOptimized: true
            };
        } else {
            return row;
        }
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

    let newInProgressOptimizationData = {
        ...inProgressOptimizationData,
        [type]: inProgressOptimizationData?.[type]?.filter((instanceId: any) => {
            const jobInstances =
                jobToInstanceMapForBulk[jobId]?.databaseHosts.flatMap((host: any) =>
                    host.sqlServerInstances.map((instance: any) => `${host.id}_${instance?.instanceId}`)
                ) || [];
            return !jobInstances.includes(instanceId);
        })
    };
    dispatch(setInProgressOptimizationData(newInProgressOptimizationData));

    let newInProgressHostData = {
        ...inProgressHostData,
        [type]: inProgressHostData?.[type]?.filter(
            //Data host id to check
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
                    jobToInstanceMapForBulk[jobId]?.databaseHosts.flatMap((host: any) =>
                        host.sqlServerInstances.map((instance: any) => `${host.id}_${instance}`)
                    ) || [];
                return !jobInstances.includes(instanceId);
            })
        })
    );
    dispatch(
        setInProgressHostData({
            ...inProgressHostData,
            [type]: inProgressHostData?.[type]?.filter(
                //Data host id to check
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
                    instanceId !== jobToInstanceMap[jobId]?.hostId + '_' + jobToInstanceMap[jobId]?.instanceId
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
    bulkRowData: any
) => {
    const state = store.getState();
    const { allmssqlHostAssessmentData } = state.inventoryV2;
    const {
        jobToInstanceMap,
        jobToInstanceMapForBulk,
        inProgressOptimizationData,
        inProgressHostData,
        optimizingData
    } = state.getWellOptimize;
    dispatch(addAllMssqlHostAssessmentData(allmssqlHostAssessmentData));

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
            updateOptimizationStatus(row, dispatch);
        });
        setTimeout(() => {
            formatGetWellData(dispatch);
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: `${bulkRowData?.[0]?.name} instances optimized successfully.`
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

        updateOptimizationStatus(rowData, dispatch);
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.SUCCESS,
                message: `${rowData?.name} optimized successfully.`
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
    subjobs: any
) => {
    const state = store.getState();
    const { allmssqlHostAssessmentData } = state.inventoryV2;
    const {
        jobToInstanceMap,
        jobToInstanceMapForBulk,
        inProgressOptimizationData,
        inProgressHostData,
        optimizingData
    } = state.getWellOptimize;
    dispatch(addAllMssqlHostAssessmentData(allmssqlHostAssessmentData));

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
                return (
                    subjob?.status === JOB_MONITORING_STATUS.COMPLETED &&
                    subjob?.hostsToOptimize?.[0]?.resourceId === row?.hostId &&
                    subjob?.hostsToOptimize?.[0]?.sqlServerInstances?.[0] === row?.instanceId
                );
            });
            if (isSuccess?.length) {
                successJobCount++;
                updateOptimizationStatus(row, dispatch);
            }
        });
        setTimeout(() => {
            formatGetWellData(dispatch);
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: `${successJobCount} out of ${bulkRowData?.length} ${bulkRowData?.[0]?.name} instances optimized successfully.`
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
        updateOptimizationStatus(rowData, dispatch);
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.SUCCESS,
                message: `${rowData?.name} optimized successfully.`
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
    failedMsgData: any
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
            formatGetWellData(dispatch);
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
        formatGetWellData(dispatch);
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
    bulkRowData?: any
) => {
    const state = store.getState();
    let optimizingData = state.getWellOptimize.optimizingData || {};
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
                            updateOptimizationStatus(row, dispatch);
                        });
                        setTimeout(() => {
                            formatGetWellData(dispatch);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                                    message: `Clone databases optimized successfully.`
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
                                return (
                                    subjob?.status === JOB_MONITORING_STATUS.COMPLETED &&
                                    subjob?.hostsToOptimize?.[0]?.resourceId === row?.hostId &&
                                    subjob?.hostsToOptimize?.[0]?.sqlServerInstances?.[0] === row?.instanceId
                                );
                            });
                            if (isSuccess?.length) {
                                successJobCount++;
                                updateOptimizationStatus(row, dispatch);
                            }
                        });
                        setTimeout(() => {
                            formatGetWellData(dispatch);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.INFO,
                                    message: `${successJobCount} out of ${bulkRowData?.length} ${bulkRowData?.[0]?.name} instances optimized successfully.`
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
            let { inProgressOptimizationData, inProgressHostData, inProgressResourceOptimizeData } =
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
                inProgressResourceOptimizeData({
                    ...inProgressResourceOptimizeData,
                    [type]: inProgressResourceOptimizeData?.[type]?.filter((instanceId: any) => {
                        const jobResource =
                            bulkRowData?.map(
                                (instance: any) =>
                                    `${instance?.hostId}_${instance?.instanceId}_${instance?.cloneDatabaseName}`
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
                        //Data host id to check
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
    isOptimizeInnerPage?: boolean
) => {
    const state = store.getState();
    let optimizingData = state.getWellOptimize.optimizingData || {};

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
                        updateAssessmentWithCompletedJobs(dispatch, operation, type, jobId, rowData, bulkRowData);
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
                            subjobs
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
                            failedMsgData
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                    }
                });
            }, OPTIMIZE_POLLING_INTERVAL);
        } else {
            let { inProgressOptimizationData, inProgressHostData } = state.getWellOptimize;
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
                            //Data host id to check
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
                let selectedDatabaseInstance = state.getWellOptimize.selectedDatabaseInstance || '';
                let selectedResourceId = state.getWellOptimize.selectedResourceId || '';
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
                            (instanceId: any) => instanceId !== selectedResourceId + '_' + selectedDatabaseInstance
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

export const updateOptimizationStatus = (rowData: any, dispatch: any) => {
    const state = store.getState();
    const updatedAsessmentData = state.inventoryV2.allmssqlHostAssessmentData?.map((hostData: any) => {
        if (
            hostData?.databaseHostId === rowData?.hostId &&
            hostData?.credentialId === rowData?.credentialId &&
            hostData?.regionId === rowData?.regionId
        ) {
            const updatedInstancesAssessment = hostData?.instancesAssessment?.map((instance: any) => {
                if (instance?.databaseInstanceId === rowData?.instanceId) {
                    const storageSizingMap: any = CONFIG_NAME_TO_ID_MAPPING.STORAGE_SIZING_MAP;
                    const storageConfigurationMap: any = CONFIG_NAME_TO_ID_MAPPING.STORAGE_CONFIG_MAP;
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
                                        } else {
                                            return item;
                                        }
                                    })
                                }
                            }
                        };
                    } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                compute: { ...instance.assessments.compute, status: 'optimized' }
                            }
                        };
                    } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                maxDOP: { ...instance.assessments.maxDOP, status: 'optimized' }
                            }
                        };
                    } else if (storageConfigurationMap[rowData?.id]) {
                        const key = storageConfigurationMap[rowData?.id];
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                storage: {
                                    ...instance?.assessments?.storage,
                                    configuration: {
                                        ...instance?.assessments?.storage?.configuration,
                                        [key]: instance?.assessments?.storage?.configuration[key].map((item: any) => {
                                            if (item.name === rowData?.id) {
                                                return { ...item, status: 'optimized' };
                                            } else {
                                                return item;
                                            }
                                        })
                                    }
                                }
                            }
                        };
                    } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
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
                        } else {
                            // If not all clone databases are optimized for a instance
                            return {
                                ...instance,
                                assessments: {
                                    ...instance?.assessments,
                                    clone: { ...instance.assessments.clone, status: 'not-optimized' }
                                }
                            };
                        }
                    } else {
                        return instance;
                    }
                } else {
                    return instance;
                }
            });
            return { ...hostData, instancesAssessment: updatedInstancesAssessment };
        } else {
            return hostData;
        }
    });
    dispatch(addAllMssqlHostAssessmentData(updatedAsessmentData));
};

export const updateConfigStateStatus = (rowData: any, dispatch: any, action: any) => {
    let setAction = '';
    if (action === CONFIG_STATE_ACTIONS.DISMISS) {
        setAction = CONFIG_STATES.DISMISSED;
    } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
        setAction = CONFIG_STATES.POSTPONED;
    } else if (action === CONFIG_STATE_ACTIONS.ACTIVE) {
        setAction = CONFIG_STATES.ACTIVATING;
    }
    const state = store.getState();
    const updatedAsessmentData = state.inventoryV2.allmssqlHostAssessmentData?.map((hostData: any) => {
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
                    const otherConfigMap: any = CONFIG_NAME_TO_ID_MAPPING.NON_STORAGE_CONFIG_MAP;
                    if (storageSizingMap[rowData?.name]) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                dismissedConfigurations: {
                                    ...instance?.assessments?.dismissedConfigurations,
                                    storage: {
                                        ...instance?.assessments?.dismissedConfigurations?.storage,
                                        sizing: instance?.assessments?.dismissedConfigurations?.storage?.sizing
                                            ? instance?.assessments?.dismissedConfigurations?.storage?.sizing.map(
                                                  (item: any) => {
                                                      if (item?.name === storageSizingMap[rowData?.name]) {
                                                          return {
                                                              ...item,
                                                              state: setAction,
                                                              endTime: rowData?.endTime
                                                          };
                                                      } else {
                                                          return item;
                                                      }
                                                  }
                                              )
                                            : [
                                                  {
                                                      name: storageSizingMap[rowData?.name],
                                                      state: setAction,
                                                      endTime: rowData?.endTime
                                                  }
                                              ]
                                    }
                                } || {
                                    storage: {
                                        sizing: [
                                            {
                                                name: storageSizingMap[rowData?.name],
                                                state: setAction,
                                                endTime: rowData?.endTime
                                            }
                                        ]
                                    }
                                }
                            }
                        };
                    } else if (storageLayoutMap[rowData?.name]) {
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                dismissedConfigurations: {
                                    ...instance?.assessments?.dismissedConfigurations,
                                    storage: {
                                        ...instance?.assessments?.dismissedConfigurations?.storage,
                                        layout: instance?.assessments?.dismissedConfigurations?.storage?.layout
                                            ? instance?.assessments?.dismissedConfigurations?.storage?.layout.map(
                                                  (item: any) => {
                                                      if (item?.name === storageLayoutMap[rowData?.name]) {
                                                          return {
                                                              ...item,
                                                              state: setAction,
                                                              endTime: rowData?.endTime
                                                          };
                                                      } else {
                                                          return item;
                                                      }
                                                  }
                                              )
                                            : [
                                                  {
                                                      name: storageLayoutMap[rowData?.name],
                                                      state: setAction,
                                                      endTime: rowData?.endTime
                                                  }
                                              ]
                                    }
                                } || {
                                    storage: {
                                        layout: [
                                            {
                                                name: storageLayoutMap[rowData?.name],
                                                state: setAction,
                                                endTime: rowData?.endTime
                                            }
                                        ]
                                    }
                                }
                            }
                        };
                    } else if (storageConfigurationMap[rowData?.id]) {
                        const key = storageConfigurationMap[rowData?.id];
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                dismissedConfigurations: {
                                    ...instance?.assessments?.dismissedConfigurations,
                                    storage: {
                                        ...instance?.assessments?.dismissedConfigurations?.storage,
                                        configuration: {
                                            ...instance?.assessments?.dismissedConfigurations?.storage?.configuration,
                                            [key]: instance?.assessments?.dismissedConfigurations?.storage
                                                ?.configuration?.[key]
                                                ? instance?.assessments?.dismissedConfigurations?.storage?.configuration?.[
                                                      key
                                                  ].map((item: any) => {
                                                      if (item.name === rowData?.id) {
                                                          return {
                                                              ...item,
                                                              state: setAction,
                                                              endTime: rowData?.endTime
                                                          };
                                                      } else {
                                                          return item;
                                                      }
                                                  })
                                                : [
                                                      {
                                                          name: rowData?.id,
                                                          state: setAction,
                                                          endTime: rowData?.endTime
                                                      }
                                                  ]
                                        }
                                    }
                                }
                            }
                        };
                    } else if (otherConfigMap[rowData?.name]) {
                        let name = otherConfigMap[rowData?.name];
                        return {
                            ...instance,
                            assessments: {
                                ...instance?.assessments,
                                dismissedConfigurations: {
                                    ...instance?.assessments?.dismissedConfigurations,
                                    [name]: instance?.assessments?.dismissedConfigurations?.[name]
                                        ? {
                                              ...instance?.assessments?.dismissedConfigurations?.[name],
                                              state: setAction,
                                              endTime: rowData?.endTime
                                          }
                                        : {
                                              name: name,
                                              state: setAction,
                                              endTime: rowData?.endTime
                                          }
                                }
                            }
                        };
                    } else {
                        return instance;
                    }
                } else {
                    return instance;
                }
            });
            return { ...hostData, instancesAssessment: updatedInstancesAssessment };
        } else {
            return hostData;
        }
    });
    dispatch(addAllMssqlHostAssessmentData(updatedAsessmentData));
};

export const updateConfigStatePerInstance = (setAction: any, name: string, endTime: any) => {
    const state = store.getState();
    const { driftAssessmentData } = state.getWellOptimize;
    const storageSizingMap: any = ['log-drive-size', 'performance-tier', 'headroom', 'tempdb-drive-size'];
    const storageLayoutMap: any = ['data-files-location', 'log-files-location', 'tempdb-files-location'];
    const storageConfigurationMap: any = CONFIG_NAME_TO_ID_MAPPING.STORAGE_CONFIG_MAP;
    const otherConfigMap: any = [
        'compute',
        'max-dop',
        'clone',
        'rss-config',
        'snapshot-policy',
        'aws-backup',
        'mssql-patch',
        'host-os-patch',
        'crr',
        'license'
    ];
    if (storageSizingMap.includes(name)) {
        return {
            ...driftAssessmentData,
            dismissedConfigurations: {
                ...driftAssessmentData?.dismissedConfigurations,
                storage: {
                    ...driftAssessmentData?.dismissedConfigurations?.storage,
                    sizing: driftAssessmentData?.dismissedConfigurations?.storage?.sizing
                        ? driftAssessmentData?.dismissedConfigurations?.storage?.sizing.map((item: any) => {
                              if (item?.name === name) {
                                  return {
                                      ...item,
                                      state: setAction,
                                      endTime: endTime
                                  };
                              } else {
                                  return item;
                              }
                          })
                        : [
                              {
                                  name: name,
                                  state: setAction,
                                  endTime: endTime
                              }
                          ]
                }
            } || {
                storage: {
                    sizing: [
                        {
                            name: name,
                            state: setAction,
                            endTime: endTime
                        }
                    ]
                }
            }
        };
    } else if (storageLayoutMap.includes(name)) {
        return {
            ...driftAssessmentData,
            dismissedConfigurations: {
                ...driftAssessmentData?.dismissedConfigurations,
                storage: {
                    ...driftAssessmentData?.dismissedConfigurations?.storage,
                    layout: driftAssessmentData?.dismissedConfigurations?.storage?.layout
                        ? driftAssessmentData?.dismissedConfigurations?.storage?.layout.map((item: any) => {
                              if (item?.name === name) {
                                  return {
                                      ...item,
                                      state: setAction,
                                      endTime: endTime
                                  };
                              } else {
                                  return item;
                              }
                          })
                        : [
                              {
                                  name: name,
                                  state: setAction,
                                  endTime: endTime
                              }
                          ]
                }
            } || {
                storage: {
                    layout: [
                        {
                            name: name,
                            state: setAction,
                            endTime: endTime
                        }
                    ]
                }
            }
        };
    } else if (storageConfigurationMap[name]) {
        const key = storageConfigurationMap[name];
        return {
            ...driftAssessmentData,
            dismissedConfigurations: {
                ...driftAssessmentData?.dismissedConfigurations,
                storage: {
                    ...driftAssessmentData?.dismissedConfigurations?.storage,
                    configuration: {
                        ...driftAssessmentData?.dismissedConfigurations?.storage?.configuration,
                        [key]: driftAssessmentData?.dismissedConfigurations?.storage?.configuration?.[key]
                            ? driftAssessmentData?.dismissedConfigurations?.storage?.configuration?.[key].map(
                                  (item: any) => {
                                      if (item.name === key) {
                                          return { ...item, state: setAction, endTime: endTime };
                                      } else {
                                          return item;
                                      }
                                  }
                              )
                            : [
                                  {
                                      name: key,
                                      state: setAction,
                                      endTime: endTime
                                  }
                              ]
                    }
                }
            }
        };
    } else if (otherConfigMap.includes(name)) {
        return {
            ...driftAssessmentData,
            dismissedConfigurations: {
                ...driftAssessmentData?.dismissedConfigurations,
                [name]: driftAssessmentData?.dismissedConfigurations?.[name]
                    ? {
                          ...driftAssessmentData?.dismissedConfigurations?.[name],
                          state: setAction,
                          endTime: endTime
                      }
                    : {
                          name: name,
                          state: setAction,
                          endTime: endTime
                      }
            }
        };
    } else {
        return driftAssessmentData;
    }
};

export const checkIfDisableForOptimize = (
    inProgressHostData: any,
    name: string,
    rowData: any,
    selectedRowsForOptimize?: any
) => {
    let isDisabled = false;
    let errorMessage = '';
    if (inProgressHostData?.[name]?.includes(rowData?.databaseHostId)) {
        isDisabled = true;
        errorMessage = 'Optimization in progress for this host';
    } else if (rowData?.status?.toLowerCase() !== STATUS_CONST.UP.toLowerCase()) {
        isDisabled = true;
        errorMessage = GENERAL.ONLINE_INSTANCE_ASSESS;
    } else if (
        !rowData?.assessmentStatus ||
        rowData?.assessmentStatus?.toLowerCase() === FINDINGS.NOT_APPLICABLE.toLowerCase()
    ) {
        isDisabled = true;
        errorMessage = name + ' ' + GENERAL.NO_ASSESSMENT_DATA;
    } else if (
        name === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE &&
        (rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
            (rowData?.sizingViolations?.overProvisionedDrives?.length &&
                !rowData?.sizingViolations?.underProvisionedDrives?.length))
    ) {
        isDisabled = true;
        errorMessage = GENERAL.LOG_DRIVE_OVER_PROVISIONED_ERROR;
    } else if (
        name === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE &&
        (rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
            (rowData?.sizingViolations?.overProvisionedDrives?.length &&
                !rowData?.sizingViolations?.underProvisionedDrives?.length))
    ) {
        isDisabled = true;
        errorMessage = GENERAL.TEMPDB_DRIVE_OVER_PROVISIONED_ERROR;
    } else if (
        name === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM &&
        (rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
            (rowData?.sizingViolations?.overProvisionedDrives?.length &&
                !rowData?.sizingViolations?.underProvisionedDrives?.length))
    ) {
        isDisabled = true;
        errorMessage = GENERAL.HEADROOM_OVER_PROVISIONED_ERROR;
    } else if (
        (name === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            name === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE ||
            name === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) &&
        rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.NOT_OPTIMIZED.toLowerCase() &&
        !rowData?.sizingViolations?.underProvisionedDrives?.length &&
        rowData?.sizingViolations?.ignoredDrives?.length
    ) {
        isDisabled = true;
        errorMessage = GENERAL.NOT_OPTIMIZED_SHARED_DRIVES;
    } else if (selectedRowsForOptimize && selectedRowsForOptimize.length > 0) {
        isDisabled = true;
        errorMessage = '';
    }

    return { isDisabled, errorMessage };
};

export const disableOptimizeCheckBoxForErrCase = (tableData: any, type: string) => {
    const state = store.getState();
    const { inProgressHostData } = state.getWellOptimize;

    // If no rows are selected, reset `isDisabled` for all rows
    return tableData.map((row: any) => {
        const { isDisabled, errorMessage } = checkIfDisableForOptimize(inProgressHostData, type, row);
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
};

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
        let isDisabled = isBeingOptimized;
        let errorMessage = '';

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

export const disableOptimizeCheckBoxForOptimizeCase = (tableData: any, type: string, selectedRowsForOptimize: any) => {
    const state = store.getState();
    const { inProgressHostData, inProgressOptimizationData } = state.getWellOptimize;

    // Extract IDs of rows currently selected for optimization
    const selectedInstanceIds = selectedRowsForOptimize.map((row: any) => row.id);

    return tableData.map((row: any) => {
        // Check if the current row is being optimized
        const isBeingOptimized =
            selectedInstanceIds.includes(row.id) && inProgressOptimizationData?.[type]?.includes(row.id);

        const hasStatusOffline = row?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP;

        // Combine both conditions
        let isDisabled = isBeingOptimized || hasStatusOffline;
        let errorMessage = '';
        if (!isDisabled) {
            ({ isDisabled, errorMessage } = checkIfDisableForOptimize(inProgressHostData, type, row));
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

export const nameToIdConfigMapping = (name: string) => {
    return name === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE
        ? 'log-drive-size'
        : name === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM
        ? 'headroom'
        : name === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
        ? 'tempdb-drive-size'
        : name === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER
        ? 'performance-tier'
        : name === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING
        ? 'compute-rightsizing'
        : name === ASSESSMENT_CONFIG_NAMES.MAXDOP
        ? 'max-dop'
        : name === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
        ? 'clone'
        : '';
};

export const setOptimizeInnerpageSummary = (type: string, configData: any, dispatch: any) => {
    let configKey = '';
    switch (type) {
        case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
            configKey = 'storageTier';
            break;
        case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
            configKey = 'fileSystemHeadroom';
            break;
        case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
            configKey = 'logDriveSize';
            break;
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
            configKey = 'tempdbDriveSize';
            break;
        case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
            configKey = 'userDataFiles';
            break;
        case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
            configKey = 'logFiles';
            break;
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
            configKey = 'tempdbPlacement';
            break;
        case 'ONTAP':
            configKey = 'ontapConfiguration';
            break;
        case 'Operating system':
            configKey = 'operatingSystem';
            break;
        case GENERAL.COMPUTE_RIGHTSIZING:
            configKey = 'computeRightsizing';
            break;
        case GENERAL.OPERATING_SYSTEM_PATCH:
            configKey = 'operatingSystemPatch';
            break;
        case GENERAL.RSS_CONFIGURATION:
            configKey = 'rssConfiguration';
            break;
        case GENERAL.LICENSE_SQL_SERVER:
            configKey = 'applicationSqlServer';
            break;
        case GENERAL.MICROSOFT_SQL_PATCH:
            configKey = 'mssqlPatch';
            break;
        case GENERAL.MAXDOP_PATCH:
            configKey = 'maxdopPatch';
            break;
        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
            configKey = 'scheduledLocalSnapshot';
            break;
        case ASSESSMENT_CONFIG_NAMES.CRR:
            configKey = 'crr';
            break;
        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
            configKey = 'scheduledawsBackup';
            break;

        case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
            configKey = 'clone';
            break;
    }
    const optimizedInstances = configData[configKey] || 0;
    let configStateValue = '';
    if (!configData?.configState?.[configKey] || configData?.configState?.[configKey]?.includes(CONFIG_STATES.ACTIVE)) {
        configStateValue = CONFIG_STATES_UI.ACTIVE;
    } else if (configData?.configState?.[configKey].includes(CONFIG_STATES.POSTPONED)) {
        configStateValue = CONFIG_STATES_UI.POSTPONED;
    } else if (configData?.configState?.[configKey].includes(CONFIG_STATES.DISMISSED)) {
        configStateValue = CONFIG_STATES_UI.DISMISSED;
    }

    let tooltipText = '';
    if (
        configData?.configState?.[configKey]?.includes(CONFIG_STATES.ACTIVE) &&
        (configData?.configState?.[configKey]?.includes(CONFIG_STATES.POSTPONED) ||
            configData?.configState?.[configKey]?.includes(CONFIG_STATES.DISMISSED))
    ) {
        tooltipText = GENERAL.DISMISS_MIX_CASE_TOOLTIP;
    }
    dispatch(
        setSelectedConfigSummary({
            totalInstances: configData?.total || 0,
            optimizedInstances: optimizedInstances,
            notOptimizedInstances: configData?.total - optimizedInstances,
            optimizationScore: `${Math.round((optimizedInstances / (configData?.total || 1)) * 100)}%`,
            severity: configData?.severityObj?.[configKey] || '',
            configState: configStateValue,
            tooltipText: tooltipText
        })
    );
};
