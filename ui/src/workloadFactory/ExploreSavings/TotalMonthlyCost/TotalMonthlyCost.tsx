import { DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as GraphIcon } from '../../../assets/ic_graph.svg';
import styles from './TotalMonthlyCost.module.scss';
import ComparisonChart from '../../../ui-components/Charts/ComparisionChart';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { SAVINGS_CALC_MODE } from '../../../utils/consts';
import { formatNumberWithCustomComma } from '../../../utils/utilityFunctions';

type TMC = {
    disableState?: boolean;
};
const TotalMonthlyCost = ({ disableState = false }: TMC) => {
    const { storageSavingsResponse, storageSavingsLoading, savingsCalculatorFrom } = useAppSelector(
        state => state.exploreSavings
    );
    const noData = disableState;
    const costZeroCase = false;

    return (
        <div className={styles.totalMonthlyCost}>
            <div className={styles.headSection}>
                <DsTypography
                    variant="Semibold_16"
                    className={styles.title}
                    style={{ color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                >
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
                                categories={[
                                    GENERAL.CATEGORY_POINT_ONE,
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
                                        ? GENERAL.CATEGORY_POINT_TWO
                                        : GENERAL.FSXW_CATEGORY
                                ]}
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
                            categories={[
                                GENERAL.CATEGORY_POINT_ONE,
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
                                    ? GENERAL.CATEGORY_POINT_TWO
                                    : GENERAL.FSXW_CATEGORY
                            ]}
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
                            categories={[
                                GENERAL.CATEGORY_POINT_ONE,
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
                                    ? GENERAL.CATEGORY_POINT_TWO
                                    : GENERAL.FSXW_CATEGORY
                            ]}
                        />
                    </>
                )}
                {!noData && !storageSavingsLoading && !costZeroCase && (
                    <>
                        <ComparisonChart
                            data={[
                                storageSavingsResponse?.totalSummary?.recommendedTotal
                                    ? Number(storageSavingsResponse?.totalSummary?.recommendedTotal)
                                    : 0,
                                storageSavingsResponse?.totalSummary?.existing
                                    ? Number(storageSavingsResponse?.totalSummary?.existing)
                                    : 0
                            ]}
                            yTickFormatter={yValue => '$' + formatNumberWithCustomComma(Number(yValue), true)}
                            height={370}
                            colors={storageSavingsResponse && ['chart-9', 'chart-6']}
                            categories={[
                                GENERAL.CATEGORY_POINT_ONE,
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
                                    ? GENERAL.CATEGORY_POINT_TWO
                                    : GENERAL.FSXW_CATEGORY
                            ]}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default TotalMonthlyCost;
