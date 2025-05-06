import { DsTypography } from '@netapp/design-system';
import { ReactComponent as InstanceName } from '../../../../../../assets/instance-name.svg';

import styles from './DetectHeader.module.scss';

const DetectHeader = () => {
    return (
        <div className={styles['detect-header']}>
            <div className={styles.firstBlock}>
                <div>
                    <InstanceName />
                </div>

                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_14">Instance name</DsTypography>
                    <DsTypography variant="Regular_14">Instance name</DsTypography>
                </div>
            </div>

            <div className={styles.commonBlock}>
                <div className={styles.firstColText}>
                    <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                    <DsTypography variant="Regular_14">Online</DsTypography>
                </div>
                <DsTypography variant="Regular_14">Instance status</DsTypography>
            </div>

            <div className={styles.commonBlock}>
                <DsTypography variant="Semibold_14">Host name</DsTypography>
                <DsTypography variant="Regular_14">Host name</DsTypography>
            </div>

            <div className={styles.fourthBlock}>
                <DsTypography variant="Semibold_14">Microsoft SQL Server</DsTypography>
                <DsTypography variant="Regular_14">Engine type</DsTypography>
            </div>
        </div>
    );
};

export default DetectHeader;
