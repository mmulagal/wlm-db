import { DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import styles from './StoragePerformance.module.scss';
import StoragePerfInput from './StoragePerfInput/StoragePerfInput';
import { useAppSelector } from '../../../../store/storeHooks';

const StoragePerformance = ({ printState, host }: any) => {
    const { onPremStorageAndComputeInfo }: any = useAppSelector(state => state.exploreSavings);

    // For bulk mode, filter data for specific host
    const hostSpecificData = useMemo(() => {
        if (!host) {
            // Single host mode - use all data from Redux
            return onPremStorageAndComputeInfo;
        }

        // Bulk mode - filter data for this specific host
        const filteredData: any = {};
        Object.keys(onPremStorageAndComputeInfo).forEach((key: any) => {
            // Only include keys that start with this host's resourceId
            if (key.startsWith(`${host.resourceId}_`)) {
                filteredData[key] = onPremStorageAndComputeInfo[key];
            }
        });
        return filteredData;
    }, [host, onPremStorageAndComputeInfo]);

    return (
        <div className={styles.storagePerf}>
            <DsTypography style={{ marginBottom: '8px' }} variant="Regular_14">
                Storage & performance:
            </DsTypography>

            <div className={styles.computeTable}>
                <div className={styles.row1}>
                    <div className={styles.col1} />
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

                {Object.keys(hostSpecificData).map((key: any, index: any) => (
                    <div key={index} className={styles.row1} style={{ marginTop: '-8px' }}>
                        <div className={styles.col1}>
                            <DsTypography variant="Regular_14">{hostSpecificData[key]?.sqlInstanceName}</DsTypography>
                        </div>
                        <StoragePerfInput printState={printState} data={hostSpecificData[key]} uniqueKey={key} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StoragePerformance;
