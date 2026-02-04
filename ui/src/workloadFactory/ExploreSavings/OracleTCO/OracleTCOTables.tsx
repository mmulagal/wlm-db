import { useAppSelector } from '../../../store/storeHooks';
import { DBType } from '../../../utils/consts';
import OracleOnPremTable from './OracleOnPremTable';
import styles from './OracleTCOTables.module.scss';

const OracleTCOTables = () => {
    const { selectedTCOHostType } = useAppSelector(state => state.exploreSavings);
    return (
        <div className={styles['oracle-tco-tables']}>
            {selectedTCOHostType === DBType.ORACLE && <OracleOnPremTable />}
        </div>
    );
};

export default OracleTCOTables;
