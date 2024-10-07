import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './TotalOptimizationScore.module.scss';
import OptimizationChart from './OptimizationChart/OptimizationChart';
import Square from '../../../common/Square/Square';
import useResize from '../../../common/hooks/useResize';

const TotalOptimizationScore = () => {
    const windowSize = useResize();
    const loading = false;
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
                    <OptimizationChart />
                </div>

                {windowSize.width >= 1770 && (
                    <div className={styles.tileSection}>
                        <div className={styles.tile} style={{ width: '131px' }}>
                            {!loading && (
                                <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                                    26
                                </DsTypography>
                            )}
                            {loading && (
                                <div style={{ height: '20px', position: 'relative', top: '4px' }}>
                                    {' '}
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            <DsTypography variant="Regular_14">Total configurations</DsTypography>
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.tile} style={{ width: '108px' }}>
                            {!loading && (
                                <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                                    17
                                </DsTypography>
                            )}
                            {loading && (
                                <div style={{ height: '20px', position: 'relative', top: '4px' }}>
                                    {' '}
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-4)" />
                                <DsTypography variant="Regular_14">Optimized</DsTypography>
                            </div>
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.tile} style={{ width: '112px' }}>
                            {!loading && (
                                <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                                    9
                                </DsTypography>
                            )}
                            {loading && (
                                <div style={{ height: '20px', position: 'relative', top: '4px' }}>
                                    {' '}
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-disabled)" />
                                <DsTypography variant="Regular_14">Not optimized</DsTypography>
                            </div>
                        </div>
                    </div>
                )}

                {windowSize.width < 1770 && (
                    <div className={styles.smallTileSection}>
                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <DsTypography style={{ width: '140px' }} variant="Regular_14">
                                Total configurations
                            </DsTypography>

                            <div className={styles.separator} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading && <DsTypography variant="Semibold_14">26</DsTypography>}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-4)" />
                                <DsTypography variant="Regular_14">Optimized</DsTypography>
                            </div>

                            <div className={styles.separator} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading && <DsTypography variant="Semibold_14">17</DsTypography>}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <Square width="8px" height="8px" background="var(--chart-disabled)" />
                                <DsTypography variant="Regular_14">Not optimized</DsTypography>
                            </div>

                            <div className={styles.separator} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading && <DsTypography variant="Semibold_14">9</DsTypography>}
                        </div>

                        <div className={styles.horizontalSeparator} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TotalOptimizationScore;
