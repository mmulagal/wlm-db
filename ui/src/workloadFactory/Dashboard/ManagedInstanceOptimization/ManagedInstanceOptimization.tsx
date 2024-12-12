import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import styles from './ManagedInstanceOptimization.module.scss';
import HostDistributionChart from '../HostDistribution/HostDistributionChart/HostDistributionChart';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import useResize from '../../../common/hooks/useResize';
import { GENERAL } from '../../../utils/appConstants';
import ManagedInstanceOptimizationBreakdownByCategory from '../ManagedInstanceOptimizationBreakdownByCategory/ManagedInstanceOptimizationBreakdownByCategory';

const ManagedInstanceOptimization = ({ openAccordion, setOpenAccordion }: any) => {
    const windowSize = useResize();
    const loading = false;
    return (
        <div className={styles.managedInstance} style={{ height: !openAccordion ? '436px' : '992px' }}>
            <div className={styles.headSection}>
                <div className={styles.ManageInstanceTooltipSection}>
                    <DsTypography variant="Regular_16" className={styles.title}>
                        Managed instances optimization score
                    </DsTypography>

                    <TooltipInfo>{GENERAL.MANAGE_INSTANCE_OPTIMIZATION_SCORE_TOOLTIP}</TooltipInfo>
                </div>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            {windowSize.width > 1700 && (
                <div className={styles.mainSection}>
                    <HostDistributionChart
                        color1={'#68C6B3'}
                        color2={'#E0E0E0'}
                        data1={65}
                        data2={35}
                        centerText={'Optimization score'}
                        centerValue="60%"
                    />

                    <div className={styles.contentSection}>
                        <div className={styles.firstBlock}>
                            <div className={styles.loadingState}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                    120
                                </DsTypography>

                                {loading && (
                                    <div className={styles.loadingPosition}>
                                        <DsFlashingDotsLoader />
                                    </div>
                                )}
                            </div>

                            <DsTypography variant="Regular_14">Total managed instances</DsTypography>
                        </div>
                        <SeparatorComponent variant="vertical" height="48px" />

                        <SquareComponent
                            value={String(72)}
                            color="var(--chart-4)"
                            text={'Optimized instances'}
                            isLoading={false}
                            loadingInFirstRow={loading}
                        />

                        <SeparatorComponent variant="vertical" height="48px" />
                        <SquareComponent
                            value={String(48)}
                            color="var(--chart-disabled)"
                            text={'Not-optimized instances '}
                            isLoading={false}
                            loadingInFirstRow={loading}
                        />
                    </div>
                </div>
            )}

            {windowSize.width <= 1700 && (
                <div className={styles.smallMainSection}>
                    <HostDistributionChart
                        color1={'#68C6B3'}
                        color2={'#E0E0E0'}
                        data1={65}
                        data2={35}
                        centerText={'Optimization score'}
                        centerValue="60%"
                    />
                    <div className={styles.secondPartSmallRes}>
                        <div className={styles.headSectionSmall}>
                            <DsTypography variant="Semibold_16" className={styles.heading}>
                                Total managed instances &nbsp;120
                            </DsTypography>
                            {loading && (
                                <div style={{ position: 'relative', top: '12px' }}>
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                        </div>

                        <div className={styles.firstBlockSection}>
                            <div className={styles.bottomRow}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                                <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                    Optimized instances
                                </DsTypography>
                            </div>
                            <div className={styles.loadingState}>
                                <DsTypography className={styles.valueText} variant="Semibold_14">
                                    {String(72)} instances
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                        </div>

                        <div className={styles.firstBlockSection} style={{ borderTop: 'none' }}>
                            <div className={styles.bottomRow}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-2)' }} />
                                <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                    Not-optimized instances
                                </DsTypography>
                            </div>
                            <div className={styles.loadingState}>
                                <DsTypography className={styles.valueText} variant="Semibold_14">
                                    {String(48)} instances
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ManagedInstanceOptimizationBreakdownByCategory setOpenAccordion={setOpenAccordion} />
        </div>
    );
};

export default ManagedInstanceOptimization;
