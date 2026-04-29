import React, { useCallback, useState } from 'react';
import { ReactComponent as FilterIcon } from '@netapp/icons/ic_filter.svg';
import classNames from 'classnames';
import { Button, Checkbox, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './FilterPanel.module.scss';
import { ColumnProps } from './Table';
import { ButtonBase } from '../ButtonBase/ButtonBase';
import useClickOutside from '../../hooks/useClickOutside';

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

    const onClickOutside = useCallback(() => {
        setIsOpen(false);
    }, [setIsOpen]);
    const ref = useClickOutside(onClickOutside);

    return (
        <div className={styles['filter-panel']} ref={ref}>
            <div className={styles['filter-content']}>
                {filterOptions &&
                    Array.isArray(filterOptions) &&
                    filterOptions.length > 0 &&
                    filterOptions.map(({ value, label, isDisabled = false, className }) => {
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
                    })}
            </div>
            <div className={styles['buttons-row']}>
                <ButtonBase
                    onClick={() => {
                        updateColumnFilter && updateColumnFilter(internalState);
                        setIsOpen(false);
                    }}
                >
                    Apply
                </ButtonBase>
                <ButtonBase
                    onClick={() => {
                        setInternalState({});
                        updateColumnFilter && updateColumnFilter({});
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
