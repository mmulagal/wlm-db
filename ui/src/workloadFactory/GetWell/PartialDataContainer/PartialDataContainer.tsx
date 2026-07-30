import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, DsTypography } from '@netapp/design-system';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { ReactComponent as Close } from '../../../assets/close-icon.svg';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import { WLF_TABS } from '../../../utils/consts';
import styles from './PartialDataContainer.module.scss';

const LINKS_OVERVIEW_URL = 'https://docs.netapp.com/us-en/workload-fsx-ontap/links-overview.html';

type PartialDataContainerProps = {
    variant?: 'default' | 'missingAssociatedLink' | 'missingExtensiveRunPermission';
    resourceType?: 'instance' | 'database';
};

const PartialDataContainer = ({ variant = 'default', resourceType = 'instance' }: PartialDataContainerProps) => {
    const [isVisible, setIsVisible] = useState(true);
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const handleAssociateLink = () => {
        dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
        dispatch(selectedTabSelection(WLF_TABS.INVENTORY));
    };

    const handleLearnMoreLinks = () => {
        window.open(LINKS_OVERVIEW_URL, '_blank', 'noopener,noreferrer');
    };

    const renderCloseButton = () => (
        <button
            type="button"
            className={styles.closeButton}
            data-testid="partial-data-warning-banner-close"
            aria-label={t('databases.general.close')}
            onClick={() => setIsVisible(false)}
        >
            <Close />
        </button>
    );

    const isDismissibleBanner = variant === 'missingAssociatedLink' || variant === 'missingExtensiveRunPermission';

    if (isDismissibleBanner && !isVisible) {
        return null;
    }

    if (variant === 'missingExtensiveRunPermission') {
        const messageKey =
            resourceType === 'database'
                ? 'databases.wad.partial-data-missing-extensive-run-permission-message-database'
                : 'databases.wad.partial-data-missing-extensive-run-permission-message-instance';

        return (
            <div className={`${styles.partialData} ${styles.missingLink}`} data-testid="partial-data-warning-banner">
                <div className={styles.topSection}>
                    <div className={styles.firstSegment}>
                        <Warning />
                        <DsTypography variant="Regular_14">
                            {t('databases.wad.partial-data-displayed-title')}
                        </DsTypography>
                    </div>
                    {renderCloseButton()}
                </div>
                <div className={styles.body}>
                    <DsTypography variant="Regular_14">{t(messageKey)}</DsTypography>
                </div>
            </div>
        );
    }

    if (variant === 'missingAssociatedLink') {
        return (
            <div className={`${styles.partialData} ${styles.missingLink}`} data-testid="partial-data-warning-banner">
                <div className={styles.topSection}>
                    <div className={styles.firstSegment}>
                        <Warning />
                        <DsTypography variant="Regular_14">
                            {t('databases.wad.partial-data-displayed-title')}
                        </DsTypography>
                    </div>
                    {renderCloseButton()}
                </div>
                <div className={styles.body}>
                    <DsTypography variant="Regular_14">
                        {t('databases.wad.partial-data-missing-link-prefix')}
                    </DsTypography>
                    <DsTypography variant="Regular_14">{t('databases.wad.learn-more-about-links-prefix')}</DsTypography>
                    <Button variant="link" className={styles.externalLinkButton} onClick={handleLearnMoreLinks}>
                        {t('databases.wad.learn-more-about-links')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.partialData}>
            <div className={styles.firstSegment}>
                <Warning />
                <DsTypography variant="Semibold_14">
                    {t('databases.wad.partial-data-missing-permissions-title')}
                </DsTypography>
            </div>
            <DsTypography variant="Regular_14" className={styles.secondSegment}>
                {t('databases.wad.partial-data-missing-permissions-message')}
            </DsTypography>
        </div>
    );
};

export default PartialDataContainer;
