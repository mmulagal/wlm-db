import { DsFlashingDotsLoader, DsTypography, FlashingDotsLoader, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import styles from './ManagedInstanceOptimization.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import HostDistributionChart from '../HostDistribution/HostDistributionChart/HostDistributionChart';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import { ReactComponent as WellArchitect } from '../../../assets/well-architect.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import useResize from '../../../common/hooks/useResize';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { getManagedInstanceOptimizationSummary } from '../../DatabaseHomePage/DatabaseHomeUtils';

const ManagedInstanceOptimization = ({ openAccordion, setOpenAccordion }: any) => {
    const { t } = useTranslation();
    const windowSize = useResize();
    const { allmssqlHostAssessmentLoading, allmssqlHostAssessmentData } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading, showNA } =
        useAppSelector(state => state.headers);

    const instanceOptimizationSummary = useMemo(
        () => getManagedInstanceOptimizationSummary(allmssqlHostAssessmentData),
        [allmssqlHostAssessmentData, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList]
    );

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || multiDataLoading,
        [allmssqlHostAssessmentLoading, multiDataLoading]
    );

    const ChartComponent = useMemo(() => {
        const setColor = (value: any) => {
            if (value <= 25) {
                return '#FE5502';
            }
            if (value > 25 && value <= 50) {
                return '#F7941D';
            }
            if (value > 50 && value <= 75) {
                return '#FDC300';
            }
            if (value > 75 && value < 100) {
                return '#68C6B3';
            }
            return '#E0E0E0';
        };
        return () => (
            <HostDistributionChart
                color1={showNA ? 'var(--border)' : setColor(instanceOptimizationSummary?.optimizedPercent)}
                color2="#E0E0E0"
                data1={showNA ? 0 : instanceOptimizationSummary?.optimizedPercent}
                data2={showNA ? 100 : 100 - instanceOptimizationSummary?.optimizedPercent}
                centerText="Optimization score"
                centerValue={
                    showNA
                        ? t('databases.general.not-available')
                        : `${instanceOptimizationSummary?.optimizedPercent || 0}%`
                }
                loading={loading}
                isDisabled={showNA}
            />
        );
    }, [instanceOptimizationSummary, loading, showNA]);

    return (
        <div className={`${styles.managedInstance} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.general.manage-instances-well-architected-score')}
                </DsTypography>

                <div className={styles.ManageInstanceTooltipSection}>
                    {loading && <FlashingDotsLoader />}
                    <TooltipInfo>{GENERAL.MANAGE_INSTANCE_OPTIMIZATION_SCORE_TOOLTIP}</TooltipInfo>
                </div>
            </div>

            {(loading || instanceOptimizationSummary?.optimizedPercent !== 100) && (
                <>
                    {windowSize.width > 1700 && (
                        <div className={styles.mainSection}>
                            <ChartComponent />
                            <div className={styles.contentSection}>
                                <div className={styles.firstBlock}>
                                    <div className={styles.loadingState}>
                                        <DsTypography
                                            variant={showNA ? 'Regular_14' : 'Regular_24'}
                                            style={{ lineHeight: showNA ? '24px' : 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {showNA
                                                ? t('databases.general.not-available')
                                                : instanceOptimizationSummary?.totalInstances}
                                        </DsTypography>

                                        {instanceOptimizationSummary?.hasDismissedOrPostponed && (
                                            <TooltipInfo>{GENERAL.MANAGED_INSTANCE_DISMISS_INFO}</TooltipInfo>
                                        )}

                                        {loading && (
                                            <div className={styles.loadingPosition}>
                                                <DsFlashingDotsLoader />
                                            </div>
                                        )}
                                    </div>

                                    <DsTypography
                                        variant="Regular_14"
                                        style={{ whiteSpace: 'nowrap' }}
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        Total registered instances
                                    </DsTypography>
                                </div>
                                <SeparatorComponent variant="vertical" height="48px" />

                                <SquareComponent
                                    value={
                                        showNA
                                            ? t('databases.general.not-available')
                                            : String(instanceOptimizationSummary?.optimizedInstances)
                                    }
                                    color="var(--chart-4)"
                                    text="Well-architected instances"
                                    isLoading={false}
                                    loadingInFirstRow={loading}
                                    showNA={showNA}
                                />

                                <SeparatorComponent variant="vertical" height="48px" />
                                <SquareComponent
                                    value={
                                        showNA
                                            ? t('databases.general.not-available')
                                            : String(instanceOptimizationSummary?.notOptimizedInstances)
                                    }
                                    color="var(--chart-disabled)"
                                    text="Not-optimized instances "
                                    isLoading={false}
                                    loadingInFirstRow={loading}
                                    showNA={showNA}
                                />
                            </div>
                        </div>
                    )}

                    {windowSize.width <= 1700 && (
                        <div className={styles.smallMainSection}>
                            <ChartComponent />
                            <div className={styles.secondPartSmallRes}>
                                <div className={styles.headSectionSmall}>
                                    <div className={styles.manageInstanceTooltipSection}>
                                        <DsTypography
                                            variant="Semibold_16"
                                            style={{ whiteSpace: 'nowrap' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            Total registered instances &nbsp;
                                            {showNA
                                                ? t('databases.general.not-available')
                                                : instanceOptimizationSummary?.totalInstances}
                                        </DsTypography>
                                        {instanceOptimizationSummary?.hasDismissedOrPostponed && (
                                            <TooltipInfo>{GENERAL.MANAGED_INSTANCE_DISMISS_INFO}</TooltipInfo>
                                        )}
                                    </div>

                                    {loading && (
                                        <div style={{ position: 'relative', top: '12px' }}>
                                            <DsFlashingDotsLoader />
                                        </div>
                                    )}
                                </div>

                                <div className={styles.firstBlockSection}>
                                    <div className={styles.bottomRow}>
                                        <div
                                            className={styles.square}
                                            style={{
                                                backgroundColor: showNA ? 'var(--text-disabled)' : 'var(--chart-4)'
                                            }}
                                        />
                                        <DsTypography
                                            variant="Regular_14"
                                            style={{ lineHeight: 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            Well-architected instances
                                        </DsTypography>
                                    </div>
                                    <div className={styles.loadingState}>
                                        <DsTypography
                                            className={`${styles.valueText} ${showNA ? CommonStyles.notAvailable : ''}`}
                                            variant="Semibold_14"
                                        >
                                            {showNA
                                                ? t('databases.general.not-available')
                                                : String(instanceOptimizationSummary?.optimizedInstances)}{' '}
                                            instances
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>
                                </div>

                                <div className={styles.firstBlockSection} style={{ borderTop: 'none' }}>
                                    <div className={styles.bottomRow}>
                                        <div
                                            className={styles.square}
                                            style={{
                                                backgroundColor: showNA ? 'var(--text-disabled)' : 'var(--chart-2)'
                                            }}
                                        />
                                        <DsTypography
                                            variant="Regular_14"
                                            style={{ lineHeight: 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            Not-optimized instances
                                        </DsTypography>
                                    </div>
                                    <div className={styles.loadingState}>
                                        <DsTypography
                                            className={`${styles.valueText} ${showNA ? CommonStyles.notAvailable : ''}`}
                                            variant="Semibold_14"
                                        >
                                            {showNA
                                                ? t('databases.general.not-available')
                                                : String(instanceOptimizationSummary?.notOptimizedInstances)}{' '}
                                            instances
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {!loading && instanceOptimizationSummary?.optimizedPercent === 100 && (
                <div
                    className={styles.smallMainSection}
                    style={{ paddingTop: '55px', alignItems: 'center', justifyContent: 'unset', gap: '80px' }}
                >
                    <WellArchitect />
                    <div className={styles.text}>
                        <div className={styles.firstBlock}>
                            <Success />
                            <DsTypography variant="Semibold_16">All instances are well-architected!</DsTypography>
                        </div>

                        <div className={styles.secondBlock}>
                            <DsTypography variant="Regular_14">There are no issues.</DsTypography>
                            <DsTypography variant="Regular_14">
                                Your instance is analyzed every 24 hours for configuration issues.
                            </DsTypography>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagedInstanceOptimization;
