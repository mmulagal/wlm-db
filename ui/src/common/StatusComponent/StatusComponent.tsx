import { ReactComponent as MajorIcon } from '../../assets/major_icon.svg';
import { ReactComponent as MinorIcon } from '../../assets/minor_icon.svg';
import { ReactComponent as CriticalIcon } from '../../assets/critical_icon.svg';
import { ReactComponent as InfoIcon } from '../../assets/ic_info.svg';
import styles from './StatusComponent.module.scss';

const iconsMap: any = {
    CRITICAL: <CriticalIcon />,
    MAJOR: <MajorIcon />,
    MINOR: <MinorIcon />,
    INFO: <InfoIcon />
};

const StatusComponent = ({
    status,
    statusText = status,
    useIcon = false,
    isCircle = false,
    className
}: {
    status: string;
    statusText?: string;
    useIcon?: boolean;
    isCircle?: boolean;
    className?: string;
}) => {
    const actualClassName = className ?? status.toLowerCase();
    return (
        <div className={styles['status-component']}>
            {!useIcon && (
                <div
                    className={`${styles['icon']} ${styles[actualClassName]} ${isCircle ? styles['circle'] : ''}`}
                ></div>
            )}
            {useIcon && <div className={`${styles['svg-icon']} ${styles[actualClassName]}`}>{iconsMap[status]}</div>}
            <div className={styles['status']}>{statusText}</div>
        </div>
    );
};

export default StatusComponent;
