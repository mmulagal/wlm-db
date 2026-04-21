import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MSSQL } from '../../../../assets/MS-sql-icon.svg';

import styles from './SavingsHeader.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

const SavingsHeader = () => {
    const { t } = useTranslation();
    const { savingsCalculatorFrom, selectedExploreSavingsTab } = useAppSelector(state => state.exploreSavings);

    // Helper to check if in Oracle on-prem mode
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;

    const setText = () => {
        // Oracle on-prem specific text
        if (isOracleOnPrem) {
            return t('databases.explore-savings.oracle-on-premises-configuration');
        }
        // Oracle EBS specific text
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) {
            return t('databases.explore-savings.savings-header-oracle-ebs');
        }
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
        ) {
            return t('databases.explore-savings.savings-header-ebs');
        }
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            return t('databases.explore-savings.savings-header-onprem');
        }
        return t('databases.explore-savings.savings-header-fsx');
    };

    const setCSS = () => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
        ) {
            return styles.savingsHeader;
        }
        if (
            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES ||
            isOracleOnPrem ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
        ) {
            return `${styles.savingsHeader} ${styles.savingsHeaderOnPrem}`;
        }
        return `${styles.savingsHeader} ${styles.savingsHeaderFSX}`;
    };

    // Render Oracle or MSSQL icon based on mode
    const renderIcon = () => <MSSQL />;

    return (
        <div className={setCSS()}>
            <div className={styles.setImage}>{renderIcon()}</div>
            <DsTypography variant="Semibold_16" className={styles.content}>
                {setText()}
            </DsTypography>
        </div>
    );
};

export default SavingsHeader;
