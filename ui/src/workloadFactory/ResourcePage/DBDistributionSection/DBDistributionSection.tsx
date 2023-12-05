import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './DBDistributionSection.module.scss';

const DBDistributionSection = () => {
    const data = {
        storage: 60,
        memory: 25,
        cpu: 20
    };
    return (
        <div className={styles.dbDistribution}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    Resources utilization
                </Typography>
                {/* <FlashingDotsLoader /> */}
            </div>

            <div className={styles.utilizationContainer}>
                <div className={styles.barContainer}>
                    <div className={styles.firstBar}>
                        <Typography variant="Semibold_20">60%</Typography>
                        {/* Progress Bar */}
                        <div className={styles.progressBar}>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar}`}
                                style={{
                                    height: `${100 - data.storage}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${data.storage}%`,
                                    backgroundColor: 'var(--chart-3)'
                                }}
                            ></div>
                        </div>
                        {/* Ends here */}

                        <Typography variant="Regular_14">Storage</Typography>
                    </div>

                    <div className={styles.firstBar}>
                        <Typography variant="Semibold_20">25%</Typography>
                        {/* Progress Bar */}
                        <div className={styles.progressBar}>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar}`}
                                style={{
                                    height: `${100 - data.memory}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${data.memory}%`,
                                    backgroundColor: 'var(--chart-2)'
                                }}
                            ></div>
                        </div>
                        {/* Ends here */}

                        <Typography variant="Regular_14">Memory</Typography>
                    </div>

                    <div className={styles.firstBar}>
                        <Typography variant="Semibold_20">20%</Typography>
                        {/* Progress Bar */}
                        <div className={styles.progressBar}>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar}`}
                                style={{
                                    height: `${100 - data.cpu}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${data.cpu}%`,
                                    backgroundColor: 'var(--chart-1)'
                                }}
                            ></div>
                        </div>
                        {/* Ends here */}

                        <Typography variant="Regular_14">CPU</Typography>
                    </div>
                </div>

                <div className={styles.textContainer}>
                    <div className={styles.headerPart}>
                        <Typography variant="Semibold_14">Resources distribution</Typography>
                    </div>

                    <div className={styles.separatorProtection} />

                    <div className={styles.usedAllocatedSection}>
                        <div className={styles.firstRow}>
                            <Typography variant="Semibold_14">Used 50 TiB</Typography>
                            <div className={styles.smallSeparator} />
                            <Typography variant="Regular_14">Allocated 100 TiB</Typography>
                        </div>
                        <div className={styles.secondRow}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                            <Typography variant="Regular_14">Storage</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />

                    <div className={styles.usedAllocatedSection}>
                        <div className={styles.firstRow}>
                            <Typography variant="Semibold_14">Used 50 TiB</Typography>
                            <div className={styles.smallSeparator} />
                            <Typography variant="Regular_14">Allocated 100 TiB</Typography>
                        </div>
                        <div className={styles.secondRow}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-2)' }} />
                            <Typography variant="Regular_14">Memory</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />

                    <div className={styles.usedAllocatedSection}>
                        <div className={styles.firstRow}>
                            <Typography variant="Semibold_14">Used 50 TiB</Typography>
                            <div className={styles.smallSeparator} />
                            <Typography variant="Regular_14">Allocated 100 TiB</Typography>
                        </div>
                        <div className={styles.secondRow}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-1)' }} />
                            <Typography variant="Regular_14">CPU</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />
                </div>
            </div>
        </div>
    );
};

export default DBDistributionSection;
