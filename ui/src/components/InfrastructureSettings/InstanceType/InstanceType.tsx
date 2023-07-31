import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import styles from './InstanceType.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { setInstanceType } from '../../../store/mssql/mssqlFormSlice';

const InstanceType = () => {
    const dispatch = useDispatch();
    const selectedInstanceType = useAppSelector((state: any) => state.mssqlForm.instanceType);

    //Mock data to be removed later
    const instances = [
        { label1: 'm5.large', value: 'm5-large', label2: '4vCPU, 16GiB RAM' },
        { label1: 'm6.large', value: 'm6.large', label2: '4vCPU, 16GiB RAM' }
    ];

    //Function to generate the options for Select Field
    const generateInstances = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        instances?.map((val, idx: number) => {
            const option = generateOptionType(val.value, val.label1, val.label2, false, '');
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        dispatch(setInstanceType(generateInstances[0]));
    }, [generateInstances]);

    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{selectedInstanceType?.label}</Typography>;
    };
    return (
        <div className={styles['instance-type']}>
            <AccordionCard
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
