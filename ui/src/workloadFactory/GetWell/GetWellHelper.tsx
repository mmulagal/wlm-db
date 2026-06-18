import { TooltipInfo } from '@netapp/design-system';
import { DsTypography } from '@tlveng/wlm-ds';
import { TFunction } from 'i18next';
import { CONFIG_STATES, ASSESSMENT_CONFIG_NAMES, GETWELL_CONFIG, WA_FLAG_SKIP } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { ReactComponent as Postpone } from '../../assets/Schedule.svg';
import { ReactComponent as Activating } from '../../assets/action-required.svg';
import {
    getConfigurationTechnicalName,
    isConfigSkippedForAoag,
    isMssqlHaDeployment,
    isWadExcludedConfig
} from './GetWellUtils';
import CommonStyles from '../../utils/CommonStyles.module.scss';

// Helper component for postpone information
export const PostponeInfo = ({
    configKey,
    getPostponeInfo,
    translation,
    placement = 'bottom'
}: {
    configKey: string;
    getPostponeInfo: (key: string) => any;
    translation: TFunction;
    placement?: string;
}) => {
    const postponeInfo = getPostponeInfo(configKey);

    if (!postponeInfo) {
        return null;
    }

    return (
        <div className={CommonStyles.postponeInfo}>
            <div className={CommonStyles.postponeContent}>
                <DsTypography variant="Regular_14" className={CommonStyles.postponeTypography}>
                    <Postpone className={CommonStyles.postponeIcon} />
                    {translation('databases.well-architect.postponed-for-30-days')}
                </DsTypography>
            </div>
            <div className={CommonStyles.postponeTooltip}>
                {/* @ts-ignore */}
                <TooltipInfo placement={placement} trigger="hover" isAppendedToBody>
                    <div>
                        <div>
                            {translation('databases.well-architect.postpone-date')} {postponeInfo.postponeDate}
                        </div>
                        <div>
                            {postponeInfo.daysLeft} {translation('databases.well-architect.days-left')}
                        </div>
                    </div>
                </TooltipInfo>
            </div>
        </div>
    );
};

// Helper component for activating information
export const ActivatingInfo = ({
    configKey,
    cardData,
    translation,
    showFullContent = true
}: {
    configKey: string;
    cardData: any;
    translation: TFunction;
    showFullContent?: boolean;
}) => {
    const configState = cardData[configKey]?.dismissedObj?.configState;
    if (configState !== CONFIG_STATES.ACTIVATING) {
        return null;
    }

    return (
        <div className={CommonStyles.activatingInfo}>
            <div className={CommonStyles.activatingContent}>
                <DsTypography variant="Regular_14" className={CommonStyles.activatingTypography}>
                    <Activating className={CommonStyles.activatingIcon} />
                    <span className={CommonStyles.textContent}>
                        <span className={CommonStyles.boldText}>
                            {translation('databases.well-architect.dismiss.activating-info-content1')}
                        </span>
                        {showFullContent && (
                            <>
                                {': '}
                                <span>{translation('databases.well-architect.dismiss.activating-info-content2')}</span>
                            </>
                        )}
                    </span>
                </DsTypography>
            </div>
        </div>
    );
};

// Helper function to check if there are any dismissed configurations
export const checkHasDismissedConfigurations = (cardData: any, assessmentData?: any): boolean => {
    if (!cardData) {
        return false;
    }

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    // Check standard dismissed configurations (using dismissedObj)
    const hasStandardDismissed = Object.keys(cardData).some((key: string) => {
        if (WA_FLAG_SKIP.includes(key)) return false;

        // Skip WAD excluded configurations
        if (isWadExcludedConfig(cardData[key]?.mapName, isWad)) {
            return false;
        }

        const configState = cardData[key]?.dismissedObj?.configState;
        const isDismissed = configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED;

        return isDismissed;
    });

    // Check storage sizing configurations (they use a different approach)
    let hasStorageSizingDismissed = false;
    if (assessmentData) {
        const storageSizingKeys = [
            'transaction_log_drive_size',
            'tempdb_drive_size',
            'file_system_headroom',
            'storage_tier'
        ];

        hasStorageSizingDismissed = storageSizingKeys.some(cardKey => {
            // Only check if this card exists in cardData
            if (!cardData[cardKey]) return false;

            const configName = getConfigurationTechnicalName(cardKey, 'sizing');
            if (!configName) return false;

            const sizingConfigs = assessmentData.dismissedConfigurations?.storage?.sizing || [];
            const specificConfig = sizingConfigs.find((config: any) => config.configurationName === configName);

            if (specificConfig) {
                const isDismissed =
                    specificConfig.configState === CONFIG_STATES.DISMISSED ||
                    specificConfig.configState === CONFIG_STATES.POSTPONED;

                return isDismissed;
            }
            return false;
        });
    }

    // Check sub-configurations for OS/ONTAP and High Availability cards
    let hasSubConfigsDismissed = false;
    if (assessmentData?.dismissedConfigurations) {
        const dismissedConfigs = assessmentData.dismissedConfigurations;

        // Check ONTAP/OS sub-configurations
        const storageSubConfigs = [
            ...(dismissedConfigs.storage?.configuration?.volumes || []),
            ...(dismissedConfigs.storage?.configuration?.luns || []),
            ...(dismissedConfigs.storage?.configuration?.os || [])
        ];

        const hasOntapOsSubConfigs = storageSubConfigs.some(
            (config: any) =>
                config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED
        );

        // Check High Availability sub-configurations
        const haSubConfigs = dismissedConfigs.highAvailability || [];
        const hasHASubConfigs = haSubConfigs.some(
            (config: any) =>
                config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED
        );

        hasSubConfigsDismissed = hasOntapOsSubConfigs || hasHASubConfigs;
    }

    return hasStandardDismissed || hasStorageSizingDismissed || hasSubConfigsDismissed;
};

