import { Typography } from '@netapp/design-system';
import styles from './Topology.module.scss';

const Topology = () => {
    return (
        <div className={styles.topology}>
            <Typography variant="Semibold_14" className={styles.topologyHeading}>
                Topology
            </Typography>
            <div className={styles.topologyChart}></div>
        </div>
    );
};

export default Topology;
