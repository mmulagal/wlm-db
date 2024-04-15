import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as CostSavingsImage } from '../../../../assets/cost-savings.svg';
import styles from './CostSavings.module.scss';

const CostSavings = () => {
    const loading = false;
    return (
        <div className={styles.costSavings}>
            <div className={styles.leftSide}>
                <div className={styles.setImage}>
                    <CostSavingsImage />
                </div>
                <div className={styles.textContent}>
                    <div className={styles.topValue}>
                        <DsTypography variant="Regular_16" className={styles.dollar}>
                            $
                        </DsTypography>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            7000
                        </DsTypography>
                    </div>

                    <div className={styles.bottomValue}>
                        <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                            Cost savings
                        </DsTypography>
                        {loading && <FlashingDotsLoader />}
                    </div>
                </div>
            </div>

            <div className={styles.separator} />

            <div className={styles.rightSide}>
                <div className={styles.firstRow}>
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        50
                    </DsTypography>
                    <DsTypography variant="Regular_16" className={styles.dollar}>
                        %
                    </DsTypography>
                </div>

                <div className={styles.bottomValue}>
                    <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                        Savings percentage
                    </DsTypography>
                    {loading && <FlashingDotsLoader />}
                </div>
            </div>
        </div>
    );
};

export default CostSavings;
