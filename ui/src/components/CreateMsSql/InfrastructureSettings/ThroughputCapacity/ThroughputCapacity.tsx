import { useEffect, useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import styles from './ThroughputCapacity.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setThroughputValue } from '../../../../store/mssql/mssqlFormSlice';

const ThroughputCapacity = () => {
    const dispatch = useDispatch();
    const selectedThroughput = useAppSelector((state: any) => state.mssqlForm.throughput);
    const units = ['128 MBps', '256 MBps', '512 MBps', '1 GBps', '2 GBps', '3 GBps', '4 GBps'];

    //Function to generate the options for Select Field
    const generateThroughputUnits = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        units?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        dispatch(setThroughputValue(generateThroughputUnits[0]));
    }, [generateThroughputUnits]);
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{selectedThroughput?.label}</Typography>;
    };
    return (
        <div className={styles.container}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="18"
                title={<div className={CommonStyles.title}>{GENERAL.THROUGHPUT_CAPACITY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.selectField}>
                            <SelectField
                                label={GENERAL.THROUGHPUT}
                                isClearable={false}
                                defaultValue={[generateThroughputUnits[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setThroughputValue(selectedOptions));
                                }}
                                isSearchable={false}
                                options={generateThroughputUnits}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default ThroughputCapacity;
