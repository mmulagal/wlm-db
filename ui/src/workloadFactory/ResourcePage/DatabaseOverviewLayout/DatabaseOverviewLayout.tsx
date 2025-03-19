import { useAppSelector } from '../../../store/storeHooks';
import { getAggrStorageSavings } from '../../../utils/utilityFunctions';

import DBDistributionSection from '../DBDistributionSection/DBDistributionSection';
import InformationSection from '../InformationSection/InformationSection';
import StoragePerformance from '../StoragePerformance/StoragePerformance';
import StorageSavingResource from '../StorageSavingResource/StorageSavingResource';
import DBOverviewProtection from './DBOverviewProtection/DBOverviewProtection';

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
                            <StorageSavingResource
                                hostData={getAggrStorageSavings([resourceDetails])}
                                hostsLoading={resourceLoading}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.storagePerformanceContainer}>
                    <StoragePerformance />
                </div>
            </div>

            <div className={styles.rightSidePart}>
                <InformationSection />
            </div>
        </div>
    );
};

export default DatabaseOverviewLayout;
