import { DsTypography, FlashingDotsLoader, Popover } from '@netapp/design-system';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CostSavingsImage } from '../../../../assets/cost-savings.svg';
import { ReactComponent as CostSavingsDisabledImage } from '../../../../assets/Cost-Disabled.svg';
import styles from './CostSavings.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { formatFractionalNumberForCost, formatNumberWithCustomComma } from '../../../../utils/utilityFunctions';
import useResize from '../../../../common/hooks/useResize';
import { SAVINGS_CALC_MODE } from '../../../../utils/consts';
import { getOracleLicenseCostValue } from '../savingsUtil';

type CS = {
    disableState?: boolean;
};

const CostSavings = ({ disableState }: CS) => {
    const { t } = useTranslation();
    const {
        storageSavingsResponse,
        storageSavingsLoading,
        savingsCalculatorFrom,
        onPremStorageAndComputeInfo,
        monthlyBYOLCost
    } = useAppSelector(state => state.exploreSavings);
    const windowSize = useResize();

    const oracleLicenseCost = useMemo(
        () => getOracleLicenseCostValue(),
        [savingsCalculatorFrom, onPremStorageAndComputeInfo, monthlyBYOLCost]
    );

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
                            {t('databases.explore-savings.cost-savings')}
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
                        {t('databases.explore-savings.notice-message-cost-savings')}
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
                        children={t('databases.explore-savings.notice-message-cost-savings')}
                        trigger="hover"
                        container={
                            <DsTypography variant="Regular_14" className={styles.smallResolutionMessage}>
                                {t('databases.explore-savings.notice-message-cost-savings')}
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
                            {t('databases.explore-savings.savings-percentage')}
                        </DsTypography>
                        {storageSavingsLoading && <FlashingDotsLoader />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CostSavings;
