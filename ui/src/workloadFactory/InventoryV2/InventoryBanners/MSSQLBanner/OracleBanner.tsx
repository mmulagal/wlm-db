import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { useMemo } from 'react';
import { ReactComponent as WellArchitectMSSQL } from '../../../../assets/Well-Architected-MSSQL.svg';
import { ReactComponent as InstanceRegistration } from '../../../../assets/instance-registration-distribution.svg';
import { ReactComponent as InstanceWellArchitected } from '../../../../assets/instance-well-architected.svg';
import styles from './MSSQLBanner.module.scss';

import BannerCard from '../BannerCard/BannerCard';
import { useAppSelector } from '../../../../store/storeHooks';
import { calculateDbBannerCounts } from '../../InventoryUtilsV2';
import { DBType, INVENTORY_BANNER_FILTER_OPTIONS } from '../../../../utils/consts';

const OracleBanner = ({ loading }: { loading: boolean }) => {
    const { t } = useTranslation();
    const { instanceTableRows } = useAppSelector(state => state.inventoryV2);

    const filteredCount = useMemo(() => calculateDbBannerCounts(instanceTableRows, DBType.ORACLE), [instanceTableRows]);

    return (
        <div className={styles.scrollableCard2}>
            <div className={styles.rightSection}>
                <div className={styles.topSection}>
                    <div className={styles.upperSection}>
                        <WellArchitectMSSQL />
                        <div className={styles.upperRightSection}>
                            <DsTypography variant="Semibold_16">{t('databases.banner.well-architected')}</DsTypography>
                            <DsTypography variant="Semibold_16">{t('databases.banner.oracle-server')}</DsTypography>
                        </div>
                    </div>

                    <DsTypography variant="Regular_14">{t('databases.banner.oracle-server-content')}</DsTypography>
                </div>
                <div className={styles.mainSection}>
                    <BannerCard
                        Image={InstanceRegistration}
                        topText={t('databases.banner.database-registration')}
                        text2={t('databases.banner.registered-databases')}
                        text3={t('databases.banner.not-registered-databases')}
                        value1={filteredCount?.registeredRows}
                        value2={filteredCount?.notRegisteredRows}
                        viewFilterOption={INVENTORY_BANNER_FILTER_OPTIONS.NOT_REGISTERED_DATABASES}
                        loading={loading}
                    />

                    <BannerCard
                        Image={InstanceWellArchitected}
                        topText={t('databases.banner.well-architected-database-status')}
                        text2={t('databases.banner.well-architected-databases')}
                        text3={t('databases.banner.not-optimized-databases')}
                        value1={filteredCount?.wellArchitectedRows}
                        value2={filteredCount?.notOptimizedRows}
                        viewFilterOption={INVENTORY_BANNER_FILTER_OPTIONS.NOT_OPTIMIZED_DATABASES}
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    );
};

export default OracleBanner;
