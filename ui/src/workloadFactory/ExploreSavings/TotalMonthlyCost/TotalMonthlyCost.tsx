import { useMemo } from 'react';
import { DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { storageSavingsResponse, storageSavingsLoading, savingsCalculatorFrom, onPremStorageAndComputeInfo } =
        useAppSelector(state => state.exploreSavings);

    const oracleLicenseCost = useMemo(() => {
        const isOracle = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;
        if (!isOracle || !onPremStorageAndComputeInfo) return 0;
        // Sum monthlyOracleCost across ALL hosts in onPremStorageAndComputeInfo
        return Object.values(onPremStorageAndComputeInfo).reduce((total: number, entry: any) => {
            const cost = entry?.monthlyOracleCost;
            return total + (cost ? Number(cost) : 0);
        }, 0);
    }, [savingsCalculatorFrom, onPremStorageAndComputeInfo]);
    const noData = disableState;
    const costZeroCase = false;

    // Get category labels based on the savings calculator mode
    const getCategoryLabels = (): [string, string] => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            return [
                t('databases.explore-savings.oracle-server-on-fsx-ontap'),
                t('databases.explore-savings.oracle-server-on-ebs')
            ];
        }
        const categoryOne = t('databases.explore-savings.mssql-server-on-fsx-ontap');
        const categoryTwo =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
                ? t('databases.explore-savings.mssql-server-on-ebs')
                : t('databases.explore-savings.mssql-server-fsxw-category');
        return [categoryOne, categoryTwo];
    };
    const categoryLabels = getCategoryLabels();

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
                    <div
                        style={{ position: 'relative', top: '250px' }}
                        className={storageSavingsLoading ? styles.loadingState : ''}
                    >
                        <ComparisonChart
                            data={[1, 1]}
                            yTickFormatter={() => `$${0}`}
                            height={120}
                            colors={['chart-9', 'chart-6']}
                            categories={categoryLabels}
                        />
                    </div>
                )}
                {!storageSavingsLoading && costZeroCase && !noData && (
                    <ComparisonChart
                        data={[1, 1]}
                        yTickFormatter={yValue => `$${Number(yValue).toLocaleString()}`}
                        height={370}
                        colors={storageSavingsResponse && ['chart-9', 'chart-6']}
                        categories={categoryLabels}
                    />
                )}
                {noData && !storageSavingsLoading && (
                    <>
                        <div className={styles['calculate-notice']}>
                            <GraphIcon style={{ marginTop: 24 }} />
                            <DsTypography variant="Semibold_14" className={styles.noData}>
                                {GENERAL.TO_VIEW_STORAGE}
                            </DsTypography>
                        </div>
                        <ComparisonChart data={[0, 0]} height={75} categories={categoryLabels} />
                    </>
                )}
                {!noData && !storageSavingsLoading && !costZeroCase && (
                    <ComparisonChart
                        data={[
                            (storageSavingsResponse?.totalSummary?.recommendedTotal
                                ? Number(storageSavingsResponse?.totalSummary?.recommendedTotal)
                                : 0) + oracleLicenseCost,
                            (storageSavingsResponse?.totalSummary?.existing
                                ? Number(storageSavingsResponse?.totalSummary?.existing)
                                : 0) + oracleLicenseCost
                        ]}
                        yTickFormatter={yValue => `$${formatNumberWithCustomComma(Number(yValue), true)}`}
                        height={370}
                        colors={storageSavingsResponse && ['chart-9', 'chart-6']}
                        categories={categoryLabels}
                    />
                )}
            </div>
        </div>
    );
};

export default TotalMonthlyCost;
