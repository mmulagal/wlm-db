import { DsTypography } from '@netapp/design-system';
import styles from './Sandboxes.module.scss';

const Sandboxes = () => {
    return (
        <div className={styles.sandboxes}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Sandboxes
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default Sandboxes;
