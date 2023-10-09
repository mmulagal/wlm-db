import { Typography } from '@netapp/design-system';
import styles from './CPU.module.scss';

const CPU = () => {
    return (
        <div className={styles.cpu}>
            <Typography variant="Semibold_14">CPU</Typography>
        </div>
    );
};

export default CPU;
