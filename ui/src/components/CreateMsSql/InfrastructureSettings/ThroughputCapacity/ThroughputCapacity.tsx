import { useEffect, useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, Popover, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import styles from './ThroughputCapacity.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setThroughputValue } from '../../../../store/mssql/mssqlFormSlice';
import { selectFsxThroughput } from '../../MSSqlServer/MSSqlUtils';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const ThroughputCapacity = () => {
    const dispatch = useDispatch();
    const selectedThroughput = useAppSelector((state: any) => state.mssqlForm.throughput);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);
    const selectedExistingFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingName);

    const units = ['128 MBps', '256 MBps', '512 MBps', '1 GBps', '2 GBps', '3 GBps', '4 GBps'];

    const [isDisable, setIsDisable] = useState(false);

    //Function to generate the options for Select Field
    const generateThroughputUnits = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        units?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        dispatch(setThroughputValue(generateThroughputUnits[0]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateThroughputUnits]);

    useEffect(() => {
        if (selectedFsxnType === GENERAL.SELECT_EXISTING_FSX && selectedExistingFsxnName) {
            setIsDisable(true);
        } else {
            setIsDisable(false);
        }
        selectFsxThroughput(selectedFsxnType, selectedExistingFsxnName, units[0], dispatch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFsxnType, selectedExistingFsxnName]);

    //Set the Header text here
    const setHeader = () => {
        if (isDisable) {
            return (
                <Popover
                    popoverClass={styles['popover']}
                    children={GENERAL.THROUGHPUT_DISABLE_TEXT}
                    trigger="hover"
                    container={
                        <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                            {selectedThroughput?.label}
                        </Typography>
                    }
                />
            );
        } else {
            return <Typography variant="Regular_14">{selectedThroughput?.label}</Typography>;
        }
    };
    return (
        <div className={styles.container}>
            <AccordionCard
                isDisabled={isDisable}
                isExpandDisabled={isDisable}
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
                                defaultValue={selectedThroughput ? selectedThroughput : [generateThroughputUnits[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setThroughputValue(selectedOptions));
                                    dispatch(setIsWizardTouched(true));
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
