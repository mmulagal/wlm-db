import ProgressBar from '../../../common/ProgressBar/ProgressBar';
import styles from './SandboxDistributionType.module.scss';

const SandboxDistributionType = () => {
    return (
        <div className={styles.sandboxType}>
            <div className={styles.progressStyle}>
                <ProgressBar value={40} color={'#0BAFFC'} />
            </div>
        </div>
    );
};

export default SandboxDistributionType;
