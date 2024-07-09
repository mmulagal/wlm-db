import { DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as GraphIcon } from '../../../assets/ic_graph.svg';
import styles from './TotalMonthlyCost.module.scss';
import ComparisonChart from '../../../ui-components/Charts/ComparisionChart';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const TotalMonthlyCost = () => {
    const { storageSavingsResponse, storageSavingsLoading } = useAppSelector(state => state.exploreSavings);
    const noData = false;
    const costZeroCase = false;

    return (
        <div className={styles.totalMonthlyCost}>
            <div className={styles.headSection}>
                <DsTypography variant="Semibold_16" className={styles.title}>
                    {GENERAL.TOTAL_MONTHLY_COST}
                </DsTypography>
                {storageSavingsLoading && <DsFlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                {storageSavingsLoading && (
                    <>
                        <div
                            style={{ position: 'relative', top: '250px' }}
                            className={storageSavingsLoading ? styles.loadingState : ''}
                        >
                            <ComparisonChart
                                data={[1, 1]}
                                yTickFormatter={yValue => '$' + 0}
                                height={120}
                                colors={['chart-9', 'chart-6']}
                                categories={[GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]}
                            />
                        </div>
                    </>
                )}
                {!storageSavingsLoading && costZeroCase && !noData && (
                    <>
                        <ComparisonChart
                            data={[1, 1]}
                            yTickFormatter={yValue => '$' + Number(yValue).toLocaleString()}
                            height={370}
                            colors={storageSavingsResponse && ['chart-9', 'chart-6']}
                            categories={[GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]}
                        />
                    </>
                )}
                {noData && !storageSavingsLoading && (
                    <>
                        <div className={styles['calculate-notice']}>
                            <GraphIcon style={{ marginTop: 24 }} />
                            <DsTypography variant="Semibold_14" className={styles.noData}>
                                {GENERAL.TO_VIEW_STORAGE}
                            </DsTypography>
                        </div>
                        <ComparisonChart
                            data={[0, 0]}
                            height={75}
                            categories={[GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]}
                        />
                    </>
                )}
                {!noData && !storageSavingsLoading && !costZeroCase && (
                    <>
                        <ComparisonChart
                            data={[
                                storageSavingsResponse?.totalSummary?.recommended
                                    ? Number(storageSavingsResponse?.totalSummary?.recommended)
                                    : 0,
                                storageSavingsResponse?.totalSummary?.existing
                                    ? Number(storageSavingsResponse?.totalSummary?.existing)
                                    : 0
                            ]}
                            yTickFormatter={yValue => '$' + Number(yValue).toLocaleString()}
                            height={370}
                            colors={storageSavingsResponse && ['chart-9', 'chart-6']}
                            categories={[GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default TotalMonthlyCost;
