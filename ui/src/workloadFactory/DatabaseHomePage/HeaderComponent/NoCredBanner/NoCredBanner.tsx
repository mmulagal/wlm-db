import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Warning } from '../../../../assets/warning.svg';
import styles from './NoCredBanner.module.scss';
import { CREDENTIAL_PROD_LINK, CREDENTIAL_STAGE_LINK, PRODUCTION } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';

const NoCredBanner = ({ width }: any) => {
    const isWorkloadFactoryStatus = useAppSelector(state => state.auth.isWorkloadFactory);
    const { t } = useTranslation();
    const navigate = useNavigate();
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
        if (isWorkloadFactoryStatus) {
            navigate('../databases/marketing');
        } else {
            navigate('../fsxdb/marketing');
        }
    };
    return (
        <div className={styles.noCredBanner} style={{ width }}>
            <div className={styles.firstSegment}>
                <Warning />
                <DsTypography variant="Regular_14">{t('databases.dashboard.no-credentials')}</DsTypography>
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
