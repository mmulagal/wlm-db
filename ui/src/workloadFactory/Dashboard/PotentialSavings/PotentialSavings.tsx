import { DsTypography } from '@netapp/design-system';
import styles from './PotentialSavings.module.scss';

const PotentialSavings = () => {
    return (
        <div className={styles.potentialSavings}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Potential savings (Elastic Block Store (EBS) & FSx for Windows File Server)
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default PotentialSavings;
