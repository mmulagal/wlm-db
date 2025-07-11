import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { useMemo } from 'react';
import styles from './HostDistribution.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import HostDistributionChart from './HostDistributionChart/HostDistributionChart';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import { GENERAL } from '../../../utils/appConstants';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';

const HostDistribution = () => {
    const windowSize = useResize();
    const mssqlHostData = useAppSelector(state => state.databaseHome.aggregatedHostsCount);
    const pgsqlHostData = useAppSelector(state => state.databaseHome.aggregatedPgSqlHostsCount);
    const mssqlDatabaseHostsLoading = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsLoading);
    const pgsqlDatabaseHostsLoading = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts.databaseHostsLoading
    );
    const { multiDataLoading, showNA } = useAppSelector(state => state.headers);

    const ChartComponent = useMemo(
        () => () =>
            (
                <HostDistributionChart
                    color1="#0BAFFC"
                    color2="#A815F3"
                    data1={showNA ? 0 : (mssqlHostData?.totalHosts || 0)}
                    data2={showNA ? 0 : (pgsqlHostData?.totalHosts || 0)}
                    centerText="Total hosts"
                    centerValue={showNA ? GENERAL.NOT_AVAILABLE : ((mssqlHostData?.totalHosts || 0) + (pgsqlHostData?.totalHosts || 0)).toString()}
                    loading={multiDataLoading}
                    isDisabled={showNA}
                />
            ),
        [mssqlHostData, pgsqlHostData, multiDataLoading, showNA]
    );

    return (
        <div className={`${styles.hostDistribution} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Host distribution
                </DsTypography>

                {!showNA && (mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading || multiDataLoading) && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <ChartComponent />

                <div className={styles.valueArea}>
                    <div className={`${styles.firstBlock} ${showNA ? CommonStyles.notAvailable : ''}`}>
                        <SquareComponent
                            value={showNA ? GENERAL.NOT_AVAILABLE : String(mssqlHostData?.totalHosts || 0)}
                            color="var(--chart-3)"
                            text={windowSize.width > 1700 ? 'Microsoft SQL Server hosts' : 'Microsoft SQL Server'}
                            loadingInFirstRow={mssqlDatabaseHostsLoading || multiDataLoading}
                            isDisabled={showNA}
                        />
                    </div>

                    <div className={styles.separator} />

                    <div className={`${styles.secondBlock} ${showNA ? CommonStyles.notAvailable : ''}`}>
                        <SquareComponent
                            value={showNA ? GENERAL.NOT_AVAILABLE : String(pgsqlHostData?.totalHosts || 0)}
                            color="var(--chart-9)"
                            text={windowSize.width > 1700 ? 'PostgreSQL hosts' : 'PostgreSQL'}
                            loadingInFirstRow={pgsqlDatabaseHostsLoading || multiDataLoading}
                            isDisabled={showNA}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HostDistribution;
