import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import styles from './InstanceType.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { formatSize, generateOptionType } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setInstanceType } from '../../../../store/mssql/mssqlFormSlice';

const InstanceType = () => {
    const dispatch = useDispatch();

    //Getting the Data from state
    const { instanceTypeData, instanceTypeLoading } = useAppSelector(state => state.mssql.getInstanceTypeList);
    const selectedInstanceType = useAppSelector(state => state.mssqlForm.instanceType);

    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);

    //Function to generate the options for Select Field
    const generateInstances = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
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
            options.push(option);
        });

        return options;
    }, [instanceTypeData]);

    useEffect(() => {
        dispatch(setInstanceType(generateInstances[0]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateInstances]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        return <Typography variant="Regular_14">{selectedInstanceType?.label}</Typography>;
    };
    return (
        <div className={styles['instance-type']}>
            <AccordionCard
                isLoading={instanceTypeLoading}
                isDisabled={!credentialData || (credentialData && !credentialData.length)}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length)}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="14"
                title={<div className={CommonStyles.title}>{GENERAL.INSTANCE_TYPE}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.handleSelect}>
                            <SelectField
                                label={GENERAL.INSTANCE_TYPE}
                                isClearable={false}
                                defaultValue={selectedInstanceType ? [selectedInstanceType] : [generateInstances[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setInstanceType(selectedOptions));
                                }}
                                isSearchable={generateInstances.length > 5}
                                options={generateInstances}
                                variant="two-lines"
                                className={styles.changeColor}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default InstanceType;
