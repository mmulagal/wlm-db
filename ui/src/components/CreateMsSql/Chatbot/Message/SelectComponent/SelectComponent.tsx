import { useState, useMemo } from 'react';
import styles from './SelectComponent.module.scss';
import { SelectField } from '@netapp/design-system';

type selectComponentPropType = {
    options: any;
    onChange: (key: string, val: string | number, label: string) => void;
    heading: string;
    selectKey: string;
};

const SelectComponent = ({ options, onChange, heading, selectKey }: selectComponentPropType) => {
    const [selected, setSelected] = useState('');
    const [searchText, setSearchText] = useState('');

    //@ts-ignore

    return (
        <div className={styles['select-component']}>
            <div className={styles['select-component-heading']}>{heading}</div>
            <SelectField
                label={''}
                isClearable={false}
                defaultValue={options[0]}
                onChange={(selectedOptions: any): void => {
                    onChange(selectKey, selectedOptions.value, selectedOptions.label);
                    setSelected(selectedOptions.value);
                }}
                isSearchable={options.length > 5}
                options={options}
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
