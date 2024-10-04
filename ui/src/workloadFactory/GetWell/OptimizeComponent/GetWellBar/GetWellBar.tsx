import ProgressBar from '../../../../common/ProgressBar/ProgressBar';
import styles from './GetWellBar.module.scss';

const GetWellBar = ({ isComingSoon }: any) => {
    return (
        <div className={styles.getWellBar}>
            <ProgressBar value={isComingSoon ? 0 : 50} color={'#5E8DCD'} />
        </div>
    );
};

export default GetWellBar;
