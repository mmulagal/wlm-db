import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    DBType,
    WELL_ARCHITECTED_CATEGORY_LABELS,
    WA_FLAG_SKIP
} from '../../../utils/consts';
import { getCategoryData } from '../GetWellUtils';
import { getDynamicOracleCategoryData } from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

// Special parent-child configuration mappings for ONTAP, OS, and HA
const getParentChildConfigurations = () => ({
    [ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS]: ['ontap_configuration'],
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM]: ['os_configuration'],
    [ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]: ['mssql_high_availability']
});

// Oracle-specific parent-child configuration mappings for ONTAP and OS
const getOracleParentChildConfigurations = () => ({
    [ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS]: ['ontap_configuration'],
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM]: ['os_configuration']
});

// Helper function to get display name to technical key mapping for MSSQL
export const getDisplayNameToTechnicalKeyMapping = () => ({
    [ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]: 'file_system_headroom',
    [ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]: 'storage_tier',
    [ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]: 'transaction_log_drive_size',
    [ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]: 'tempdb_drive_size',
    [ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]: 'user_data_files',
    [ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]: 'transaction_log_files',
    [ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]: 'tempdb_files',
    [ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS]: 'ontap_configuration',
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM]: 'os_configuration',
    [ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]: 'compute_rightsizing',
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]: 'host_os_patch',
    [ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION]: 'rss_config',
    [ASSESSMENT_CONFIG_NAMES.MTU]: 'mtu',
    [ASSESSMENT_CONFIG_NAMES.LICENSE]: 'sql_licenses',
    [ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]: 'microsoft_sql_patch',
    [ASSESSMENT_CONFIG_NAMES.MAXDOP]: 'maxdop',
    [ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]: 'scheduled_local_snapshot',
    [ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]: 'scheduled_fsx_for_ontap_backups',
    [ASSESSMENT_CONFIG_NAMES.CRR]: 'crr',
    [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: 'clone_management',
    [ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]: 'mssql_high_availability'
});

// Helper function to get display name to technical key mapping for Oracle
export const getOracleDisplayNameToTechnicalKeyMapping = () => ({
    // Storage Sizing configurations
    [ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]: 'file_system_headroom',
    [ASSESSMENT_CONFIG_NAMES.SWAP_SPACE]: 'swap_space',
    // compute configurations
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]: 'host_os_patch',
    [ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES]: 'transparent_hugepages',
    [ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS]: 'tcp_advanced_options',
    [ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS]: 'filesystems_io_options',
    [ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT]: 'multiblock_readcount',
    // Placement configurations
    [ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]: 'storage_tier',
    // Storage Layout configurations
    [ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT]: 'oracle_binary_placement',
    [ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT]: 'datafiles_placement',
    [ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT]: 'controlfiles_placement',
    [ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT]: 'redologs_placement',
    [ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT]: 'templogs_placement',
    [ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT]: 'archive_placement',
    // ASM LUN Layout configurations
    [ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT]: 'data_dg_lun_layout',
    [ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT]: 'log_dg_lun_layout',
    [ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT]: 'fra_dg_lun_layout',
    [ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT]: 'archivelog_dg_lun_layout',
    // Storage Configuration configurations
    [ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS]: 'ontap_configuration',
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM]: 'os_configuration',
    // Oracle ONTAP configurations
    [ASSESSMENT_CONFIG_NAMES.COMPRESSION]: 'compression',
    [ASSESSMENT_CONFIG_NAMES.DEDUPLICATION]: 'deduplication',
    [ASSESSMENT_CONFIG_NAMES.COMPACTION]: 'compaction',
    [ASSESSMENT_CONFIG_NAMES.NFS_ROOTONLY]: 'nfs-rootonly',
    [ASSESSMENT_CONFIG_NAMES.EXPORT_POLICY]: 'export-policy',
    [ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY]: 'snapshot-policy',
    // Oracle OS configurations
    [ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO]: 'multipath-io',
    [ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES]: 'host-utilities',
    [ASSESSMENT_CONFIG_NAMES.SELINUX]: 'selinux',
    [ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT]: 'iscsi-replacement-timeout',
    [ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES]: 'multipath-friendly-names',
    [ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS]: 'multipath-io-sessions',
    [ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION]: 'multipath-configuration',
    [ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS]: 'kernel-parameters',
    [ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES]: 'nfs-mount-options-databasefiles',
    [ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME]: 'nfs-mount-options-adrhome',
    [ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS]: 'nfs-caching-options',
    [ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME]: 'nfsv4-domain-name',
    [ASSESSMENT_CONFIG_NAMES.ASM_SETUP]: 'asm-setup',
    [ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY]: 'asm-external-redundancy',
    [ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE]: 'afd-logical-block-size',
    [ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE]: 'asmlib-logical-block-size',
    [ASSESSMENT_CONFIG_NAMES.DNFS_CONSISTENT_IP_RESOLUTION]: 'dnfs-consistent-ip-resolution',
    [ASSESSMENT_CONFIG_NAMES.DNFS_ENABLEMENT]: 'dnfs-enabled',
    [ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE]: 'dnfs-configuration-file',
    [ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE]: 'dnfs-no-shared-cache',
    [ASSESSMENT_CONFIG_NAMES.CRR]: 'crr',
    [ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT]: 'snapcenter_snapshot',
    [ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH]: 'oracle_security_patch',
    [ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]: 'aws_backup',
    [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: 'clone_management'
});

