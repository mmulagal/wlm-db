import { useState, useEffect, useMemo } from 'react';
import styles from './SelectComponent.module.scss';
import { Button, SelectField, Typography } from '@netapp/design-system';
import { generateOptionType, openCredentialTab } from '../../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setSuggestionBubbles } from '../../../../../store/chatbot/chatbotSlice';
import { GENERAL } from '../../../../../utils/appConstants';

type selectComponentPropType = {
    options: any;
    onChange: (key: string, val: string | number, label: string) => void;
    heading: string;
    selectKey: string;
    paramObj: any;
    allowCreate?: boolean;
    activeField?: any;
    handleSelectButtonClicked: (paramObj: any) => void;
    link?: any;
};

const delay = () => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve('');
        }, 2000);
    });
};

const SelectComponent = ({
    options,
    onChange,
    heading,
    selectKey,
    paramObj,
    allowCreate = false,
    activeField,
    handleSelectButtonClicked,
    link
}: selectComponentPropType) => {
    const [selected, setSelected] = useState('');
    const [optionsToShow, setOptionsToShow] = useState<any>([]);
    const [isCreating, setIsCreating] = useState(false);
    const dispatch = useDispatch();

    //@ts-ignore
    useEffect(() => {
        setOptionsToShow(
            options.map((item: any) => {
                return { label: item.label || item.value, value: item.value };
            })
        );
    }, [options]);

    useEffect(() => {
        if (options.length && !paramObj.hasOwnProperty(selectKey)) {
            setSelected(options[0].value);
            onChange(selectKey, options[0].value, options[0].label);
        }
    }, [options, paramObj]);

    useEffect(() => {
        if (options.length < 10) {
            dispatch(
                setSuggestionBubbles({
                    list: optionsToShow,
                    onBubbleClick: (label: string, value: string) => {
                        onChange(selectKey, value, label);
                        setSelected(value);
                        handleSelectButtonClicked({ ...paramObj, [selectKey]: { label: label, value: value } });
                        dispatch(
                            setSuggestionBubbles({
                                list: []
                            })
                        );
                    }
                })
            );
        }
    }, [options, optionsToShow]);

    const addNewOption = async (option: any) => {
        setIsCreating(true);
        const updatedOptions = [...optionsToShow, { label: option, value: option }];
        await delay();
        setOptionsToShow(updatedOptions);
        setIsCreating(false);
        return generateOptionType(option, option, '', false, '');
    };

    return (
        <div className={styles['select-component']}>
            <div className={styles['select-component-heading']}>
                <Typography variant="Regular_14">{heading}</Typography>
                {link && (
                    <Typography className={styles.link} variant="Regular_14">
                        {link.description}{' '}
                        <Button
                            Component="button"
                            onClick={() => {
                                if (link.path === '/credentials') {
                                    openCredentialTab();
                                }
                            }}
                            variant="text"
                        >
                            {GENERAL.CREDENTIAL}
                        </Button>
                    </Typography>
                )}
            </div>
            {options.length >= 10 || options.length === 0 ? (
                <div className={styles['dropdown-container']}>
                    <SelectField
                        id={selectKey}
                        label={''}
                        isClearable={false}
                        defaultValue={options[0]}
                        isCreatingOption={isCreating}
                        isOptionsAddingEnabled={allowCreate}
                        //@ts-ignore
                        onCreateOption={addNewOption}
                        onChange={(selectedOptions: any): void => {
                            onChange(selectKey, selectedOptions.value, selectedOptions.label);
                            setSelected(selectedOptions.value);
                        }}
                        isSearchable={optionsToShow.length > 5 || allowCreate}
                        options={optionsToShow}
                        className={`${styles['select-field-container']} ${
                            activeField === selectKey ? styles['select-component-highlight'] : ''
                        }`}
                    />
                    <Button
                        variant="primary"
                        onClick={() => handleSelectButtonClicked(paramObj)}
                        className={styles['add-btn']}
                    >
                        Add
                    </Button>
                </div>
            ) : null}
        </div>
    );
};

export default SelectComponent;
