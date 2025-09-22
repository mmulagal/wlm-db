import { TooltipInfo } from '@netapp/design-system';
import { DsTypography } from '@tlveng/wlm-ds';
import { TFunction } from 'i18next';
import { CONFIG_STATES, ASSESSMENT_CONFIG_NAMES, GETWELL_CONFIG } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { ReactComponent as Postpone } from '../../assets/Schedule.svg';
import { ReactComponent as Activating } from '../../assets/action-required.svg';
import { getConfigurationTechnicalName } from './GetWellUtils';
import styles from './GetWell.module.scss';

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
        <div className={styles.postponeInfo}>
            <div className={styles.postponeContent}>
                <DsTypography variant="Regular_14" className={styles.postponeTypography}>
                    <Postpone className={styles.postponeIcon} />
                    {translation('databases.well-architect.postponed-for-30-days')}
                </DsTypography>
            </div>
            <div className={styles.postponeTooltip}>
                {/* @ts-ignore */}
                <TooltipInfo placement={placement} trigger="hover">
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
        <div className={styles.activatingInfo}>
            <div className={styles.activatingContent}>
                <DsTypography variant="Regular_14" className={styles.activatingTypography}>
                    <Activating className={styles.activatingIcon} />
                    <span className={styles.textContent}>
                        <span className={styles.boldText}>
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

    // Check standard dismissed configurations (using dismissedObj)
    const hasStandardDismissed = Object.keys(cardData).some((key: string) => {
        if (key === 'deploymentType') return false;

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

    let count = 0;
    Object.keys(cardData).forEach((key: string) => {
        if (key === 'deploymentType') return;

        // Skip MSSQL High Availability for non-FCI instances
        const isMSSQLHighAvailability = key === GETWELL_CONFIG.mssqlhighavailability;
        if (isMSSQLHighAvailability && cardData?.deploymentType !== GENERAL.FCI) {
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
export const calculatePostponeInfo = (cardData: any, key: string) => {
    const configState = cardData[key]?.dismissedObj?.configState;
    if (configState !== CONFIG_STATES.POSTPONED) {
        return null;
    }

    // Get the postpone date from startTime or endTime
    const postponeTimestamp = cardData[key]?.dismissedObj?.startTime || cardData[key]?.dismissedObj?.endTime;
    if (!postponeTimestamp) {
        return null;
    }

    const postponeDate = new Date(postponeTimestamp);
    const today = new Date();
    const thirtyDaysFromPostpone = new Date(postponeDate);
    thirtyDaysFromPostpone.setDate(thirtyDaysFromPostpone.getDate() + 30);

    const daysLeft = Math.max(
        0,
        Math.ceil((thirtyDaysFromPostpone.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Format postpone date
    const postponeDateFormatted = postponeDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return {
        postponeDate: postponeDateFormatted,
        daysLeft
    };
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

// Helper function to check if a table row configuration is in ACTIVATING state
export const isTableRowConfigurationActivating = (rowData: any, cardData: any, driftAssessmentData?: any): boolean => {
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

        return specificConfig?.configState === CONFIG_STATES.ACTIVATING;
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

        return specificConfig?.configState === CONFIG_STATES.ACTIVATING;
    }

    // Check for regular configurations using their config key
    const configKey = rowData?.id || rowData?.configKey;
    if (configKey && cardData[configKey]?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING) {
        return true;
    }

    // Check for storage sizing configurations
    if (driftAssessmentData?.dismissedConfigurations?.storage?.sizing) {
        const sizingConfigs = driftAssessmentData.dismissedConfigurations.storage.sizing;

        const mappedConfigName = getConfigurationTechnicalName(configKey, 'sizing');
        if (mappedConfigName) {
            const specificConfig = sizingConfigs.find((config: any) => config.configurationName === mappedConfigName);
            return specificConfig?.configState === CONFIG_STATES.ACTIVATING;
        }
    }

    return false;
};
