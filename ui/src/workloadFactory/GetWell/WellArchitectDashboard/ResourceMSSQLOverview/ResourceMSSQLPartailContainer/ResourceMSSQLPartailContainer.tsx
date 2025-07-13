import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Warning } from '../../../../../assets/warning.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './ResourceMSSQLPartailContainer.module.scss';

const ResourceMSSQLPartialContainer = () => {
    const { t } = useTranslation();
    return (
        <div className={styles.partialData}>
            <div className={styles.firstSegment}>
                <Warning />
                <DsTypography variant="Semibold_14">
                    {t('databases.resource-overview.missing-modules-content-4')}
                </DsTypography>
            </div>
            <DsTypography variant="Regular_14" className={styles.secondSegment}>
                <div className={styles.list}>
                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_13">
                            {t('databases.resource-overview.missing-modules-content-1')}
                        </DsTypography>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_13">
                            {t('databases.resource-overview.missing-modules-content-2')}
                        </DsTypography>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_13">
                            {t('databases.resource-overview.missing-modules-content-3')}
                        </DsTypography>
                    </div>
                </div>
            </DsTypography>
        </div>
    );
};

export default ResourceMSSQLPartialContainer;
