import { DsTypography } from '@netapp/design-system';
import styles from './HostDistribution.module.scss';

const HostDistribution = () => {
    return (
        <div className={styles.hostDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Host distribution
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default HostDistribution;
