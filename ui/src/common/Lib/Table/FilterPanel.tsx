import React, { useCallback, useMemo, useState } from 'react';
import { ReactComponent as FilterIcon } from '@netapp/icons/ic_filter.svg';
import classNames from 'classnames';
import { Button, Checkbox, Popover, SearchInput } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './FilterPanel.module.scss';
import { ColumnProps } from './Table';
import { ButtonBase } from '../ButtonBase/ButtonBase';
import useClickOutside from '../../hooks/useClickOutside';

/** Show in-filter search when the option list is long (same threshold as other searchable dropdowns in the app). */
const FILTER_OPTION_SEARCH_MIN_COUNT = 5;

export interface FilterPanelProps {
    column: ColumnProps;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const FilterPanel = ({
    column: { filterState, filterOptions, updateColumnFilter },
    setIsOpen
}: FilterPanelProps) => {
    const { t } = useTranslation();
    const [internalState, setInternalState] = useState(filterState?.values || {});
    const [optionSearch, setOptionSearch] = useState('');

    const showOptionSearch = Boolean(
        filterOptions && Array.isArray(filterOptions) && filterOptions.length > FILTER_OPTION_SEARCH_MIN_COUNT
    );

    const visibleFilterOptions = useMemo(() => {
        if (!filterOptions || !Array.isArray(filterOptions) || filterOptions.length === 0) {
            return [];
        }
        if (!showOptionSearch || !optionSearch.trim()) {
            return filterOptions;
        }
        const q = optionSearch.trim().toLowerCase();
        return filterOptions.filter(({ value, label }) => {
            const displayText = (label === '' ? t('databases.general.not-available') : label).toLowerCase();
            return displayText.includes(q) || String(value).toLowerCase().includes(q);
        });
    }, [filterOptions, showOptionSearch, optionSearch, t]);

    const clearOptionSearch = useCallback(() => setOptionSearch(''), []);

    const onClickOutside = useCallback(() => {
        clearOptionSearch();
        setIsOpen(false);
    }, [clearOptionSearch, setIsOpen]);
    const ref = useClickOutside(onClickOutside);

    return (
        <div className={styles['filter-panel']} ref={ref}>
            {showOptionSearch && (
                <div className={styles['filter-search']}>
                    <SearchInput
                        className={styles['filter-search-input']}
                        isAlwaysOpen
                        value={optionSearch}
                        onChange={setOptionSearch}
                        placeholder={t('databases.general.filter-options-search-placeholder')}
                    />
                </div>
            )}
            <div className={styles['filter-content']}>
                {visibleFilterOptions.length > 0 ? (
                    visibleFilterOptions.map(({ value, label, isDisabled = false, className }) => {
                        const displayText = label === '' ? t('databases.general.not-available') : label;
                        return (
                            <Checkbox
                                key={value as string}
                                isDisabled={isDisabled}
                                isChecked={internalState[String(value)] || false}
                                className={classNames(styles['checkbox-container'], className)}
                                onChange={() =>
                                    setInternalState({
                                        ...internalState,
                                        [String(value)]: !internalState[String(value)]
                                    })
                                }
                            >
                                <span className={styles['filter-option-label']} title={displayText}>
                                    {displayText}
                                </span>
                            </Checkbox>
                        );
                    })
                ) : showOptionSearch && optionSearch.trim() ? (
                    <div className={styles['filter-no-matches']}>
                        {t('databases.general.filter-options-no-matches')}
                    </div>
                ) : null}
            </div>
            <div className={styles['buttons-row']}>
                <ButtonBase
                    onClick={() => {
                        updateColumnFilter && updateColumnFilter(internalState);
                        clearOptionSearch();
                        setIsOpen(false);
                    }}
                >
                    Apply
                </ButtonBase>
                <ButtonBase
                    onClick={() => {
                        setInternalState({});
                        updateColumnFilter && updateColumnFilter({});
                        clearOptionSearch();
                        setIsOpen(false);
                    }}
                >
                    Clear
                </ButtonBase>
            </div>
        </div>
    );
};

export const FilterButton = ({ column, isDisabled = false }: { column: ColumnProps; isDisabled: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover
            visible={isOpen}
            isAppendedToBody
            popoverClass={styles['filter-panel-wrapper']}
            placement="bottom-end"
            container={
                <Button
                    variant="icon"
                    className={styles['filter-button']}
                    isDisabled={isDisabled}
                    onClick={() => setIsOpen(prev => !prev)}
                >
                    <FilterIcon />
                </Button>
            }
            containerClass={classNames(styles['filter-trigger-button'], {
                [styles.opened]: isOpen
            })}
        >
            <FilterPanel column={column} setIsOpen={setIsOpen} />
        </Popover>
    );
};
