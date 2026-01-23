import { TextField } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './StoragePerfInput.module.scss';
import { useSearchDebounce } from '../../../../../common/hooks/useSearchDebounce';
import { setOnPremStorageAndComputeInfo } from '../../../../../store/workloadFactory/exploreSavingsSlice';

interface StoragePerfData {
    sqlInstanceName?: string;
    totalStorage?: number | string;
    totalIops?: number | string;
    totalThroughput?: number | string;
}

interface StoragePerfInputProps {
    data?: StoragePerfData;
    printState?: boolean;
    uniqueKey?: string;
}

const StoragePerfInput = ({ data, printState, uniqueKey }: StoragePerfInputProps) => {
    const dispatch = useDispatch();
    // Use uniqueKey if provided (bulk mode with resourceId_instanceName), otherwise fall back to sqlInstanceName (single host mode)
    const storeKey = uniqueKey || data?.sqlInstanceName;

    useEffect(() => {
        if (data) {
            setTotalStorageAmount(data?.totalStorage);
            setIOPS(data?.totalIops);
            setThroughput(data?.totalThroughput);
        }
    }, [data]);

    const [totalStorageAmount, setTotalStorageAmount] = useState<any>(null);

    const [totalStorageAmountSearch, setTotalStorageAmountSearch] = useSearchDebounce(1000);

    // use effect for no of cpu details
    useEffect(() => {
        setTotalStorageAmountSearch(totalStorageAmount);
    }, [totalStorageAmount]);

    useEffect(() => {
        if (totalStorageAmountSearch !== null && totalStorageAmountSearch !== undefined) {
            dispatch(
                setOnPremStorageAndComputeInfo({
                    type: storeKey,
                    mode: 'totalStorage',
                    value: totalStorageAmountSearch
                })
            );
        }
    }, [totalStorageAmountSearch, storeKey]);

    const [iops, setIOPS] = useState<any>(null);

    const [iopsSearch, setIOPSSearch] = useSearchDebounce(1000);

    // use effect for no of cpu details
    useEffect(() => {
        setIOPSSearch(iops);
    }, [iops]);

    useEffect(() => {
        if (iopsSearch !== null && iopsSearch !== undefined) {
            dispatch(
                setOnPremStorageAndComputeInfo({
                    type: storeKey,
                    mode: 'totalIops',
                    value: iopsSearch
                })
            );
        }
    }, [iopsSearch, storeKey]);

    const [throughput, setThroughput] = useState<any>(null);

    const [throughputSearch, setThroughputSearch] = useSearchDebounce(1000);

    // use effect for no of cpu details
    useEffect(() => {
        setThroughputSearch(throughput);
    }, [throughput]);

    useEffect(() => {
        if (throughputSearch !== null && throughputSearch !== undefined) {
            dispatch(
                setOnPremStorageAndComputeInfo({
                    type: storeKey,
                    mode: 'totalThroughput',
                    value: throughputSearch
                })
            );
        }
    }, [throughputSearch, storeKey]);

    return (
        <div className={styles.computeInputComponent}>
            <div className={styles.col2}>
                {printState && (
                    <div className={styles.mockInputClone}>
                        <div className={styles.inputField}>{totalStorageAmount}</div>
                    </div>
                )}
                {!printState && (
                    <TextField
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setTotalStorageAmount(numVal);
                        }}
                        placeholder=""
                        value={totalStorageAmount || ''}
                        className={styles.keyField}
                    />
                )}
            </div>
            <div className={styles.col3}>
                {printState && (
                    <div className={styles.mockInputClone}>
                        <div className={styles.inputField}>{iops}</div>
                    </div>
                )}
                {!printState && (
                    <TextField
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setIOPS(numVal);
                        }}
                        placeholder=""
                        value={iops || ''}
                        className={styles.keyField}
                    />
                )}
            </div>
            <div className={styles.col4}>
                {printState && (
                    <div className={styles.mockInputClone}>
                        <div className={styles.inputField}>{throughput}</div>
                    </div>
                )}
                {!printState && (
                    <TextField
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setThroughput(numVal);
                        }}
                        placeholder=""
                        value={throughput || ''}
                        className={styles.keyField}
                    />
                )}
            </div>
        </div>
    );
};

export default StoragePerfInput;
