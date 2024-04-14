import { DsTypography } from '@netapp/design-system';
import styles from './SavingsSelectedHost.module.scss';

const SavingsSelectedHost = () => {
    return (
        <div className={styles.selectedHosts}>
            <DsTypography variant="Regular_14">Selected host:</DsTypography>
            <div className={styles.valueArea}></div>
        </div>
    );
};

export default SavingsSelectedHost;
