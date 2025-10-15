import { useAppSelector } from '../../../store/storeHooks';
import EstimatedCost from '../../DatabaseHomePage/EstimatedCost/EstimatedCost';
import NewPotentialSavings from '../PotentialSavings/NewPotentialSavings';
import styles from './DashboardOverview.module.scss';
import DatabaseResources from './DatabaseResources/DatabaseResources';
import ErrorInvestigationOverview from './ErrorInvestigationOverview/ErrorInvestigationOverview';
import Sandboxes from './Sandboxes/Sanboxes';
import WellArchitectedScore from './WellArchitectedScore/WellArchitectedScore';

const DashboardOverview = () => {
    const hostCostData: any = useAppSelector(state => state.databaseHome.aggregatedCosts);
    const mssqlHostDataLoading = useAppSelector(state => state.inventoryV2.getDatabaseHosts.fullHostDataLoading);
    const pgsqlHostDataLoading = useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts.fullHostDataLoading);
    const { multiDataLoading } = useAppSelector(state => state.headers);
    return (
        <div className={styles.dashboardOverview}>
            <DatabaseResources />

            <div className={styles.layerTwo}>
                <WellArchitectedScore />
                <ErrorInvestigationOverview />
            </div>

            <div className={styles.layerThree}>
                <NewPotentialSavings />

                <div className={styles.rightSection}>
                    <div className={styles.container}>
                        <EstimatedCost
                            hostData={hostCostData}
                            hostsLoading={mssqlHostDataLoading || pgsqlHostDataLoading || multiDataLoading}
                        />
                    </div>
                    <div className={styles.container}>
                        <Sandboxes />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