// Helper function to get total count based on dismissed configuration state
export const calculateTotalConfigCount = (
    cardData: any,
    showDismissedConfigurations: boolean,
    assessmentData?: any
): number => {
    if (!cardData) return 0;

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    let count = 0;
    Object.keys(cardData).forEach((key: string) => {
        if (WA_FLAG_SKIP.includes(key)) return;

        // Skip MSSQL High Availability for non-HA instances (only show for FCI and AOAG)
        const isMSSQLHighAvailability = key === GETWELL_CONFIG.mssqlhighavailability;
        if (isMSSQLHighAvailability && !isMssqlHaDeployment(cardData?.deploymentType)) {
            return;
        }

        if (key === 'isStorageLayoutFra' || key === 'isASMManaged' || key === 'storageProtocol') {
            return;
        }

        // Skip WAD excluded configurations from count
        if (isWadExcludedConfig(cardData[key]?.mapName, isWad)) {
            return;
        }

        const configState = cardData[key]?.dismissedObj?.configState;

        if (showDismissedConfigurations) {
            // Count only dismissed and postponed configurations
            if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
                count++;
            }
        } else {
            // Count only active configurations
            if (!configState || configState === CONFIG_STATES.ACTIVE || configState === CONFIG_STATES.ACTIVATING) {
                count++;
            }
        }
    });

    // Add sub-configurations count if we have assessment data
    if (assessmentData?.dismissedConfigurations && showDismissedConfigurations) {
        const dismissedConfigs = assessmentData.dismissedConfigurations;

        // Check if ONTAP card has dismissed sub-configurations
        const ontapSubConfigs = [
            ...(dismissedConfigs.storage?.configuration?.volumes || []),
            ...(dismissedConfigs.storage?.configuration?.luns || [])
        ];
        const hasOntapSubConfigsDismissed = ontapSubConfigs.some(
            (config: any) =>
                config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED
        );

        // Check if OS card has dismissed sub-configurations
        const osSubConfigs = dismissedConfigs.storage?.configuration?.os || [];
        const hasOsSubConfigsDismissed = osSubConfigs.some(
            (config: any) =>
                config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED
        );

        // Check if High Availability card has dismissed sub-configurations
        const haSubConfigs = dismissedConfigs.highAvailability || [];
        const hasHASubConfigsDismissed = haSubConfigs.some(
            (config: any) =>
                config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED
        );

        // Count each parent card only once if it has any dismissed sub-configurations
        // But only if the parent card itself is not already counted via dismissedObj
        if (hasOntapSubConfigsDismissed && !cardData?.ontap_configuration?.dismissedObj?.configState) {
            count++;
        }
        if (hasOsSubConfigsDismissed && !cardData?.os_configuration?.dismissedObj?.configState) {
            count++;
        }
        if (hasHASubConfigsDismissed && !cardData?.mssql_high_availability?.dismissedObj?.configState) {
            count++;
        }
    }

    return count;
};

