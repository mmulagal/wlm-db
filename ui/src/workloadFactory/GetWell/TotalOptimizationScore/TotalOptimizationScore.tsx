import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as WellArchitect } from '../../../assets/well-architect.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import styles from './TotalOptimizationScore.module.scss';
import OptimizationChart from './OptimizationChart/OptimizationChart';

import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const TotalOptimizationScore = () => {
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const optimizationBreakDown = useAppSelector(state => state.getWellOptimize.optimizationBreakDown);
    const isAssessmentAvailable = useAppSelector(state => state.getWellOptimize.isAssessmentAvailable);

    return (
        <div className={styles.totalOptimizationScore}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Well-architected score
                </DsTypography>
                {loading && <DsFlashingDotsLoader />}
            </div>

            {!loading && Number(optimizationBreakDown?.total?.percent) === 100 && (
                <div className={styles.perfectScore}>
                    <div className={styles.image}>
                        <WellArchitect />
                    </div>
                    <div className={styles.text}>
                        <div className={styles.firstBlock}>
                            <Success />
                            <DsTypography variant="Semibold_16">This instance is well-architected!</DsTypography>
                        </div>

                        <div className={styles.secondBlock}>
                            <DsTypography variant="Regular_14" style={{ textAlign: 'center' }}>
                                There are no issues. Your instance is analyzed every 24 hours for configuration issues.
                            </DsTypography>
                        </div>
                    </div>
                </div>
            )}

            {(loading || Number(optimizationBreakDown?.total?.percent) !== 100) && (
                <div className={styles.mainSection}>
                    <div className={styles.chartSection}>
                        <OptimizationChart hostData={optimizationBreakDown?.total} />
                    </div>

                    <div className={styles.smallTileSection}>
                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <DsTypography variant="Regular_14" isDisabled={!!(!loading && !isAssessmentAvailable)}>
                                    Well-architected configurations
                                </DsTypography>
                            </div>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.optimized}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <DsTypography variant="Regular_14" isDisabled={!!(!loading && !isAssessmentAvailable)}>
                                    Critical issues
                                </DsTypography>
                            </div>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.critical}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <DsTypography variant="Regular_14" isDisabled={!!(!loading && !isAssessmentAvailable)}>
                                    Warnings
                                </DsTypography>
                            </div>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.warning}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <DsTypography
                                style={{ width: '140px' }}
                                variant="Semibold_14"
                                isDisabled={!!(!loading && !isAssessmentAvailable)}
                            >
                                Total
                            </DsTypography>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />
                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.total}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TotalOptimizationScore;
