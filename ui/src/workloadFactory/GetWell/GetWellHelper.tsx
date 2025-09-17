import { TooltipInfo } from '@netapp/design-system';
import { DsTypography } from '@tlveng/wlm-ds';
import { TFunction } from 'i18next';
import { CONFIG_STATES } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { ReactComponent as Postpone } from '../../assets/Schedule.svg';
import { ReactComponent as Activating } from '../../assets/action-required.svg';
import styles from './GetWell.module.scss';

// Helper component for postpone information
export const PostponeInfo = ({
    configKey,
    getPostponeInfo
}: {
    configKey: string;
    getPostponeInfo: (key: string) => any;
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
                    Postpone for 30 days
                </DsTypography>
            </div>
            <div className={styles.postponeTooltip}>
                <TooltipInfo trigger="hover">
                    <div>
                        <div>Postpone date: {postponeInfo.postponeDate}</div>
                        <div>{postponeInfo.daysLeft} days left</div>
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
    translation
}: {
    configKey: string;
    cardData: any;
    translation: TFunction;
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
                        </span>{' '}
                        <span>{translation('databases.well-architect.dismiss.activating-info-content2')}</span>
                    </span>
                </DsTypography>
            </div>
        </div>
    );
};

// Helper function to check if there are any dismissed configurations
export const checkHasDismissedConfigurations = (cardData: any): boolean => {
    if (!cardData) return false;

    return Object.keys(cardData).some((key: string) => {
        if (key === 'deploymentType') return false;
        const configState = cardData[key]?.dismissedObj?.configState;
        return configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED;
    });
};

// Helper function to get total count based on dismissed configuration state
export const calculateTotalConfigCount = (cardData: any, showDismissedConfigurations: boolean): number => {
    if (!cardData) return 0;

    let count = 0;
    Object.keys(cardData).forEach((key: string) => {
        if (key === 'deploymentType') return;

        // Skip MSSQL High Availability for non-FCI instances
        const isMSSQLHighAvailability = key === 'mssql_high_availability';
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
