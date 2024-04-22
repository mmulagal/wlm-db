import { DsTypography } from '@netapp/design-system';
import { ReactComponent as MSSQL } from '../../../../assets/MS-sql-icon.svg';

import styles from './SavingsHeader.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

const SavingsHeader = () => {
    return (
        <div className={styles.savingsHeader}>
            <div className={styles.setImage}>
                <MSSQL />
            </div>
            <DsTypography variant="Semibold_16" className={styles.content}>
                {GENERAL.SAVINGS_HEADER}
            </DsTypography>
        </div>
    );
};

export default SavingsHeader;
