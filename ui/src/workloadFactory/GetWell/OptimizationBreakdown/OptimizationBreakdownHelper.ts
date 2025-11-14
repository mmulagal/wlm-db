import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, DBType } from '../../../utils/consts';
import { getCategoryData, getConfigurationTechnicalName } from '../GetWellUtils';
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
    [ASSESSMENT_CONFIG_NAMES.CRR_DISPLAY_NAME]: 'crr',
    [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: 'clone_management',
    [ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]: 'mssql_high_availability'
});

// Helper function to get display name to technical key mapping for Oracle
export const getOracleDisplayNameToTechnicalKeyMapping = () => ({
    // Storage Sizing configurations
    [ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]: 'headroom',
    [ASSESSMENT_CONFIG_NAMES.SWAP_SPACE]: 'swap-space',
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
    [ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES]: 'transparent-hugepages',
    [ASSESSMENT_CONFIG_NAMES.SELINUX]: 'selinux',
    [ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT]: 'iscsi-replacement-timeout',
    [ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES]: 'multipath-friendly-names',
    [ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS]: 'tcp-advanced-options',
    [ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS]: 'filesystems-io-options',
    [ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT]: 'multiblock-readcount',
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
    [ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE]: 'asmlib-logical-block-size'
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

// Helper function to group configurations by category with hierarchical structure
export const groupConfigurationsByCategory = (
    configIds: string[],
    assessmentData?: any,
    cardsData?: any,
    databaseType?: string
) => {
    // Determine database type if not provided
    const dbType = databaseType || DBType.MSSQL;

    // Use appropriate category data and mappings based on database type
    // For Oracle, use dynamic category data based on actual assessment response
    const categoryData = dbType === DBType.ORACLE ? getDynamicOracleCategoryData(assessmentData) : getCategoryData();
    const displayNameToTechnicalKey =
        dbType === DBType.ORACLE ? getOracleDisplayNameToTechnicalKeyMapping() : getDisplayNameToTechnicalKeyMapping();
    const parentChildConfigs =
        dbType === DBType.ORACLE ? getOracleParentChildConfigurations() : getParentChildConfigurations();
    const technicalKeyToDisplayName =
        dbType === DBType.ORACLE ? getOracleTechnicalKeyToDisplayNameMapping() : getTechnicalKeyToDisplayNameMapping();

    // Separate parent configurations (ONTAP, OS, HA) for special handling
    const parentConfigurations: string[] = [];
    const subConfigurations: string[] = [];
    const regularConfigurations: string[] = [];

    configIds.forEach(configId => {
        const technicalKey = displayNameToTechnicalKey[configId];
        const isParentConfig = Object.keys(parentChildConfigs).includes(configId);
        const isSubConfig = Object.values(parentChildConfigs).flat().includes(technicalKey);

        // Check if this configId is an individual sub-configuration from assessment data
        let isIndividualSubConfig = false;
        if (assessmentData?.dismissedConfigurations) {
            // Check ONTAP sub-configurations (volumes and LUNs)
            const ontapSubConfigs = [
                ...(assessmentData.dismissedConfigurations.storage?.configuration?.volumes || []),
                ...(assessmentData.dismissedConfigurations.storage?.configuration?.luns || [])
            ];
            const isOntapSubConfig = ontapSubConfigs.some((config: any) => {
                // Convert display name to technical name for comparison
                const technicalName = getConfigurationTechnicalName(configId, config.type || 'volume');
                return technicalName === config.configurationName;
            });

            // Check OS sub-configurations
            const osSubConfigs = assessmentData.dismissedConfigurations.storage?.configuration?.os || [];
            const isOsSubConfig = osSubConfigs.some((config: any) => {
                // Convert display name to technical name for comparison
                const technicalName = getConfigurationTechnicalName(configId, 'os');
                return technicalName === config.configurationName;
            });

            // Check HA sub-configurations (only for MSSQL)
            const haSubConfigs = assessmentData.dismissedConfigurations.highAvailability || [];
            const isHaSubConfig = haSubConfigs.some((config: any) => {
                // Convert display name to technical name for comparison
                const technicalName = getConfigurationTechnicalName(configId, 'mssqlhighavailability');
                return technicalName === config.configurationName;
            });

            isIndividualSubConfig = isOntapSubConfig || isOsSubConfig || isHaSubConfig;
        }

        if (isParentConfig) {
            parentConfigurations.push(configId);
        } else if (isSubConfig || isIndividualSubConfig) {
            subConfigurations.push(configId);
        } else {
            regularConfigurations.push(configId);
        }
    });

    // Build complete category and subcategory structures including parent configurations
    const allCategoriesWithSubCategories = Object.keys(categoryData).reduce((acc, configKey) => {
        const { category, subCategory } = categoryData[configKey as keyof typeof categoryData];
        if (!acc[category]) {
            acc[category] = {};
        }
        if (!acc[category][subCategory]) {
            acc[category][subCategory] = [];
        }
        acc[category][subCategory].push(configKey);
        return acc;
    }, {} as { [category: string]: { [subCategory: string]: string[] } });

    // Process both regular and parent configurations for categories and subcategories
    // Include parent configurations in category analysis since ONTAP/OS are Storage category
    const allProcessingTechnicalKeys = [
        ...regularConfigurations.map(configId => displayNameToTechnicalKey[configId]).filter(Boolean),
        ...parentConfigurations.map(configId => displayNameToTechnicalKey[configId]).filter(Boolean)
    ];

    const fullyDismissedCategories: string[] = [];
    const fullyDismissedSubCategories: { [subCategory: string]: { category: string; configs: string[] } } = {};
    const individualConfigs: { [category: string]: { [subCategory: string]: string[] } } = {};

    // Check for fully dismissed categories
    Object.keys(allCategoriesWithSubCategories).forEach(category => {
        const allConfigsInCategory = Object.values(allCategoriesWithSubCategories[category]).flat();
        const dismissedConfigsInCategory = allProcessingTechnicalKeys.filter((key: string) =>
            allConfigsInCategory.includes(key)
        );

        if (
            allConfigsInCategory.length === dismissedConfigsInCategory.length &&
            dismissedConfigsInCategory.length > 0
        ) {
            fullyDismissedCategories.push(category);
        } else if (dismissedConfigsInCategory.length > 0) {
            // Check for fully dismissed subcategories within this category
            Object.keys(allCategoriesWithSubCategories[category]).forEach(subCategory => {
                const allConfigsInSubCategory = allCategoriesWithSubCategories[category][subCategory];
                const dismissedConfigsInSubCategory = allProcessingTechnicalKeys.filter((key: string) =>
                    allConfigsInSubCategory.includes(key)
                );

                if (
                    allConfigsInSubCategory.length === dismissedConfigsInSubCategory.length &&
                    dismissedConfigsInSubCategory.length > 0
                ) {
                    fullyDismissedSubCategories[subCategory] = {
                        category,
                        configs: dismissedConfigsInSubCategory.map(
                            (key: string) => technicalKeyToDisplayName[key] || key
                        )
                    };
                } else if (dismissedConfigsInSubCategory.length > 0) {
                    // Individual configurations
                    if (!individualConfigs[category]) {
                        individualConfigs[category] = {};
                    }
                    if (!individualConfigs[category][subCategory]) {
                        individualConfigs[category][subCategory] = [];
                    }
                    individualConfigs[category][subCategory] = dismissedConfigsInSubCategory.map(
                        (key: string) => technicalKeyToDisplayName[key] || key
                    );
                }
            });
        }
    });

    // Handle sub-configurations from bulk dismissed parent configurations
    const subConfigurationsFromBulkDismissed: string[] = [];

    if (assessmentData?.dismissedConfigurations && cardsData) {
        // Simplify the logic: check if parent cards are dismissed and extract all their sub-configs
        // regardless of whether they're in parentConfigurations or not

        // Check ONTAP card dismissal
        const ontapCardDismissed =
            cardsData?.ontap_configuration?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            cardsData?.ontap_configuration?.dismissedObj?.configState === CONFIG_STATES.POSTPONED;

        if (ontapCardDismissed) {
            // Extract ONTAP sub-configurations (volumes and LUNs)
            const ontapSubConfigs = [
                ...(assessmentData.dismissedConfigurations.storage?.configuration?.volumes || []),
                ...(assessmentData.dismissedConfigurations.storage?.configuration?.luns || [])
            ];
            ontapSubConfigs.forEach((config: any) => {
                if (config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED) {
                    if (!subConfigurationsFromBulkDismissed.includes(config.configurationName)) {
                        subConfigurationsFromBulkDismissed.push(config.configurationName);
                    }
                }
            });
        }

        // Check OS card dismissal
        const osCardDismissed =
            cardsData?.os_configuration?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            cardsData?.os_configuration?.dismissedObj?.configState === CONFIG_STATES.POSTPONED;

        if (osCardDismissed) {
            // Extract OS sub-configurations
            const osSubConfigs = assessmentData.dismissedConfigurations.storage?.configuration?.os || [];
            osSubConfigs.forEach((config: any) => {
                if (config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED) {
                    if (!subConfigurationsFromBulkDismissed.includes(config.configurationName)) {
                        subConfigurationsFromBulkDismissed.push(config.configurationName);
                    }
                }
            });
        }

        // Check HA card dismissal
        const haCardDismissed =
            cardsData?.mssql_high_availability?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            cardsData?.mssql_high_availability?.dismissedObj?.configState === CONFIG_STATES.POSTPONED;

        if (haCardDismissed) {
            // Extract HA sub-configurations
            const haSubConfigs = assessmentData.dismissedConfigurations.highAvailability || [];
            haSubConfigs.forEach((config: any) => {
                if (config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED) {
                    if (!subConfigurationsFromBulkDismissed.includes(config.configurationName)) {
                        subConfigurationsFromBulkDismissed.push(config.configurationName);
                    }
                }
            });
        }
    }

    // Combine existing sub-configurations with those from bulk dismissed parents
    const allSubConfigurations = [...subConfigurations, ...subConfigurationsFromBulkDismissed];

    return {
        fullyDismissedCategories,
        fullyDismissedSubCategories,
        individualConfigs,
        parentConfigurations,
        subConfigurations: allSubConfigurations
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

    const {
        fullyDismissedCategories,
        fullyDismissedSubCategories,
        individualConfigs,
        parentConfigurations,
        subConfigurations
    } = groupConfigurationsByCategory(dismissedIds, assessmentData, cardsData, databaseType);

    // Use appropriate mappings based on database type
    const dbType = databaseType || DBType.MSSQL;
    const categoryData = dbType === DBType.ORACLE ? getDynamicOracleCategoryData(assessmentData) : getCategoryData();
    const technicalKeyToDisplayName =
        dbType === DBType.ORACLE ? getOracleTechnicalKeyToDisplayNameMapping() : getTechnicalKeyToDisplayNameMapping();

    // Get parent-child mappings
    const parentChildConfigs =
        dbType === DBType.ORACLE ? getOracleParentChildConfigurations() : getParentChildConfigurations();

    // Calculate individual configurations (not in categories or subcategories)
    const configurationSources = [
        // Configurations from fully dismissed categories
        ...fullyDismissedCategories
            .map(category => {
                const configsInCategory = Object.keys(categoryData).filter(
                    configKey => categoryData[configKey as keyof typeof categoryData].category === category
                );
                return configsInCategory.map(configKey => technicalKeyToDisplayName[configKey] || configKey);
            })
            .flat(),
        // Configurations from fully dismissed sub-categories
        ...Object.entries(fullyDismissedSubCategories)
            .map(([, data]) => data.configs)
            .flat(),
        // Individual configurations from different sub-categories
        ...Object.entries(individualConfigs)
            .map(([, subCategories]) =>
                Object.entries(subCategories)
                    .map(([, configs]) => configs)
                    .flat()
            )
            .flat(),
        // Parent configurations (ONTAP, OS, HA) - only if not already included above
        ...parentConfigurations.filter(parentConfig => {
            const technicalKey = Object.keys(categoryData).find(key => technicalKeyToDisplayName[key] === parentConfig);
            if (!technicalKey) return true;

            const configData = categoryData[technicalKey as keyof typeof categoryData];
            if (!configData) return true;

            if (fullyDismissedCategories.includes(configData.category)) return false;
            if (fullyDismissedSubCategories[configData.subCategory]) return false;

            const individualConfigsForCategory = individualConfigs[configData.category];
            if (individualConfigsForCategory?.[configData.subCategory]?.includes(parentConfig)) return false;

            return true;
        })
    ];

    const allConfigurations = [...new Set(configurationSources)];

    // Filter sub-configurations to exclude those whose parent is already dismissed
    const relevantSubConfigurations = subConfigurations.filter(
        subConfig =>
            // Check if any parent configuration is already dismissed
            !Object.entries(parentChildConfigs).some(([parentKey, childKeys]) => {
                const parentDisplayName = technicalKeyToDisplayName[parentKey];
                return childKeys.some(childKey => {
                    const childDisplayName = technicalKeyToDisplayName[childKey];
                    return (
                        allConfigurations.includes(parentDisplayName) &&
                        assessmentData?.[childKey]?.subConfigurations?.some((sc: any) => sc.displayName === subConfig)
                    );
                });
            })
    );

    // Build the display text
    const parts: string[] = [];

    if (fullyDismissedCategories.length > 0) {
        parts.push(`${fullyDismissedCategories.length} categor${fullyDismissedCategories.length > 1 ? 'ies' : 'y'}`);
    }

    if (allConfigurations.length > 0) {
        parts.push(`${allConfigurations.length} configuration${allConfigurations.length > 1 ? 's' : ''}`);
    }

    if (relevantSubConfigurations.length > 0) {
        parts.push(
            `${relevantSubConfigurations.length} sub-configuration${relevantSubConfigurations.length > 1 ? 's' : ''}`
        );
    }

    return parts.length > 0
        ? `Dismissed: ${parts.join(' | ')}`
        : `Dismissed: ${dismissedOrPostponed} Configuration${dismissedOrPostponed > 1 ? 's' : ''}`;
};