// Helper function to get technical key to display name mapping for MSSQL
export const getTechnicalKeyToDisplayNameMapping = () => {
    const displayToTech = getDisplayNameToTechnicalKeyMapping();
    const techToDisplay: { [key: string]: string } = {};
    Object.entries(displayToTech).forEach(([display, tech]) => {
        techToDisplay[tech] = display;
    });
    return techToDisplay;
};

// Helper function to get technical key to display name mapping for Oracle
export const getOracleTechnicalKeyToDisplayNameMapping = () => {
    const displayToTech = getOracleDisplayNameToTechnicalKeyMapping();
    const techToDisplay: { [key: string]: string } = {};
    Object.entries(displayToTech).forEach(([display, tech]) => {
        techToDisplay[tech] = display;
    });
    return techToDisplay;
};

// Helper function to group configurations by category
export const groupConfigurationsByCategory = (
    configIds: string[],
    assessmentData?: any,
    cardsData?: any,
    databaseType?: string
) => {
    // Check if using flat API (dismissedConfigurations is an array)
    const isFlatApi = Array.isArray(assessmentData?.dismissedConfigurations);

    if (isFlatApi) {
        // FLAT API: Group by category and check for fully dismissed categories
        const configsByCategory: { [category: string]: { id: string; displayName: string }[] } = {};

        // Group configs by category
        configIds.forEach(configId => {
            // Direct lookup by ID
            const card = cardsData?.[configId];

            if (card && card.mapName) {
                const displayName = card.mapName;
                const { category } = card;

                // Only process if category exists
                if (category) {
                    if (!configsByCategory[category]) {
                        configsByCategory[category] = [];
                    }

                    configsByCategory[category].push({ id: configId, displayName });
                }
            }
        });

        // Check which categories are fully dismissed
        const fullyDismissedCategories: string[] = [];
        const individualConfigs: string[] = [];

        Object.keys(configsByCategory).forEach(category => {
            // Get all configs in this category from cardsData (API gives us only what should be shown)
            const allConfigsInCategory = Object.keys(cardsData || {}).filter(key => {
                const card = cardsData[key];
                // Skip metadata fields
                if (WA_FLAG_SKIP.includes(key)) return false;
                return card?.category?.toLowerCase() === category.toLowerCase();
            });

            const dismissedConfigsInCategory = configsByCategory[category];

            // If ALL configs in this category are dismissed, it's a fully dismissed category
            if (allConfigsInCategory.length > 0 && dismissedConfigsInCategory.length === allConfigsInCategory.length) {
                // Map category to display label
                const displayLabel =
                    WELL_ARCHITECTED_CATEGORY_LABELS[
                        category.toLowerCase() as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS
                    ] || category;
                fullyDismissedCategories.push(displayLabel);
            } else {
                // Otherwise, list individual configs
                dismissedConfigsInCategory.forEach(config => {
                    individualConfigs.push(config.displayName);
                });
            }
        });

        return {
            fullyDismissedCategories,
            individualConfigs: {} as { [category: string]: string[] },
            parentConfigurations: [] as string[],
            configurations: individualConfigs,
            flatApiCategories: fullyDismissedCategories
        };
    }

    // NESTED API: Logic for categories and configurations
    const dbType = databaseType || DBType.MSSQL;
    const categoryData = dbType === DBType.ORACLE ? getDynamicOracleCategoryData(assessmentData) : getCategoryData();
    const displayNameToTechnicalKey =
        dbType === DBType.ORACLE ? getOracleDisplayNameToTechnicalKeyMapping() : getDisplayNameToTechnicalKeyMapping();
    const parentChildConfigs =
        dbType === DBType.ORACLE ? getOracleParentChildConfigurations() : getParentChildConfigurations();
    const technicalKeyToDisplayName =
        dbType === DBType.ORACLE ? getOracleTechnicalKeyToDisplayNameMapping() : getTechnicalKeyToDisplayNameMapping();

    const parentConfigurations: string[] = [];
    const regularConfigurations: string[] = [];

    configIds.forEach(configId => {
        const technicalKey = displayNameToTechnicalKey[configId] || configId;
        const isParentConfig = Object.keys(parentChildConfigs).includes(configId);

        if (isParentConfig) {
            parentConfigurations.push(configId);
        } else {
            regularConfigurations.push(configId);
        }
    });

    // Build category structure
    const allCategoriesWithConfigs = Object.keys(categoryData).reduce((acc, configKey) => {
        const configInfo = categoryData[configKey as keyof typeof categoryData];
        const { category } = configInfo;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(configKey);
        return acc;
    }, {} as { [category: string]: string[] });

    // Process both regular and parent configurations for categories
    const allProcessingTechnicalKeys: string[] = [
        ...regularConfigurations.map(configId => displayNameToTechnicalKey[configId] || configId),
        ...parentConfigurations.map(configId => displayNameToTechnicalKey[configId] || configId)
    ];

    const fullyDismissedCategories: string[] = [];
    const individualConfigs: { [category: string]: string[] } = {};

    // Check for fully dismissed categories
    Object.keys(allCategoriesWithConfigs).forEach(category => {
        const allConfigsInCategory = allCategoriesWithConfigs[category];
        const dismissedConfigsInCategory = allProcessingTechnicalKeys.filter((key: string) =>
            allConfigsInCategory.includes(key)
        );

        if (
            allConfigsInCategory.length === dismissedConfigsInCategory.length &&
            dismissedConfigsInCategory.length > 0
        ) {
            fullyDismissedCategories.push(category);
        } else if (dismissedConfigsInCategory.length > 0) {
            individualConfigs[category] = dismissedConfigsInCategory.map(
                (key: string) => technicalKeyToDisplayName[key] || key
            );
        }
    });

    return {
        fullyDismissedCategories,
        individualConfigs,
        parentConfigurations,
        configurations: [] as string[]
    };
};

