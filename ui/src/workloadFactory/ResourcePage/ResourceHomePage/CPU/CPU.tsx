import { Typography } from '@netapp/design-system';
import styles from './CPU.module.scss';
import LineChart from '../../../DatabaseHomePage/LineChart/LineChart';

const CPU = () => {
    return (
        <div className={styles.cpu}>
            <div className={styles.topSection}>
                <Typography variant="Semibold_14">CPU</Typography>
            </div>

            <div className={styles.bottomSection}>
                <LineChart startColor="#68C6B3" endColor="rgba(104, 198, 179, 0.00)" />
            </div>
        </div>
    );
};

export default CPU;
