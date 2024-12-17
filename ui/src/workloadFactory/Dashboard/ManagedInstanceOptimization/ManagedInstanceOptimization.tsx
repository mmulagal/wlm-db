import { DsFlashingDotsLoader, DsTypography, FlashingDotsLoader, TooltipInfo } from '@netapp/design-system';
import styles from './ManagedInstanceOptimization.module.scss';
import HostDistributionChart from '../HostDistribution/HostDistributionChart/HostDistributionChart';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import useResize from '../../../common/hooks/useResize';
import { GENERAL } from '../../../utils/appConstants';
import ManagedInstanceOptimizationBreakdownByCategory from '../ManagedInstanceOptimizationBreakdownByCategory/ManagedInstanceOptimizationBreakdownByCategory';
import { useAppSelector } from '../../../store/storeHooks';
import { useMemo } from 'react';
import { getManagedInstanceOptimizationSummary } from '../../DatabaseHomePage/DatabaseHomeUtils';

const ManagedInstanceOptimization = ({ openAccordion, setOpenAccordion }: any) => {
    const windowSize = useResize();
    const { allmssqlHostAssessmentLoading, allmssqlHostAssessmentData } = useAppSelector(state => state.inventoryV2);

    const instanceOptimizationSummary = useMemo(() => {
        return getManagedInstanceOptimizationSummary(allmssqlHostAssessmentData);
    }, [allmssqlHostAssessmentData]);

    const ChartComponent = useMemo(() => {
        return () => (
            <HostDistributionChart
                color1={'#68C6B3'}
                color2={'#E0E0E0'}
                data1={instanceOptimizationSummary?.optimizedPercent}
                data2={100 - instanceOptimizationSummary?.optimizedPercent}
                centerText={'Optimization score'}
                centerValue={`${instanceOptimizationSummary?.optimizedPercent || 0}%`}
            />
        );
    }, [instanceOptimizationSummary]);

    return (
        <div className={styles.managedInstance} style={{ height: !openAccordion ? '436px' : '992px' }}>
            <div className={styles.headSection}>
                <div className={styles.ManageInstanceTooltipSection}>
                    <DsTypography variant="Regular_16" className={styles.title}>
                        Managed instances optimization score
                    </DsTypography>

                    <TooltipInfo>{GENERAL.MANAGE_INSTANCE_OPTIMIZATION_SCORE_TOOLTIP}</TooltipInfo>
                </div>

                {allmssqlHostAssessmentLoading && <FlashingDotsLoader />}
            </div>

            {windowSize.width > 1700 && (
                <div className={styles.mainSection}>
                    <ChartComponent />
                    <div className={styles.contentSection}>
                        <div className={styles.firstBlock}>
                            <div className={styles.loadingState}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                    {instanceOptimizationSummary?.totalInstances}
                                </DsTypography>

                                {allmssqlHostAssessmentLoading && (
                                    <div className={styles.loadingPosition}>
                                        <DsFlashingDotsLoader />
                                    </div>
                                )}
                            </div>

                            <DsTypography variant="Regular_14">Total managed instances</DsTypography>
                        </div>
                        <SeparatorComponent variant="vertical" height="48px" />

                        <SquareComponent
                            value={String(instanceOptimizationSummary?.optimizedInstances)}
                            color="var(--chart-4)"
                            text={'Optimized instances'}
                            isLoading={false}
                            loadingInFirstRow={allmssqlHostAssessmentLoading}
                        />

                        <SeparatorComponent variant="vertical" height="48px" />
                        <SquareComponent
                            value={String(instanceOptimizationSummary?.notOptimizedInstances)}
                            color="var(--chart-disabled)"
                            text={'Not-optimized instances '}
                            isLoading={false}
                            loadingInFirstRow={allmssqlHostAssessmentLoading}
                        />
                    </div>
                </div>
            )}

            {windowSize.width <= 1700 && (
                <div className={styles.smallMainSection}>
                    <ChartComponent />
                    <div className={styles.secondPartSmallRes}>
                        <div className={styles.headSectionSmall}>
                            <DsTypography variant="Semibold_16" className={styles.heading}>
                                Total managed instances &nbsp;{instanceOptimizationSummary?.totalInstances}
                            </DsTypography>
                            {allmssqlHostAssessmentLoading && (
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
                                    {String(instanceOptimizationSummary?.optimizedInstances)} instances
                                </DsTypography>
                                {allmssqlHostAssessmentLoading && <DsFlashingDotsLoader />}
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
                                    {String(instanceOptimizationSummary?.notOptimizedInstances)} instances
                                </DsTypography>
                                {allmssqlHostAssessmentLoading && <DsFlashingDotsLoader />}
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
