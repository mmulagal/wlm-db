import { DsTypography, FlashingDotsLoader, Popover } from '@netapp/design-system';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { useEffect, useMemo, useState } from 'react';
import { ReactComponent as CostSavingsImage } from '../../../../assets/cost-savings.svg';
import { ReactComponent as CostSavingsDisabledImage } from '../../../../assets/Cost-Disabled.svg';
import styles from './CostSavings.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { formatFractionalNumberForCost, formatNumberWithCustomComma } from '../../../../utils/utilityFunctions';
import useResize from '../../../../common/hooks/useResize';
import { SAVINGS_CALC_MODE } from '../../../../utils/consts';

type CS = {
    disableState?: boolean;
};

const CostSavings = ({ disableState }: CS) => {
    const { storageSavingsResponse, storageSavingsLoading, savingsCalculatorFrom, onPremStorageAndComputeInfo } =
        useAppSelector(state => state.exploreSavings);
    const windowSize = useResize();

    const oracleLicenseCost = useMemo(() => {
        const isOracle = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;
        if (!isOracle || !onPremStorageAndComputeInfo) return 0;
        // Sum monthlyOracleCost across ALL hosts in onPremStorageAndComputeInfo
        return Object.values(onPremStorageAndComputeInfo).reduce((total: number, entry: any) => {
            const cost = entry?.monthlyOracleCost;
            return total + (cost ? Number(cost) : 0);
        }, 0);
    }, [savingsCalculatorFrom, onPremStorageAndComputeInfo]);

    const [savings, setSavings] = useState<any>(0);
    const [savingsPer, setSavingsPer] = useState<any>(0);
    const [costZeroCase, setCostZeroCase] = useState(false);
    const [savingsCalculated, setSavingsCalculated] = useState(false);

    useEffect(() => {
        const fsxTotal =
            (storageSavingsResponse?.totalSummary?.recommendedTotal
                ? Number(storageSavingsResponse?.totalSummary?.recommendedTotal)
                : 0) + oracleLicenseCost;
        const ebsTotal =
            (storageSavingsResponse?.totalSummary?.existing
                ? Number(storageSavingsResponse?.totalSummary?.existing)
                : 0) + oracleLicenseCost;
        if (storageSavingsResponse && fsxTotal && ebsTotal && fsxTotal <= ebsTotal) {
            setSavings(ebsTotal - fsxTotal);
            setSavingsCalculated(true);
            const percent = 100 * ((ebsTotal - fsxTotal) / ebsTotal);
            setSavingsPer(percent);
            setCostZeroCase(false);
        } else {
            setSavings(0);
            setSavingsPer(0);
            if (fsxTotal > ebsTotal) {
                setCostZeroCase(true);
            }
        }
    }, [storageSavingsResponse, oracleLicenseCost]);

    return (
        <div className={styles.costSavings}>
            <div className={styles.leftSide}>
                <div className={styles.setImage}>
                    {disableState ? <CostSavingsDisabledImage /> : <CostSavingsImage />}
                </div>
                <div className={costZeroCase ? `${styles.textContent} ${styles.changeWidth}` : styles.textContent}>
                    <div
                        className={`${styles.topValue} ${savings !== 0 ? 'es-nonzero-cost-savings' : ''}`}
                        id={savingsCalculated ? 'es-cost-savings' : ''}
                    >
                        <DsTypography
                            variant="Regular_16"
                            className={
                                storageSavingsLoading ? `${styles.dollar} ${styles.dollarHeight}` : styles.dollar
                            }
                            style={{ color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                        >
                            $
                        </DsTypography>
                        <DsTypography
                            variant="Regular_32"
                            style={{
                                lineHeight: 'unset',
                                color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                            }}
                        >
                            {/* {!storageSavingsLoading && savings} */}
                            {!storageSavingsLoading &&
                                !costZeroCase &&
                                formatNumberWithCustomComma(Number(savings), true).toLocaleString()}
                            {!storageSavingsLoading && costZeroCase && Number(0).toLocaleString()}
                        </DsTypography>
                    </div>

                    <div className={styles.bottomValue}>
                        <DsTypography
                            variant="Regular_14"
                            style={{
                                lineHeight: 'unset',
                                color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                            }}
                        >
                            {GENERAL.ES_COST_SAVINGS}
                        </DsTypography>
                        {storageSavingsLoading && <FlashingDotsLoader />}
                    </div>
                </div>
            </div>

            <div
                className={costZeroCase ? `${styles.separator} ${styles.separatorNewWidth}` : styles.separator}
                style={{ color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)' }}
            />
            {costZeroCase && windowSize.width > 1500 && (
                <div className={styles.costZeroCase}>
                    <div>
                        <InfoIcon />
                    </div>

                    <DsTypography
                        variant="Regular_14"
                        style={{ color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                    >
                        {GENERAL.NOTICE_MESSAGE_COST_SAVINGS}
                    </DsTypography>
                </div>
            )}
            {costZeroCase && windowSize.width < 1500 && (
                <div className={styles.costZeroCaseSmallRes}>
                    <div>
                        <InfoIcon />
                    </div>

                    <Popover
                        popoverClass={styles.popover}
                        children={GENERAL.NOTICE_MESSAGE_COST_SAVINGS}
                        trigger="hover"
                        container={
                            <DsTypography variant="Regular_14" className={styles.smallResolutionMessage}>
                                {GENERAL.NOTICE_MESSAGE_COST_SAVINGS}
                            </DsTypography>
                        }
                    />
                </div>
            )}

            {!costZeroCase && (
                <div className={styles.rightSide}>
                    <div className={styles.firstRow}>
                        <DsTypography
                            variant="Regular_32"
                            style={{
                                lineHeight: 'unset',
                                color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                            }}
                        >
                            {!storageSavingsLoading && formatFractionalNumberForCost(savingsPer, 0, false)}
                        </DsTypography>
                        <DsTypography
                            variant="Regular_16"
                            className={
                                storageSavingsLoading ? `${styles.dollar} ${styles.dollarHeight}` : styles.dollar
                            }
                            style={{ color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                        >
                            %
                        </DsTypography>
                    </div>

                    <div className={styles.bottomValue}>
                        <DsTypography
                            variant="Regular_14"
                            style={{
                                lineHeight: 'unset',
                                color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                            }}
                        >
                            {GENERAL.ES_SAVINGS_PERCENTAGE}
                        </DsTypography>
                        {storageSavingsLoading && <FlashingDotsLoader />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CostSavings;
