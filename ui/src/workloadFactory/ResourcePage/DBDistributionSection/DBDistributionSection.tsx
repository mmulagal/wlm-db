import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './DBDistributionSection.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSize } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';

const DBDistributionSection = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const { cpu, disk, memory } = resourceDetails.resourceUtilization || {};

    return (
        <div className={styles.dbDistribution}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.RESOURCE_UTILIZATION}
                </Typography>
                {resourceLoading && <FlashingDotsLoader />}
            </div>

            <div className={styles.utilizationContainer}>
                <div className={styles.barContainer}>
                    <div className={styles.firstBar}>
                        <Typography variant="Semibold_20">{`${disk?.percentUsed || 0}%`}</Typography>
                        {/* Progress Bar */}
                        <div className={styles.progressBar}>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${100 - (parseInt(disk?.percentUsed) || 0)}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${parseInt(disk?.percentUsed) || 0}%`,
                                    backgroundColor: 'var(--chart-3)'
                                }}
                            ></div>
                        </div>
                        {/* Ends here */}

                        <Typography variant="Regular_14">{GENERAL.STORAGE}</Typography>
                    </div>

                    <div className={styles.firstBar}>
                        <Typography variant="Semibold_20">{`${memory?.percentUsed || 0}%`}</Typography>
                        {/* Progress Bar */}
                        <div className={styles.progressBar}>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${100 - (parseInt(memory?.percentUsed) || 0)}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${parseInt(memory?.percentUsed) || 0}%`,
                                    backgroundColor: 'var(--chart-2)'
                                }}
                            ></div>
                        </div>
                        {/* Ends here */}

                        <Typography variant="Regular_14">{GENERAL.MEMORY}</Typography>
                    </div>

                    <div className={styles.firstBar}>
                        <Typography variant="Semibold_20">{`${cpu?.percentUsed || 0}%`}</Typography>
                        {/* Progress Bar */}
                        <div className={styles.progressBar}>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${100 - (parseInt(cpu?.percentUsed) || 0)}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    height: `${parseInt(cpu?.percentUsed) || 0}%`,
                                    backgroundColor: 'var(--chart-1)'
                                }}
                            ></div>
                        </div>
                        {/* Ends here */}

                        <Typography variant="Regular_14">{GENERAL.CPU}</Typography>
                    </div>
                </div>

                <div className={styles.textContainer}>
                    <div className={styles.headerPart}>
                        <Typography variant="Semibold_14">{GENERAL.RESOURCES_DISTRIBUTION}</Typography>
                    </div>

                    <div className={styles.separatorProtection} />

                    <div className={styles.usedAllocatedSection}>
                        <div className={styles.firstRow}>
                            <Typography variant="Semibold_14">{`${formatSize(
                                parseInt(disk?.used) || 0
                            )} used`}</Typography>
                            <div className={styles.smallSeparator} />
                            <Typography variant="Regular_14">{`${formatSize(
                                parseInt(disk?.total) || 0
                            )} allocated`}</Typography>
                        </div>
                        <div className={styles.secondRow}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                            <Typography variant="Regular_14">{GENERAL.STORAGE}</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />

                    <div className={styles.usedAllocatedSection}>
                        <div className={styles.firstRow}>
                            <Typography variant="Semibold_14">{`${formatSize(
                                parseInt(memory?.used) || 0
                            )} used`}</Typography>
                            <div className={styles.smallSeparator} />
                            <Typography variant="Regular_14">{`${formatSize(
                                parseInt(memory?.total) || 0
                            )} allocated`}</Typography>
                        </div>
                        <div className={styles.secondRow}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-2)' }} />
                            <Typography variant="Regular_14">{GENERAL.MEMORY}</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />

                    <div className={styles.usedAllocatedSection}>
                        <div className={styles.firstRow}>
                            <Typography variant="Semibold_14">{`Current usage ${cpu?.percentUsed || 0}%`}</Typography>
                        </div>
                        <div className={styles.secondRow}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-1)' }} />
                            <Typography variant="Regular_14">{GENERAL.CPU}</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />
                </div>
            </div>
        </div>
    );
};

export default DBDistributionSection;
