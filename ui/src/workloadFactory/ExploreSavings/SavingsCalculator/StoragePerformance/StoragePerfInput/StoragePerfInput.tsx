import { TextField } from '@netapp/design-system';
import styles from './StoragePerfInput.module.scss';
import { useEffect, useState } from 'react';
import { useSearchDebounce } from '../../../../../common/hooks/useSearchDebounce';
import { useDispatch } from 'react-redux';
import { setStoragePerformance } from '../../../../../store/workloadFactory/exploreSavingsSlice';
import { GIB_IN_BYTE } from '../../../../../utils/consts';
import { formatFractionalNumber } from '../../../../../utils/utilityFunctions';

const StoragePerfInput = ({ data, printState }: any) => {
    const dispatch = useDispatch();

    useEffect(() => {
        if (data) {
            setTotalStorageAmount(formatFractionalNumber(Number(data?.totalStorage || 0) / GIB_IN_BYTE, 3));
            setIOPS(formatFractionalNumber(data?.totalIops, 3));
            setThroughput(formatFractionalNumber(data?.totalThroughput, 3));
        }
    }, [data]);

    const [totalStorageAmount, setTotalStorageAmount] = useState<any>(null);

    const [totalStorageAmountSearch, setTotalStorageAmountSearch] = useSearchDebounce(1000);

    //use effect for no of cpu details
    useEffect(() => {
        setTotalStorageAmountSearch(totalStorageAmount);
    }, [totalStorageAmount]);

    useEffect(() => {
        dispatch(
            setStoragePerformance({
                type: data?.sqlInstanceName,
                mode: 'storage',
                value: totalStorageAmountSearch
            })
        );
    }, [totalStorageAmountSearch]);

    const [iops, setIOPS] = useState<any>(null);

    const [iopsSearch, setIOPSSearch] = useSearchDebounce(1000);

    //use effect for no of cpu details
    useEffect(() => {
        setIOPSSearch(iops);
    }, [iops]);

    useEffect(() => {
        dispatch(
            setStoragePerformance({
                type: data?.sqlInstanceName,
                mode: 'iops',
                value: iopsSearch
            })
        );
    }, [iopsSearch]);

    const [throughput, setThroughput] = useState<any>(null);

    const [throughputSearch, setThroughputSearch] = useSearchDebounce(1000);

    //use effect for no of cpu details
    useEffect(() => {
        setThroughputSearch(throughput);
    }, [throughput]);

    useEffect(() => {
        dispatch(
            setStoragePerformance({
                type: data?.sqlInstanceName,
                mode: 'throughput',
                value: throughputSearch
            })
        );
    }, [throughputSearch]);

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
                        placeholder={''}
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
                        placeholder={''}
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
                        placeholder={''}
                        value={throughput || ''}
                        className={styles.keyField}
                    />
                )}
            </div>
        </div>
    );
};

export default StoragePerfInput;
