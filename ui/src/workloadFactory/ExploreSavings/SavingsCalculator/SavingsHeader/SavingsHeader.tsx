import { DsTypography } from '@netapp/design-system';
import { ReactComponent as MSSQL } from '../../../../assets/MS-sql-icon.svg';

import styles from './SavingsHeader.module.scss';

const SavingsHeader = () => {
    return (
        <div className={styles.savingsHeader}>
            <div className={styles.setImage}>
                <MSSQL />
            </div>
            <DsTypography variant="Semibold_16" className={styles.content}>
                Microsoft SQL server on Amazon Elastic Block Store (EBS) configuration.
            </DsTypography>
        </div>
    );
};

export default SavingsHeader;
