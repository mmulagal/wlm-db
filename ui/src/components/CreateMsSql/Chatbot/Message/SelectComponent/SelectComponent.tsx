import { useState, useEffect, useMemo } from 'react';
import styles from './SelectComponent.module.scss';
import { SelectField } from '@netapp/design-system';
import { generateOptionType } from '../../../../../utils/utilityFunctions';

type selectComponentPropType = {
    options: any;
    onChange: (key: string, val: string | number, label: string) => void;
    heading: string;
    selectKey: string;
    paramObj: any;
    allowCreate?: boolean;
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
    allowCreate = false
}: selectComponentPropType) => {
    const [selected, setSelected] = useState('');
    const [optionsToShow, setOptionsToShow] = useState<any>([]);
    const [isCreating, setIsCreating] = useState(false);

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
            <div className={styles['select-component-heading']}>{heading}</div>
            <SelectField
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
            />
            {/* {options.length > 4 && (
                <div className={styles['search-container']}>
                    <input className={styles['search-input']} onChange={e => setSearchText(e.target.value)} />
                    <SearchIcon className={styles['search-icon']} />
                </div>
            )}
            <div className={styles['select-list-container']}>
                {filteredOptions.map((item: any, idx: number) => {
                    return (
                        <div className={styles['select-component-item']} key={`option-${idx}`}>
                            <button
                                className={`${styles['select-button']} ${
                                    selected === item.value ? styles['selected'] : ''
                                }`}
                                onClick={() => {
                                    onChange(selectKey, item.value, item.label);
                                    setSelected(item.value);
                                }}
                            ></button>
                            <div className={styles['select-button-text']}>
                                <div className={selectKey === 'imageId' ? styles['first-line'] : ''}>
                                    {item.label || item.value}
                                </div>
                                {selectKey === 'imageId' && (
                                    <div className={styles['second-line']} title={item.value}>
                                        {item.value}
                                    </div>
                                )}
                                {selectKey === 'imageId' && (
                                    <div
                                        className={styles['third-line']}
                                        title={`Virtualization: ${item.metadata.virtualization}    ENA enabled: ${item.metadata.enaEnabled}    Root device type: ${item.metadata.rootDeviceType}`}
                                    >
                                        <span
                                            className={styles['second-line-span']}
                                        >{`Virtualization: ${item.metadata.virtualization}`}</span>
                                        <span
                                            className={styles['second-line-span']}
                                        >{`ENA enabled: ${item.metadata.enaEnabled}`}</span>
                                        <span
                                            className={styles['second-line-span']}
                                        >{`Root device type: ${item.metadata.rootDeviceType}`}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div> */}
        </div>
    );
};

export default SelectComponent;
