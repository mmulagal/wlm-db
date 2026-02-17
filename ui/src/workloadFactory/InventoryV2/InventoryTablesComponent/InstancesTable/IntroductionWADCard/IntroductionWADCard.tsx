import { DsButton, DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StorageCredentials } from '../../../../../assets/WAD.svg';

import styles from './IntroductionWADCard.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { setMssqlInstancesTabVisitCount } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { STAGING } from '../../../../../utils/consts';

const MAX_WAD_CARD_VISITS = 3;

const IntroductionWADCard = ({ buttonRef, setIsCardOpen }: any) => {
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const handleClose = () => {
        setIsCardOpen(false);
        if (import.meta.env.VITE_APP_ENVIRONMENT === STAGING) {
            dispatch(setMssqlInstancesTabVisitCount(MAX_WAD_CARD_VISITS));
        }
    };

    return (
        <div
            className={styles['intro-card']}
            style={{
                top: buttonRef.current?.offsetHeight + 24, // 8px for spacing
                left: buttonRef.current
                    ? buttonRef.current.offsetLeft + buttonRef.current.offsetWidth - 528 /* Card width */
                    : 0,
                height: '540px'
            }}
        >
            <div className={isDarkTheme ? styles.darkSvgContainer : ''}>
                {' '}
                <StorageCredentials />
            </div>

            <div className={styles.content}>
                <DsTypography className={styles.heading} variant="Semibold_14">
                    {t('databases.banner.one-time-assessment')}
                </DsTypography>

                <DsTypography variant="Regular_14" className={styles.text}>
                    {t('databases.banner.one-time-assessment-content')}
                </DsTypography>

                <DsTypography variant="Regular_14" className={styles.text}>
                    {t('databases.banner.one-time-assessment-content-2')}
                </DsTypography>
            </div>
            <div className={styles.buttonContainer}>
                <DsButton isThin variant="secondary" className={styles.button} onClick={handleClose}>
                    {t('databases.banner.close')}
                </DsButton>
            </div>
        </div>
    );
};

export default IntroductionWADCard;
