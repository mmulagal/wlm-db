import ProgressBar from '../../../../common/ProgressBar/ProgressBar';
import styles from './GetWellBar.module.scss';

const GetWellBar = () => {
    return (
        <div className={styles.getWellBar}>
            <ProgressBar value={50} color={'#5E8DCD'} />
        </div>
    );
};

export default GetWellBar;
