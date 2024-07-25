import { TextField } from '@netapp/design-system';
import styles from './ManualEC2.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import {
    setSecondarySelectedMachineDescription,
    setSelectedSecondaryManualInstanceType
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useMemo } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { formatSize, generateOptionType, sortListOfDict } from '../../../../utils/utilityFunctions';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';

const SecondaryManualEC2 = () => {
    const dispatch = useDispatch();
    const { manualSecondaryMachineDescription, selectedSecondaryManualInstanceType } = useAppSelector(
        state => state.exploreSavings
    );
    //Getting the Data from state
    const { instanceTypeData, instanceTypeLoading } = useAppSelector(
        state => state.exploreSavings.getManualInstanceTypeList
    );

    //Function to generate the options for Select Field
    const generateInstances = useMemo<optionType[]>((): optionType[] => {
        let options: optionType[] = [];
        let default_instance_item = null;

        instanceTypeData?.instanceTypes?.map((val, idx: number) => {
            const value = val?.instanceType || '';
            let label2 = '';
            if (val?.vCpus) {
                label2 += val?.vCpus + 'vCPU, ';
            }
            if (val?.ramInMib) {
                label2 += formatSize(val?.ramInMib, 'mib') + ' RAM, ';
            }
            if (val?.iopsInMbps) {
                label2 += val?.iopsInMbps + 'Mbps';
            }
            const option = generateOptionType(value, value, label2, false, '', val);

            if (value === DEAFULT_INSTANCE_VALUE) {
                default_instance_item = option;
            } else {
                options.push(option);
            }
        });

        options = sortListOfDict(options, 'value');
        if (default_instance_item) {
            options.unshift(default_instance_item);
        }

        return options;
    }, [instanceTypeData]);

    useEffect(() => {
        dispatch(setSelectedSecondaryManualInstanceType(generateInstances[0]));
    }, [generateInstances]);
    return (
        <div className={styles.manualEc2}>
            <div className={styles.firstRow}>
                <TextField
                    label={'Machine description'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        dispatch(setSecondarySelectedMachineDescription(e.target.value));
                    }}
                    value={manualSecondaryMachineDescription}
                    className={styles.setWidth}
                    isOptional
                />

                <SelectField
                    label={'Instance type'}
                    isClearable={false}
                    variant="two-lines"
                    defaultValue={
                        selectedSecondaryManualInstanceType
                            ? selectedSecondaryManualInstanceType
                            : [generateInstances[0]]
                    }
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedSecondaryManualInstanceType(selectedOptions));
                    }}
                    isSearchable={true}
                    isLoading={instanceTypeLoading}
                    options={generateInstances}
                    className={styles.setWidth}
                />
            </div>
        </div>
    );
};

export default SecondaryManualEC2;
