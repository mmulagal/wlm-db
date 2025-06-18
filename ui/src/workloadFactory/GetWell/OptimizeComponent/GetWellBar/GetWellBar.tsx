import ProgressBar from '../../../../common/ProgressBar/ProgressBar';
import styles from './GetWellBar.module.scss';

const GetWellBar = ({ barValue, isComingSoon }: any) => (
    <div className={styles.getWellBar}>
        <ProgressBar
            value={isComingSoon ? 0 : barValue || 0}
            color={barValue === '100' ? 'var(--chart-4)' : '#5E8DCD'}
        />
    </div>
);

export default GetWellBar;
