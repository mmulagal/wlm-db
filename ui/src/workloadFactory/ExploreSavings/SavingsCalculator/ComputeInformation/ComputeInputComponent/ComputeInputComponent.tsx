import { DsTypography, TextField } from '@netapp/design-system';
import styles from './ComputeInputComponent.module.scss';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { useEffect, useMemo, useState } from 'react';
import { useSearchDebounce } from '../../../../../common/hooks/useSearchDebounce';
import { useDispatch } from 'react-redux';
import { setComputeInformation } from '../../../../../store/workloadFactory/exploreSavingsSlice';
import { generateOptionType } from '../../../../../utils/utilityFunctions';
import { useAppSelector } from '../../../../../store/storeHooks';

const ComputeInputComponent = ({ type }: any) => {
    const { computeInformation } = useAppSelector(state => state.exploreSavings);
    const dispatch = useDispatch();

    const [numberOfCpu, setNumberOfCpu] = useState<any>(null);

    const [numberOfCpuSearch, setNumberOfCpuSearch] = useSearchDebounce(300);

    //use effect for no of cpu details
    useEffect(() => {
        setNumberOfCpuSearch(numberOfCpu);
    }, [numberOfCpu]);

    useEffect(() => {
        dispatch(
            setComputeInformation({
                type: type,
                mode: 'vCPUsInUse',
                value: numberOfCpuSearch
            })
        );
    }, [numberOfCpuSearch]);

    const [memory, setMemory] = useState<any>(null);

    const [memorySearch, setMemorySearch] = useSearchDebounce(300);

    //use effect for no of cpu details
    useEffect(() => {
        setMemorySearch(memory);
    }, [memory]);

    useEffect(() => {
        dispatch(
            setComputeInformation({
                type: type,
                mode: 'memory',
                value: memorySearch
            })
        );
    }, [memorySearch]);

    const [dropDownValue, setDropdownValue] = useState<any>(null);

    const generateNetworkPerfOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = ['Up to 10 GiB', 'Above 10 GiB'];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        if (!computeInformation?.type?.networkPerformance) {
            dispatch(
                setComputeInformation({
                    type: type,
                    mode: 'networkPerformance',
                    value: generateNetworkPerfOptions[0]
                })
            );
        }
    }, [generateNetworkPerfOptions]);
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
                    // value={generateOptionType(dropDownValue, dropDownValue, '', false, '')}
                    onChange={(selectedOptions: any): void => {
                        setDropdownValue(selectedOptions);
                        dispatch(
                            setComputeInformation({
                                type: type,
                                mode: 'networkPerformance',
                                value: selectedOptions
                            })
                        );
                    }}
                    isSearchable={false}
                    options={generateNetworkPerfOptions}
                    defaultValue={
                        computeInformation?.type?.networkPerformance
                            ? [computeInformation?.type?.networkPerformance]
                            : [generateNetworkPerfOptions[0]]
                    }
                />
            </div>
        </div>
    );
};

export default ComputeInputComponent;