// Helper function to generate display text for dismissed configurations
export const generateDisplayText = (
    dismissedIds: string[],
    dismissedOrPostponed: number,
    assessmentData?: any,
    cardsData?: any,
    databaseType?: string
) => {
    if (!dismissedIds?.length) return '';

    // Check if using flat API
    const isFlatApi = Array.isArray(assessmentData?.dismissedConfigurations);

    if (isFlatApi) {
        // FLAT API: Show categories and configurations dynamically
        const result = groupConfigurationsByCategory(dismissedIds, assessmentData, cardsData, databaseType);
        const categoryCount = result.flatApiCategories?.length || 0;
        const configCount = result.configurations?.length || 0;

        const parts: string[] = [];

        if (categoryCount > 0) {
            parts.push(`${categoryCount} categor${categoryCount > 1 ? 'ies' : 'y'}`);
        }

        if (configCount > 0) {
            parts.push(`${configCount} configuration${configCount > 1 ? 's' : ''}`);
        }

        return parts.length > 0
            ? `Dismissed: ${parts.join(' | ')}`
            : `Dismissed: ${dismissedOrPostponed} Configuration${dismissedOrPostponed > 1 ? 's' : ''}`;
    }

    // NESTED API: Logic for categories and configurations
    const { fullyDismissedCategories, individualConfigs, parentConfigurations } = groupConfigurationsByCategory(
        dismissedIds,
        assessmentData,
        cardsData,
        databaseType
    );

    const dbType = databaseType || DBType.MSSQL;
    const categoryData = dbType === DBType.ORACLE ? getDynamicOracleCategoryData(assessmentData) : getCategoryData();
    const technicalKeyToDisplayName =
        dbType === DBType.ORACLE ? getOracleTechnicalKeyToDisplayNameMapping() : getTechnicalKeyToDisplayNameMapping();

    const configurationSources = [
        ...fullyDismissedCategories
            .map(category => {
                const configsInCategory = Object.keys(categoryData).filter(
                    configKey => categoryData[configKey as keyof typeof categoryData].category === category
                );
                return configsInCategory.map(configKey => technicalKeyToDisplayName[configKey] || configKey);
            })
            .flat(),
        ...Object.entries(individualConfigs)
            .map(([, configs]) => configs)
            .flat(),
        ...parentConfigurations.filter(parentConfig => {
            const technicalKey = Object.keys(categoryData).find(key => technicalKeyToDisplayName[key] === parentConfig);
            if (!technicalKey) return true;

            const configData = categoryData[technicalKey as keyof typeof categoryData];
            if (!configData) return true;

            if (fullyDismissedCategories.includes(configData.category)) return false;

            const individualConfigsForCategory = individualConfigs[configData.category];
            if (individualConfigsForCategory?.includes(parentConfig)) return false;

            return true;
        })
    ];

    const allConfigurations = [...new Set(configurationSources)];

    // Build the display text
    const parts: string[] = [];

    if (fullyDismissedCategories.length > 0) {
        parts.push(`${fullyDismissedCategories.length} categor${fullyDismissedCategories.length > 1 ? 'ies' : 'y'}`);
    }

    if (allConfigurations.length > 0) {
        parts.push(`${allConfigurations.length} configuration${allConfigurations.length > 1 ? 's' : ''}`);
    }

    return parts.length > 0
        ? `Dismissed: ${parts.join(' | ')}`
        : `Dismissed: ${dismissedOrPostponed} Configuration${dismissedOrPostponed > 1 ? 's' : ''}`;
};
