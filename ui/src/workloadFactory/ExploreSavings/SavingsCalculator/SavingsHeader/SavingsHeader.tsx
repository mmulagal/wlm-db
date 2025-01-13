import { DsTypography } from '@netapp/design-system';
import { ReactComponent as MSSQL } from '../../../../assets/MS-sql-icon.svg';

import styles from './SavingsHeader.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

const SavingsHeader = () => {
    const { savingsCalculatorFrom, selectedExploreSavingsTab } = useAppSelector(state => state.exploreSavings);

    const setText = () => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
        ) {
            return GENERAL.SAVINGS_HEADER;
        } else if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            return GENERAL.SAVINGS_ONPREM_HEADER;
        } else {
            return GENERAL.SAVINGS_HEADER_FSX;
        }
    };

    const setCSS = () => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
        ) {
            return styles.savingsHeader;
        } else if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            return `${styles.savingsHeader} ${styles.savingsHeaderOnPrem}`;
        } else {
            return `${styles.savingsHeader} ${styles.savingsHeaderFSX}`;
        }
    };
    return (
        <div className={setCSS()}>
            <div className={styles.setImage}>
                <MSSQL />
            </div>
            <DsTypography variant="Semibold_16" className={styles.content}>
                {setText()}
            </DsTypography>
        </div>
    );
};

export default SavingsHeader;
