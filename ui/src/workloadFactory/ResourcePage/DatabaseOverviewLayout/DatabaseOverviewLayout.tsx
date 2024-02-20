import { useAppSelector } from '../../../store/storeHooks';
import { getAggrCost, getAggrStorageSavings } from '../../../utils/utilityFunctions';
import EstimatedCost from '../../DatabaseHomePage/EstimatedCost/EstimatedCost';
import StorageSavings from '../../DatabaseHomePage/StorageSavings/StorageSavings';
import DBDistributionSection from '../DBDistributionSection/DBDistributionSection';
import InformationSection from '../InformationSection/InformationSection';
import StoragePerformance from '../StoragePerformance/StoragePerformance';
import DBOverviewProtection from './DBOverviewProtection/DBOverviewProtection';
import DatabaseHostTile from './DatabaseHostTile/DatabaseHostTile';
import styles from './DatabaseOverviewLayout.module.scss';
import Diagram from './Diagram/Diagram';

const DatabaseOverviewLayout = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    return (
        <div className={styles.databaseOverview}>
            <div className={styles.leftSidePart}>
                <div className={styles.secondLevel}>
                    <DBOverviewProtection />
                    <DBDistributionSection />
                </div>

                <div className={styles.fourthLevelContainer}>
                    {/* Bar lines */}
                    <div className={styles.barContainer}>
                        <div className={styles.commonContainer}>
                            <StorageSavings
                                hostData={getAggrStorageSavings([resourceDetails])}
                                hostsLoading={resourceLoading}
                            />
                        </div>

                        <div className={styles.commonContainer}>
                            <EstimatedCost hostData={getAggrCost([resourceDetails])} hostsLoading={resourceLoading} />
                        </div>
                    </div>
                </div>

                <div className={styles.storagePerformanceContainer}>
                    <StoragePerformance />
                </div>

                <div className={styles.diagramContainer}>
                    <Diagram />
                </div>
            </div>

            <div className={styles.rightSidePart}>
                <InformationSection />
            </div>
        </div>
    );
};

export default DatabaseOverviewLayout;
