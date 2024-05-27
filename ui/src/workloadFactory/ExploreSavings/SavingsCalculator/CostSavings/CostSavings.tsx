import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as CostSavingsImage } from '../../../../assets/cost-savings.svg';
import styles from './CostSavings.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';

const CostSavings = () => {
    const { storageSavingsResponse, storageSavingsLoading } = useAppSelector(state => state.exploreSavings);

    const [savings, setSavings] = useState<any>(0);
    const [savingsPer, setSavingsPer] = useState<any>(0);
    const [costZeroCase, setCostZeroCase] = useState(false);

    useEffect(() => {
        const fsxTotal = storageSavingsResponse?.fsx?.total ? Number(storageSavingsResponse?.fsx?.total) : 0;
        const ebsTotal = storageSavingsResponse?.ebs?.total ? Number(storageSavingsResponse?.ebs?.total) : 0;
        if (storageSavingsResponse && fsxTotal && ebsTotal && fsxTotal <= ebsTotal) {
            setSavings(ebsTotal - fsxTotal);
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
    }, [storageSavingsResponse]);

    return (
        <div className={styles.costSavings}>
            <div className={styles.leftSide}>
                <div className={styles.setImage}>
                    <CostSavingsImage />
                </div>
                <div className={costZeroCase ? `${styles.textContent} ${styles.changeWidth}` : styles.textContent}>
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
                            {/* {!storageSavingsLoading && savings} */}
                            {!storageSavingsLoading && !costZeroCase && Number(savings).toLocaleString()}
                            {!storageSavingsLoading && costZeroCase && Number(0).toLocaleString()}
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

            <div className={costZeroCase ? `${styles.separator} ${styles.separatorNewWidth}` : styles.separator} />
            {costZeroCase && (
                <div className={styles.costZeroCase}>
                    <div>
                        <InfoIcon />
                    </div>

                    <DsTypography variant="Regular_14">{GENERAL.NOTICE_MESSAGE_COST_SAVINGS}</DsTypography>
                </div>
            )}

            {!costZeroCase && (
                <div className={styles.rightSide}>
                    <div className={styles.firstRow}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {!storageSavingsLoading && formatFractionalNumber(savingsPer, 0)}
                        </DsTypography>
                        <DsTypography
                            variant="Regular_16"
                            className={
                                storageSavingsLoading ? `${styles.dollar} ${styles.dollarHeight}` : styles.dollar
                            }
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
            )}
        </div>
    );
};

export default CostSavings;
