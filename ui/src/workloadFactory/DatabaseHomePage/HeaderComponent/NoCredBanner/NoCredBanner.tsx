/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { Button } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ReactComponent as Warning } from '../../../../assets/warning.svg';
import { ReactComponent as Close } from '../../../../assets/close-icon.svg';
import styles from './NoCredBanner.module.scss';
import { CREDENTIAL_PROD_LINK, CREDENTIAL_STAGE_LINK, PRODUCTION } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';

const NoCredBanner = ({ width }: any) => {
    const isWorkloadFactoryStatus = useAppSelector(state => state.auth.isWorkloadFactory);
    const [isVisible, setIsVisible] = useState(true);
    const { t } = useTranslation();

    const openCred = () => {
        let url;
        if (isWorkloadFactoryStatus) {
            url = import.meta.env.VITE_APP_CREDENTIAL_WF_LINK;
        } else {
            url = import.meta.env.VITE_APP_ENVIRONMENT === PRODUCTION ? CREDENTIAL_PROD_LINK : CREDENTIAL_STAGE_LINK;
        }

        window.location.href = url;
    };

    const learnMore = () => {
        window.open(
            'https://docs.netapp.com/us-en/workload-setup-admin/permissions-reference.html#why-use-permissions',
            '_blank',
            'noopener,noreferrer'
        );
    };

    const closeHandler = () => {
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }
    return (
        <div className={styles.noCredBanner} style={{ width }}>
            <div className={styles.topSection}>
                <div className={styles.firstSegment}>
                    <Warning />
                    <DsTypography variant="Regular_14">{t('databases.dashboard.no-credentials')}</DsTypography>
                </div>
                <div onClick={closeHandler} className={styles.image}>
                    <Close />
                </div>
            </div>

            <div className={styles.secondSegment}>
                <DsButton onClick={openCred} type="text">
                    {t('databases.dashboard.add-credentials')}
                </DsButton>
                <DsTypography variant="Regular_14">{t('databases.dashboard.discover-database')}</DsTypography>
                <Button className={styles.buttonClass} onClick={learnMore} variant="link">
                    {t('databases.dashboard.learn-more')}
                </Button>
            </div>
        </div>
    );
};

export default NoCredBanner;
