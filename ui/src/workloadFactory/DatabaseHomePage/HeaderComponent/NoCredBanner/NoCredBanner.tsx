/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { useAppSelector } from '../../../../store/storeHooks';
import { BlueXPListeners, Button, postBlueXPMessage } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ReactComponent as Warning } from '../../../../assets/warning.svg';
import { ReactComponent as Close } from '../../../../assets/close-icon.svg';
import styles from './NoCredBanner.module.scss';

const NoCredBanner = ({ width }: any) => {
    const [isVisible, setIsVisible] = useState(true);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const openCred = () => {
        if (!isWorkloadFactory) {
            navigate('../..//credentials/wlf');
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: '../..//credentials/wlf',
                    replace: true
                }
            });
        } else {
            navigate('../../credentials');
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: '../../credentials',
                    replace: true
                }
            });
        }
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
