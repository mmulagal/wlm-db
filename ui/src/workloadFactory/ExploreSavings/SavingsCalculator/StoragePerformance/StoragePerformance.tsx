import { DsTypography } from '@netapp/design-system';
import styles from './StoragePerformance.module.scss';
import StoragePerfInput from './StoragePerfInput/StoragePerfInput';
import { useAppSelector } from '../../../../store/storeHooks';

const StoragePerformance = ({ printState }: any) => {
    const { onPremStorageAndComputeInfo }: any = useAppSelector(state => state.exploreSavings);

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
                        <DsTypography variant="Semibold_14">Throughput (MB/s)</DsTypography>
                    </div>
                </div>

                {Object.keys(onPremStorageAndComputeInfo).map((key: any, index: any) => (
                    <div key={index} className={styles.row1} style={{ marginTop: '-8px' }}>
                        <div className={styles.col1}>
                            <DsTypography variant="Regular_14">
                                {onPremStorageAndComputeInfo[key]?.sqlInstanceName}
                            </DsTypography>
                        </div>
                        <StoragePerfInput printState={printState} data={onPremStorageAndComputeInfo[key]} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StoragePerformance;
