import { TextField } from '@netapp/design-system';
import styles from './StoragePerfInput.module.scss';
import { useEffect, useState } from 'react';
import { useSearchDebounce } from '../../../../../common/hooks/useSearchDebounce';
import { useDispatch } from 'react-redux';
import { setStoragePerformance } from '../../../../../store/workloadFactory/exploreSavingsSlice';
import { GIB_IN_BYTE } from '../../../../../utils/consts';
import { formatFractionalNumber } from '../../../../../utils/utilityFunctions';

const StoragePerfInput = ({ type, data }: any) => {
    const dispatch = useDispatch();

    useEffect(() => {
        if (data) {
            setTotalStorageAmount(formatFractionalNumber(Number(data?.totalStorage || 0) / GIB_IN_BYTE, 3));
            setIOPS(data?.totalIops);
            setThroughput(data?.totalThroughput);
        }
    }, [data]);

    const [totalStorageAmount, setTotalStorageAmount] = useState<any>(null);

    const [totalStorageAmountSearch, setTotalStorageAmountSearch] = useSearchDebounce(300);

    //use effect for no of cpu details
    useEffect(() => {
        setTotalStorageAmountSearch(totalStorageAmount);
    }, [totalStorageAmount]);

    useEffect(() => {
        dispatch(
            setStoragePerformance({
                type: type,
                mode: 'totalStorageAmount',
                value: totalStorageAmountSearch
            })
        );
    }, [totalStorageAmountSearch]);

    const [iops, setIOPS] = useState<any>(null);

    const [iopsSearch, setIOPSSearch] = useSearchDebounce(300);

    //use effect for no of cpu details
    useEffect(() => {
        setIOPSSearch(iops);
    }, [iops]);

    useEffect(() => {
        dispatch(
            setStoragePerformance({
                type: type,
                mode: 'iops',
                value: iopsSearch
            })
        );
    }, [iopsSearch]);

    const [throughput, setThroughput] = useState<any>(null);

    const [throughputSearch, setThroughputSearch] = useSearchDebounce(300);

    //use effect for no of cpu details
    useEffect(() => {
        setThroughputSearch(throughput);
    }, [throughput]);

    useEffect(() => {
        dispatch(
            setStoragePerformance({
                type: type,
                mode: 'throughput',
                value: throughputSearch
            })
        );
    }, [throughputSearch]);

    return (
        <div className={styles.computeInputComponent}>
            <div className={styles.col2}>
                <TextField
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        setTotalStorageAmount(numVal);
                    }}
                    placeholder={''}
                    value={totalStorageAmount || ''}
                    className={styles.keyField}
                    isDisabled={true}
                />
            </div>
            <div className={styles.col3}>
                <TextField
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        setIOPS(numVal);
                    }}
                    placeholder={''}
                    value={iops || ''}
                    className={styles.keyField}
                />
            </div>
            <div className={styles.col4}>
                <TextField
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        setThroughput(numVal);
                    }}
                    placeholder={''}
                    value={throughput || ''}
                    className={styles.keyField}
                />
            </div>
        </div>
    );
};

export default StoragePerfInput;
