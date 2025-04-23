import React, { useCallback, useState } from 'react';
import styles from './FilterPanel.module.scss';
import { ReactComponent as FilterIcon } from '@netapp/icons/ic_filter.svg';
import { ColumnProps } from './Table';
import classNames from 'classnames';
import { ButtonBase } from '../ButtonBase/ButtonBase';
import useClickOutside from '../../hooks/useClickOutside';
import { Button, Checkbox, Popover } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';

export interface FilterPanelProps {
    column: ColumnProps;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const FilterPanel = ({
    column: { filterState, filterOptions, updateColumnFilter },
    setIsOpen
}: FilterPanelProps) => {
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
                                {label === '' ? GENERAL.NOT_AVAILABLE : label}
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
            isAppendedToBody={true}
            popoverClass={styles['filter-panel-wrapper']}
            placement={'bottom-end'}
            container={
                <Button
                    variant={'icon'}
                    className={styles['filter-button']}
                    isDisabled={isDisabled}
                    onClick={() => setIsOpen(prev => !prev)}
                >
                    <FilterIcon />
                </Button>
            }
            containerClass={classNames(styles['filter-trigger-button'], {
                [styles['opened']]: isOpen
            })}
        >
            <FilterPanel column={column} setIsOpen={setIsOpen} />
        </Popover>
    );
};