// Helper function to calculate postpone information for configurations
export const calculatePostponeInfo = (cardData: any, key: string, fullCardData?: any) => {
    const configState = cardData[key]?.dismissedObj?.configState;
    if (configState !== CONFIG_STATES.POSTPONED && configState !== CONFIG_STATES.DISMISSED) {
        return null;
    }

    // Get the postpone date from startTime and endTime
    const startTime = cardData[key]?.dismissedObj?.startTime;
    const endTime = cardData[key]?.dismissedObj?.endTime;

    let postponeDateFormatted = '';
    let daysLeft = 0;

    // Only calculate date info for POSTPONED state
    if (configState === CONFIG_STATES.POSTPONED && startTime && endTime) {
        const postponeStartDate = new Date(startTime);
        const postponeEndDate = new Date(endTime);
        const today = new Date();

        daysLeft = Math.max(0, Math.ceil((postponeEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

        // Format postpone date
        postponeDateFormatted = postponeStartDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    // Get config name from block_one
    const configName = cardData[key]?.block_one?.value || '';

    const result = {
        postponeDate: postponeDateFormatted,
        daysLeft,
        configName
    };

    return result;
};

// Helper function to check if all sub-configurations are in ACTIVATING state
export const areAllSubConfigurationsActivating = (subConfigs: any[], subcategoryType: string): boolean => {
    if (!subConfigs || subConfigs.length === 0) {
        return false;
    }

    return subConfigs.every((config: any) => config.configState === CONFIG_STATES.ACTIVATING);
};

// Helper function to check if all ONTAP sub-configurations (volumes + luns) are in ACTIVATING state
export const areAllOntapSubConfigurationsActivating = (driftAssessmentData: any): boolean => {
    if (!driftAssessmentData?.dismissedConfigurations?.storage?.configuration) {
        return false;
    }

    const storageConfig = driftAssessmentData.dismissedConfigurations.storage.configuration;
    const volumes = storageConfig.volumes || [];
    const luns = storageConfig.luns || [];
    const allOntapConfigs = [...volumes, ...luns];

    return areAllSubConfigurationsActivating(allOntapConfigs, ASSESSMENT_CONFIG_NAMES.ONTAP);
};

// Helper function to check if all OS sub-configurations are in ACTIVATING state
export const areAllOsSubConfigurationsActivating = (driftAssessmentData: any): boolean => {
    if (!driftAssessmentData?.dismissedConfigurations?.storage?.configuration) {
        return false;
    }

    const osConfigs = driftAssessmentData.dismissedConfigurations.storage.configuration.os || [];
    return areAllSubConfigurationsActivating(osConfigs, ASSESSMENT_CONFIG_NAMES.OS);
};

// Helper function to check if all HA sub-configurations are in ACTIVATING state
export const areAllHaSubConfigurationsActivating = (driftAssessmentData: any): boolean => {
    if (!driftAssessmentData?.dismissedConfigurations?.highAvailability) {
        return false;
    }

    const haConfigs = driftAssessmentData.dismissedConfigurations.highAvailability || [];
    return areAllSubConfigurationsActivating(haConfigs, ASSESSMENT_CONFIG_NAMES.HIGH_AVAILABILITY);
};

// Helper function to check if a table row configuration is in specific state(s)
export const isTableRowConfigurationInState = (
    rowData: any,
    cardData: any,
    targetStates: string[],
    driftAssessmentData?: any
): boolean => {
    const configName = rowData?.name;
    const configType = rowData?.type;

    if (!configName) return false;

    // Check for sub-configurations (ONTAP, OS, HA)
    if (configType === 'volume' || configType === 'lun' || configType === 'os') {
        // Get the technical name for this specific configuration
        const technicalName = getConfigurationTechnicalName(configName, configType);

        // Get dismissed configurations for the subcategory
        let dismissedConfigs: any[] = [];

        if (configType === 'volume') {
            dismissedConfigs = driftAssessmentData?.dismissedConfigurations?.storage?.configuration?.volumes || [];
        } else if (configType === 'lun') {
            dismissedConfigs = driftAssessmentData?.dismissedConfigurations?.storage?.configuration?.luns || [];
        } else if (configType === 'os') {
            dismissedConfigs = driftAssessmentData?.dismissedConfigurations?.storage?.configuration?.os || [];
        }

        // Find the specific configuration by technical name
        const specificConfig = dismissedConfigs.find((config: any) => config.configurationName === technicalName);

        return targetStates.includes(specificConfig?.configState);
    }

    // Check for MSSQL High Availability sub-configurations
    if (
        configType === GETWELL_CONFIG.mssqlhighavailabilityWithoutUnderscore ||
        (configName === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY && rowData?.type)
    ) {
        const technicalName = getConfigurationTechnicalName(
            configName,
            GETWELL_CONFIG.mssqlhighavailabilityWithoutUnderscore
        );
        const haConfigs = driftAssessmentData?.dismissedConfigurations?.highAvailability || [];

        const specificConfig = haConfigs.find((config: any) => config.configurationName === technicalName);

        return targetStates.includes(specificConfig?.configState);
    }

    // Check for regular configurations using their config key
    const configKey = rowData?.id || rowData?.configKey;
    if (configKey && targetStates.includes(cardData[configKey]?.dismissedObj?.configState)) {
        return true;
    }

    // Check individual row dismissed state
    if (targetStates.includes(rowData?.dismissedObj?.configState)) {
        return true;
    }

    // Check for storage sizing configurations
    if (driftAssessmentData?.dismissedConfigurations?.storage?.sizing) {
        const sizingConfigs = driftAssessmentData.dismissedConfigurations.storage.sizing;

        const mappedConfigName = getConfigurationTechnicalName(configKey, 'sizing');
        if (mappedConfigName) {
            const specificConfig = sizingConfigs.find((config: any) => config.configurationName === mappedConfigName);
            return targetStates.includes(specificConfig?.configState);
        }
    }

    return false;
};

export const isTableRowConfigurationActivating = (rowData: any, cardData: any, driftAssessmentData?: any): boolean =>
    isTableRowConfigurationInState(rowData, cardData, [CONFIG_STATES.ACTIVATING], driftAssessmentData);

// Helper function to check if all configurations are dismissed (dismissed or postponed)
export const checkAllConfigurationsDismissed = (cardData: any, assessmentData?: any): boolean => {
    if (!cardData) {
        return false;
    }

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    let totalConfigs = 0;
    let dismissedConfigs = 0;

    // Check standard configurations (using dismissedObj)
    Object.keys(cardData).forEach((key: string) => {
        if (WA_FLAG_SKIP.includes(key)) return;

        // Skip MSSQL High Availability for non-HA instances (only show for FCI and AOAG)
        const isMSSQLHighAvailability = key === GETWELL_CONFIG.mssqlhighavailability;
        if (isMSSQLHighAvailability && !isMssqlHaDeployment(cardData?.deploymentType)) {
            return;
        }

        // Skip configurations not supported for AOAG deployments (compare by mapName)
        if (isConfigSkippedForAoag(cardData[key]?.mapName, cardData?.deploymentType)) {
            return;
        }

        // Skip WAD excluded configurations
        if (isWadExcludedConfig(cardData[key]?.mapName, isWad)) {
            return;
        }

        totalConfigs++;
        const configState = cardData[key]?.dismissedObj?.configState;
        if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
            dismissedConfigs++;
        }
    });

    // Check storage sizing configurations (they use a different approach)
    if (assessmentData?.dismissedConfigurations?.storage?.sizing) {
        const sizingConfigs = assessmentData.dismissedConfigurations.storage.sizing;
        const storageSizingKeys = [
            'transaction_log_drive_size',
            'tempdb_drive_size',
            'file_system_headroom',
            'storage_tier'
        ];

        storageSizingKeys.forEach(cardKey => {
            const mappedConfigName = getConfigurationTechnicalName(cardKey, 'sizing');
            if (mappedConfigName) {
                const specificConfig = sizingConfigs.find(
                    (config: any) => config.configurationName === mappedConfigName
                );
                if (specificConfig) {
                    totalConfigs++;
                    if (
                        specificConfig.configState === CONFIG_STATES.DISMISSED ||
                        specificConfig.configState === CONFIG_STATES.POSTPONED
                    ) {
                        dismissedConfigs++;
                    }
                }
            }
        });
    }

    // Check sub-configurations for OS/ONTAP and High Availability cards
    if (assessmentData?.dismissedConfigurations) {
        const dismissedConfigurationsData = assessmentData.dismissedConfigurations;

        // Check ONTAP/OS sub-configurations
        const storageSubConfigs = [
            ...(dismissedConfigurationsData.storage?.configuration?.volumes || []),
            ...(dismissedConfigurationsData.storage?.configuration?.luns || []),
            ...(dismissedConfigurationsData.storage?.configuration?.os || [])
        ];

        storageSubConfigs.forEach((config: any) => {
            totalConfigs++;
            if (config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED) {
                dismissedConfigs++;
            }
        });

        // Check High Availability sub-configurations
        const haSubConfigs = dismissedConfigurationsData.highAvailability || [];
        haSubConfigs.forEach((config: any) => {
            totalConfigs++;
            if (config.configState === CONFIG_STATES.DISMISSED || config.configState === CONFIG_STATES.POSTPONED) {
                dismissedConfigs++;
            }
        });
    }

    // Return true only if there are configurations and ALL of them are dismissed
    return totalConfigs > 0 && dismissedConfigs === totalConfigs;
};
