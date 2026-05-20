import { DsTypography, TextField } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import styles from './ManualEC2.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import {
    setSelectedMachineDescription,
    setSelectedManualInstanceType
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { formatSize, generateOptionType, sortListOfDict } from '../../../../utils/utilityFunctions';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

interface ManualEC2Props {
    printState?: boolean;
}

const ManualEC2 = ({ printState = false }: ManualEC2Props) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { manualMonthlyDescription, selectedManualInstanceType } = useAppSelector(state => state.exploreSavings);
    // Getting the Data from state
    const { instanceTypeData, instanceTypeLoading } = useAppSelector(
        state => state.exploreSavings.getManualInstanceTypeList
    );

    const [textSearch, setTextSearch] = useSearchDebounce(500);

    const [machineDesc, setMachineDesc] = useState('');

    // Use effect for machine description
    useEffect(() => {
        setTextSearch(machineDesc);
    }, [machineDesc]);

    useEffect(() => {
        dispatch(setSelectedMachineDescription(textSearch));
    }, [textSearch]);

    // Function to generate the options for Select Field
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
        const isPresent = instanceTypeData?.instanceTypes?.filter(
            (val: any) => val?.instanceType === selectedManualInstanceType?.value
        );
        if (!selectedManualInstanceType || !isPresent?.length) {
            dispatch(setSelectedManualInstanceType(generateInstances[0]));
        }
    }, [generateInstances]);
    return (
        <div className={styles.manualEc2}>
            <DsTypography variant="Semibold_14">{GENERAL.EC2_SPECIFICATIONS}</DsTypography>

            <div className={styles.firstRow}>
                {!printState && (
                    <TextField
                        label={t('databases.explore-savings.manual-machine-description')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setMachineDesc(e.target.value);
                        }}
                        value={machineDesc}
                        className={`${styles.setWidth} savings-calculator-input-fields`}
                        isOptional
                    />
                )}
                {printState && (
                    <div className={`${CommonStyles.mockInputClone} ${styles.setWidth}`}>
                        <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                            {t('databases.explore-savings.manual-machine-description')}
                        </DsTypography>
                        <div className={CommonStyles.inputField}>{machineDesc}</div>
                    </div>
                )}

                {!printState && (
                    <SelectField
                        label={t('databases.explore-savings.manual-instance-type')}
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
                )}
                {printState && (
                    <div className={`${CommonStyles.mockInputClone} ${styles.setWidth}`}>
                        <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                            {t('databases.explore-savings.manual-instance-type')}
                        </DsTypography>
                        <div className={CommonStyles.inputField}>{selectedManualInstanceType?.value || ''}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualEC2;
