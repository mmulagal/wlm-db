import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { DsPopover, Popover } from '@netapp/design-system';
import { CONFIG_STATES, GETWELL_STATUS, GETWELL_VALUES, GETWELL_DISPLAY } from '../../../../../utils/consts';
import { GENERAL } from '../../../../../utils/appConstants';
import { isNotApplicableStatus } from '../OracleWellArchitectedUtils';
import styles from './OracleCardComponent.module.scss';
import { ReactComponent as NotActive } from '../../../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../../../assets/In Progress.svg';
import { ReactComponent as TooltipIcon } from '../../../../../assets/tooltipGrey.svg';

const StatusSection = ({ cardData, loading, disableText }: any) => {
    const { t } = useTranslation();
    const setImage = (value: string) => {
        if (value === GETWELL_STATUS.OPTIMIZED) {
            return <Optimized />;
        }
        if (value === GETWELL_STATUS.UNDER_PROVISIONED) {
            return <UnderProvisioned />;
        }
        if (value === GETWELL_STATUS.OVER_PROVISIONED) {
            return (
                <div style={{ transform: 'rotate(180deg)' }}>
                    <UnderProvisioned />
                </div>
            );
        }
        if (value === GETWELL_STATUS.NOT_OPTIMIZED) {
            return <NotActive />;
        }
        if (value === GETWELL_STATUS.OPTIMIZING || value === GETWELL_STATUS.ANALYZING) {
            return <InProgress />;
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingSection}>
                <DsFlashingDotsLoader />
            </div>
        );
    }
    if (cardData?.dismissedObj?.configState && cardData?.dismissedObj?.configState !== CONFIG_STATES.ACTIVE) {
        return (
            <DsTypography variant="Semibold_14" isDisabled={disableText}>
                {t('databases.general.not-available-table-columns')}
            </DsTypography>
        );
    }

    // Not applicable status - show with tooltip and icon (similar to WAD excluded)
    const statusValue = cardData?.block_two?.value;

    if (isNotApplicableStatus(statusValue)) {
        const displayValue = GETWELL_DISPLAY.NOT_APPLICABLE;
        return (
            <span className={styles.overProvisioned}>
                <span className={styles.tooltipLevel}>
                    <DsPopover
                        title={t('databases.well-architect.not-applicable-tooltip')}
                        trigger="hover"
                        placement="bottom"
                    >
                        <TooltipIcon />
                    </DsPopover>
                </span>
                <span style={{ marginLeft: '8px' }}>
                    <DsTypography variant="Semibold_14" isDisabled>
                        {displayValue}
                    </DsTypography>
                </span>
            </span>
        );
    }

    // WAD excluded configurations show Unavailable with tooltip
    if (cardData?.isWadExcluded) {
        return (
            <span className={styles.overProvisioned}>
                <span className={styles.tooltipLevel}>
                    <DsPopover
                        title={t('databases.wad.tab-disabled-message-oracle')}
                        trigger="hover"
                        placement="bottom"
                    >
                        <TooltipIcon />
                    </DsPopover>
                </span>
                <span style={{ marginLeft: '8px' }}>
                    <DsTypography variant="Semibold_14" isDisabled>
                        {t('databases.well-architect.unavailable')}
                    </DsTypography>
                </span>
            </span>
        );
    }
    return (
        <DsTypography
            variant="Semibold_14"
            className={
                cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED
                    ? `${styles.titleText} ${styles.overProvisioned}`
                    : styles.titleText
            }
            style={{
                whiteSpace: cardData?.errorMessage ? 'unset' : 'nowrap'
            }}
        >
            {cardData?.block_two?.value && cardData?.block_two?.value !== GENERAL.UNAVAILABLE ? (
                <>
                    <span
                        className={styles.svgSection}
                        style={{
                            top:
                                cardData?.block_two?.value === GETWELL_STATUS.UNDER_PROVISIONED ||
                                cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED
                                    ? '2px'
                                    : '8px'
                        }}
                    >
                        {setImage(cardData?.block_two?.value || t('databases.general.not-available-table-columns'))}
                    </span>
                    <span
                        className={styles.valueSection}
                        title={cardData?.block_two?.value || t('databases.general.not-available-table-columns')}
                    >
                        {cardData?.block_two?.value || t('databases.general.not-available-table-columns')}
                    </span>
                </>
            ) : (
                <span className={styles.overProvisioned}>
                    <span className={styles.tooltipLevel}>
                        <Popover
                            popoverClass=""
                            children={
                                cardData?.errorMessage || t('databases.general.assessment-unavailable-with-tooltip')
                            }
                            trigger="hover"
                            isAppendedToBody={false}
                            container={<TooltipIcon />}
                            placement="bottom"
                        />
                    </span>
                    <span style={{ marginLeft: '8px' }}>
                        <DsTypography variant="Semibold_14" isDisabled={disableText}>
                            {t('databases.well-architect.unavailable')}
                        </DsTypography>
                    </span>
                </span>
            )}
        </DsTypography>
    );
};

export default StatusSection;
