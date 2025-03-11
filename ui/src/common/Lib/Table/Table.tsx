import React, {
    Component,
    MouseEventHandler,
    ReactNode,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { ReactComponent as SortIcon } from '@netapp/icons/ic_sort.svg';
import { ReactComponent as ArrowDownIcon } from '@netapp/icons/ic_arrow_down.svg';
import { ReactComponent as ArrowUpIcon } from '@netapp/icons/ic_arrow_up.svg';
import { ReactComponent as FileIcon } from '@netapp/icons/ic_file.svg';
import { ReactComponent as SearchIcon } from '@netapp/icons/ic_search.svg';
import get from 'lodash/get';
import styles from './Table.module.scss';
import { FilterButton } from './FilterPanel';
import { PaginationPanel } from './PaginationPanel';

import classNames from 'classnames';

import { css } from '@emotion/css';

import {
    ColumnFilterStateType,
    ColumnStateType,
    FilterStateType,
    rowDataType,
    RowsStateType,
    SortOrderType,
    SortStateType
} from './useTable';
import _isString from 'lodash/isString';

import { useResizeColumn } from './useResizeColumns';
import { Button, DsTypography, TooltipInfo } from '@netapp/design-system';
import useHover from '../../hooks/useHover';
import { HashTable } from '../../../utils/utilityFunctions';

interface renderCellValueProps {
    column: ColumnProps;
    data: rowDataType;
    updateRowState: Function;
    rowsState: RowsStateType;
    isRowHovered: boolean;
}

const renderCellValue = ({ column, data, updateRowState, rowsState, isRowHovered }: renderCellValueProps) => {
    const value = get(data, column.accessor, '');
    if (column.renderCell) {
        return column.renderCell(value, data, {
            updateRowState,
            rowsState,
            isRowHovered
        });
    } else {
        return (
            <DsTypography color="unset" variant="Regular_14" isEllipsis title={_isString(value) ? value : ''}>
                {value}
            </DsTypography>
        );
    }
};

interface RowsProps {
    columns: ColumnProps[];
    data: rowDataType;
    updateRowState: Function;
    rowsState: HashTable<RowsStateType>;
    ExpandedRow?: typeof React.Component;
    textFilter: string;
    selectionState: SelectionStateType;
    isDoubleRow: boolean;
    isRowExpandedInSameLevel: boolean;
}

const Row = ({
    columns,
    data,
    updateRowState,
    rowsState,
    ExpandedRow,
    textFilter,
    selectionState,
    isDoubleRow,
    isRowExpandedInSameLevel = false
}: RowsProps) => {
    const { className = '', isLoading = false, isDisabled, selectionProps, ...cellProps } = data.cellProps || {};
    const currentRowState = rowsState[data.id];
    const isSelected = !!selectionState?.rows[data.id];
    const { hoverParentProps, isHovered: isRowHovered } = useHover();

    return (
        <>
            <div
                key={data.id}
                className={classNames(styles['row'], {
                    [styles['disabled-row']]: isDisabled,
                    [styles['highlighted-row']]: currentRowState?.isExpanded || isSelected
                })}
                {...hoverParentProps}
            >
                {columns.map((column, index: number) => {
                    const cellValue = renderCellValue({
                        column,
                        data,
                        updateRowState,
                        rowsState,
                        isRowHovered
                    });
                    const { className: columnClassName = '' } = column;
                    return (
                        <span
                            className={classNames(styles['cell'], className, columnClassName, styles[`col-${index}`], {
                                [styles['last-col']]: index === columns.length - 1,
                                [styles['sticky']]: column?.isSticky,
                                [styles['high-row']]: isDoubleRow
                            })}
                            key={column.id}
                            {...cellProps}
                        >
                            {isLoading ? <div className={styles['skeleton']} /> : cellValue}
                        </span>
                    );
                })}
                {currentRowState?.isExpanded && !isRowExpandedInSameLevel && ExpandedRow && (
                    <div className={styles['expanded-row-section']} style={{ gridColumn: `1 / ${columns.length + 1}` }}>
                        <ExpandedRow columns={columns} rowData={data} rowsState={rowsState} textFilter={textFilter} />
                    </div>
                )}
            </div>
            {currentRowState?.isExpanded && isRowExpandedInSameLevel && ExpandedRow && (
                <div className={styles['expanded-row-section']} style={{ gridColumn: `1 / ${columns.length + 1}` }}>
                    <ExpandedRow columns={columns} rowData={data} rowsState={rowsState} textFilter={textFilter} />
                </div>
            )}
        </>
    );
};

const HeaderCell = ({
    column,
    isExternalFilter,
    index,
    isLast,
    columnSortState,
    isLazyLoading,
    setResizedState
}: {
    column: ColumnProps;
    isExternalFilter: boolean;
    index: number;
    isLast: boolean;
    columns: ColumnProps[];
    columnSortState?: SortOrderType;
    isLazyLoading: boolean;
    setResizedState: React.Dispatch<React.SetStateAction<HashTable<string>>>;
}) => {
    const {
        isSortable,
        Header,
        toggleSort,
        filterState,
        filterOptions,
        info,
        infoProps = {},
        id,
        className = '',
        isSticky = false
    } = column;
    const { columnRef, resizeRef } = useResizeColumn(id, setResizedState);
    return (
        <div
            className={classNames(styles['header-cell'], styles[`col-${index}`], className, {
                [styles['last-col']]: isLast,
                [styles['sticky']]: isSticky
            })}
            key={id}
            ref={columnRef}
        >
            {info && (
                <TooltipInfo isAppendedToBody={true} className={styles['table-header-tooltip']} {...infoProps}>
                    {info}
                </TooltipInfo>
            )}
            <DsTypography variant={'Semibold_14'} isEllipsis={true} className={styles['header-name']}>
                <span>{typeof Header === 'function' ? <Header /> : Header}</span>
                <span>{filterState?.activeCount ? ` (${filterState.activeCount})` : ''}</span>
            </DsTypography>
            {((filterOptions && !isExternalFilter) || isSortable) && (
                <div className={styles['filter-sort-wrapper']}>
                    {filterOptions && !isExternalFilter && <FilterButton isDisabled={isLazyLoading} column={column} />}
                    {isSortable && (
                        <SortButton
                            isDisabled={isLazyLoading}
                            handleSort={toggleSort}
                            columnSortState={columnSortState || null}
                        />
                    )}
                </div>
            )}
            <div className={styles['right-border']} ref={resizeRef} />
        </div>
    );
};

const useHorizontalScroll = (columns: ColumnProps[], pagesCount: number) => {
    const tableBodyRef = useRef<HTMLDivElement | null>(null);
    const tableHeaderRef = useRef<HTMLDivElement | null>(null);
    const [scrollWidth, setScrollWidth] = useState<number>(0);

    const tableBodyCallbackRef = useCallback(
        (node: HTMLDivElement) => {
            if (node !== null && columns.length) {
                tableBodyRef.current = node;
                setScrollWidth(node.scrollWidth);
            }
        },
        [columns.length]
    );

    useLayoutEffect(() => {
        if (tableBodyRef?.current?.scrollWidth) {
            setScrollWidth(tableBodyRef?.current?.scrollWidth);
        }
    }, [tableBodyRef?.current?.scrollWidth]);

    const scrollWidthClass = useMemo(() => {
        return css`
            width: ${scrollWidth}px;
        `;
    }, [scrollWidth]);

    const scrollBottomClass = useMemo(() => {
        return css`
            --horizontal-scroll-bottom: ${pagesCount > 1 ? '40px' : 0};
        `;
    }, [pagesCount]);

    return {
        tableBodyRef,
        tableHeaderRef,
        scrollWidthClass,
        scrollBottomClass,
        tableBodyCallbackRef
    };
};

export interface filterOptionShape {
    /** value the data should be filtered for */
    value: string | boolean | number;
    /** label of filter */
    label: string;
    /** Should the option be disabled? */
    isDisabled?: boolean;
    /** custom classname for the filter Option */
    className?: string;
}

export interface RowMetaData {
    updateRowState: Function;
    rowsState: RowsStateType;
    isRowHovered: boolean;
}

export interface ColumnProps {
    /** Identifier for the column */
    id: string;
    /** column header label text/ react node/ React Function */
    Header: ReactNode | typeof React.Component;
    /** key of relevant property from data */
    accessor: string;
    /** Is column should be sortable */
    isSortable?: boolean;
    /** Is filterable? pass filter options or allow auto-creation of the options by passing 'auto'.  */
    filterOptions?: 'auto' | filterOptionShape[];
    /** informative tooltip on column header */
    info?: ReactNode;
    /** column width - valid grid template column value. required on horizontal scroll */
    width?: string;
    /** custom cell content (cellData,rowData)=>cellContent */
    renderCell?: (cellData: any, rowData: rowDataType, rowMetaData: RowMetaData) => ReactNode;
    /** custom filter-panel label content (val)=>labelContent */
    renderFilterPanelLabel?: Function;
    /** custom classname for the column. header and cells */
    className?: string;
    /** InfoTooltip props */
    infoProps?: any;
    /** On horizontal scroll, keep column sticky, can be apply to x first and x last columns */
    isSticky?: boolean;
    /** Property in the data to use for text filter purposes */
    accessorForTextFilter?: string;
    /** The filter state of the column */
    filterState?: ColumnFilterStateType;
    /** A callback to update column filter */
    updateColumnFilter?: Function;
    /** A callback to toggle the sort state of the column */
    toggleSort?: MouseEventHandler<HTMLButtonElement>;
    /** The sorting state of the column */
    columnSortState?: SortOrderType;
    /** Use when more complex filter logic is needed */
    customFilter?: ({
        filterState,
        row,
        column,
        cellValue
    }: {
        cellValue: any;
        filterState: ColumnFilterStateType;
        row: rowDataType;
        column: ColumnProps;
    }) => boolean;
}

export type SelectionStateType =
    | {
          rows: HashTable<boolean>;
          count: number;
          allSelected?: boolean;
      }
    | undefined;

export type PaginationStateType = {
    gotoPage: Function;
    pageIndex: number;
    pageRows: rowDataType[];
    pageCount: number;
    totalRows: number;
};

type TableStateType = any;
type PageStateType = any;

export interface TableProps {
    /** Is there horizontal scroll? if true, a fixed width should be given to each columns */
    isHorizontalScroll: boolean;
    /** All the rows of the table */
    rows: rowDataType[];
    /** Filtered and sorted rows */
    organizedRows: rowDataType[];
    /** The columns of the table */
    columns: ColumnProps[];
    /** The sorting state of the table */
    sortState: SortStateType;
    /** The filter state of the table */
    filterState: FilterStateType;
    /** The state of the table */
    tableState: TableStateType;
    /** The state of the row */
    rowsState: HashTable<RowsStateType>;
    /** The state of selection of rows */
    selectionState: SelectionStateType;
    /** The state of columns */
    columnState: HashTable<ColumnStateType>;
    /** A callback to toggle a column sorting state */
    toggleSort: Function;
    /** Update column filter state */
    updateFilterState: Function;
    /** Update specific row state */
    updateRowState: Function;
    /** Update text  filter (search) */
    updateTextFilter: Function;
    /** Update table selection */
    toggleRowSelection: Function;
    /** A callback to select all rows */
    selectAllRows: Function;
    /** A callback to remove all filters (including search) */
    resetFilters: Function;
    /** Info of pagination, when number of rows bigger than pageSize */
    pagination: PaginationStateType;
    /** Maximum rows per page */
    pageSize: number;
    /** The text filter string value(search) */
    textFilter: string;
    /** state of a specific page in the table */
    pageState: PageStateType;
    /** The initial pages state */
    initialPageState: PageStateType;
    /** If we didnt finish loading the rows it should be true */
    isLazyLoading: boolean;
}

export interface TableComponentProps {
    /** Table variant, blue headers? or white? */
    variant?: 'default' | 'innerTable';
    /** The props of the table (returned from useTable hook) */
    tableProps: TableProps;
    /** Custom classname */
    className?: string;
    /** Should column auto sizing feature be disabled? */
    isColumnsAutoSizeDisabled?: boolean;
    /** Are there external Filters, if true, the filter buttons in the tables header will disappear */
    isExternalFilter?: boolean;
    /** In case the row is expandable, ExpandedRow will be the component that will render the expanded row */
    ExpandedRow?: typeof Component;
    /** Should row ne higher? (72px) */
    isDoubleRow?: boolean;
    /** In case useTable have isLazyLoading:true, and there are no rows, show the following text */
    lazyLoadingText?: string;
    /** In case expanded row needs to be open in same level of outer row */
    isRowExpandedInSameLevel?: boolean;
}

/** Data table - Should be used with useTable hook, all props go for useTable which return the gridProps (apart from className, isColumnsAutoSizeDisabled and isExternalFilter) */
export const Table = React.forwardRef(
    (
        {
            tableProps,
            variant = 'default',
            className,
            isColumnsAutoSizeDisabled,
            ExpandedRow,
            isDoubleRow = false,
            isExternalFilter = false,
            lazyLoadingText = 'Loading',
            isRowExpandedInSameLevel = false
        }: TableComponentProps,
        ref
    ) => {
        const {
            organizedRows,
            rows,
            columns,
            pagination,
            pageSize,
            isHorizontalScroll = false,
            rowsState,
            updateRowState,
            filterState,
            selectionState,
            sortState,
            isLazyLoading
        } = tableProps;
        const [resizedState, setResizedState] = useState<HashTable<string>>({});

        const gridTemplateColumns = useMemo(
            () =>
                columns.reduce(
                    (acc: string, { width, id }: ColumnProps) =>
                        acc +
                        (resizedState[id]
                            ? `${resizedState[id]} `
                            : width
                            ? `${width} `
                            : isColumnsAutoSizeDisabled || isHorizontalScroll
                            ? '1fr '
                            : 'auto '),
                    ''
                ),
            [columns, isColumnsAutoSizeDisabled, isHorizontalScroll, resizedState]
        );
        const gridTemplateColumnsClass = css`
            grid-template-columns: ${gridTemplateColumns as unknown as string};
        `;
        const { tableBodyRef, tableHeaderRef, scrollWidthClass, scrollBottomClass, tableBodyCallbackRef } =
            useHorizontalScroll(columns, pagination?.pageCount);
        return (
            <div className={classNames(styles['table-wrapper'], styles[variant])}>
                <div
                    className={classNames(
                        styles['table'],
                        gridTemplateColumnsClass,
                        { [styles['fixed-cell-width']]: isHorizontalScroll },
                        className
                    )}
                >
                    <div
                        key={'header-row'}
                        className={classNames(styles['header-row'], gridTemplateColumnsClass)}
                        ref={tableHeaderRef}
                    >
                        {columns.map((column: ColumnProps, index: number) => (
                            <HeaderCell
                                columnSortState={sortState?.column === column.id ? sortState?.sortOrder : null}
                                key={column.id}
                                column={column}
                                isExternalFilter={isExternalFilter}
                                index={index}
                                columns={columns}
                                isLast={columns.length - 1 === index}
                                isLazyLoading={isLazyLoading}
                                setResizedState={setResizedState}
                            />
                        ))}
                    </div>

                    <div className={classNames(styles['body'], gridTemplateColumnsClass)} ref={tableBodyCallbackRef}>
                        {pagination?.pageRows?.map((dataRow: rowDataType) => (
                            <Row
                                key={dataRow.id}
                                columns={columns}
                                data={dataRow}
                                isDoubleRow={isDoubleRow}
                                ExpandedRow={ExpandedRow}
                                selectionState={selectionState}
                                rowsState={rowsState}
                                updateRowState={updateRowState}
                                textFilter={filterState?.textFilter}
                                isRowExpandedInSameLevel={isRowExpandedInSameLevel}
                            />
                        ))}
                    </div>
                </div>
                {organizedRows.length === 0 && rows.length !== 0 && (
                    <div className={styles['empty-table']}>
                        <SearchIcon />
                        <DsTypography variant={'Semibold_14'} color={'var(--text-secondary)'}>
                            No results
                        </DsTypography>
                    </div>
                )}
                {organizedRows.length === 0 &&
                    rows.length === 0 &&
                    (isLazyLoading ? (
                        <div className={classNames(styles['empty-table'], styles['smaller-table'])}>
                            <SearchIcon />
                            <DsTypography variant={'Semibold_14'} color={'var(--text-secondary)'}>
                                {lazyLoadingText}
                            </DsTypography>
                        </div>
                    ) : (
                        <div className={styles['empty-table']}>
                            <FileIcon />
                            <DsTypography variant={'Semibold_14'} color={'var(--text-secondary)'}>
                                No data
                            </DsTypography>
                        </div>
                    ))}
                {isHorizontalScroll && (
                    <div
                        className={classNames(styles['horizontal-scroll'], scrollBottomClass)}
                        onScroll={(e: React.UIEvent<HTMLDivElement>) => {
                            const newScrollLeft = (e.target as HTMLElement)?.scrollLeft;
                            if (tableBodyRef.current && tableHeaderRef.current) {
                                tableHeaderRef.current.scrollLeft = newScrollLeft;
                                tableBodyRef.current.scrollLeft = newScrollLeft;
                            }
                        }}
                    >
                        <div className={classNames(styles['scroll'], scrollWidthClass)} />
                    </div>
                )}
                {pagination?.pageCount > 1 && (
                    <PaginationPanel pagination={pagination} pageSize={pageSize} totalRows={organizedRows.length} />
                )}
            </div>
        );
    }
);

const SortButton = ({
    handleSort,
    columnSortState = null,
    isDisabled = false
}: {
    handleSort?: MouseEventHandler<HTMLButtonElement>;
    columnSortState: SortOrderType;
    isDisabled: boolean;
}) => {
    return (
        <Button
            variant={'icon'}
            isDisabled={isDisabled}
            className={classNames(styles['sort-button'])}
            onClick={handleSort}
        >
            {columnSortState === null && <SortIcon />}
            {columnSortState === 'asc' && <ArrowUpIcon />}
            {columnSortState === 'desc' && <ArrowDownIcon />}
        </Button>
    );
};
