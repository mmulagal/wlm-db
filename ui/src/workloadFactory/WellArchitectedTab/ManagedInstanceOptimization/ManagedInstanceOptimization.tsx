import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import styles from './ManagedInstanceOptimization.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import { ReactComponent as WellArchitect } from '../../../assets/well-architect.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { useAppSelector } from '../../../store/storeHooks';
import { getManagedOptimizationSummary } from '../../DatabaseHomePage/DatabaseHomeUtils';
import HostDistributionChart from '../../Dashboard/HostDistribution/HostDistributionChart/HostDistributionChart';

const ManagedInstanceOptimization = () => {
    const { t } = useTranslation();
    const {
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData,
        allOracleHostAssessmentLoading,
        allOracleHostAssessmentData
    } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, showNA } = useAppSelector(
        state => state.headers
    );

    const instanceOptimizationSummary = useMemo(
        () => getManagedOptimizationSummary(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [
            allmssqlHostAssessmentData,
            allOracleHostAssessmentData,
            headerSelectedMultiCredIdsList,
            headerSelectedMultiRegionIdsList
        ]
    );

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || allOracleHostAssessmentLoading,
        [allmssqlHostAssessmentLoading, allOracleHostAssessmentLoading]
    );

    const ChartComponent = useMemo(() => {
        const setColor = () => '#68C6B3';
        return () => (
            <HostDistributionChart
                color1={showNA ? 'var(--border)' : setColor()}
                color2="#E0E0E0"
                data1={showNA ? 0 : instanceOptimizationSummary?.optimizedPercent}
                data2={showNA ? 100 : 100 - instanceOptimizationSummary?.optimizedPercent}
                centerText="Total score"
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

                <div className={styles.ManageInstanceTooltipSection}>{loading && <FlashingDotsLoader />}</div>
            </div>

            {(loading || instanceOptimizationSummary?.optimizedPercent !== 100) && (
                <div className={styles.mainSection}>
                    <ChartComponent />
                    <div className={styles.contentSection}>
                        <SquareComponent
                            value={
                                showNA
                                    ? t('databases.general.not-available')
                                    : String(instanceOptimizationSummary?.optimizedInstances)
                            }
                            color="var(--chart-4)"
                            text="Well-architected resources"
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
                            text="Not-optimized resources"
                            isLoading={false}
                            loadingInFirstRow={loading}
                            showNA={showNA}
                        />
                    </div>
                </div>
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
                            <DsTypography variant="Semibold_16">
                                {t('databases.dashboard.all-instances-are-well-architected')}
                            </DsTypography>
                        </div>

                        <div className={styles.secondBlock}>
                            <DsTypography variant="Regular_14">
                                {t('databases.dashboard.there-are-no-issues')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.dashboard.instance-analyzed')}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagedInstanceOptimization;
