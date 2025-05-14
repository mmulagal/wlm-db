import styles from './ResourceMSSQLOverview.module.scss';
import ResourceHeader from './ResourceHeader/ResourceHeader';
import CPUUtilizationCard from './CPUUtilizationCard/CPUUtilizationCard';
import LatencyCard from './LatencyCard/LatencyCard';
import ProtectedDatabases from './ProtectedDatabases/ProtectedDatabases';
import CapacityUtilization from './CapacityUtilizationCard/CapacityUtilization';
import IOPSCard from './IOPSCard/IOPSCard';
import ThroughputCard from './ThroughputCard/ThroughputCard';
import InformationSection from '../../../ResourcePage/InformationSection/InformationSection';
import StorageSavingResource from '../../../ResourcePage/StorageSavingResource/StorageSavingResource';
import { useAppSelector } from '../../../../store/storeHooks';
import { getAggrStorageSavings } from '../../../../utils/utilityFunctions';
import DatabaseHostOverviewApiV2 from '../../../ResourcePage/ResourceHomePage/DatabaseHostOverviewApiV2';
import DBDistributionSection from '../../../ResourcePage/DBDistributionSection/DBDistributionSection';
import StoragePerformance from '../../../ResourcePage/StoragePerformance/StoragePerformance';

const ResourceMSSQLOverview = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);

    DatabaseHostOverviewApiV2();
    return (
        <div className={styles['resource-mssql-overview']}>
            <div className={styles.leftSide}>
                <ResourceHeader />

                {/* <div className={styles.commonBlock}>
                    <CPUUtilizationCard />
                    <LatencyCard />
                </div> */}

                <div className={styles.commonBlock}>
                    <DBDistributionSection />
                </div>

                <div className={styles.commonBlock}>
                    <ProtectedDatabases />
                    <CapacityUtilization />
                </div>

                {/* <div className={styles.commonBlock}>
                    <IOPSCard />
                    <ThroughputCard />
                </div> */}

                <div className={styles.commonBlock}>
                    <StoragePerformance />
                </div>

                <div className={styles.barContainer}>
                    <div className={styles.commonContainer}>
                        <StorageSavingResource
                            hostData={getAggrStorageSavings([resourceDetails])}
                            hostsLoading={resourceLoading}
                        />
                    </div>
                </div>
            </div>
            <div className={styles.rightSide}>
                <InformationSection />
            </div>
        </div>
    );
};

export default ResourceMSSQLOverview;
