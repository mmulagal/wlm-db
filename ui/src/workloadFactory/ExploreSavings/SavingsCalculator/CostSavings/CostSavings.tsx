import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as CostSavingsImage } from '../../../../assets/cost-savings.svg';
import styles from './CostSavings.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { GENERAL } from '../../../../utils/appConstants';

const CostSavings = () => {
    const { loading } = useAppSelector(state => state.exploreSavings);

    const costZeroCase = true;
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
                            className={loading ? `${styles.dollar} ${styles.dollarHeight}` : styles.dollar}
                        >
                            $
                        </DsTypography>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {!loading && !costZeroCase && Number(7000).toLocaleString()}
                            {!loading && costZeroCase && Number(0).toLocaleString()}
                        </DsTypography>
                    </div>

                    <div className={styles.bottomValue}>
                        <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                            {GENERAL.ES_COST_SAVINGS}
                        </DsTypography>
                        {loading && <FlashingDotsLoader />}
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
                            {!loading && 50}
                        </DsTypography>
                        <DsTypography
                            variant="Regular_16"
                            className={loading ? `${styles.dollar} ${styles.dollarHeight}` : styles.dollar}
                        >
                            %
                        </DsTypography>
                    </div>

                    <div className={styles.bottomValue}>
                        <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                            {GENERAL.ES_SAVINGS_PERCENTAGE}
                        </DsTypography>
                        {loading && <FlashingDotsLoader />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CostSavings;
