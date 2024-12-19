import { DsTypography } from '@netapp/design-system';
import styles from './StoragePerformance.module.scss';
import StoragePerfInput from './StoragePerfInput/StoragePerfInput';
// import ComputeInputComponent from './StoragePerformance.moodule.scss';

const StoragePerformance = () => {
    return (
        <div className={styles.storagePerf}>
            <DsTypography style={{ marginBottom: '8px' }} variant="Regular_14">
                Storage & performance:
            </DsTypography>

            <div className={styles.computeTable}>
                <div className={styles.row1}>
                    <div className={styles.col1}></div>
                    <div className={styles.col2}>
                        <DsTypography variant="Semibold_14">Total Storage amount (GiB)</DsTypography>
                    </div>
                    <div className={styles.col3}>
                        <DsTypography variant="Semibold_14">IOPS</DsTypography>
                    </div>
                    <div className={styles.col4}>
                        <DsTypography variant="Semibold_14">Throughput</DsTypography>
                    </div>
                </div>

                <div className={styles.row1} style={{ marginTop: '-8px' }}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">Primary - data</DsTypography>
                    </div>
                    <StoragePerfInput type="primaryData" />
                </div>

                <div className={styles.row1}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">Primary - log</DsTypography>
                    </div>
                    <StoragePerfInput type="primaryLog" />
                </div>

                <div className={styles.row1}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">Secondary - data</DsTypography>
                    </div>
                    <StoragePerfInput type="secondaryData" />
                </div>

                <div className={styles.row1}>
                    <div className={styles.col1}>
                        <DsTypography variant="Regular_14">Secondary - log</DsTypography>
                    </div>
                    <StoragePerfInput type="secondaryLog" />
                </div>
            </div>
        </div>
    );
};

export default StoragePerformance;
