import { DsTypography, TextField } from '@netapp/design-system';
import styles from './ComputeInputComponent.module.scss';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { useEffect, useMemo, useState } from 'react';
import { useSearchDebounce } from '../../../../../common/hooks/useSearchDebounce';
import { useDispatch } from 'react-redux';
import {
    setComputeInformation,
    setOnPremNetworkPerformance
} from '../../../../../store/workloadFactory/exploreSavingsSlice';
import { formatFractionalNumber, generateOptionType } from '../../../../../utils/utilityFunctions';
import { GIB_IN_BYTE } from '../../../../../utils/consts';
import { useAppSelector } from '../../../../../store/storeHooks';

const ComputeInputComponent = ({ data, index }: any) => {
    const dispatch = useDispatch();

    const [numberOfCpu, setNumberOfCpu] = useState<any>(data?.noOfVcpusInUse);

    const [numberOfCpuSearch, setNumberOfCpuSearch] = useSearchDebounce(1000);

    const { onPremNetworkPerformance }: any = useAppSelector(state => state.exploreSavings);

    //use effect for no of cpu details
    useEffect(() => {
        setNumberOfCpuSearch(numberOfCpu);
    }, [numberOfCpu]);

    useEffect(() => {
        dispatch(
            setComputeInformation({
                type: data?.sqlInstanceName,
                mode: 'noOfVcpusInUse',
                value: numberOfCpuSearch
            })
        );
    }, [numberOfCpuSearch]);

    const [memory, setMemory] = useState<any>(Number(data?.memory || 0) / GIB_IN_BYTE);

    const [memorySearch, setMemorySearch] = useSearchDebounce(1000);

    //use effect for no of cpu details
    useEffect(() => {
        setMemorySearch(memory);
    }, [memory]);

    useEffect(() => {
        dispatch(
            setComputeInformation({
                type: data?.sqlInstanceName,
                mode: 'memory',
                value: memorySearch
            })
        );
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
        if (data?.networkPerformance) {
            dispatch(
                setOnPremNetworkPerformance(
                    data?.networkPerformance === 'upTo10'
                        ? generateNetworkPerfOptions[0]
                        : generateNetworkPerfOptions[1]
                )
            );
        }
    }, [generateNetworkPerfOptions]);

    useEffect(() => {
        setNumberOfCpu(data?.noOfVcpusInUse);
        setMemory(formatFractionalNumber(Number(data?.memory || 0) / GIB_IN_BYTE, 3));
    }, [data]);

    return (
        <div className={styles.computeInputComponent}>
            <div className={styles.col2}>
                <TextField
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        setNumberOfCpu(numVal);
                    }}
                    placeholder={''}
                    value={numberOfCpu}
                    className={styles.keyField}
                />
            </div>
            <div className={styles.col3}>
                <TextField
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        setMemory(numVal);
                    }}
                    placeholder={''}
                    value={memory}
                    className={styles.keyField}
                />
            </div>
            <div className={styles.col4}>
                <SelectField
                    isClearable={false}
                    onChange={(selectedOptions: any): void => {
                        dispatch(setOnPremNetworkPerformance(selectedOptions));
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
