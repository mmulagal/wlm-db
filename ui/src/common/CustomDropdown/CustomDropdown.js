import React, { useState, useEffect, useRef } from 'react';
import styles from './CustomDropdown.module.scss';
import { ReactComponent as CloseIcon } from '../../assets/close.svg';
import CustomPopover from '../CustomPopover/CustomPopover';
// import InfoIconPopover from '../../../../lib/components/general/InfoIcon/InfoIcon';
import { ReactComponent as SearchIcon } from '../../assets/search-icon2.svg';
import { ReactComponent as Check } from '../../assets/check.svg';

const CustomDropdown = ({
    options,
    title,
    addOption,
    addFieldValidation,
    isMultiSelect,
    addFilter,
    removeFilter,
    selectedFilters,
    setSearchFocus,
    onChange,
    DisabledToolTip,
    fromSearchBox,
    showSearch = false,
    noOptionMsg = ''
}) => {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(isMultiSelect ? [] : [options[0]]);
    const [isAddMode, setIsAddMode] = useState(false);
    const [newOption, setNewOption] = useState('');
    const [updatedOptions, setUpdatedOptions] = useState(options || []);
    const [hoverOption, setHoverOption] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [searchText, setSearchText] = useState('');
    const myRef = useRef();
    const popupRef = useRef();

    const handleClickOutside = e => {
        if (myRef && myRef.current && !myRef.current.contains(e.target) && !hoverOption && open) {
            handlePopup(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    });

    useEffect(() => {
        if (selectedFilters) {
            let defaultSelected = [];
            selectedFilters.map(
                filter =>
                    updatedOptions.filter(item => item.value === filter.value).length > 0 &&
                    defaultSelected.push({ label: filter.filter, value: filter.value })
            );
            setSelected(defaultSelected);
        }
    }, [selectedFilters]);

    useEffect(() => {
        addFieldValidation && setErrorMsg(addFieldValidation(newOption));
    }, [newOption]);

    useEffect(() => {
        setUpdatedOptions(options);
    }, [options]);

    useEffect(() => {
        setUpdatedOptions(options.filter(item => item.label.toLowerCase().includes(searchText.toLowerCase())));
    }, [searchText, open]);

    function handleAddClick(e) {
        e && e.stopPropagation();
        if (isAddMode && !errorMsg) {
            if (newOption) {
                const optionExists = updatedOptions.filter(option => option.label === newOption).length > 0;
                const optionChecked = optionExists && selected.filter(option => option.label === newOption).length > 0;
                if (!optionExists) {
                    setUpdatedOptions([...updatedOptions, { label: newOption, value: newOption }]);
                }
                if (!optionChecked || !optionExists) {
                    handleCheckBox({ label: newOption, value: newOption });
                }
                setNewOption('');
            }
            setIsAddMode(false);
        } else {
            setIsAddMode(true);
        }
    }

    function handleCheckBox(option) {
        let updatedSelected = [];
        if (selected.filter(item => item.value === option.value).length > 0) {
            updatedSelected = selected.filter(item => item.value !== option.value);
            removeFilter && removeFilter(option.label);
        } else {
            updatedSelected = isMultiSelect ? [...selected, option] : [option];
            if (addFilter) {
                if (!isMultiSelect) {
                    selected.map(filter => removeFilter(filter));
                }
                addFilter(option, title);
            }
        }
        setSelected(updatedSelected);
        setSearchText('');
        onChange && onChange(updatedSelected);
    }

    function handleSingleSelect(option) {
        setSelected([option]);
        onChange && onChange([option]);
        handlePopup(false);
    }

    function handlePopup(flag = !open) {
        setSearchFocus && setSearchFocus(flag);
        setOpen(flag);
        setErrorMsg('');
    }

    function handleAddInputChange(e) {
        if (e.charCode === 13) {
            handleAddClick();
        }
    }

    function handleClearButton(e) {
        e.stopPropagation();
        setIsAddMode(false);
        setNewOption('');
    }

    return (
        <div key={title} className={styles['custom-dropdown']} ref={myRef}>
            <div className={`${styles['input-box']} ${open ? styles.focused : ''}`} onClick={() => handlePopup()}>
                {!isMultiSelect && selected.length ? selected[0].label : title}
                {open ? <div className={styles['arrow-up']}></div> : <div className={styles['arrow-down']}></div>}
            </div>
            {open && (
                <div className={styles['option-list-container']}>
                    {showSearch && options.length > 5 ? (
                        <div className={styles['search-bar']}>
                            <SearchIcon />
                            <input
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                placeholder={`Search ${title}`}
                            />
                        </div>
                    ) : null}
                    {!options.length ? (
                        <div className={styles['no-option-message']}>{noOptionMsg || 'No Options'}</div>
                    ) : null}
                    <div className={styles['options-list']} ref={popupRef}>
                        {updatedOptions.map(option => (
                            <div
                                className={`${styles['options']} ${option.disabled ? styles.disabled : ''}`}
                                onMouseEnter={() => setHoverOption(option.value)}
                                onMouseLeave={() => setHoverOption(null)}
                                onClick={() => !isMultiSelect && handleSingleSelect(option)}
                            >
                                <CustomPopover
                                    fromSearchBox={true}
                                    CustomPopoverBody={<DisabledToolTip />}
                                    CustomPopoverTrigger={
                                        <>
                                            {isMultiSelect ? (
                                                <input
                                                    type="checkbox"
                                                    className={styles['option-checkbox']}
                                                    disabled={option.disabled}
                                                    onChange={() => handleCheckBox(option)}
                                                    checked={
                                                        selected.filter(item => item.value === option.value).length > 0
                                                    }
                                                />
                                            ) : (
                                                <div className={styles['check-icon']}>
                                                    {selected.filter(item => item.value === option.value).length >
                                                        0 && <Check />}
                                                </div>
                                            )}

                                            <span className={styles['option-text']} title={option.label}>
                                                {option.label}
                                            </span>
                                        </>
                                    }
                                    isPopoverOpen={option.disabled && hoverOption === option.value}
                                    disableTransition={true}
                                />
                            </div>
                        ))}
                    </div>
                    {addOption && (
                        <div
                            className={
                                styles[
                                    `add-option${isAddMode ? ' add-mode' : ''}${errorMsg ? ' failed-validation' : ''}`
                                ]
                            }
                            onClick={() => setIsAddMode(true)}
                        >
                            <div className={styles['add-icon']} onClick={e => handleAddClick(e)}>
                                +
                            </div>
                            {isAddMode ? (
                                <React.Fragment>
                                    <input
                                        type="text"
                                        autoFocus
                                        onKeyPress={e => handleAddInputChange(e)}
                                        onChange={e => setNewOption(e.target.value)}
                                    />
                                    {/* {errorMsg && <InfoIconPopover tooltipText={errorMsg} />} */}
                                    <button className={styles['clear-button']} onClick={e => handleClearButton(e)}>
                                        <CloseIcon width={10} height={10} />
                                    </button>
                                </React.Fragment>
                            ) : (
                                <span
                                    className={styles['add-text']}
                                    onClick={() => setIsAddMode(true)}
                                >{`Add ${title}`}</span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;
