import { useAppSelector } from '../../../../store/storeHooks';
import CPUUtilizationCard from '../../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/CPUUtilizationCard/CPUUtilizationCard';
import IOPSCard from '../../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/IOPSCard/IOPSCard';
import LatencyCard from '../../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/LatencyCard/LatencyCard';
import ResourceHeader from '../../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/ResourceHeader/ResourceHeader';
import ThroughputCard from '../../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/ThroughputCard/ThroughputCard';
import useOracleResourceOverview from './OracleResourceOverviewApi';
import OracleInformationSection from './OracleInformationSection/OracleInformationSection';
import styles from './OracleOverview.module.scss';
import { DBType, MS_PER_HOUR } from '../../../../utils/consts';
import { isPartialData } from '../../../../utils/utilityFunctions';
import ResourceMSSQLPartialContainer from '../../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/ResourceMSSQLPartailContainer/ResourceMSSQLPartailContainer';
import { GENERAL } from '../../../../utils/appConstants';
import OracleCapacityUtilization from './OracleCapacityUtilization/OracleCapacityUtilization';

const PARTIAL_DATA_THRESHOLD = 6 * MS_PER_HOUR; // 6 hours in milliseconds

const OracleOverview = () => {
    const { selectedHostname, selectedDatabaseInstanceName } = useAppSelector(state => state.workloadFactoryResource);

    const { resourceLoading, resourceDetails } = useAppSelector(state => state.oracleSlice);

    useOracleResourceOverview();
    return (
        <>
            {/* Partial data warning here - based on condition 1. latency/throughput/iops read,write should be an array  2. creation of resource should be more than 6 hours 3.resource page should load fully */}
            {isPartialData(resourceDetails) &&
                Date.now() - Number(new Date(resourceDetails?.databaseServer?.creationDate).getTime()) >
                    PARTIAL_DATA_THRESHOLD &&
                !resourceLoading && (
                    <div className={styles['resource-Oracle-overview-partialDataContainer']}>
                        <ResourceMSSQLPartialContainer resourceType={DBType.ORACLE} />
                    </div>
                )}
            <div className={styles.oracleOverview}>
                <div className={styles.leftSide}>
                    <ResourceHeader
                        resourceDetails={resourceDetails}
                        resourceLoading={resourceLoading}
                        selectedHostname={selectedHostname}
                        selectedDatabaseInstanceName={selectedDatabaseInstanceName}
                        resourceHeaderType={DBType.ORACLE}
                    />

                    <div className={styles.commonBlock}>
                        <CPUUtilizationCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                        <LatencyCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                    </div>

                    <div className={styles.commonBlock}>
                        <IOPSCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                        <ThroughputCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                    </div>

                    <div className={styles.capacityUtilizationContainer}>
                        <OracleCapacityUtilization
                            resourceDetails={resourceDetails}
                            resourceLoading={resourceLoading}
                        />
                    </div>
                </div>
                <div className={styles.rightSide}>
                    <OracleInformationSection />
                </div>
            </div>
        </>
    );
};

export default OracleOverview;
