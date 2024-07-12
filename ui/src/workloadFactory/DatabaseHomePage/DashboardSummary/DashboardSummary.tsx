import useResize from '../../../common/hooks/useResize';
import { ReactComponent as Host } from '../../../assets/host.svg';
import { ReactComponent as Instance } from '../../../assets/instance.svg';
import { ReactComponent as Database } from '../../../assets/icon database.svg';
import { ReactComponent as Line } from '../../../assets/Line 265.svg';
import styles from './DashboardSummary.module.scss';
import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { useEffect, useState } from 'react';

const DashboardSummary = () => {
    const hostData = useAppSelector(state => state.databaseHome.aggregatedHostsCount);
    const databaseHostsLoadingV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsLoading);
    const fullHostDataLoadingV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.fullHostDataLoading);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(databaseHostsLoadingV2 || fullHostDataLoadingV2);
    }, [databaseHostsLoadingV2, fullHostDataLoadingV2]);

    const windowSize = useResize();
    return (
        <div className={styles.dashboardSummary}>
            {windowSize.width > 1500 && (
                <div className={styles.mainContainer}>
                    {/* section 1 Hosts */}
                    <div className={styles.valueContainer}>
                        <div className={styles.imageContainer}>
                            <Host />
                        </div>
                        <div className={styles.textContainer}>
                            <div className={styles.loadingContainer}>
                                <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                    {hostData?.totalHosts}
                                </DsTypography>
                                {/* <div style={{ height: '42px' }} /> */}
                                {loading && <DsFlashingDotsLoader />}
                            </div>

                            <DsTypography variant="Regular_14">Total Hosts</DsTypography>
                        </div>
                    </div>

                    {/* Section 2 Instances */}
                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Instance />
                        </div>
                        <div className={styles.textContainer}>
                            <div className={styles.loadingContainer}>
                                <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                    {hostData?.totalInstances}
                                </DsTypography>
                                {/* <div style={{ height: '42px' }} /> */}
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Regular_14">Total instances</DsTypography>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className={styles.separator} />

                    {/* Section 3 Managed Instances */}
                    <div className={styles.textContainer}>
                        <div className={styles.loadingContainer}>
                            <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                {hostData?.managedInstances}
                            </DsTypography>
                            {/* <div style={{ height: '42px' }} /> */}
                            {loading && <DsFlashingDotsLoader />}
                        </div>
                        <DsTypography variant="Regular_14">Managed instances</DsTypography>
                    </div>

                    {/* Section 4 Total databases */}

                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Database />
                        </div>
                        <div className={styles.textContainer}>
                            <div className={styles.loadingContainer}>
                                <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                    {hostData?.totalDatabases}
                                </DsTypography>
                                {/* <div style={{ height: '42px' }} /> */}
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Regular_14">Total databases</DsTypography>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className={styles.separator} />

                    {/* Section 5 Managed databases */}
                    <div className={styles.textContainer}>
                        <div className={styles.loadingContainer}>
                            <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                {hostData?.managedDatabases}
                            </DsTypography>
                            {/* <div style={{ height: '42px' }} /> */}
                            {loading && <DsFlashingDotsLoader />}
                        </div>
                        <DsTypography variant="Regular_14">Managed databases</DsTypography>
                    </div>
                </div>
            )}

            {windowSize.width < 1500 && (
                <div className={styles.mainContainer}>
                    {/* section 1 Hosts */}
                    <div className={styles.valueContainer}>
                        <div className={styles.imageContainer}>
                            <Host />
                        </div>
                        <div className={styles.textContainer}>
                            <div className={styles.loadingContainer}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                    {hostData?.totalHosts}
                                </DsTypography>
                                {/* <div style={{ height: '42px' }} /> */}
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Regular_14">Total Hosts</DsTypography>
                        </div>
                    </div>

                    {/* Section 2 Instances */}
                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Instance />
                        </div>
                        <div className={styles.textContainer}>
                            <div className={styles.loadingContainer}>
                                <DsTypography
                                    variant="Regular_24"
                                    className={styles.combinedValue}
                                    style={{ lineHeight: '36px' }}
                                >
                                    <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                        {hostData?.managedInstances}
                                    </DsTypography>
                                    <Line />
                                    <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                        {hostData?.totalInstances}
                                    </DsTypography>
                                </DsTypography>
                                {/* <div style={{ height: '42px' }} /> */}
                                {loading && <DsFlashingDotsLoader />}
                            </div>

                            <DsTypography variant="Regular_14">Managed instances</DsTypography>
                        </div>
                    </div>

                    {/* Section 3 Total databases */}

                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Database />
                        </div>
                        <div className={styles.textContainer}>
                            <div className={styles.loadingContainer}>
                                <DsTypography
                                    variant="Regular_24"
                                    className={styles.combinedValue}
                                    style={{ lineHeight: '36px' }}
                                >
                                    <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                        {hostData?.managedDatabases}
                                    </DsTypography>
                                    <Line />
                                    <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                        {hostData?.totalDatabases}
                                    </DsTypography>
                                </DsTypography>

                                {/* <div style={{ height: '42px' }} /> */}
                                {loading && <DsFlashingDotsLoader />}
                            </div>

                            <DsTypography variant="Regular_14">Managed databases</DsTypography>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardSummary;
