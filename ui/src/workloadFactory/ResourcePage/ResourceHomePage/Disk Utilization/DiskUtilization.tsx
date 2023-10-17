import { Typography } from '@netapp/design-system';
import styles from './DiskUtilization.module.scss';

const DiskUtilization = () => {
    return (
        <div className={styles.disk}>
            <Typography variant="Semibold_14">Disk Utilization</Typography>
        </div>
    );
};

export default DiskUtilization;
