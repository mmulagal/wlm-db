import styles from './ProgressBar.module.scss';

type Progress = {
    value: number;
    color: string;
    max?: number;
    className?: string;
};

const ProgressBar = ({ value, color, max = 100, className = '' }: Progress) => {
    return (
        <div className={`${styles['Suc-progressbar']} ${className}`}>
            <div
                className={styles['Suc-filled-value']}
                style={{ width: (value / max) * 100 + '%', backgroundColor: color }}
            />
        </div>
    );
};

export default ProgressBar;
