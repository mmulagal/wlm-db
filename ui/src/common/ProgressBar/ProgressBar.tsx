import { useAppSelector } from '../../store/storeHooks';
import styles from './ProgressBar.module.scss';

type Progress = {
    value: number;
    color: string;
    max?: number;
    className?: string;
};

const ProgressBar = ({ value, color, max = 100, className = '' }: Progress) => {
    const { isNA } = useAppSelector(state => state.sandbox);
    return (
        <div
            className={`${styles['Suc-progressbar']} ${className}`}
            style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : 'var(--field-border-disabled)' }}
        >
            <div
                className={styles['Suc-filled-value']}
                style={{ width: (value / max) * 100 + '%', backgroundColor: color }}
            />
        </div>
    );
};

export default ProgressBar;
