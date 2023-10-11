import { Typography } from '@netapp/design-system';
import { ReactComponent as SelectedDatabase } from '../../../../assets/Selected database.svg';
import { ReactComponent as EC2 } from '../../../../assets/EC2.svg';
import { ReactComponent as FSX } from '../../../../assets/FSX.svg';
import styles from './Topology.module.scss';

const Topology = () => {
    return (
        <div className={styles.topology}>
            <Typography variant="Semibold_14" className={styles.topologyHeading}>
                Topology
            </Typography>
            <div className={styles.topologyChart}>
                <div className={styles.chartContainer}>
                    {/* Left side box starts */}
                    <div className={styles.leftBox}>
                        <div className={styles.layers}>
                            <SelectedDatabase />
                            <div className={styles.dbText}>
                                <Typography variant="Semibold_13">Database 1</Typography>
                            </div>
                        </div>

                        <div className={styles.layers}>
                            <EC2 />
                            <div className={styles.dbText}>
                                <Typography variant="Semibold_13">EC2</Typography>
                            </div>
                        </div>
                    </div>
                    {/* Left side box ends */}

                    {/* Separator line */}
                    <div className={styles.connectingLines}>
                        <div className={styles.partOne}>
                            <div className={styles.dashedLine} />
                            <div className={styles.verticalDashedLine} />
                        </div>
                        <div className={styles.partTwo}>
                            <div className={styles.dashedLine}></div>

                            <div className={styles.dashedBottomLine} />
                        </div>
                    </div>

                    <div className={styles.thirdRow}>
                        <div className={styles.firstElement}>
                            <FSX />
                            <Typography variant="Semibold_13" className={styles.elementText}>
                                FSX1
                            </Typography>
                        </div>

                        <div className={styles.firstElement}>
                            <FSX />
                            <Typography variant="Semibold_13" className={styles.elementText}>
                                EC2
                            </Typography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Topology;
