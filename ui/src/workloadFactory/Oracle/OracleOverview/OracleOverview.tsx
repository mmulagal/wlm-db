import { useAppSelector } from '../../../store/storeHooks';
import CPUUtilizationCard from '../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/CPUUtilizationCard/CPUUtilizationCard';
import IOPSCard from '../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/IOPSCard/IOPSCard';
import LatencyCard from '../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/LatencyCard/LatencyCard';
import ResourceHeader from '../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/ResourceHeader/ResourceHeader';
import ThroughputCard from '../../GetWell/WellArchitectDashboard/ResourceMSSQLOverview/ThroughputCard/ThroughputCard';
import OracleResourceOverviewApi from '../OracleWellArchitectDashboard/OracleResourceOverviewApi';
import OracleInformationSection from './OracleInformationSection/OracleInformationSection';
import styles from './OracleOverview.module.scss';

const OracleOverview = () => {
    const { selectedHostname, selectedDatabaseInstanceName } = useAppSelector(state => state.workloadFactoryResource);

    const { resourceLoading, resourceDetails } = useAppSelector(state => state.oracleSlice);

    OracleResourceOverviewApi();
    return (
        <div className={styles.oracleOverview}>
            <div className={styles.leftSide}>
                <ResourceHeader
                    resourceDetails={resourceDetails}
                    resourceLoading={resourceLoading}
                    selectedHostname={selectedHostname}
                    selectedDatabaseInstanceName={selectedDatabaseInstanceName}
                    resourceHeaderType="oracle"
                />

                <div className={styles.commonBlock}>
                    <CPUUtilizationCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                    <LatencyCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                </div>

                <div className={styles.commonBlock}>
                    <IOPSCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                    <ThroughputCard resourceDetails={resourceDetails} resourceLoading={resourceLoading} />
                </div>
            </div>
            <div className={styles.rightSide}>
                <OracleInformationSection />
            </div>
        </div>
    );
};

export default OracleOverview;
