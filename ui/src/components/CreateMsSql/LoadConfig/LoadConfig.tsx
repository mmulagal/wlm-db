import { GENERAL } from '../../../utils/appConstants';
import styles from './LoadConfig.module.scss';

const LoadConfig = () => {
    return (
        <div className={styles['load-config']}>
            <div className={styles.content}>{GENERAL.LOAD_CONFIG_CONTENT}</div>
        </div>
    );
};

export default LoadConfig;
