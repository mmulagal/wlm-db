import { Typography } from '@netapp/design-system';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import styles from './NewInventoryHeaderSection.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import NewInventoryChart from './NewInventoryChart/NewInventoryChart';

const NewInventoryHeaderSection = () => {
    // const navigate = useNavigate();
    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventory.isManagedHostListLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventory.getDatabaseHosts);
    const { unManagedHosts, unIdentifiableHosts } = useAppSelector(state => state.inventory);
    const databaseHostsList: any = useAppSelector(state => state.databaseHome.databaseHostsList);
    return (
        <div className={styles.chartSection}>
            <div className={styles.firstPart}>
                <NewInventoryChart
                    color1={'#68C6B3'}
                    color2={'#5E8DCD'}
                    data1={(databaseHostsList?.length || 0) + unManagedHosts.length}
                    data2={unIdentifiableHosts.length}
                    centerText={'Hosts'}
                />

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.DB_HOSTS_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.firstBlock}>
                            <SquareComponent
                                value={((databaseHostsList || [])?.length || 0) + unManagedHosts.length}
                                color="var(--chart-4)"
                                text={GENERAL.DETECTED_HOSTS}
                                isLoading={isDiscoverInProgress || isManagedHostListLoading}
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent
                                value={unIdentifiableHosts.length}
                                color="var(--chart-2)"
                                text={GENERAL.UNIDENTIFIABLE_HOSTS}
                                isLoading={isDiscoverInProgress || isManagedHostListLoading}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.firstPart}>
                <NewInventoryChart
                    color1={'#A815F3'}
                    color2={'#DE9EFF'}
                    data1={databaseHostsList?.length || 0}
                    data2={unManagedHosts.length}
                    centerText={'Instances'}
                />

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.INSTANCES_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.thirdBlock}>
                            <SquareComponent
                                value={((databaseHostsList || [])?.length || 0).toString()}
                                color="var(--chart-9)"
                                text={GENERAL.MANAGED_INSTANCES}
                                isLoading={databaseHostsLoading || fullHostDataLoading}
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent
                                value={unManagedHosts.length}
                                color="#DE9EFF"
                                text={GENERAL.UNMANAGED_INSTANCES}
                                isLoading={isDiscoverInProgress || isManagedHostListLoading}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewInventoryHeaderSection;
