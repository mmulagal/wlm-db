import React, { useMemo, useState } from 'react';
import classNames from 'classnames';
import { Checkbox, Popover } from '@netapp/design-system';
import styles from './ManageColumns.module.scss';
import { ButtonBase } from '../ButtonBase/ButtonBase';
import { ReactComponent as AddIcon } from '../../../assets/ic_columns.svg';
import { ColumnProps } from './Table';

import { ColumnStateType } from './useTable';

import { HashTable } from '../../../utils/utilityFunctions';

interface ManageColumnsPanelProps extends ManageColumnsProps {
    setIsOpen: Function;
}

export const ManageColumnsPanel = ({
    allColumns,
    setIsOpen,
    columnsState,
    updateColumnState
}: ManageColumnsPanelProps) => {
    const [internalState, setInternalState] = useState<HashTable<ColumnStateType>>(columnsState);

    const isAllHidden = useMemo(() => {
        const hiddenColumnCount = Object.values(internalState).reduce(
            (acc: number, singleColumnState: ColumnStateType) => {
                if (singleColumnState.isHidden === true) {
                    acc++;
                }
                return acc;
            },
            0
        );
        return hiddenColumnCount === allColumns.length;
    }, [internalState, allColumns]);

    const handleSelectAllChange = (isChecked: boolean) => {
        const newState = { ...internalState };

        allColumns.forEach(({ id }) => {
            const columnState = newState[String(id)];
            if (!columnState?.isRemovalDisabled) {
                newState[String(id)] = {
                    ...columnState,
                    isHidden: !isChecked
                };
            }
        });

        setInternalState(newState);
    };

    const areAllSelectableColumnsChecked = useMemo(
        () =>
            allColumns.every(({ id }) => {
                const singleColumnState = internalState[String(id)];
                return singleColumnState?.isHidden !== true || singleColumnState?.isRemovalDisabled;
            }),
        [internalState, allColumns]
    );

    return (
        <div className={styles['manage-column-panel']}>
            {/* Keep Select All outside the scrollable div */}
            <div className={styles['select-all-container']}>
                <Checkbox
                    isChecked={areAllSelectableColumnsChecked}
                    onChange={() => handleSelectAllChange(!areAllSelectableColumnsChecked)}
                    className={`${styles['checkbox-container']} ${styles['select-all']}`}
                >
                    <span>Select All</span>
                </Checkbox>
            </div>
            <div className={styles['manage-content-content']}>
                {allColumns
                    .filter(({ Header }: any) => Header !== undefined && Header !== null && Header !== '')
                    .map(({ id, Header }) => {
                        const isChecked = !(internalState[String(id)] && internalState[String(id)].isHidden);
                        const singleColumnState = internalState[String(id)];
                        return (
                            <Checkbox
                                key={id}
                                isChecked={isChecked}
                                isDisabled={singleColumnState?.isRemovalDisabled}
                                className={styles['checkbox-container']}
                                onChange={() =>
                                    setInternalState({
                                        ...internalState,
                                        [String(id)]: {
                                            ...singleColumnState,
                                            isHidden: !singleColumnState?.isHidden
                                        }
                                    })
                                }
                            >
                                <span>{typeof Header === 'function' ? <Header /> : Header}</span>
                            </Checkbox>
                        );
                    })}
            </div>
            <div className={styles['buttons-row']}>
                <Popover
                    trigger={isAllHidden ? 'hover' : null}
                    containerClass={styles['action-button-wrapper']}
                    container={
                        <ButtonBase
                            className={styles['action-button']}
                            disabled={isAllHidden}
                            onClick={() => {
                                updateColumnState(internalState);
                                setIsOpen(false);
                            }}
                        >
                            Apply
                        </ButtonBase>
                    }
                >
                    You cant hide all columns
                </Popover>
                <ButtonBase
                    className={styles['action-button']}
                    onClick={() => {
                        setInternalState({});
                        setIsOpen(false);
                    }}
                >
                    Cancel
                </ButtonBase>
            </div>
        </div>
    );
};

export interface ManageColumnsProps {
    allColumns: ColumnProps[];
    updateColumnState: Function;
    columnsState: HashTable<ColumnStateType>;
    /** When a manual width is applied to the Manage Columns header cell */
    isManualWidth?: boolean;
}

export const ManageColumns = (props: ManageColumnsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const { isManualWidth } = props;
    return (
        <Popover
            visible={isOpen}
            isAppendedToBody
            popoverClass={styles['manage-columns-panel']}
            container={
                <ButtonBase
                    className={classNames(styles.button, {
                        [styles.opened]: isOpen
                    })}
                    onClick={() => setIsOpen(prev => !prev)}
                >
                    <AddIcon style={{ marginLeft: isManualWidth ? 20 : 0 }} />
                </ButtonBase>
            }
            containerClass={styles.base}
        >
            <ManageColumnsPanel {...props} setIsOpen={setIsOpen} />
        </Popover>
    );
};
