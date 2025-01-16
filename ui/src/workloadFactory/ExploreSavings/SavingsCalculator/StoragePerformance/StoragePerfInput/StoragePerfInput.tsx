import { TextField } from '@netapp/design-system';
import styles from './StoragePerfInput.module.scss';
import { useEffect, useState } from 'react';
import { useSearchDebounce } from '../../../../../common/hooks/useSearchDebounce';
import { useDispatch } from 'react-redux';
import { setStoragePerformance } from '../../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../../store/storeHooks';
import { GIB_IN_BYTE } from '../../../../../utils/consts';

const StoragePerfInput = ({ type }: any) => {
    const dispatch = useDispatch();
    const { selectedOnPremHostDetails, onPremFirstLoad }: any = useAppSelector(state => state.exploreSavings);

    useEffect(() => {
        if (selectedOnPremHostDetails?.nodeUsage) {
            let nodeRow = null;
            if (type === 'primaryData' || type === 'primaryLog') {
                nodeRow = selectedOnPremHostDetails?.nodeUsage?.find(
                    (node: any) => node?.nodeType?.toLowerCase() === 'primary'
                );
            } else {
                nodeRow = selectedOnPremHostDetails?.nodeUsage?.find(
                    (node: any) => node?.nodeType?.toLowerCase() === 'secondary'
                );
            }
            if (type === 'primaryData' || type === 'secondaryData') {
                setTotalStorageAmount(Number(nodeRow?.dataTotalStorage || 0) / GIB_IN_BYTE);
                setIOPS(nodeRow?.dataIops);
                setThroughput(nodeRow?.dataThroughput);
            } else if (type === 'primaryLog' || type === 'secondaryLog') {
                setTotalStorageAmount(Number(nodeRow?.logTotalStorage || 0) / GIB_IN_BYTE);
                setIOPS(nodeRow?.logIops);
                setThroughput(nodeRow?.logThroughput);
            }
        }
    }, [selectedOnPremHostDetails]);

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
                    value={totalStorageAmount}
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
                    value={iops}
                    className={styles.keyField}
                    isDisabled={onPremFirstLoad}
                />
            </div>
            <div className={styles.col4}>
                <TextField
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        setThroughput(numVal);
                    }}
                    placeholder={''}
                    value={throughput}
                    className={styles.keyField}
                    isDisabled={onPremFirstLoad}
                />
            </div>
        </div>
    );
};

export default StoragePerfInput;
