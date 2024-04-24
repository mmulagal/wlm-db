import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as CostSavingsImage } from '../../../../assets/cost-savings.svg';
import styles from './CostSavings.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';

const CostSavings = () => {
    const { storageSavingsResponse, storageSavingsLoading } = useAppSelector(state => state.exploreSavings);

    const [savings, setSavings] = useState<any>(0);
    const [savingsPer, setSavingsPer] = useState<any>(0);

    useEffect(() => {
        const fsxTotal = storageSavingsResponse?.fsx?.total;
        const ebsTotal = storageSavingsResponse?.ebs?.total;
        if (storageSavingsResponse && fsxTotal && ebsTotal && fsxTotal <= ebsTotal) {
            setSavings(ebsTotal - fsxTotal);
            const percent = 100 * ((ebsTotal - fsxTotal) / ebsTotal);
            setSavingsPer(percent);
        } else {
            setSavings(GENERAL.NOT_AVAILABLE);
            setSavingsPer(GENERAL.NOT_AVAILABLE);
        }
    }, [storageSavingsResponse]);

    return (
        <div className={styles.costSavings}>
            <div className={styles.leftSide}>
                <div className={styles.setImage}>
                    <CostSavingsImage />
                </div>
                <div className={styles.textContent}>
                    <div className={styles.topValue}>
                        <DsTypography
                            variant="Regular_16"
                            className={
                                storageSavingsLoading ? `${styles.dollar} ${styles.dollarHeight}` : styles.dollar
                            }
                        >
                            $
                        </DsTypography>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {!storageSavingsLoading && savings}
                        </DsTypography>
                    </div>

                    <div className={styles.bottomValue}>
                        <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                            {GENERAL.ES_COST_SAVINGS}
                        </DsTypography>
                        {storageSavingsLoading && <FlashingDotsLoader />}
                    </div>
                </div>
            </div>

            <div className={styles.separator} />

            <div className={styles.rightSide}>
                <div className={styles.firstRow}>
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        {!storageSavingsLoading && formatFractionalNumber(savingsPer, 2)}
                    </DsTypography>
                    <DsTypography
                        variant="Regular_16"
                        className={storageSavingsLoading ? `${styles.dollar} ${styles.dollarHeight}` : styles.dollar}
                    >
                        %
                    </DsTypography>
                </div>

                <div className={styles.bottomValue}>
                    <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                        {GENERAL.ES_SAVINGS_PERCENTAGE}
                    </DsTypography>
                    {storageSavingsLoading && <FlashingDotsLoader />}
                </div>
            </div>
        </div>
    );
};

export default CostSavings;
