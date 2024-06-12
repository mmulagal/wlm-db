import { Typography } from '@netapp/design-system';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import styles from './NewInventoryHeaderSection.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import NewInventoryChart from './NewInventoryChart/NewInventoryChart';
import { useEffect, useState } from 'react';

const NewInventoryHeaderSection = () => {
    // const navigate = useNavigate();
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { inventoryChartData, isManagedHostListLoading } = useAppSelector(state => state.inventoryV2);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(databaseHostsLoading || isDiscoverInProgress || fullHostDataLoading || isManagedHostListLoading);
    }, [databaseHostsLoading, isDiscoverInProgress, fullHostDataLoading, isManagedHostListLoading]);

    return (
        <div className={styles.chartSection}>
            <div className={styles.firstPart}>
                <NewInventoryChart
                    color1={'#68C6B3'}
                    color2={'#5E8DCD'}
                    data1={inventoryChartData?.detectedHost}
                    data2={inventoryChartData?.undetectedHost}
                    centerText={'Hosts'}
                />

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.DB_HOSTS_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.firstBlock}>
                            <SquareComponent
                                value={String(inventoryChartData?.detectedHost || 0)}
                                color="var(--chart-4)"
                                text={GENERAL.DETECTED_HOSTS}
                                isLoading={loading}
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent
                                value={String(inventoryChartData?.undetectedHost || 0)}
                                color="var(--chart-2)"
                                text={GENERAL.UNIDENTIFIABLE_HOSTS}
                                isLoading={loading}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.firstPart}>
                <NewInventoryChart
                    color1={'#A815F3'}
                    color2={'#DE9EFF'}
                    data1={inventoryChartData?.managedInstance}
                    data2={inventoryChartData?.unmanagedInstance}
                    centerText={'Instances'}
                />

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.INSTANCES_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.thirdBlock}>
                            <SquareComponent
                                value={String(inventoryChartData?.managedInstance || 0)}
                                color="var(--chart-9)"
                                text={GENERAL.MANAGED_INSTANCES}
                                isLoading={loading}
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent
                                value={String(inventoryChartData?.unmanagedInstance || 0)}
                                color="#DE9EFF"
                                text={GENERAL.UNMANAGED_INSTANCES}
                                isLoading={loading}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewInventoryHeaderSection;
