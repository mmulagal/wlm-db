import styles from './ResourceMSSQLOverview.module.scss';
import ResourceHeader from './ResourceHeader/ResourceHeader';
import CPUUtilizationCard from './CPUUtilizationCard/CPUUtilizationCard';
import LatencyCard from './LatencyCard/LatencyCard';
import ProtectedDatabases from './ProtectedDatabases/ProtectedDatabases';
import CapacityUtilization from './CapacityUtilizationCard/CapacityUtilization';
import IOPSCard from './IOPSCard/IOPSCard';
import ThroughputCard from './ThroughputCard/ThroughputCard';

const ResourceMSSQLOverview = () => {
    return (
        <div className={styles['resource-mssql-overview']}>
            <div className={styles.leftSide}>
                <ResourceHeader />

                <div className={styles.commonBlock}>
                    <CPUUtilizationCard />
                    <LatencyCard />
                </div>

                <div className={styles.commonBlock}>
                    <ProtectedDatabases />
                    <CapacityUtilization />
                </div>

                <div className={styles.commonBlock}>
                    <IOPSCard />
                    <ThroughputCard />
                </div>
            </div>
            <div className={styles.rightSide}></div>
        </div>
    );
};

export default ResourceMSSQLOverview;
