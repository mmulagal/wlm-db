import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, DsTypography } from '@netapp/design-system';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { ReactComponent as Close } from '../../../assets/close-icon.svg';
import styles from '../../GetWell/PartialDataContainer/PartialDataContainer.module.scss';

type ExploreSavingsPartialDataBannerProps = {
    showAuthLink?: boolean;
    onAuthenticate?: () => void;
};

const ExploreSavingsPartialDataBanner = ({
    showAuthLink = false,
    onAuthenticate
}: ExploreSavingsPartialDataBannerProps) => {
    const [isVisible, setIsVisible] = useState(true);
    const { t } = useTranslation();

    if (!isVisible) {
        return null;
    }

    return (
        <div
            className={`${styles.partialData} ${styles.missingLink}`}
            data-testid="explore-savings-partial-data-banner"
        >
            <div className={styles.topSection}>
                <div className={styles.firstSegment}>
                    <Warning />
                    <DsTypography variant="Regular_14">{t('databases.wad.partial-data-displayed-title')}</DsTypography>
                </div>
                <button
                    type="button"
                    className={styles.closeButton}
                    data-testid="explore-savings-partial-data-banner-close"
                    aria-label={t('databases.general.close')}
                    onClick={() => setIsVisible(false)}
                >
                    <Close />
                </button>
            </div>
            <div className={styles.body}>
                <DsTypography variant="Regular_14">{t('databases.explore-savings.partial-data-message')}</DsTypography>
                {showAuthLink && onAuthenticate && (
                    <Button variant="link" onClick={onAuthenticate}>
                        {t('databases.explore-savings.authenticate')}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ExploreSavingsPartialDataBanner;
