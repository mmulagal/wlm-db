import { TextField } from '@netapp/design-system';
import styles from './ComputeInputComponent.module.scss';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { useEffect, useMemo, useState } from 'react';
import { useSearchDebounce } from '../../../../../common/hooks/useSearchDebounce';
import { useDispatch } from 'react-redux';
import {
    setOnPremNetworkPerformance,
    setOnPremStorageAndComputeInfo
} from '../../../../../store/workloadFactory/exploreSavingsSlice';
import { generateOptionType } from '../../../../../utils/utilityFunctions';
import { useAppSelector } from '../../../../../store/storeHooks';
import { NETWORK_PERFORMANCE_OPTIONS } from '../../../../../utils/consts';

const ComputeInputComponent = ({ data, index, printState }: any) => {
    const dispatch = useDispatch();

    useEffect(() => {
        if (data) {
            setNumberOfCpu(data?.noOfVcpusInUse);
            setMemory(data?.memory);
        }
    }, [data]);

    const [numberOfCpu, setNumberOfCpu] = useState<any>(null);

    const [numberOfCpuSearch, setNumberOfCpuSearch] = useSearchDebounce(1000);

    const { onPremNetworkPerformance }: any = useAppSelector(state => state.exploreSavings);

    //use effect for no of cpu details
    useEffect(() => {
        setNumberOfCpuSearch(numberOfCpu);
    }, [numberOfCpu]);

    useEffect(() => {
        if (numberOfCpuSearch !== null && numberOfCpuSearch !== undefined) {
            dispatch(
                setOnPremStorageAndComputeInfo({
                    type: data?.sqlInstanceName,
                    mode: 'noOfVcpusInUse',
                    value: numberOfCpuSearch
                })
            );
        }
    }, [numberOfCpuSearch]);

    const [memory, setMemory] = useState<any>(null);

    const [memorySearch, setMemorySearch] = useSearchDebounce(1000);

    //use effect for no of cpu details
    useEffect(() => {
        setMemorySearch(memory);
    }, [memory]);

    useEffect(() => {
        if (memorySearch !== null && memorySearch !== undefined) {
            dispatch(
                setOnPremStorageAndComputeInfo({
                    type: data?.sqlInstanceName,
                    mode: 'memory',
                    value: memorySearch
                })
            );
        }
    }, [memorySearch]);

    const generateNetworkPerfOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = ['Up to 10 Gbps', 'Above 10 Gbps'];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        if (!onPremNetworkPerformance) {
            dispatch(
                setOnPremNetworkPerformance(
                    data?.networkPerformance === 'upTo10'
                        ? generateNetworkPerfOptions[0]
                        : generateNetworkPerfOptions[1]
                )
            );
        }
    }, [generateNetworkPerfOptions]);

    return (
        <div className={styles.computeInputComponent}>
            <div className={styles.col2}>
                {printState && (
                    <div className={styles.mockInputClone}>
                        <div className={styles.inputField}>{numberOfCpu}</div>
                    </div>
                )}
                {!printState && (
                    <TextField
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setNumberOfCpu(numVal);
                        }}
                        placeholder={''}
                        value={numberOfCpu}
                        className={styles.keyField}
                    />
                )}
            </div>
            <div className={styles.col3}>
                {printState && (
                    <div className={styles.mockInputClone}>
                        <div className={styles.inputField}>{memory}</div>
                    </div>
                )}
                {!printState && (
                    <TextField
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setMemory(numVal);
                        }}
                        placeholder={''}
                        value={memory}
                        className={styles.keyField}
                    />
                )}
            </div>
            <div className={styles.col4}>
                <SelectField
                    isClearable={false}
                    onChange={(selectedOptions: any): void => {
                        dispatch(setOnPremNetworkPerformance(selectedOptions));
                        dispatch(
                            setOnPremStorageAndComputeInfo({
                                type: data?.sqlInstanceName,
                                mode: 'networkPerformance',
                                value: NETWORK_PERFORMANCE_OPTIONS?.[selectedOptions?.value] || 'upTo10'
                            })
                        );
                    }}
                    isDisabled={index !== 0}
                    isSearchable={false}
                    options={generateNetworkPerfOptions}
                    value={onPremNetworkPerformance}
                />
            </div>
        </div>
    );
};

export default ComputeInputComponent;
