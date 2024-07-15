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
import { formatSize, generateOptionType, sortListOfDict } from '../../../../utils/utilityFunctions';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';

const ManualEC2 = () => {
    const dispatch = useDispatch();
    const { manualMonthlyDescription, selectedManualServerEdition, selectedManualInstanceType } = useAppSelector(
        state => state.exploreSavings
    );
    //Getting the Data from state
    const { instanceTypeData, instanceTypeLoading } = useAppSelector(
        state => state.exploreSavings.getManualInstanceTypeList
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
                    defaultValue={selectedManualInstanceType ? selectedManualInstanceType : [generateInstances[0]]}
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedManualInstanceType(selectedOptions));
                    }}
                    isSearchable={true}
                    options={generateInstances}
                    className={styles.setWidth}
                />
            </div>
        </div>
    );
};

export default ManualEC2;
