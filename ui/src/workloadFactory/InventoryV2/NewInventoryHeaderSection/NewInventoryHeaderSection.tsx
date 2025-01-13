import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import styles from './NewInventoryHeaderSection.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import NewInventoryChart from './NewInventoryChart/NewInventoryChart';
import { useEffect, useState } from 'react';
import useResize from '../../../common/hooks/useResize';

const NewInventoryHeaderSection = () => {
    // const navigate = useNavigate();
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { inventoryChartData, isManagedHostListLoading, fsxCredentialStatusLoading } = useAppSelector(
        state => state.inventoryV2
    );
    const [loading, setLoading] = useState(false);
    const windowSize = useResize();

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                isDiscoverInProgress ||
                fullHostDataLoading ||
                isManagedHostListLoading ||
                fsxCredentialStatusLoading
        );
    }, [
        databaseHostsLoading,
        isDiscoverInProgress,
        fullHostDataLoading,
        isManagedHostListLoading,
        fsxCredentialStatusLoading
    ]);

    return (
        <div className={styles.chartSection}>
            {windowSize.width > 1500 && (
                <>
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
                                        isLoading={false}
                                        loadingInFirstRow={loading}
                                    />
                                </div>

                                <div className={styles.separator} />

                                <div className={styles.secondBlock}>
                                    <SquareComponent
                                        value={String(inventoryChartData?.undetectedHost || 0)}
                                        color="var(--chart-2)"
                                        text={GENERAL.HOSTS_PENDING_DETECTION}
                                        isLoading={false}
                                        loadingInFirstRow={loading}
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
                                        color="#A815F3"
                                        text={GENERAL.MANAGED_INSTANCES}
                                        isLoading={false}
                                        loadingInFirstRow={loading}
                                    />
                                </div>

                                <div className={styles.separator} />

                                <div className={styles.secondBlock}>
                                    <SquareComponent
                                        value={String(inventoryChartData?.unmanagedInstance || 0)}
                                        color="#DE9EFF"
                                        text={GENERAL.UNMANAGED_INSTANCES}
                                        isLoading={false}
                                        loadingInFirstRow={loading}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {windowSize.width < 1500 && (
                <div style={{ display: 'flex', gap: '78px' }}>
                    <div className={styles.firstPart}>
                        <NewInventoryChart
                            color1={'#68C6B3'}
                            color2={'#5E8DCD'}
                            data1={inventoryChartData?.detectedHost}
                            data2={inventoryChartData?.undetectedHost}
                            centerText={'Hosts'}
                        />

                        <div className={styles.secondPartSmallRes}>
                            <div className={styles.headSection}>
                                <Typography variant="Semibold_16" className={styles.heading}>
                                    {GENERAL.DB_HOSTS_DISTRIBUTION}
                                </Typography>
                                {loading && (
                                    <div style={{ position: 'relative', top: '12px' }}>
                                        <DsFlashingDotsLoader />
                                    </div>
                                )}
                            </div>

                            <div className={styles.firstBlockSection}>
                                <div className={styles.bottomRow}>
                                    <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                                    <Typography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                        {GENERAL.DETECTED_HOSTS}
                                    </Typography>
                                </div>
                                <Typography className={styles.valueText} variant="Semibold_14">
                                    {String(inventoryChartData?.detectedHost || 0)} hosts
                                </Typography>
                            </div>

                            <div className={styles.firstBlockSection} style={{ borderTop: 'none' }}>
                                <div className={styles.bottomRow}>
                                    <div className={styles.square} style={{ backgroundColor: 'var(--chart-2)' }} />
                                    <Typography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                        {GENERAL.HOSTS_PENDING_DETECTION}
                                    </Typography>
                                </div>
                                <Typography className={styles.valueText} variant="Semibold_14">
                                    {String(inventoryChartData?.undetectedHost || 0)} hosts
                                </Typography>
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

                        <div className={styles.secondPartSmallRes}>
                            <div className={styles.headSection}>
                                <Typography variant="Semibold_16" className={styles.heading}>
                                    {GENERAL.INSTANCES_DISTRIBUTION}
                                </Typography>
                                {loading && (
                                    <div style={{ position: 'relative', top: '12px' }}>
                                        <DsFlashingDotsLoader />
                                    </div>
                                )}
                            </div>

                            <div className={styles.firstBlockSection}>
                                <div className={styles.bottomRow}>
                                    <div className={styles.square} style={{ backgroundColor: 'var(--chart-9)' }} />
                                    <Typography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                        {GENERAL.MANAGED_INSTANCES}
                                    </Typography>
                                </div>
                                <Typography className={styles.valueText} variant="Semibold_14">
                                    {String(inventoryChartData?.managedInstance || 0)} instances
                                </Typography>
                            </div>

                            <div className={styles.firstBlockSection} style={{ borderTop: 'none' }}>
                                <div className={styles.bottomRow}>
                                    <div className={styles.square} style={{ backgroundColor: '#DE9EFF' }} />
                                    <Typography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                        {GENERAL.UNMANAGED_INSTANCES}
                                    </Typography>
                                </div>
                                <Typography className={styles.valueText} variant="Semibold_14">
                                    {String(inventoryChartData?.unmanagedInstance || 0)} instances
                                </Typography>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewInventoryHeaderSection;
