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
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    CONFIG_STATE_ACTIONS,
    DBType,
    FSXN_STORAGE_PROTOCOLS,
    GETWELL_CONFIG,
    GETWELL_STATUS,
    GETWELL_VALUES,
    ORACLE_ISCSI_ONLY_CARD_IDS,
    ORACLE_ISCSI_ONLY_CARD_KEYS,
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
import {
    areAllSubcategoryConfigurationsDismissed,
    getConfigurationDisplayName,
    shouldShowOntapOsCard,
    handleOptimizeStorageJob,
    isWadExcludedConfig
} from '../../../GetWell/GetWellUtils';
import { createFailedOptimizationMessage, fixingProcessNotification } from './OracleCardComponent/OracleCardComponent';

// Helper function to get the dismiss state for ONTAP/OS cards based on subcategory logic (Oracle version)
const getOracleOntapOsCardDismissState = (
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
            volumeConfigs.length > 0
                ? areAllSubcategoryConfigurationsDismissed(volumeConfigs, dismissedVolumeConfigs, 'volumes')
                : true;

        const allLunsAreDismissed =
            lunConfigs.length > 0
                ? areAllSubcategoryConfigurationsDismissed(lunConfigs, dismissedLunConfigs, 'luns')
                : true;

        // If all volumes and luns are dismissed/postponed, consider the card dismissed
        if (
            (volumeConfigs.length === 0 || allVolumesAreDismissed) &&
            (lunConfigs.length === 0 || allLunsAreDismissed) &&
            (volumeConfigs.length > 0 || lunConfigs.length > 0)
        ) {
            const allDismissedOntapConfigs = [...dismissedVolumeConfigs, ...dismissedLunConfigs];

            if (allDismissedOntapConfigs.length > 0) {
                // Count dismissed vs postponed to determine final state
                const dismissedCount = allDismissedOntapConfigs.filter(
                    (config: any) => config.configState === CONFIG_STATES.DISMISSED
                ).length;
                const postponedCount = allDismissedOntapConfigs.filter(
                    (config: any) => config.configState === CONFIG_STATES.POSTPONED
                ).length;

                const finalState = dismissedCount >= postponedCount ? CONFIG_STATES.DISMISSED : CONFIG_STATES.POSTPONED;

                // If the final state is postponed, get the timestamp from one of the postponed configurations
                if (finalState === CONFIG_STATES.POSTPONED) {
                    const postponedConfig = allDismissedOntapConfigs.find(
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
            osConfigs.length > 0
                ? areAllSubcategoryConfigurationsDismissed(osConfigs, dismissedOsConfigs, ASSESSMENT_CONFIG_NAMES.OS)
                : true;

        // If all OS configurations are dismissed/postponed, consider the card dismissed
        if (allOsAreDismissed && dismissedOsConfigs.length > 0) {
            // Count dismissed vs postponed to determine final state
            const dismissedCount = dismissedOsConfigs.filter(
                (config: any) => config.configState === CONFIG_STATES.DISMISSED
            ).length;
            const postponedCount = dismissedOsConfigs.filter(
                (config: any) => config.configState === CONFIG_STATES.POSTPONED
            ).length;

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

    return undefined;
};

// Helper function to get individual configuration dismiss state (similar to MSSQL version)
const getIndividualConfigDismissState = (
    configName: string,
    type: 'volume' | 'lun' | 'os' | 'sizing',
    dismissedConfigurations: any
): any => {
    let dismissedConfigs: any[] = [];

    if (type === 'volume' || type === 'lun') {
        dismissedConfigs =
            dismissedConfigurations?.storage?.configuration?.[type === 'volume' ? 'volumes' : 'luns'] || [];
    } else if (type === 'os') {
        dismissedConfigs = dismissedConfigurations?.storage?.configuration?.os || [];
    } else if (type === 'sizing') {
        dismissedConfigs = dismissedConfigurations?.storage?.sizing || [];
    }
    const dismissedConfig = dismissedConfigs.find((config: any) => config.configurationName === configName);

    // Return the dismiss state for any configuration that has been dismissed, postponed, or is activating
    if (dismissedConfig) {
        return {
            configState: dismissedConfig.configState,
            startTime: dismissedConfig.startTime,
            endTime: dismissedConfig.endTime
        };
    }

    return undefined;
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
        title: 'Redo logs placement recommendation',
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
        title: 'Temp placement recommendation',
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
        title: 'Archive placement recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Placing archive logs on a dedicated volume ensures efficient backup and recovery processes and helps reduce storage cost.\nBy separating archive logs, you can apply specific storage configurations, such as compression and tiering policies, to optimize cost and performance.\nThis separation also facilitates efficient snapshot and backup strategies, ensuring that archive logs are readily available for recovery without impacting the performance of redo logs, data files, or control files.',
        smallFont: true
    },
    datafiles_placement: {
        id: 'datafiles-placement',
        configName: ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
        title: 'Data files placement recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Placing data files on a dedicated volume or shared with control files boosts performance by isolating their random I/O from redo or archive log writes, reducing contention. This separation allows you to benefit from customized snapshot configurations, tiering policies, and efficiency mechanisms to optimize performance and cost.'
    },
    controlfiles_placement: {
        id: 'controlfiles-placement',
        configName: ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
        title: 'Control files placement recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Oracle strongly recommends multiplexing control files to avoid a single point of failure in production environments. Maintain at least two, preferably three, control file copies across separate volumes or disks to enhance redundancy and reduce the risk of losing all copies. Control files can be placed on a dedicated volume or shared with redo logs or data files, but avoid placing them on volumes tiered to object storage, such as archive volumes, as its slower access pattern is incompatible with control file performance needs.'
    },
    oracle_binary_placement: {
        id: 'oracle-binary-placement',
        configName: ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
        title: 'Oracle binary placement recommendation',
        resourceImpact: 'Impacted volumes',
        resourceType: 'Volume',
        tags: ['Performance efficiency', 'Operational excellence', 'Cost optimization'],
        description:
            'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files.\nThis separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.'
    },
    data_dg_lun_layout: {
        id: 'data-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT,
        title: 'ASM data disk group LUNs layout recommendation',
        resourceImpact: 'Impacted disk groups',
        resourceType: 'Disk group',
        tags: ['Performance efficiency', 'Operational excellence'],
        description:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.\nIt is recommended that ASM Disk Group that contains data files will consist of at least 4-8 LUNs.'
    },
    log_dg_lun_layout: {
        id: 'redolog-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT,
        title: 'ASM logs disk group LUNs layout recommendation',
        resourceImpact: 'Impacted disk groups',
        resourceType: 'Disk group',
        tags: ['Performance efficiency', 'Operational excellence'],
        description:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.\nIt is recommended that ASM Disk Group that contains redo logs will consist of at least 2-8 LUNs.'
    },
    fra_dg_lun_layout: {
        id: 'fra-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT,
        title: 'ASM FRA disk group LUNs layout recommendation',
        resourceImpact: 'Impacted disk groups',
        resourceType: 'Disk group',
        tags: ['Performance efficiency', 'Operational excellence'],
        description:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.\nIt is recommended that ASM Disk Group for archive logs will consist of at least 2-8 LUNs.'
    },
    archivelog_dg_lun_layout: {
        id: 'archivelog-dg-lun-layout',
        configName: ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT,
        title: 'ASM archive disk group LUNs layout recommendation',
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
    // Storage Sizing cards
    swap_space: {
        id: 'swap-space',
        category: 'storage',
        mapName: ASSESSMENT_CONFIG_NAMES.SWAP_SPACE,
        block_one: {
            value: 'Swap space',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Current',
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
            type: 'Swap space',
            value: ''
        },
        recommendation: {
            title: 'Swap space sizing recommendation',
            description:
                'Proper swap sizing ensures that the system can handle memory pressure gracefully, avoiding potential performance degradation or system crashes.',
            valuesHeading: 'Swap space should be sized relatively to RAM:',
            values: [
                'Between 1 GB and 2 GB: 1.5 times the size of the RAM',
                'Between 2 GB and 16 GB: Equal to the size of the RAM',
                'More than 16 GB: 16 GB'
            ]
        },
        tags: ['Performance efficiency']
    },
    file_system_headroom: {
        id: 'headroom',
        category: 'storage',
        mapName: ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
        block_one: {
            value: 'File system headroom',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Current',
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
            type: 'File system headroom',
            value: ''
        },
        recommendation: {
            title: 'File system headroom sizing recommendation',
            description:
                'To optimize storage performance, provision file system capacity as 1.2 times of total size of provisioned volume.',
            valuesHeading: 'File system headroom percentages are as follows:',
            values: ['Under-provisioned: <20%', 'Optimized: 20-50%', 'Over-provisioned: >50%']
        },
        tags: ['Performance efficiency']
    },
    ontap_configuration: {
        id: 'ONTAP',
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
        id: 'Operating system',
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
    host_os_patch: {
        id: 'host-os-patch',
        category: 'compute',
        mapName: ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
        block_one: {
            value: 'Operating system patch',
            type: 'Compute'
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
            value: 'Critical'
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
                'Whenever possible, apply the latest patches to ensure security and stability. Applying the latest patch helps protect your Oracle database servers from vulnerabilities and significantly improves overall system reliability.'
        },
        tags: ['Security', 'Reliability']
    },
    transparent_hugepages: {
        id: 'transparent-hugepages',
        category: 'compute',
        mapName: ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES,
            type: 'Compute'
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
            value: ''
        },
        block_six: {
            type: 'Impacted EC2 instances',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Transparent hugePages recommendation',
            description:
                'Workload Factory recommends disabling Transparent HugePages (THP) on database hosts running Oracle databases. \nDisabling THP is an Oracle best practice to prevent potential performance issues and ensure optimal database stability.'
        },
        tags: ['Performance efficiency']
    },
    tcp_advanced_options: {
        id: 'tcp-advanced-options',
        category: 'compute',
        mapName: ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS,
            type: 'Compute'
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
            value: ''
        },
        block_six: {
            type: 'Impacted EC2 instances',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'TCP advanced options recommendation',
            description:
                'Workload Factory recommends enabling TCP features such as TCP window scaling, timestamps, and selective acknowledgments on Oracle database hosts.'
        },
        tags: ['Reliability', 'Performance efficiency']
    },
    filesystems_io_options: {
        id: 'filesystems-io-options',
        category: 'compute',
        mapName: ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS,
            type: 'Compute'
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
            value: ''
        },
        block_six: {
            type: 'Impacted EC2 instances',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Filesystem I/O options recommendation',
            description:
                'Workload Factory recommends setting filesystemio_options = setall for optimal I/O performance. \nAdjust SGA size if needed when moving away from buffered I/O.'
        },
        tags: ['Performance efficiency']
    },
    multiblock_readcount: {
        id: 'multiblock-readcount',
        category: 'compute',
        mapName: ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT,
            type: 'Compute'
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
            value: ''
        },
        block_six: {
            type: 'Impacted EC2 instances',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Multiblock read count recommendation',
            description:
                'Workload Factory recommends removing db_file_multiblock_read_count from init.ora to prevent performance issues and allow Oracle to manage this setting automatically.'
        },
        tags: ['Performance efficiency']
    },
    snapcenter_snapshot: {
        id: 'snapcenter-snapshot',
        category: 'resiliency',
        mapName: ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT,
            type: 'Resiliency'
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
            value: ''
        },
        block_six: {
            type: 'Impacted volumes',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Application-consistent snapshots recommendation',
            description:
                'Use application-consistent snapshots with NetApp SnapCenter to take accurate, reliable snapshots of your volume data at a specific moment in time. This keeps your apps running smoothly and your data safe. SnapCenter makes backups easier and helps you restore data quickly and correctly, reducing downtime and protecting your most important workloads.'
        },
        tags: ['Reliability']
    },
    crr: {
        id: 'crr',
        category: 'resiliency',
        mapName: ASSESSMENT_CONFIG_NAMES.CRR,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.CRR,
            type: 'Resiliency'
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
            value: ''
        },
        block_six: {
            type: 'Impacted volumes',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Cross-Region Replication (CRR) recommendation',
            description:
                'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems serving Oracle. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. It is recommended to configure CRR for disaster recovery and compliance requirements. Replicating redo logs (when applicable) can also assist with recovery to a specific point in time.'
        },
        tags: ['Reliability']
    },
    aws_backup: {
        id: 'backup-configuration',
        category: 'resiliency',
        mapName: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
            type: 'Resiliency'
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
                'Backup Configuration recommendation: Enable FSx Backup or AWS Backup for Oracle volumes to support data retention and compliance. Avoid redundant backups to optimize costs.'
        },
        tags: ['Reliability']
    },
    clone_management: {
        id: 'clone',
        category: 'cloning',
        mapName: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
            type: 'Cloning'
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
            value: ''
        },
        block_six: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Clone cleanup recommendation',
            description:
                'Old clones can incur significant costs.\nConsider deleting these clones to optimize your storage expenses.'
        },
        tags: ['Cost efficiency']
    },
    oracle_security_patch: {
        id: 'oracle-security-patch',
        category: 'application',
        mapName: ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH,
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH,
            type: 'Application'
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
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Oracle patch recommendation',
            description:
                'Oracle Critical Patch Updates (CPUs) include security fixes for supported self-managed Oracle databases.\nInstalling the latest patch helps protect your database from vulnerabilities and improves system reliability.'
        },
        tags: ['Security', 'Reliability']
    },
    isASMManaged: false,
    storageProtocol: '',
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
    const itemName =
        originalName === 'headroom' ? 'file_system_headroom' : GETWELL_CONFIG?.[originalName] || originalName;

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
        dismissedObj: mapDismissedValues(data?.dismissedConfigurations?.storage, item?.name),
        recommendedValue: item?.recommended
    };
};

