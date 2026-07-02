import { TooltipInfo } from '@netapp/design-system';
import { DsTypography } from '@tlveng/wlm-ds';
import { TFunction } from 'i18next';
import { CONFIG_STATES, WA_FLAG_SKIP } from '../../utils/consts';
import { ReactComponent as Postpone } from '../../assets/Schedule.svg';
import { ReactComponent as Activating } from '../../assets/action-required.svg';
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
export const checkHasDismissedConfigurations = (cardData: any): boolean => {
    if (!cardData) {
        return false;
    }

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    // Check standard dismissed configurations (using dismissedObj)
    const hasStandardDismissed = Object.keys(cardData).some((key: string) => {
        if (WA_FLAG_SKIP.includes(key)) return false;

        const configState = cardData[key]?.dismissedObj?.configState;
        const isDismissed = configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED;

        return isDismissed;
    });

    return hasStandardDismissed;
};

// Helper function to get total count based on dismissed configuration state
export const calculateTotalConfigCount = (cardData: any, showDismissedConfigurations: boolean): number => {
    if (!cardData) return 0;

    // Check if this is a WAD (offline assessment) instance
    const isWad = cardData?.isWad || false;

    let count = 0;
    Object.keys(cardData).forEach((key: string) => {
        if (WA_FLAG_SKIP.includes(key)) return;

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

// Helper function to check if a table row configuration is in specific state(s)
export const isTableRowConfigurationInState = (rowData: any, cardData: any, targetStates: string[]): boolean => {
    const configName = rowData?.name;

    if (!configName) return false;

    // Check for regular configurations using their config key
    const configKey = rowData?.id || rowData?.configKey;
    if (configKey && targetStates.includes(cardData[configKey]?.dismissedObj?.configState)) {
        return true;
    }

    // Check individual row dismissed state
    if (targetStates.includes(rowData?.dismissedObj?.configState)) {
        return true;
    }

    return false;
};

export const isTableRowConfigurationActivating = (rowData: any, cardData: any): boolean =>
    isTableRowConfigurationInState(rowData, cardData, [CONFIG_STATES.ACTIVATING]);

// Helper function to check if all configurations are dismissed (dismissed or postponed)
export const checkAllConfigurationsDismissed = (cardData: any): boolean => {
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

        totalConfigs++;
        const configState = cardData[key]?.dismissedObj?.configState;
        if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
            dismissedConfigs++;
        }
    });

    // Return true only if there are configurations and ALL of them are dismissed
    return totalConfigs > 0 && dismissedConfigs === totalConfigs;
};
