import useResize from '../../../common/hooks/useResize';
import { ReactComponent as Host } from '../../../assets/host.svg';
import { ReactComponent as Instance } from '../../../assets/instance.svg';
import { ReactComponent as Database } from '../../../assets/icon database.svg';
import { ReactComponent as Line } from '../../../assets/Line 265.svg';
import styles from './DashboardSummary.module.scss';
import { DsTypography } from '@netapp/design-system';

const DashboardSummary = () => {
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
                            <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                20
                            </DsTypography>
                            <DsTypography variant="Regular_14">Total Hosts</DsTypography>
                        </div>
                    </div>

                    {/* Section 2 Instances */}
                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Instance />
                        </div>
                        <div className={styles.textContainer}>
                            <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                120
                            </DsTypography>
                            <DsTypography variant="Regular_14">Total instances</DsTypography>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className={styles.separator} />

                    {/* Section 3 Managed Instances */}
                    <div className={styles.textContainer}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                            100
                        </DsTypography>
                        <DsTypography variant="Regular_14">Managed instances</DsTypography>
                    </div>

                    {/* Section 4 Total databases */}

                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Database />
                        </div>
                        <div className={styles.textContainer}>
                            <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                                120
                            </DsTypography>
                            <DsTypography variant="Regular_14">Total databases</DsTypography>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className={styles.separator} />

                    {/* Section 5 Managed databases */}
                    <div className={styles.textContainer}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: '43px' }}>
                            100
                        </DsTypography>
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
                            <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                20
                            </DsTypography>
                            <DsTypography variant="Regular_14">Total Hosts</DsTypography>
                        </div>
                    </div>

                    {/* Section 2 Instances */}
                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Instance />
                        </div>
                        <div className={styles.textContainer}>
                            <DsTypography
                                variant="Regular_24"
                                className={styles.combinedValue}
                                style={{ lineHeight: '36px' }}
                            >
                                <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                    100
                                </DsTypography>
                                <Line />
                                <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                    120
                                </DsTypography>
                            </DsTypography>
                            <DsTypography variant="Regular_14">Managed instances</DsTypography>
                        </div>
                    </div>

                    {/* Section 3 Total databases */}

                    <div className={`${styles.valueContainer} ${styles.marginAdjust}`}>
                        <div className={styles.imageContainer}>
                            <Database />
                        </div>
                        <div className={styles.textContainer}>
                            <DsTypography
                                variant="Regular_24"
                                className={styles.combinedValue}
                                style={{ lineHeight: '36px' }}
                            >
                                <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                    100
                                </DsTypography>
                                <Line />
                                <DsTypography variant="Regular_24" style={{ lineHeight: '36px' }}>
                                    120
                                </DsTypography>
                            </DsTypography>
                            <DsTypography variant="Regular_14">Managed databases</DsTypography>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardSummary;