// Function to format host OS patch configuration
export const formatOracleHostOsPatchConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const hostOsPatchItem = data?.hostOsPatch;

    const originalName = hostOsPatchItem?.name || 'host-os-patch';
    const status = optimizingData?.[originalName] || hostOsPatchItem?.status || '';
    const severity = hostOsPatchItem?.severity || '';
    let totalViolations = 0;
    let criticalViolations = 0;
    let securityViolations = 0;
    let otherViolations = 0;

    hostOsPatchItem?.ec2InstancesToPatch?.forEach((instance: any) => {
        totalViolations += instance?.criticalNonCompliantCount || 0;
        totalViolations += instance?.securityNonCompliantCount || 0;
        totalViolations += instance?.otherNonCompliantCount || 0;

        criticalViolations += instance?.criticalNonCompliantCount || 0;
        securityViolations += instance?.securityNonCompliantCount || 0;
        otherViolations += instance?.otherNonCompliantCount || 0;
    });

    return {
        ...oracleCardData.host_os_patch,
        block_two: {
            ...oracleCardData.host_os_patch?.block_two,
            value: formatValue(status)
        },
        block_three: {
            ...oracleCardData.host_os_patch?.block_three,
            value: String(totalViolations)
        },
        block_four: {
            ...oracleCardData.host_os_patch?.block_four,
            value: formatValue(severity)
        },
        block_five: {
            ...oracleCardData.host_os_patch?.block_five,
            value: hostOsPatchItem?.resourceType
        },
        block_six: {
            ...oracleCardData.host_os_patch?.block_six,
            value: String(totalViolations)
        },
        tags: hostOsPatchItem?.tags,
        id: hostOsPatchItem?.name || 'host-os-patch',
        category: 'compute',
        errorMessage: hostOsPatchItem?.errorMessage,
        osPatchMissingPatches: {
            critical: criticalViolations,
            security: securityViolations,
            other: otherViolations
        },
        recommendationText: hostOsPatchItem?.recommendation,
        objectsInViolation: hostOsPatchItem?.ec2InstancesToPatch?.map((instance: any) => instance.ec2InstanceId),
        dismissedObj: data?.dismissedConfigurations?.hostOsPatch
    };
};

export const formatOracleTransparentHugepagesConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const item = data?.transparentHugepages;
    const originalName = item?.name || 'transparent-hugepages';
    const status = optimizingData?.[originalName] || item?.status || '';
    const severity = item?.severity || '';
    return {
        ...oracleCardData.transparent_hugepages,
        block_two: { ...oracleCardData.transparent_hugepages?.block_two, value: formatValue(status) },
        block_four: { ...oracleCardData.transparent_hugepages?.block_four, value: formatValue(severity) },
        block_five: { ...oracleCardData.transparent_hugepages?.block_five, value: item?.resourceType || '' },
        block_six: {
            ...oracleCardData.transparent_hugepages?.block_six,
            value: `${item?.totalObjectsInViolation || 0} out of ${item?.totalObjectsAssessed || 0}`,
            count: {
                totalObjectsAssessed: item?.totalObjectsAssessed,
                totalObjectsInViolation: item?.totalObjectsInViolation
            }
        },
        tags: item?.tags,
        id: item?.name || 'transparent-hugepages',
        category: 'compute',
        errorMessage: item?.errorMessage,
        recommendationText: item?.recommendation || oracleCardData.transparent_hugepages?.recommendation?.description,
        objectsInViolation: item?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.transparentHugepages
    };
};

export const formatOracleTcpAdvancedOptionsConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const item = data?.tcpAdvancedOptions;
    const originalName = item?.name || 'tcp-advanced-options';
    const status = optimizingData?.[originalName] || item?.status || '';
    const severity = item?.severity || '';
    return {
        ...oracleCardData.tcp_advanced_options,
        block_two: { ...oracleCardData.tcp_advanced_options?.block_two, value: formatValue(status) },
        block_four: { ...oracleCardData.tcp_advanced_options?.block_four, value: formatValue(severity) },
        block_five: { ...oracleCardData.tcp_advanced_options?.block_five, value: item?.resourceType || '' },
        block_six: {
            ...oracleCardData.tcp_advanced_options?.block_six,
            value: `${item?.totalObjectsInViolation || 0} out of ${item?.totalObjectsAssessed || 0}`,
            count: {
                totalObjectsAssessed: item?.totalObjectsAssessed,
                totalObjectsInViolation: item?.totalObjectsInViolation
            }
        },
        tags: item?.tags,
        id: item?.name || 'tcp-advanced-options',
        category: 'compute',
        errorMessage: item?.errorMessage,
        recommendationText: item?.recommendation || oracleCardData.tcp_advanced_options?.recommendation?.description,
        objectsInViolation: item?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.tcpAdvancedOptions
    };
};

export const formatOracleFilesystemsIoOptionsConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const item = data?.filesystemsIoOptions;
    const originalName = item?.name || 'filesystems-io-options';
    const status = optimizingData?.[originalName] || item?.status || '';
    const severity = item?.severity || '';
    return {
        ...oracleCardData.filesystems_io_options,
        block_two: { ...oracleCardData.filesystems_io_options?.block_two, value: formatValue(status) },
        block_four: { ...oracleCardData.filesystems_io_options?.block_four, value: formatValue(severity) },
        block_five: { ...oracleCardData.filesystems_io_options?.block_five, value: item?.resourceType || '' },
        block_six: {
            ...oracleCardData.filesystems_io_options?.block_six,
            value: `${item?.totalObjectsInViolation || 0} out of ${item?.totalObjectsAssessed || 0}`,
            count: {
                totalObjectsAssessed: item?.totalObjectsAssessed,
                totalObjectsInViolation: item?.totalObjectsInViolation
            }
        },
        tags: item?.tags,
        id: item?.name || 'filesystems-io-options',
        category: 'compute',
        errorMessage: item?.errorMessage,
        recommendationText: item?.recommendation || oracleCardData.filesystems_io_options?.recommendation?.description,
        objectsInViolation: item?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.filesystemsIoOptions
    };
};

export const formatOracleMultiblockReadcountConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const item = data?.multiblockReadcount;
    const originalName = item?.name || 'multiblock-readcount';
    const status = optimizingData?.[originalName] || item?.status || '';
    const severity = item?.severity || '';
    return {
        ...oracleCardData.multiblock_readcount,
        block_two: { ...oracleCardData.multiblock_readcount?.block_two, value: formatValue(status) },
        block_four: { ...oracleCardData.multiblock_readcount?.block_four, value: formatValue(severity) },
        block_five: { ...oracleCardData.multiblock_readcount?.block_five, value: item?.resourceType || '' },
        block_six: {
            ...oracleCardData.multiblock_readcount?.block_six,
            value: `${item?.totalObjectsInViolation || 0} out of ${item?.totalObjectsAssessed || 0}`,
            count: {
                totalObjectsAssessed: item?.totalObjectsAssessed,
                totalObjectsInViolation: item?.totalObjectsInViolation
            }
        },
        tags: item?.tags,
        id: item?.name || 'multiblock-readcount',
        category: 'compute',
        errorMessage: item?.errorMessage,
        recommendationText: item?.recommendation || oracleCardData.multiblock_readcount?.recommendation?.description,
        objectsInViolation: item?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.multiblockReadcount
    };
};

export const formatOracleSnapCenterConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const snapcenterItem = data?.snapcenterSnapshot;

    const originalName = snapcenterItem?.name || 'snapcenter-snapshot';
    const status = optimizingData?.[originalName] || snapcenterItem?.status || '';
    const severity = snapcenterItem?.severity || '';

    return {
        ...oracleCardData.snapcenter_snapshot,
        block_two: {
            ...oracleCardData.snapcenter_snapshot?.block_two,
            value: formatValue(status)
        },
        block_four: {
            ...oracleCardData.snapcenter_snapshot?.block_four,
            value: formatValue(severity)
        },
        block_five: {
            ...oracleCardData.snapcenter_snapshot?.block_five,
            value: snapcenterItem?.resourceType || ''
        },
        block_six: {
            ...oracleCardData.snapcenter_snapshot?.block_six,
            value: `${snapcenterItem?.totalObjectsInViolation || 0} out of ${
                snapcenterItem?.totalObjectsAssessed || 0
            }`,
            count: {
                totalObjectsAssessed: snapcenterItem?.totalObjectsAssessed,
                totalObjectsInViolation: snapcenterItem?.totalObjectsInViolation
            }
        },
        tags: snapcenterItem?.tags,
        id: snapcenterItem?.name || 'snapcenter-snapshot',
        mapName: ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT,
        category: 'resiliency',
        errorMessage: snapcenterItem?.errorMessage,
        recommendationText:
            snapcenterItem?.recommendation || oracleCardData.snapcenter_snapshot?.recommendation?.description,
        objectsInViolation: snapcenterItem?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.snapcenterSnapshot
    };
};

// Function to format CRR configuration for Oracle
export const formatOracleCRRConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const crrItem = data?.crr;

    const originalName = crrItem?.name || 'crr';
    const status = optimizingData?.[originalName] || crrItem?.status || '';
    const severity = crrItem?.severity || '';

    return {
        ...oracleCardData.crr,
        block_two: {
            ...oracleCardData.crr?.block_two,
            value: formatValue(status)
        },
        block_four: {
            ...oracleCardData.crr?.block_four,
            value: formatValue(severity)
        },
        block_five: {
            ...oracleCardData.crr?.block_five,
            value: crrItem?.resourceType || ''
        },
        block_six: {
            ...oracleCardData.crr?.block_six,
            value: `${crrItem?.totalObjectsInViolation || 0} out of ${crrItem?.totalObjectsAssessed || 0}`,
            count: {
                totalObjectsAssessed: crrItem?.totalObjectsAssessed,
                totalObjectsInViolation: crrItem?.totalObjectsInViolation
            }
        },
        tags: crrItem?.tags,
        id: crrItem?.name || 'crr',
        category: 'resiliency',
        errorMessage: crrItem?.errorMessage,
        recommendationText: crrItem?.recommendation || oracleCardData.crr?.recommendation?.description,
        objectsInViolation: crrItem?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.crr
    };
};

export const formatOracleAWSBackupConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const awsBackupItem = (data as any)?.awsBackup;

    const originalName = awsBackupItem?.name || 'backup-configuration';
    const status = optimizingData?.[originalName] || awsBackupItem?.status || '';
    const severity = awsBackupItem?.severity || '';

    return {
        ...oracleCardData.aws_backup,
        block_two: {
            ...oracleCardData.aws_backup?.block_two,
            value: formatValue(status)
        },
        block_four: {
            ...oracleCardData.aws_backup?.block_four,
            value: formatValue(severity)
        },
        block_five: {
            ...oracleCardData.aws_backup?.block_five,
            value: awsBackupItem?.resourceType || ''
        },
        block_six: {
            ...oracleCardData.aws_backup?.block_six,
            value: `${awsBackupItem?.totalObjectsInViolation || 0} out of ${awsBackupItem?.totalObjectsAssessed || 0}`,
            count: {
                totalObjectsAssessed: awsBackupItem?.totalObjectsAssessed,
                totalObjectsInViolation: awsBackupItem?.totalObjectsInViolation
            }
        },
        tags: awsBackupItem?.tags,
        id: awsBackupItem?.name || 'backup-configuration',
        mapName: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
        category: 'resiliency',
        errorMessage: awsBackupItem?.errorMessage,
        recommendationText: awsBackupItem?.recommendation || oracleCardData.aws_backup?.recommendation?.description,
        objectsInViolation: awsBackupItem?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.awsBackup
    };
};

export const formatOracleCloneConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const cloneItem = data?.clone;

    if (!cloneItem) {
        return null;
    }

    const originalName = cloneItem?.name || 'clone-management';
    const status = optimizingData?.[originalName] || cloneItem?.status || '';
    const severity = cloneItem?.severity || '';

    return {
        ...oracleCardData.clone_management,
        block_two: {
            ...oracleCardData.clone_management?.block_two,
            value: formatValue(status)
        },
        block_four: {
            ...oracleCardData.clone_management?.block_four,
            value: formatValue(severity)
        },
        block_five: {
            ...oracleCardData.clone_management?.block_five,
            value: cloneItem?.resourceType || ''
        },
        block_six: {
            ...oracleCardData.clone_management?.block_six,
            value: `${cloneItem?.totalObjectsInViolation || 0} out of ${cloneItem?.totalObjectsAssessed || 0}`,
            count: {
                totalObjectsAssessed: cloneItem?.totalObjectsAssessed,
                totalObjectsInViolation: cloneItem?.totalObjectsInViolation
            }
        },
        tags: cloneItem?.tags,
        id: cloneItem?.name || 'clone-management',
        mapName: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
        category: 'cloning',
        errorMessage: cloneItem?.errorMessage,
        recommendationText: cloneItem?.recommendation || oracleCardData.clone_management?.recommendation?.description,
        cloneDetails: cloneItem?.cloneDetails,
        objectsInViolation: cloneItem?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.clone
    };
};

