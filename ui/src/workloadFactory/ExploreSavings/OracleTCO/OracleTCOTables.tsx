import { useAppSelector } from '../../../store/storeHooks';
import { DBType, WLF_TABS } from '../../../utils/consts';
import OracleOnPremTable from './OracleOnPremTable';
import OracleEbsTable from './OracleEbsTable';
import styles from './OracleTCOTables.module.scss';

const OracleTCOTables = () => {
    const { selectedTCOHostType, selectedOracleExploreSavingsTab } = useAppSelector(state => state.exploreSavings);
    return (
        <div className={styles['oracle-tco-tables']}>
            {selectedTCOHostType === DBType.ORACLE &&
                selectedOracleExploreSavingsTab === WLF_TABS.ORACLE_SERVER_ON_PREMISES && <OracleOnPremTable />}
            {selectedTCOHostType === DBType.ORACLE &&
                selectedOracleExploreSavingsTab === WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE && <OracleEbsTable />}
        </div>
    );
};

export default OracleTCOTables;
