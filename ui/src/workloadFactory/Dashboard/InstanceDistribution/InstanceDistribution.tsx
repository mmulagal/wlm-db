import { DsTypography } from '@netapp/design-system';
import styles from './InstanceDistribution.module.scss';

const InstanceDistribution = () => {
    return (
        <div className={styles.instanceDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Instance distribution
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default InstanceDistribution;
