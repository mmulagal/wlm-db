import { DsTypography } from '@netapp/design-system';
import { useEffect, useMemo } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';
import styles from './ManualFSXEC2.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { formatSize, generateOptionType, sortListOfDict } from '../../../../utils/utilityFunctions';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';
import { setSelectedManualInstanceType } from '../../../../store/workloadFactory/exploreSavingsSlice';

const ManualFSXEC2 = () => {
    const { selectedManualInstanceType } = useAppSelector(state => state.exploreSavings);
    // Getting the Data from state
    const { instanceTypeData, instanceTypeLoading } = useAppSelector(
        state => state.exploreSavings.getManualInstanceTypeList
    );
    const dispatch = useDispatch();

    const generateInstances = useMemo<optionType[]>((): optionType[] => {
        let options: optionType[] = [];
        let default_instance_item = null;

        instanceTypeData?.instanceTypes?.map((val, idx: number) => {
            const value = val?.instanceType || '';
            let label2 = '';
            if (val?.vCpus) {
                label2 += `${val?.vCpus}vCPU, `;
            }
            if (val?.ramInMib) {
                label2 += `${formatSize(val?.ramInMib, 'mib')} RAM, `;
            }
            if (val?.iopsInMbps) {
                label2 += `${val?.iopsInMbps}Mbps`;
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
        if (!selectedManualInstanceType) dispatch(setSelectedManualInstanceType(generateInstances[0]));
    }, [generateInstances]);
    return (
        <div className={styles.manualFSXEC2}>
            <DsTypography variant="Semibold_14">EC2 specifications</DsTypography>
            <SelectField
                label="Instance type"
                isClearable={false}
                variant="two-lines"
                value={selectedManualInstanceType}
                onChange={(selectedOptions: any): void => {
                    dispatch(setSelectedManualInstanceType(selectedOptions));
                }}
                isLoading={instanceTypeLoading}
                isSearchable
                options={generateInstances}
                className={`${styles.setWidth} savings-calculator-input-fields`}
            />
        </div>
    );
};

export default ManualFSXEC2;
