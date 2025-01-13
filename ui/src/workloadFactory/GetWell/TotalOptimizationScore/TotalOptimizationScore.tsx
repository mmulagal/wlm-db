import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './TotalOptimizationScore.module.scss';
import OptimizationChart from './OptimizationChart/OptimizationChart';
import Square from '../../../common/Square/Square';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const TotalOptimizationScore = () => {
    const windowSize = useResize();
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const optimizationBreakDown = useAppSelector(state => state.getWellOptimize.optimizationBreakDown);
    const isAssessmentAvailable = useAppSelector(state => state.getWellOptimize.isAssessmentAvailable);

    return (
        <div className={styles.totalOptimizationScore}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Total optimization score
                </DsTypography>
                {loading && <DsFlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <div className={styles.chartSection}>
                    <OptimizationChart hostData={optimizationBreakDown?.total} />
                </div>

                {windowSize.width >= 1770 && (
                    <div className={styles.tileSection}>
                        <div className={styles.tile} style={{ width: '131px' }}>
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                                        {optimizationBreakDown?.total?.total}
                                    </DsTypography>
                                ) : (
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Semibold_16"
                                        isDisabled={true}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                            {loading && (
                                <div style={{ height: '20px', position: 'relative', top: '4px' }}>
                                    {' '}
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            <DsTypography
                                variant="Regular_14"
                                isDisabled={!loading && !isAssessmentAvailable ? true : false}
                            >
                                Total configurations
                            </DsTypography>
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.tile} style={{ width: '108px' }}>
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                                        {optimizationBreakDown?.total?.optimized}
                                    </DsTypography>
                                ) : (
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Semibold_16"
                                        isDisabled={true}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                            {loading && (
                                <div style={{ height: '20px', position: 'relative', top: '4px' }}>
                                    {' '}
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-4)" />
                                <DsTypography
                                    variant="Regular_14"
                                    isDisabled={!loading && !isAssessmentAvailable ? true : false}
                                >
                                    Optimized
                                </DsTypography>
                            </div>
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.tile} style={{ width: '112px' }}>
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                                        {optimizationBreakDown?.total?.notOptimized}
                                    </DsTypography>
                                ) : (
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Semibold_16"
                                        isDisabled={true}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                            {loading && (
                                <div style={{ height: '20px', position: 'relative', top: '4px' }}>
                                    {' '}
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-disabled)" />
                                <DsTypography
                                    variant="Regular_14"
                                    isDisabled={!loading && !isAssessmentAvailable ? true : false}
                                >
                                    Not optimized
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                )}

                {windowSize.width < 1770 && (
                    <div className={styles.smallTileSection}>
                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <DsTypography
                                style={{ width: '140px' }}
                                variant="Regular_14"
                                isDisabled={!loading && !isAssessmentAvailable ? true : false}
                            >
                                Total configurations
                            </DsTypography>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />
                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.total}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled={true}>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-4)" />
                                <DsTypography
                                    variant="Regular_14"
                                    isDisabled={!loading && !isAssessmentAvailable ? true : false}
                                >
                                    Optimized
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
                                    <DsTypography variant="Semibold_14" isDisabled={true}>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-disabled)" />
                                <DsTypography
                                    variant="Regular_14"
                                    isDisabled={!loading && !isAssessmentAvailable ? true : false}
                                >
                                    Not optimized
                                </DsTypography>
                            </div>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.notOptimized}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled={true}>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TotalOptimizationScore;