// Function to format Oracle Security Patch configuration
export const formatOracleSecurityPatchConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): any => {
    const securityPatchItem = data?.oracleSecurityPatch;

    const originalName = securityPatchItem?.name || 'oracle-security-patch';
    const status = optimizingData?.[originalName] || securityPatchItem?.status || '';
    const severity = securityPatchItem?.severity || '';

    const totalMissingPatches = securityPatchItem?.missingPatchesCount || 0;

    return {
        ...oracleCardData.oracle_security_patch,
        block_two: {
            ...oracleCardData.oracle_security_patch?.block_two,
            value: formatValue(status)
        },
        block_three: {
            ...oracleCardData.oracle_security_patch?.block_three,
            value: String(totalMissingPatches)
        },
        block_four: {
            ...oracleCardData.oracle_security_patch?.block_four,
            value: formatValue(severity)
        },
        block_five: {
            ...oracleCardData.oracle_security_patch?.block_five,
            value: securityPatchItem?.resourceType || ''
        },
        block_six: {
            ...oracleCardData.oracle_security_patch?.block_six,
            value: String(totalMissingPatches)
        },
        oracleSecurityPatchMissingPatches: {
            critical: totalMissingPatches
        },
        tags: securityPatchItem?.tags,
        id: securityPatchItem?.name || 'oracle-security-patch',
        category: 'application',
        errorMessage: securityPatchItem?.errorMessage,
        recommendationText:
            securityPatchItem?.recommendation || oracleCardData.oracle_security_patch?.recommendation?.description,
        objectsInViolation: securityPatchItem?.objectsInViolation,
        dismissedObj: data?.dismissedConfigurations?.oracleSecurityPatch
    };
};

