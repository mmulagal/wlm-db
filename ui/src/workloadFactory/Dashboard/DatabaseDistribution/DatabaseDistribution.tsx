import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DatabaseDistribution.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import { ReactComponent as Database } from '../../../assets/icon database.svg';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';

const DatabaseDistribution = () => {
    const { t } = useTranslation();
    const { aggregatedHostsCount, aggregatedPgSqlHostsCount } = useAppSelector(state => state.databaseHome);
    const { getDatabaseHosts, getPgSqlDatabaseHosts } = useAppSelector(state => state.inventoryV2);
    const { multiDataLoading, showNA } = useAppSelector(state => state.headers);
    const loading = useMemo(
        () => getDatabaseHosts.fullHostDataLoading || getPgSqlDatabaseHosts.fullHostDataLoading || multiDataLoading,
        [getDatabaseHosts, getPgSqlDatabaseHosts, multiDataLoading]
    );

    return (
        <div className={`${styles.databaseDistribution} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Databases distribution
                </DsTypography>

                {loading && <DsFlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                {/* top section */}
                <div className={styles.tile}>
                    <div className={styles.leftSection}>
                        <div>
                            <Database />
                        </div>
                        <div className={styles.valueSection}>
                            <DsTypography
                                variant={showNA ? "Regular_14" : "Regular_32"}
                                style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }}
                                className={showNA ? CommonStyles.notAvailable : ''}
                            >
                                {showNA ? t('databases.general.not-available') : (aggregatedHostsCount?.totalDatabases || 0) +
                                    (aggregatedPgSqlHostsCount?.totalDatabases || 0)}
                                {loading && <DsFlashingDotsLoader />}
                            </DsTypography>
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>Total databases</DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="56px" />

                    <div className={styles.valueSection}>
                        <DsTypography variant={showNA ? "Regular_14" : "Regular_32"} style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }} className={showNA ? CommonStyles.notAvailable : ''}>
                            {showNA ? t('databases.general.not-available') : (aggregatedHostsCount?.managedDatabases || 0) +
                                (aggregatedPgSqlHostsCount?.managedDatabases || 0)}
                            {loading && <DsFlashingDotsLoader />}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>Registered databases</DsTypography>
                    </div>
                </div>

                <DsTypography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>Registered databases</DsTypography>
                <div className={`${styles.barContainer} ${showNA ? CommonStyles.notAvailable : ''}`}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText="Microsoft SQL Server"
                        percentage={showNA ? t('databases.general.not-available') : formatFractionalNumber(
                            ((aggregatedHostsCount?.managedDatabases || 0) /
                                (aggregatedHostsCount?.totalDatabases || 1)) *
                                100,
                            2
                        )}
                        beforeOutOf={showNA ? t('databases.general.not-available') : aggregatedHostsCount?.managedDatabases || 0}
                        afterOutOf={showNA ? t('databases.general.not-available') : aggregatedHostsCount?.totalDatabases || 0}
                        bottomText="Registered databases:"
                        width="auto"
                        loading={loading}
                        isDisabled={showNA}
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText="PostgreSQL"
                        percentage={showNA ? t('databases.general.not-available') : formatFractionalNumber(
                            ((aggregatedPgSqlHostsCount?.managedDatabases || 0) /
                                (aggregatedPgSqlHostsCount?.totalDatabases || 1)) *
                                100,
                            2
                        )}
                        beforeOutOf={showNA ? t('databases.general.not-available') : aggregatedPgSqlHostsCount?.managedDatabases || 0}
                        afterOutOf={showNA ? t('databases.general.not-available') : aggregatedPgSqlHostsCount?.totalDatabases || 0}
                        bottomText="Registered databases:"
                        width="auto"
                        loading={loading}
                        isDisabled={showNA}
                    />
                </div>
            </div>
        </div>
    );
};

export default DatabaseDistribution;
