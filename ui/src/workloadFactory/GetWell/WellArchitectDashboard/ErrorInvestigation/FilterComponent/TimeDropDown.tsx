/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useState, useEffect, useRef } from 'react';
import { DsTypography, DsCheckbox } from '@tlveng/wlm-ds';
import { DsButton } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import styles from './TimeDropDown.module.scss'; // you can replace this with SCSS
import {
    setSelectedErrorCodes,
    setSelectedErrorTags,
    setSelectedSeverity,
    setSelectedTimeFrame,
    updateTimeRangeField
} from '../../../../../store/workloadFactory/agenticAISlice';
import { DsSelectFsx, DsSelectItemProps } from '../../../../../common/FsxSelectField/fsxSelectField';
import { useAppSelector } from '../../../../../store/storeHooks';

export type TimeDropdownProps = {
    options: string[];
    dropDownType: string;
    width?: string;
    selectedValue: string;
};

const TimeDropdown = ({ options, dropDownType, width = 'auto', selectedValue }: TimeDropdownProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const { timeRange, noData, investigationDatesLoading, noErrorsDetected, selectedErrorTags } = useAppSelector(
        state => state.agenticAI
    );
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = investigationDatesLoading || errorInvestigationLoading;

    const [showOptions, setShowOptions] = useState(false);
    const [showCustomTimeOption, setShowCustomTimeOption] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>(['Compute', 'Storage', 'Network', 'Security']); // All tags selected by default (temp state)
    const [appliedTags, setAppliedTags] = useState<string[]>(['Compute', 'Storage', 'Network', 'Security']); // Applied tags (what shows in label)
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setShowOptions(false);
        setShowCustomTimeOption(false);
    }, [selectedValue]);

    useEffect(() => {
        if (dropDownType === 'tags' && selectedErrorTags) {
            setSelectedTags([...selectedErrorTags]);
            setAppliedTags([...selectedErrorTags]);
        }
    }, [selectedErrorTags, dropDownType]);

    const duration = [
        { id: '1', label: 'AM', value: 'AM' },
        { id: '2', label: 'PM', value: 'PM' }
    ];

    const timeOptionsArray = Array.from({ length: 12 }, (_, i) => {
        const hour = i + 1;
        const label = hour < 10 ? `0${hour}:00` : `${hour}:00`;
        return { id: hour.toString(), label, value: label };
    });

    const handleSelect = (option: string) => {
        if (option === 'Custom') {
            setShowCustomTimeOption(true);
            setShowOptions(false); // Close dropdown when opening custom
        } else {
            if (dropDownType === 'timeFrame') {
                dispatch(setSelectedTimeFrame(option));
            } else if (dropDownType === 'errorCodes') {
                dispatch(setSelectedErrorCodes(option));
            } else if (dropDownType === 'severity') {
                dispatch(setSelectedSeverity(option));
            }

            setShowOptions(false);
            setShowCustomTimeOption(false);
        }
    };

    const applyCustom = () => {
        const customLabel = `${timeRange.from} ${timeRange.fromPeriod} - ${timeRange.to} ${timeRange.toPeriod}`;
        dispatch(setSelectedTimeFrame(customLabel));
        setShowCustomTimeOption(false);
        setShowOptions(false);
    };

    const generateTagOptions = () => [
            { id: '1', label: t('databases.log-analyzer.Compute'), value: 'Compute' },
            { id: '2', label: t('databases.log-analyzer.Storage'), value: 'Storage' },
            { id: '3', label: t('databases.log-analyzer.Network'), value: 'Network' },
            { id: '4', label: t('databases.log-analyzer.Security'), value: 'Security' }
        ];

    const formatLabelForMultiSelectTags = () => {
        const totalTags = generateTagOptions().length;
        const selectedCount = appliedTags.length;

        if (selectedCount === 0) {
            return 'No tag selected';
        } if (selectedCount === totalTags) {
            return 'All error tags';
        } if (selectedCount === 1) {
            return '1 tag selected';
        } 
            return `${selectedCount} tags selected`;
        
    };

    const handleTagToggle = (tagValue: string) => {
        setSelectedTags(prev =>
            prev.includes(tagValue) ? prev.filter(value => value !== tagValue) : [...prev, tagValue]
        );
    };

    const handleSelectAllTags = () => {
        const allTagValues = generateTagOptions().map(tag => tag.value);
        setSelectedTags(prev => (prev.length === allTagValues.length ? [] : allTagValues));
    };

    const handleApplyTags = () => {
        setAppliedTags([...selectedTags]);
        dispatch(setSelectedErrorTags(selectedTags));
        setShowOptions(false);
    };

    const handleCancelTags = () => {
        setSelectedTags([...appliedTags]); // Reset to applied tags
        setShowOptions(false);
    };

    return (
        <div className={styles['time-dropdown']} ref={dropdownRef}>
            <div
                className={styles['time-toggle']}
                role="button"
                tabIndex={0}
                onClick={() => {
                    if (!loading && !noData && !noErrorsDetected) {
                        setShowOptions(!showOptions);
                    } else {
                        setShowOptions(false);
                    }
                }}
                onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ' ') && !loading && !noData && !noErrorsDetected) {
                        setShowOptions(!showOptions);
                        e.preventDefault();
                    }
                }}
            >
                <span>
                    <DsTypography
                        className={
                            loading || noData || noErrorsDetected
                                ? `${styles['selected-time']} ${styles.disabled}`
                                : styles['selected-time']
                        }
                        variant="Semibold_13"
                    >
                        {' '}
                        {dropDownType === 'tags' ? formatLabelForMultiSelectTags() : selectedValue}
                    </DsTypography>
                </span>
                <span
                    className={`${styles.icon} ${showOptions ? styles.rotated : ''} ${
                        noData || noErrorsDetected || loading ? styles.iconDisable : ''
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none">
                        <path d="M11.603 14.5C11.7769 14.483 11.9454 14.4173 12.0788 14.3029L16.2802 10.6995C16.5935 10.4307 16.5523 10.0281 16.2802 9.72634C16.008 9.42455 15.5009 9.42455 15.1456 9.72634L11.5021 12.8513L7.85442 9.72634C7.49915 9.42455 6.99199 9.42455 6.71983 9.72634C6.44766 10.0281 6.40651 10.4307 6.71983 10.6995L10.9212 14.3029C11.0546 14.4173 11.2231 14.483 11.397 14.5H11.603Z" />
                    </svg>
                </span>
            </div>

            {showOptions && (
                <div className={styles['dropdown-menu']} style={{ width }}>
                    {dropDownType === 'tags' ? (
                        <div className={styles.popup}>
                            <div className={styles.filterGrid}>
                                <div className={styles.column}>
                                    {/* Select All Option */}
                                    <DsCheckbox
                                        id="select-all-tags"
                                        title="Select All"
                                        isSelected={selectedTags.length === generateTagOptions().length}
                                        onSelect={handleSelectAllTags}
                                        className={styles.item}
                                        style={{ borderBottom: '1px solid var(--border)', width: '180px' }}
                                    />

                                    {/* Tag Options */}
                                    {generateTagOptions().map(tag => (
                                        <DsCheckbox
                                            id={tag.id}
                                            key={tag.id}
                                            title={tag.label}
                                            isSelected={selectedTags.includes(tag.value)}
                                            onSelect={() => handleTagToggle(tag.value)}
                                            className={styles.item}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className={styles.footer}>
                                <DsButton className={styles.buttonItem} type="text" onClick={handleApplyTags}>
                                    {t('databases.log-analyzer.apply')}
                                </DsButton>
                                <DsButton className={styles.buttonItem1} type="text" onClick={handleCancelTags}>
                                    {t('databases.log-analyzer.cancel')}
                                </DsButton>
                            </div>
                        </div>
                    ) : (
                        /* Regular dropdown options for non-tags */
                        options.map(option => (
                            <div
                                key={option}
                                className={`${styles['dropdown-option']} ${
                                    option === selectedValue ? styles.selected : ''
                                }`}
                                role="option"
                                tabIndex={0}
                                aria-selected={option === selectedValue}
                                onClick={() => handleSelect(option)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleSelect(option);
                                        e.preventDefault();
                                    }
                                }}
                            >
                                <DsTypography
                                    className={` ${option === selectedValue ? styles.selected : ''}`}
                                    variant="Regular_14"
                                >
                                    {option}
                                </DsTypography>
                            </div>
                        ))
                    )}
                </div>
            )}

            {showCustomTimeOption && (
                <div className={styles['custom-panel']}>
                    <div className={styles['time-range']}>
                        <div>
                            <DsTypography variant="Regular_14">From</DsTypography>
                            <div className={styles['custom-label']}>
                                <DsSelectFsx
                                    options={timeOptionsArray}
                                    title=""
                                    variant="Default"
                                    // In DsSelectFsx onSelect, use (option: DsSelectItemProps[]) => ...
                                    onSelect={(option: DsSelectItemProps[]) =>
                                        dispatch(updateTimeRangeField({ key: 'from', value: option[0].label }))
                                    }
                                    isCleanable={false}
                                    className={styles.timeSelect}
                                    selectedOptionIds={
                                        timeRange.from.length > 0
                                            ? timeOptionsArray
                                                  .filter(item => item.value === timeRange.from)
                                                  .map(item => item.id)
                                            : ['1']
                                    }
                                />

                                <DsSelectFsx
                                    options={duration}
                                    title=""
                                    variant="Default"
                                    onSelect={(option: DsSelectItemProps[]) =>
                                        dispatch(updateTimeRangeField({ key: 'fromPeriod', value: option[0].label }))
                                    }
                                    isCleanable={false}
                                    className={styles.periodSelect}
                                    selectedOptionIds={
                                        timeRange.fromPeriod.length > 0
                                            ? duration
                                                  .filter(item => item.value === timeRange.fromPeriod)
                                                  .map(item => item.id)
                                            : ['1']
                                    }
                                />
                            </div>
                        </div>
                        <div>
                            <DsTypography variant="Regular_14">To</DsTypography>
                            <div className={styles['custom-label']}>
                                <DsSelectFsx
                                    options={timeOptionsArray}
                                    title=""
                                    variant="Default"
                                    onSelect={(option: DsSelectItemProps[]) =>
                                        dispatch(updateTimeRangeField({ key: 'to', value: option[0].label }))
                                    }
                                    isCleanable={false}
                                    className={styles.timeSelect}
                                    selectedOptionIds={
                                        timeRange.to.length > 0
                                            ? timeOptionsArray
                                                  .filter(item => item.value === timeRange.to)
                                                  .map(item => item.id)
                                            : ['2']
                                    }
                                />

                                <DsSelectFsx
                                    options={duration}
                                    title=""
                                    variant="Default"
                                    onSelect={(option: DsSelectItemProps[]) =>
                                        dispatch(updateTimeRangeField({ key: 'toPeriod', value: option[0].label }))
                                    }
                                    isCleanable={false}
                                    className={styles.periodSelect}
                                    selectedOptionIds={
                                        timeRange.toPeriod.length > 0
                                            ? duration
                                                  .filter(item => item.value === timeRange.toPeriod)
                                                  .map(item => item.id)
                                            : ['1']
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    <div className={styles['custom-actions']}>
                        <DsTypography
                            style={{ borderRight: '1px solid var(--border)' }}
                            variant="Regular_14"
                            className={styles.button}
                            onClick={applyCustom}
                        >
                            {t('databases.log-analyzer.apply')}
                        </DsTypography>
                        <DsTypography
                            variant="Regular_14"
                            className={styles.button}
                            onClick={() => setShowCustomTimeOption(false)}
                        >
                            {t('databases.log-analyzer.cancel')}
                        </DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeDropdown;
