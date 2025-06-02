import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './DatabaseDistribution.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import { ReactComponent as Database } from '../../../assets/icon database.svg';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { useMemo } from 'react';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';

const DatabaseDistribution = () => {
    const { aggregatedHostsCount, aggregatedPgSqlHostsCount } = useAppSelector(state => state.databaseHome);
    const { getDatabaseHosts, getPgSqlDatabaseHosts } = useAppSelector(state => state.inventoryV2);
    const { multiDataLoading } = useAppSelector(state => state.headers);
    const loading = useMemo(() => {
        return getDatabaseHosts.fullHostDataLoading || getPgSqlDatabaseHosts.fullHostDataLoading || multiDataLoading;
    }, [getDatabaseHosts, getPgSqlDatabaseHosts, multiDataLoading]);

    return (
        <div className={styles.databaseDistribution}>
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
                                variant="Regular_32"
                                style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }}
                            >
                                {(aggregatedHostsCount?.totalDatabases || 0) +
                                    (aggregatedPgSqlHostsCount?.totalDatabases || 0)}
                                {loading && <DsFlashingDotsLoader />}
                            </DsTypography>
                            <DsTypography variant="Regular_14">Total databases</DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="56px" />

                    <div className={styles.valueSection}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }}>
                            {(aggregatedHostsCount?.managedDatabases || 0) +
                                (aggregatedPgSqlHostsCount?.managedDatabases || 0)}
                            {loading && <DsFlashingDotsLoader />}
                        </DsTypography>

                        <DsTypography variant="Regular_14">Registered databases</DsTypography>
                    </div>
                </div>

                <DsTypography variant="Semibold_14">Registered databases</DsTypography>
                <div className={styles.barContainer}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText="Microsoft SQL Server"
                        percentage={formatFractionalNumber(
                            ((aggregatedHostsCount?.managedDatabases || 0) /
                                (aggregatedHostsCount?.totalDatabases || 1)) *
                                100,
                            2
                        )}
                        beforeOutOf={aggregatedHostsCount?.managedDatabases || 0}
                        afterOutOf={aggregatedHostsCount?.totalDatabases || 0}
                        bottomText="Registered databases:"
                        width="auto"
                        loading={loading}
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText="PostgreSQL"
                        percentage={formatFractionalNumber(
                            ((aggregatedPgSqlHostsCount?.managedDatabases || 0) /
                                (aggregatedPgSqlHostsCount?.totalDatabases || 1)) *
                                100,
                            2
                        )}
                        beforeOutOf={aggregatedPgSqlHostsCount?.managedDatabases || 0}
                        afterOutOf={aggregatedPgSqlHostsCount?.totalDatabases || 0}
                        bottomText="Registered databases:"
                        width="auto"
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    );
};

export default DatabaseDistribution;
