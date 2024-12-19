import { DsTypography, TextField } from '@netapp/design-system';
import styles from './ComputeInformation.module.scss';
import ComputeInputComponent from './ComputeInputComponent/ComputeInputComponent';

const ComputeInformation = () => {
    return (
        <div className={styles.computeInformation}>
            <DsTypography style={{ marginBottom: '8px' }} variant="Regular_14">
                Compute information:
            </DsTypography>

            <div className={styles.computeTable}>
                <div className={styles.row1}>
                    <div className={styles.col1}></div>
                    <div className={styles.col2}>
                        <DsTypography variant="Semibold_14">Number of vCPUs in use</DsTypography>
                    </div>
                    <div className={styles.col3}>
                        <DsTypography variant="Semibold_14">Memory (GiB)</DsTypography>
                    </div>
                    <div className={styles.col4}>
                        <DsTypography variant="Semibold_14">Network performance</DsTypography>
                    </div>
                </div>

                <div className={styles.row1} style={{ marginTop: '-8px' }}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">SQL_ins1</DsTypography>
                    </div>
                    <ComputeInputComponent type="SQL_ins1" />
                </div>

                <div className={styles.row1}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">SQL_ins12</DsTypography>
                    </div>
                    <ComputeInputComponent type="SQL_ins2" />
                </div>

                <div className={styles.row1}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">SQL_ins3</DsTypography>
                    </div>
                    <ComputeInputComponent type="SQL_ins3" />
                </div>
            </div>
        </div>
    );
};

export default ComputeInformation;
