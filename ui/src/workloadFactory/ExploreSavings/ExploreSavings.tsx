import TCOEngineTypeSelector from '../../common/EngineTypeSelector/TCOEngineTypeSelector';
import { useAppSelector } from '../../store/storeHooks';
import { DBType } from '../../utils/consts';
import ExploreSavingHeader from './ExploreSavingHeader/ExploreSavingHeader';
import styles from './ExploreSavings.module.scss';
import ExploreSavingsOracleTab from './ExploreSavingsTab/ExploreSavingsOracleTab';
import ExploreSavingsTab from './ExploreSavingsTab/ExploreSavingsTab';
import OracleTCOTables from './OracleTCO/OracleTCOTables';
import OracleTCOBanner from './TCOBanner/OracleTCOBanner';

const ExploreSavings = () => {
    const { selectedTCOHostType } = useAppSelector(state => state.exploreSavings);
    return (
        <div className={styles.exploreSavings}>
            <TCOEngineTypeSelector />

            {selectedTCOHostType === DBType.MSSQL && (
                <>
                    <ExploreSavingsTab />
                    <ExploreSavingHeader />
                </>
            )}

            {selectedTCOHostType === DBType.ORACLE && (
                <>
                    <ExploreSavingsOracleTab />
                    <OracleTCOBanner />
                    <OracleTCOTables />
                </>
            )}
        </div>
    );
};

export default ExploreSavings;