// Optimized function to format individual card main config
export const formatIndividualCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>
): Record<string, any> => {
    const layoutItems = data?.storage?.layout || [];
    const sizingItems = data?.storage?.sizing || [];
    const cardsData = { ...oracleCardData };

    layoutItems.forEach((item: PerConfigInterface) => {
        const itemName = GETWELL_CONFIG?.[item?.name || ''] || item?.name || '';
        cardsData[itemName] = formatCardItem(item, optimizingData, data);
    });

    // Process storage sizing items
    sizingItems.forEach((item: PerConfigInterface) => {
        const originalName = item?.name || '';
        const itemName =
            originalName === 'headroom' ? 'file_system_headroom' : GETWELL_CONFIG?.[originalName] || originalName;
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
    type: 'volume' | 'lun' | 'os' | 'sizing',
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

            // Get the dismiss state for this configuration
            const dismissedObj = getIndividualConfigDismissState(
                item?.name || '',
                index === 0 ? 'volume' : 'lun',
                data?.dismissedConfigurations
            );
            const configState = dismissedObj?.configState;

            // Skip dismissed and postponed configurations from counts
            if (configState === CONFIG_STATE_ACTIONS.DISMISS || configState === CONFIG_STATE_ACTIONS.POSTPONED) {
                // Skip this configuration from counting
            } else {
                // Count optimized vs not optimized
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

// Optimized function to format storage sizing configuration data
export const formatStorageSizingConfig = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>,
    showDismissedView: boolean = false
) => {
    const sizingList = data?.storage?.sizing;

    if (!sizingList?.length || sizingList[0]?.errorMessage) {
        return {
            formatStorageSizingConfigList: [],
            storageSizingTagsList: [],
            storageSizingOptimizedConfig: 0,
            storageSizingNotOptimizedConfig: 0,
            highestStorageSizingSeverity: 'None'
        };
    }

    const formatStorageSizingConfigList: PerConfigInterface[] = [];
    const allTags: string[] = [];
    let storageSizingOptimizedConfig = 0;
    let storageSizingNotOptimizedConfig = 0;
    let hasCritical = false;
    let hasWarning = false;

    sizingList?.forEach((item: PerConfigInterface) => {
        const processedItem = processStorageConfigItem(item, optimizingData, 'sizing', data?.dismissedConfigurations);
        formatStorageSizingConfigList.push(processedItem);

        // Get the dismiss state for this configuration
        const dismissedObj = getIndividualConfigDismissState(item?.name || '', 'sizing', data?.dismissedConfigurations);
        const configState = dismissedObj?.configState;

        // Skip dismissed and postponed configurations from counts
        if (configState === CONFIG_STATE_ACTIONS.DISMISS || configState === CONFIG_STATE_ACTIONS.POSTPONED) {
            // Skip this configuration from counting
        } else {
            // Count optimized vs not optimized
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }

            // If the configuration is in activating state, count it as optimized
            if (configState === CONFIG_STATES.ACTIVATING) {
                storageSizingOptimizedConfig++;
            } else if (status === 'optimized') {
                storageSizingOptimizedConfig++;
            } else {
                storageSizingNotOptimizedConfig++;
            }
        }

        // Track severities
        if (item?.severity === 'critical') hasCritical = true;
        if (item?.severity === 'warning') hasWarning = true;

        // Collect tags
        if (item?.tags) allTags.push(...item.tags);
    });

    return {
        formatStorageSizingConfigList,
        storageSizingTagsList: allTags,
        storageSizingOptimizedConfig,
        storageSizingNotOptimizedConfig,
        highestStorageSizingSeverity: getHighestSeverity(hasCritical, hasWarning)
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

        // Get the dismiss state for this configuration
        const dismissedObj = getIndividualConfigDismissState(item?.name || '', 'os', data?.dismissedConfigurations);
        const configState = dismissedObj?.configState;

        // Skip dismissed and postponed configurations from counts
        if (configState === CONFIG_STATE_ACTIONS.DISMISS || configState === CONFIG_STATE_ACTIONS.POSTPONED) {
            // Skip this configuration from counting
        } else {
            // Count optimized vs not optimized
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
    ontapTagsList: string[],
    dismissedObj?: any
) => {
    const totalConfigs = ontapOptimizedConfig + ontapNotOptimizedConfig;
    const hasConfigs = totalConfigs > 0;

    return {
        ...oracleCardData?.ontap_configuration,
        block_two: {
            ...oracleCardData?.ontap_configuration?.block_two,
            value: hasConfigs ? (ontapNotOptimizedConfig > 0 ? 'Not optimized' : 'Optimized') : 'n/a'
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
        category: 'storage',
        dismissedObj: dismissedObj || null
    };
};

// Helper function to create OS configuration block
const createOsConfigurationBlock = (
    osOptimizedConfig: number,
    osNotOptimizedConfig: number,
    highestOsSeverity: string,
    osTagsList: string[],
    dismissedObj?: any
) => {
    const totalConfigs = osOptimizedConfig + osNotOptimizedConfig;
    const hasConfigs = totalConfigs > 0;

    return {
        ...oracleCardData?.os_configuration,
        block_two: {
            ...oracleCardData?.os_configuration?.block_two,
            value: hasConfigs ? (osNotOptimizedConfig > 0 ? 'Not optimized' : 'Optimized') : 'n/a'
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
        category: 'storage',
        dismissedObj: dismissedObj || null
    };
};

// Optimized function to get cards data
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

    return grouped;
};

// Helper function to check if a category has configurations
export const hasOracleCategoryConfigs = (groupedConfigs: Record<string, any[]>, category: string): boolean =>
    groupedConfigs[category] && groupedConfigs[category].length > 0;

// Helper function to detect if API response is flat structure
const isOracleFlatApiResponse = (data: any): boolean => data && Array.isArray(data.assessments);

// Map category to the Oracle sub-header text shown under the card title
const getOracleBlockOneType = (category: string): string =>
    WELL_ARCHITECTED_CATEGORY_LABELS[category?.toLowerCase() as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS] ||
    category ||
    '';

// Helper function to format flat assessment to card format
const formatOracleFlatAssessmentToCard = (
    assessment: any,
    optimizingData: Record<string, string>
): any => {
    const configId = assessment.id;
    const displayName = assessment.name || getConfigurationDisplayName(configId);

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

    // Capitalize severity to match constants
    const severity = assessment.severity
        ? assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)
        : '';

    // Dismiss state will be populated by processOracleFlatAssessments from the dismissedConfigurations array
    // Do not try to read it here as dismissedConfigurations is an array, not an object keyed by configId

    // Get category from type
    const category = assessment.type || WELL_ARCHITECTED_CATEGORIES.STORAGE;

    // Get tags from categories
    const tags = assessment.categories || [];

    const card = {
        id: configId,
        configurationId: configId, // Store for dismiss flow and tooltip matching
        mapName: displayName,
        name: configId,
        displayName,
        category,
        configurationName: displayName,
        block_one: {
            value: displayName,
            type: getOracleBlockOneType(category)
        },
        block_two: {
            type: 'Status',
            value: assessment.errorMessage ? i18next.t('databases.general.unavailable') : status
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
            value: assessment.resourceType || '',
            count: {
                totalObjectsInViolation: assessment.totalObjectsInViolation ?? 0,
                totalObjectsAssessed: assessment.totalObjectsAssessed ?? 0
            }
        },
        block_six: {
            type: displayName,
            value:
                assessment.totalObjectsInViolation || assessment.totalObjectsAssessed
                    ? `${assessment.totalObjectsInViolation ?? 0} out of ${assessment.totalObjectsAssessed ?? 0}`
                    : '',
            count:
                assessment.totalObjectsAssessed !== undefined
                    ? {
                          totalObjectsInViolation: assessment.totalObjectsInViolation ?? 0,
                          totalObjectsAssessed: assessment.totalObjectsAssessed ?? 0
                      }
                    : undefined,
            smallFont: true
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
        tags,
        errorMessage: assessment.errorMessage,
        objectsInViolation: assessment.objectsInViolation || [],
        violationDetails: assessment.violationDetails || [],
        totalObjectsAssessed: assessment.totalObjectsAssessed ?? 0,
        totalObjectsInViolation: assessment.totalObjectsInViolation ?? 0,
        status: optimizingData[configId] || '',
        ...(assessment.ec2InstancesToPatch && { ec2InstancesToPatch: assessment.ec2InstancesToPatch }),
        ...(assessment.cloneDetails && { cloneDetails: assessment.cloneDetails }),
        ...(assessment.oldCloneDetails && { oldCloneDetails: assessment.oldCloneDetails }),
        ...(assessment.oldCloneDatabaseNames && { oldCloneDatabaseNames: assessment.oldCloneDatabaseNames }),
        ...(assessment.cloneDriftMessage && { cloneDriftMessage: assessment.cloneDriftMessage }),
        ...(assessment.missingPatchesCount !== undefined && { missingPatchesCount: assessment.missingPatchesCount }),
        ...(assessment.recommendedSizeInGib && { recommendedSizeInGib: assessment.recommendedSizeInGib })
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

            // If not found, try matching by the card's name field (fallback for legacy data)
            if (!matchingCardKey) {
                matchingCardKey = Object.keys(cardsData).find(key => {
                    const card = cardsData[key];
                    return card?.name === configId || card?.block_one?.value === configId;
                });
            }

            if (matchingCardKey && cardsData[matchingCardKey]) {
                // Add dismissedObj to the card
                cardsData[matchingCardKey].dismissedObj = {
                    configState: dismissedConfig.configState,
                    startTime: dismissedConfig.startTime,
                    endTime: dismissedConfig.endTime
                };
            }
        });
    }

    // Add metadata
    cardsData.isASMManaged = data.metadata?.isASMManaged || false;
    cardsData.storageProtocol = data.metadata?.storageProtocol || '';
    cardsData.isWad = data.metadata?.isWad || false;
    cardsData.deploymentType = data.metadata?.deploymentType || '';
    cardsData.baseDeploymentType = data.metadata?.baseDeploymentType || '';

    return cardsData;
};

export const getOracleCardsData = (
    data: AssessmentResponseInterface,
    optimizingData: Record<string, string>,
    showDismissedView: boolean = false
) => {
    // Check if this is flat API response
    if (isOracleFlatApiResponse(data)) {
        const cardsData = processOracleFlatAssessments(data, optimizingData);
        return {
            cardsData,
            formatOntapConfigList: [],
            formatOsConfigList: []
        };
    }

    // Original nested structure processing
    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData, showDismissedView);

    const { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity } =
        formatOSConfig(data, optimizingData, showDismissedView);

    const {
        formatStorageSizingConfigList,
        storageSizingTagsList,
        storageSizingOptimizedConfig,
        storageSizingNotOptimizedConfig,
        highestStorageSizingSeverity
    } = formatStorageSizingConfig(data, optimizingData, showDismissedView);

    // Get dismiss states for ONTAP and OS cards
    const ontapDismissedObj = getOracleOntapOsCardDismissState('ontap_configuration', data);
    const osDismissedObj = getOracleOntapOsCardDismissState('os_configuration', data);

    const isFraCheck = data?.storage?.layout?.some((item: any) => item?.name === 'fra-dg-lun-layout') || false;

    const cardsData = {
        ...formatIndividualCardMainConfig(data, optimizingData),
        isASMManaged: data?.isASMManaged || false,
        storageProtocol: data?.storageProtocol || '',
        isStorageLayoutFra: isFraCheck,
        ontap_configuration: createOntapConfigurationBlock(
            ontapOptimizedConfig,
            ontapNotOptimizedConfig,
            highestOntapSeverity,
            ontapTagsList,
            ontapDismissedObj
        ),
        os_configuration: createOsConfigurationBlock(
            osOptimizedConfig,
            osNotOptimizedConfig,
            highestOsSeverity,
            osTagsList,
            osDismissedObj
        ),
        host_os_patch: formatOracleHostOsPatchConfig(data, optimizingData),
        transparent_hugepages: formatOracleTransparentHugepagesConfig(data, optimizingData),
        tcp_advanced_options: formatOracleTcpAdvancedOptionsConfig(data, optimizingData),
        filesystems_io_options: formatOracleFilesystemsIoOptionsConfig(data, optimizingData),
        multiblock_readcount: formatOracleMultiblockReadcountConfig(data, optimizingData),
        crr: formatOracleCRRConfig(data, optimizingData),
        snapcenter_snapshot: formatOracleSnapCenterConfig(data, optimizingData),
        aws_backup: formatOracleAWSBackupConfig(data, optimizingData),
        oracle_security_patch: formatOracleSecurityPatchConfig(data, optimizingData),
        clone_management: formatOracleCloneConfig(data, optimizingData),
        isWad: data?.isWad || false
    };

    return {
        cardsData,
        formatOntapConfigList,
        formatOsConfigList
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

        // Skip WAD excluded configurations - they should not be counted in optimization breakdown
        if (isWadExcludedConfig(cardItem?.mapName, isWad, DBType.ORACLE)) {
            return;
        }

        if (cardItem?.category === 'storage') {
            if (
                (!cardsData?.isASMManaged || cardsData?.storageProtocol !== FSXN_STORAGE_PROTOCOLS.ISCSI) &&
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
                // Use actual ID, not display name
                if (cardItem?.id === 'ontap_configuration' || cardItem?.id === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS) {
                    storageCount.dismissedIds.push(ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS);
                } else if (
                    cardItem?.id === 'os_configuration' ||
                    cardItem?.id === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
                ) {
                    storageCount.dismissedIds.push(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM);
                } else {
                    storageCount.dismissedIds.push(cardItem?.id);
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
        }

        if (cardItem?.category === 'compute') {
            // Skip the iSCSI-only compute cards when protocol is not iSCSI
            if (ORACLE_ISCSI_ONLY_CARD_IDS.has(cardItem?.id)) {
                if (cardsData?.storageProtocol !== FSXN_STORAGE_PROTOCOLS.ISCSI) {
                    return;
                }
            }

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
    const formattedTimestamp = timestamp ? formatTimestamp(timestamp) : getCurrentDateTime();
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

    const categoryData = getDynamicOracleCategoryData(driftAssessmentData);

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

        // Check if this config is excluded for WAD instances
        const isWadExcluded = isWadExcludedConfig(cardData[key]?.mapName, isWad, DBType.ORACLE);

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

        // For flat API, use category directly from config if available
        let currentCategory: string | undefined;

        if (cardData[key].category) {
            // Flat API: category is directly on the card
            currentCategory = cardData[key].category;
        } else {
            // Nested structure: look up category from mapping
            const categoryInfo = categoryData[key as keyof typeof categoryData];
            currentCategory = categoryInfo?.category;
        }

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
            checkStatus &&
            checkSeverity &&
            checkTags &&
            checkConfigState &&
            checkResourceType &&
            checkDismissedFilter
        ) {
            filteredCardData[key] = cardData[key];
            if (
                currentCategory &&
                (cardData[key].block_two.value || key === 'ontap_configuration' || key === 'os_configuration')
            ) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};

// Static Oracle category data mapping (for fallback)
export const getOracleCategoryData = () => ({
    // Storage Sizing cards (moved to top)
    swap_space: { category: 'Storage', subCategory: 'Storage sizing' },
    file_system_headroom: { category: 'Storage', subCategory: 'Storage sizing' },
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
    os_configuration: { category: 'Storage', subCategory: 'Storage configuration' },
    // Compute Configuration cards
    host_os_patch: { category: 'Compute', subCategory: 'Compute' },
    transparent_hugepages: { category: 'Compute', subCategory: 'Compute' },
    tcp_advanced_options: { category: 'Compute', subCategory: 'Compute' },
    filesystems_io_options: { category: 'Compute', subCategory: 'Compute' },
    multiblock_readcount: { category: 'Compute', subCategory: 'Compute' },
    // Application cards
    oracle_security_patch: { category: 'Application', subCategory: 'Application' },
    // Resiliency cards
    crr: { category: 'Resiliency', subCategory: 'Protection' },
    snapcenter_snapshot: { category: 'Resiliency', subCategory: 'Protection' },
    aws_backup: { category: 'Resiliency', subCategory: 'Protection' },
    clone_management: { category: 'Cloning', subCategory: 'Cloning' }
});

// Helper function to convert assessment configuration names to technical keys
const convertOracleAssessmentNameToTechnicalKey = (assessmentName: string): string => {
    // Special case for headroom -> file_system_headroom
    if (assessmentName === 'headroom') {
        return 'file_system_headroom';
    }
    // Special case for redolog-dg-lun-layout -> log_dg_lun_layout (remove "redo" prefix)
    if (assessmentName === 'redolog-dg-lun-layout') {
        return 'log_dg_lun_layout';
    }
    // Convert hyphenated names from assessment to underscore format used in technical keys
    return assessmentName.replace(/-/g, '_');
};
// Dynamic Oracle category data mapping based on actual assessment response
export const getDynamicOracleCategoryData = (assessmentData?: any) => {
    const categoryMapping: { [key: string]: { category: string; subCategory: string } } = {};

    // Always include ONTAP and OS configurations as they're core storage configurations
    categoryMapping.ontap_configuration = { category: 'Storage', subCategory: 'Storage configuration' };
    categoryMapping.os_configuration = { category: 'Storage', subCategory: 'Storage configuration' };

    // Always include host OS patch (Compute) so it appears in filters even when Unavailable
    categoryMapping.host_os_patch = { category: 'Compute', subCategory: 'Compute' };
    categoryMapping.transparent_hugepages = { category: 'Compute', subCategory: 'Compute' };
    categoryMapping.tcp_advanced_options = { category: 'Compute', subCategory: 'Compute' };
    categoryMapping.filesystems_io_options = { category: 'Compute', subCategory: 'Compute' };
    categoryMapping.multiblock_readcount = { category: 'Compute', subCategory: 'Compute' };

    // Always include Oracle Security Patch (Application) so it appears in filters
    categoryMapping.oracle_security_patch = { category: 'Application', subCategory: 'Application' };

    // Always include CRR, SnapCenter Snapshot, and AWS Backup (Resiliency) so they appear in filters
    categoryMapping.crr = { category: 'Resiliency', subCategory: 'Protection' };
    categoryMapping.snapcenter_snapshot = { category: 'Resiliency', subCategory: 'Protection' };
    categoryMapping.aws_backup = { category: 'Resiliency', subCategory: 'Protection' };

    // Include Clone Management (Cloning) so it appears in filters
    categoryMapping.clone_management = { category: 'Cloning', subCategory: 'Cloning' };

    if (!assessmentData?.storage) {
        // If no assessment data, return static mapping as fallback
        return getOracleCategoryData();
    }

    // Add storage layout configurations based on actual assessment data
    if (assessmentData.storage.layout) {
        assessmentData.storage.layout.forEach((layoutConfig: any) => {
            if (layoutConfig.name) {
                const technicalKey = convertOracleAssessmentNameToTechnicalKey(layoutConfig.name);
                categoryMapping[technicalKey] = {
                    category: 'Storage',
                    subCategory: 'Storage layout'
                };
            }
        });
    }

    // Add storage sizing configurations based on actual assessment data
    if (assessmentData.storage.sizing) {
        assessmentData.storage.sizing.forEach((sizingConfig: any) => {
            if (sizingConfig.name) {
                const technicalKey = convertOracleAssessmentNameToTechnicalKey(sizingConfig.name);
                categoryMapping[technicalKey] = {
                    category: 'Storage',
                    subCategory: 'Storage sizing'
                };
            }
        });
    }

    // Add any storage configuration items (volumes, LUNs, OS) if they exist
    if (assessmentData.storage.configuration) {
        // For volumes and LUNs, these are typically sub-configurations of ONTAP
        // For OS configurations, these are sub-configurations of OS
        // They don't need separate category entries as they are handled as sub-configurations
    }

    return categoryMapping;
};

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
    // Use static mapping here as this is for generating filter options based on cards that exist
    const categoryData = getOracleCategoryData();
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

        // For flat API, use category directly from config if available
        if (config.category) {
            availableCategories.add(config.category);
        } else {
            // Fall back to category mapping for old nested structure
            const categoryInfo = categoryData[key as keyof typeof categoryData];
            if (categoryInfo) {
                availableCategories.add(categoryInfo.category);
            }
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

// Helper function to get category for a subcategory (Oracle version)
const getOracleCategoryForSubCategory = (subCategory: string) => {
    const categoryData = getOracleCategoryData();
    const entry = Object.values(categoryData).find((item: any) => item.subCategory === subCategory);
    return entry ? entry.category : '';
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
                                ? existingDismissed.map((d: any, i: number) =>
                                      i === idx ? { ...d, ...entry } : d
                                  )
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

        // Apply Oracle-specific logic for ASM configurations
        if (key === 'data_dg_lun_layout' || key === 'log_dg_lun_layout') {
            if (!cardData.isASMManaged || cardData?.storageProtocol !== FSXN_STORAGE_PROTOCOLS.ISCSI) return;
        }
        if (key === 'archivelog_dg_lun_layout' || key === 'fra_dg_lun_layout') {
            if (!cardData.isASMManaged || cardData?.storageProtocol !== FSXN_STORAGE_PROTOCOLS.ISCSI) return;
            // Additional logic for FRA-specific configs
            if (key === 'archivelog_dg_lun_layout' && cardData.isStorageLayoutFra) {
                return; // Skip archivelog if FRA is enabled
            }
            if (key === 'fra_dg_lun_layout' && !cardData.isStorageLayoutFra) {
                return; // Skip FRA if it's not enabled
            }
        }
        // Skip the iSCSI-only compute cards when protocol is not iSCSI
        if ((ORACLE_ISCSI_ONLY_CARD_KEYS as readonly string[]).includes(key)) {
            if (cardData?.storageProtocol !== FSXN_STORAGE_PROTOCOLS.ISCSI) return;
        }

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
    type,
    cardData,
    optimizeOracleOs,
    getJobDetailApi,
    dispatch,
    isWorkloadFactory,
    t
}: {
    type: any;
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

    const computeHostOsPayload = (configurationName: string) => ({
        type: 'compute-host-os',
        hostsToOptimize: [
            {
                configurationName,
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
    });

    if (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) {
        apiCall = optimizeOracleOs;
        payload = {
            type: 'storage-sizing',
            hostsToOptimize: [
                {
                    configurationName: 'headroom',
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
    } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
        const { selectedAWSBackup, selectedRowFsxId } = state.getWellOptimize;
        apiCall = optimizeOracleOs;
        payload = {
            type: 'aws-backup',
            hostsToOptimize: [
                {
                    configurationName: 'aws-backup',
                    databaseHosts: [
                        {
                            id: selectedResourceId,
                            region: selectedGwInstanceRegionId,
                            credentialsId: selectedGwInstanceCredId,
                            databases: [selectedDatabaseInstance],
                            fsxFileSystemId: selectedRowFsxId,
                            backupRetentionDays: selectedAWSBackup?.numberOfDays,
                            backupStartTime: backupStartTime(selectedAWSBackup)
                        }
                    ]
                }
            ]
        };
    } else if (type === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES) {
        apiCall = optimizeOracleOs;
        payload = computeHostOsPayload('transparent-hugepages');
    } else if (type === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS) {
        apiCall = optimizeOracleOs;
        payload = computeHostOsPayload('tcp-advanced-options');
    } else if (type === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT) {
        apiCall = optimizeOracleOs;
        payload = computeHostOsPayload('multiblock-readcount');
    }

    // call optimize api
    dispatch(setOptimizingInstanceData(true));
    dispatch(
        setOptimizingData({
            ...optimizingData,
            [cardData?.id]: 'optimizing'
        })
    );
    dispatch(
        setInProgressOptimizationData({
            ...inProgressOptimizationData,
            [type]: [...(inProgressOptimizationData[type] || []), `${selectedResourceId}_${selectedDatabaseInstance}`]
        })
    );
    dispatch(
        setInProgressHostData({
            ...inProgressHostData,
            [type]: [...(inProgressHostData[type] || []), selectedResourceId]
        })
    );

    formatOracleWellArchitectedData(dispatch, undefined, false, false);

    // Use the centralized notification function
    fixingProcessNotification(type, dispatch, isWorkloadFactory, t);

    let apiCallObj = {};
    if (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) {
        apiCallObj = {
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload
        };
    } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
        apiCallObj = { payload };
    } else if (
        type === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES ||
        type === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS ||
        type === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT
    ) {
        apiCallObj = { payload };
    }

    apiCall(apiCallObj).then((res: any) => {
        const failedMsgData = createFailedOptimizationMessage(type, dispatch, isWorkloadFactory, t);

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
                name: type,
                hostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                credentialId: selectedGwInstanceCredId,
                regionId: selectedGwInstanceRegionId
            },
            failedMsgData,
            getJobDetailApi,
            dispatch,
            type,
            '',
            {},
            false,
            DBType.ORACLE
        );
    });
};
