import { DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import styles from './StoragePerformance.module.scss';
import StoragePerfInput from './StoragePerfInput/StoragePerfInput';
import { useAppSelector } from '../../../../store/storeHooks';
import { SAVINGS_CALC_MODE } from '../../../../utils/consts';

interface StorageAndComputeEntry {
    totalStorage?: string | number;
    totalIops?: string | number;
    totalThroughput?: string | number;
    memory?: string | number;
    noOfVcpusInUse?: number;
    networkPerformance?: string;
    hostResourceName?: string;
    sqlInstanceName?: string;
    sqlInstanceId?: string;
    databaseName?: string;
    databaseId?: string;
    monthlyOracleCost?: string | number;
}

interface StoragePerformanceProps {
    printState: boolean;
    host?: { resourceId: string };
}

const StoragePerformance = ({ printState, host }: StoragePerformanceProps) => {
    const { onPremStorageAndComputeInfo, savingsCalculatorFrom } = useAppSelector(state => state.exploreSavings);

    // Check if Oracle on-prem mode
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;

    // For bulk mode, filter data for specific host
    const hostSpecificData = useMemo(() => {
        if (!host) {
            // Single host mode - use all data from Redux
            return onPremStorageAndComputeInfo as Record<string, StorageAndComputeEntry>;
        }

        // Bulk mode - filter data for this specific host
        const filteredData: Record<string, StorageAndComputeEntry> = {};
        Object.keys(onPremStorageAndComputeInfo || {}).forEach(key => {
            // Only include keys that start with this host's resourceId
            if (key.startsWith(`${host.resourceId}_`)) {
                filteredData[key] = onPremStorageAndComputeInfo[key];
            }
        });
        return filteredData;
    }, [host, onPremStorageAndComputeInfo]);

    // Helper to get display name (databaseName for Oracle, sqlInstanceName for MSSQL)
    const getDisplayName = (data: StorageAndComputeEntry) => {
        if (isOracleOnPrem) {
            return data?.databaseName;
        }
        return data?.sqlInstanceName;
    };

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

                {Object.keys(hostSpecificData || {}).map((key, index) => (
                    <div key={index} className={styles.row1} style={{ marginTop: '-8px' }}>
                        <div className={styles.col1}>
                            <DsTypography variant="Regular_14">{getDisplayName(hostSpecificData[key])}</DsTypography>
                        </div>
                        <StoragePerfInput printState={printState} data={hostSpecificData[key]} uniqueKey={key} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StoragePerformance;
