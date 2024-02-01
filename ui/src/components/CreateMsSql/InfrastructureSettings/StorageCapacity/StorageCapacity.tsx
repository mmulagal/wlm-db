import { useEffect, useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './StorageCapacity.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import AccordionError from '../../../../common/AccordionError/AccordionError';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setStorageCapacity, setStorageUnit } from '../../../../store/mssql/mssqlFormSlice';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';

const StorageCapacity = () => {
    const dispatch = useDispatch();

    const inputCapacity = useAppSelector((state: any) => state.mssqlForm.storageCapacity.capacity);
    const selectedUnit = useAppSelector((state: any) => state.mssqlForm.storageCapacity.unit);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    const [inputText, setInputText] = useState<any>(inputCapacity);
    const [textSearch, setTextSearch] = useSearchDebounce(1000);

    const units = ['TiB', 'GiB'];

    //Function to generate the options for Select Field
    const generateUnitsForStorage = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        units?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setStorageUnit(generateUnitsForStorage[1]));
            if (!inputCapacity) {
                setInputText('1024');
                // setTextSearch('1024');
                // dispatch(setStorageCapacity('1024'));
            } else {
                setInputText(inputCapacity);
            }
        }
        
    }, [generateUnitsForStorage]);

    useEffect(() => {
        if (inputCapacity) {
            setInputText(inputCapacity);
        }
    }, [inputCapacity]);

    //Set the Header text here
    const setHeader = () => {
        if (checkError()) {
            return <AccordionError />;
        }
        return (
            <Typography variant="Regular_14">
                {inputText} {selectedUnit?.label}
            </Typography>
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const re = /^[0-9\b]+$/;

        // if value is not blank, then test the regex

        if (e.target.value === '' || re.test(e.target.value)) {
            setInputText(e.target.value);
            setTextSearch(e.target.value);
            // setInput(e.target.value);
            dispatch(setIsWizardTouched(true));
        }
    };

    useEffect(() => {
        setTextSearch(inputText);
    }, [inputText]);

    useEffect(() => {
        dispatch(setStorageCapacity(textSearch));
    }, [textSearch]);

    const checkError = () => {
        if (
            (selectedUnit?.label === 'TiB' && (Number(inputText) > 130 || Number(inputText) < 1)) ||
            (selectedUnit?.label === 'GiB' && (Number(inputText) > 133120 || Number(inputText) < 120))
        ) {
            return GENERAL.ERROR_CAPACITY;
        }
    };

    const tooltipMessage = () => {
        return (
            <Typography variant="Regular_13" className={styles.infoMsg}>
                {GENERAL.CAPACITY_TOOLTIP}
            </Typography>
        );
    };

    return (
        <div className={styles['storage-capacity']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="16"
                title={<div className={CommonStyles.title}>{GENERAL.STORAGE_CAPACITY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.container}>
                            <TextField
                                label={GENERAL.CAPACITY}
                                info={tooltipMessage()}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    handleChange(e);
                                }}
                                value={inputText}
                                className={styles.textfield}
                                error={checkError()}
                            />
                            <SelectField
                                label={GENERAL.UNIT}
                                isClearable={false}
                                defaultValue={selectedUnit ? [selectedUnit] : [generateUnitsForStorage[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setStorageUnit(selectedOptions));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                isSearchable={generateUnitsForStorage.length > 5}
                                options={generateUnitsForStorage}
                                className={styles.selectField}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default StorageCapacity;
