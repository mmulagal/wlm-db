import { Button, Typography } from '@netapp/design-system';

import styles from './InventoryHeaderSection.module.scss';
import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import InventoryChart from '../InventoryChart/InventoryChart';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import { useAppSelector } from '../../../store/storeHooks';

const InventoryHeaderSection = () => {
    const navigate = useNavigate();
    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const isManagedHostInProgress = useAppSelector(state => state.databaseHome.getDatabaseHosts.databaseHostsLoading);
    const { unManagedHosts, unIdentifiableHosts } = useAppSelector(state => state.inventory);
    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    return (
        <div className={styles.inventoryHeader}>
            {/* Top button area */}
            <div className={styles.buttonSection}>
                <div />
                <div>
                    <Button
                        variant="primary"
                        onClick={() => {
                            navigate(WLF_TO_FORM_NAVIGATE);
                        }}
                        id={'deploy-button'}
                    >
                        {GENERAL.DEPLOY_NEW_DATABASE}
                    </Button>
                </div>
            </div>

            {/* chart area */}
            <div className={styles.chartSection}>
                <div className={styles.firstPart}>
                    <InventoryChart />
                </div>

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.DB_HOSTS_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.firstBlock}>
                            <SquareComponent
                                value={(databaseHostsData?.length || 0) + unManagedHosts.length}
                                color="var(--chart-4)"
                                text={GENERAL.DETECTED_HOSTS}
                                isLoading={isDiscoverInProgress}
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent
                                value={unIdentifiableHosts.length}
                                color="var(--chart-2)"
                                text={GENERAL.UNDETECTED_HOSTS}
                                isLoading={isDiscoverInProgress}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.DETECTED_DB_HOSTS_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.thirdBlock}>
                            <SquareComponent
                                value={(databaseHostsData?.length || 0).toString()}
                                color="var(--chart-9)"
                                text={GENERAL.MANAGED_BY_WLF}
                                isLoading={isManagedHostInProgress}
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent
                                value={unManagedHosts.length}
                                color="#DE9EFF"
                                text={GENERAL.UNMANAGED_HOSTS}
                                isLoading={isDiscoverInProgress}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryHeaderSection;
