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
import { getAggrStorageSavings, isPartialData } from '../../../../utils/utilityFunctions';
import DatabaseHostOverviewApiV2 from '../../../ResourcePage/ResourceHomePage/DatabaseHostOverviewApiV2';
import ResourceMSSQLPartialContainer from './ResourceMSSQLPartailContainer/ResourceMSSQLPartailContainer';
import { MS_PER_HOUR } from '../../../../utils/consts';

const PARTIAL_DATA_THRESHOLD = 6 * MS_PER_HOUR; // 6 hours in milliseconds

const ResourceMSSQLOverview = () => {
    const { resourceLoading, resourceDetails, selectedHostname, selectedDatabaseInstanceName } = useAppSelector(
        state => state.workloadFactoryResource
    );

    DatabaseHostOverviewApiV2();
    return (
        <>
            {/* Partial data warning here - based on condition 1. latency/throughput/iops read,write should be an array  2. creation of resource should be more than 6 hours 3.resource page should load fully */}
            {isPartialData(resourceDetails) &&
                Date.now() - Number(resourceDetails?.databaseServer?.creationDate) > PARTIAL_DATA_THRESHOLD &&
                !resourceLoading && (
                    <div className={styles['resource-mssql-overview-partialDataContainer']}>
                        <ResourceMSSQLPartialContainer />
                    </div>
                )}
            <div className={styles['resource-mssql-overview']}>
                <div className={styles.leftSide}>
                    <ResourceHeader
                        resourceDetails={resourceDetails}
                        resourceLoading={resourceLoading}
                        selectedHostname={selectedHostname}
                        selectedDatabaseInstanceName={selectedDatabaseInstanceName}
                        resourceHeaderType="mssql"
                    />

                    <div className={styles.commonBlock}>
                        <CPUUtilizationCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                        <LatencyCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                    </div>

                    {/* <div className={styles.commonBlock}>
                    <DBDistributionSection />
                </div> */}

                    <div className={styles.commonBlock}>
                        <ProtectedDatabases />
                        <CapacityUtilization />
                    </div>

                    <div className={styles.commonBlock}>
                        <IOPSCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                        <ThroughputCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                    </div>

                    {/* <div className={styles.commonBlock}>
                    <StoragePerformance />
                </div> */}

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
        </>
    );
};

export default ResourceMSSQLOverview;
