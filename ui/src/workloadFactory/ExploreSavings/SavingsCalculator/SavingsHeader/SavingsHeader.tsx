import { DsTypography } from '@netapp/design-system';
import { ReactComponent as MSSQL } from '../../../../assets/MS-sql-icon.svg';

import styles from './SavingsHeader.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';

const SavingsHeader = () => {
    const { savingsCalculatorFrom } = useAppSelector(state => state.exploreSavings);
    return (
        <div
            className={
                savingsCalculatorFrom === 'Manual'
                    ? styles.savingsHeader
                    : `${styles.savingsHeader} ${styles.savingsHeaderFSX}`
            }
        >
            <div className={styles.setImage}>
                <MSSQL />
            </div>
            <DsTypography variant="Semibold_16" className={styles.content}>
                {savingsCalculatorFrom === 'Manual' ? GENERAL.SAVINGS_HEADER : GENERAL.SAVINGS_HEADER_FSX}
            </DsTypography>
        </div>
    );
};

export default SavingsHeader;
