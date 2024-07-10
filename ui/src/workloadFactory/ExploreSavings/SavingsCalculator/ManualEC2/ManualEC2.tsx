import { DsTypography, TextField } from '@netapp/design-system';
import styles from './ManualEC2.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import {
    setSelectedMachineDescription,
    setSelectedManualInstanceType,
    setSelectedManualServerEdition
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useMemo } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../utils/utilityFunctions';

const ManualEC2 = () => {
    const dispatch = useDispatch();
    const { manualMonthlyDescription, selectedManualServerEdition, selectedManualInstanceType } = useAppSelector(
        state => state.exploreSavings
    );

    //Function to generate the options for Select Field
    const generateSQLEditionList = useMemo<optionType[]>((): optionType[] => {
        const deploymentModel = [
            'SQL server Standard',
            'SQL server Enterprise',
            'SQL server Web',
            'SQL server Developer'
        ];
        const options: optionType[] = [];
        deploymentModel?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    //Function to generate the options for Select Field
    const generateInstanceTypeList = useMemo<optionType[]>((): optionType[] => {
        const instanceList = [
            { name: 'm5.xlarge', label: '4vCPU, 16 GiB RAM, 4750Mbps' },
            { name: 'm5.2xlarge', label: '8vCPU, 16 GiB RAM, 4750Mbps' }
        ];
        const options: optionType[] = [];
        instanceList?.map((val, idx: number) => {
            const option = generateOptionType(val?.name, val?.name, val?.label, false, '', val);
            options.push(option);
        });

        return options;
    }, []);
    return (
        <div className={styles.manualEc2}>
            <DsTypography variant="Semibold_14">{GENERAL.EC2_SPECIFICATIONS}</DsTypography>

            <div className={styles.firstRow}>
                <TextField
                    label={'Machine description'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        dispatch(setSelectedMachineDescription(e.target.value));
                    }}
                    value={manualMonthlyDescription}
                    className={styles.setWidth}
                />

                <SelectField
                    label={'SQL server edition'}
                    isClearable={false}
                    defaultValue={
                        selectedManualServerEdition ? selectedManualServerEdition : [generateSQLEditionList[0]]
                    }
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedManualServerEdition(selectedOptions));
                    }}
                    isSearchable={generateSQLEditionList.length > 5}
                    options={generateSQLEditionList}
                    className={styles.setWidth}
                />
            </div>

            <div>
                <SelectField
                    label={'Instance type'}
                    isClearable={false}
                    variant="two-lines"
                    defaultValue={
                        selectedManualInstanceType ? selectedManualInstanceType : [generateInstanceTypeList[0]]
                    }
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedManualInstanceType(selectedOptions));
                    }}
                    isSearchable={true}
                    options={generateInstanceTypeList}
                    className={styles.setWidth}
                />
            </div>
        </div>
    );
};

export default ManualEC2;
