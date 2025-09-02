import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PGSQLDeployment } from '../../../../assets/pgsql-deployment.svg';
import { ReactComponent as PGSQLDeploy } from '../../../../assets/pgsql-deploy.svg';
import styles from './PGSQLBanner.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';

const PGSQLBanner = ({ loading }: { loading: boolean }) => {
    const { t } = useTranslation();
    const { instanceTableRows } = useAppSelector(state => state.inventoryV2);

    return (
        <div className={styles.pgsqlBanner}>
            <div className={styles.rightSection}>
                <div className={styles.topSection}>
                    <div className={styles.upperSection}>
                        <PGSQLDeployment />
                        <div className={styles.upperRightSection}>
                            <DsTypography variant="Semibold_16">{t('databases.banner.pgsql-deployment')}</DsTypography>
                            <DsTypography variant="Semibold_16">{t('databases.banner.PostgreSQL-Server')}</DsTypography>
                        </div>
                    </div>

                    <DsTypography variant="Regular_14">{t('databases.banner.pgsql-deployment-content')}</DsTypography>
                </div>
                <div className={styles.mainSection}>
                    <PGSQLDeploy />

                    <div className={styles.cardTextSection}>
                        <div className={styles.cardValue}>
                            <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                {instanceTableRows?.length || 0}
                            </DsTypography>
                            {loading && (
                                <div className={styles.loaderClass}>
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                        </div>
                        <DsTypography variant="Regular_14">{t('databases.banner.deployed-instances')}</DsTypography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PGSQLBanner;
