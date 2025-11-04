import React, { useCallback, useMemo, useReducer } from 'react';
import { css } from '@emotion/css';
import classNames from 'classnames';
import _orderBy from 'lodash/orderBy';
import _filter from 'lodash/filter';
import _forEach from 'lodash/forEach';
import _isString from 'lodash/isString';
import _get from 'lodash/get';
import _isObject from 'lodash/isObject';
import _find from 'lodash/find';
import _chunk from 'lodash/chunk';
import _isArray from 'lodash/isArray';
import _uniqBy from 'lodash/uniqBy';
import _compact from 'lodash/compact';
import _map from 'lodash/map';
import _isUndefined from 'lodash/isUndefined';
import _pickBy from 'lodash/pickBy';
import _size from 'lodash/size';
import _values from 'lodash/values';
import { Checkbox } from '@netapp/design-system';
import { getStickyClass, HashTable } from '../../../utils/utilityFunctions';
import useRunOnceWhenTruthy from '../../hooks/useRunOnceWhenTruthy';
import { ColumnProps, SelectionStateType } from './Table';
import { ManageColumns } from './ManageColumns';
import { SELECTION_TYPE, SelectionCell } from './Selection';

const noRightPaddingClass = css({
    '&&&&': {
        paddingRight: 0,
        '--display-cell-right-border': 'none'
    }
});

const noFilterState = { columns: {}, count: 0, textFilter: '' };

const sort = (sortState: SortStateType, columnsMap: HashTable<ColumnProps>, rows: rowDataType[]) =>
    sortState?.column && sortState?.sortOrder
        ? _orderBy(rows, [columnsMap[sortState.column].accessor], [sortState.sortOrder])
        : rows;

const filterFunc = (
    filterState: FilterStateType,
    rows: rowDataType[],
    columns: ColumnProps[],
    columnsMap: HashTable<ColumnProps>,
    additionalSearchKeys?: string[]
) => {
    const { textFilter } = filterState;
    return _filter(rows, row => {
        const lowerCaseTextFilter = textFilter && textFilter.toLowerCase();
        let isTextFilterMatch = !textFilter;

        if (textFilter) {
            _forEach(columns, column => {
                const { accessor } = column;

                const { accessorForTextFilter } = column;

                // Get value from `customAccessor` if available, otherwise use `accessor`
                const value = accessorForTextFilter ? _get(row, accessorForTextFilter) : _get(row, accessor);

                if (_isString(value) && value.toLowerCase().includes(lowerCaseTextFilter)) {
                    isTextFilterMatch = true;
                    return false;
                }
                if (_isArray(value) && value.join(', ').toLowerCase().includes(lowerCaseTextFilter)) {
                    isTextFilterMatch = true;
                    return false;
                }
            });

            additionalSearchKeys &&
                _forEach(additionalSearchKeys, (searchKey: string) => {
                    const value = _get(row, searchKey);
                    if (_isString(value) && value.toLowerCase().includes(lowerCaseTextFilter)) {
                        isTextFilterMatch = true;
                        return false;
                    }
                });
        }

        let isMultiFilterMatch = true;

        _forEach(filterState.columns, (filter, key) => {
            if (_isObject(filter) && filter!.activeCount > 0) {
                const { accessor } = columnsMap[key];
                const customAccessor = columnsMap[key]?.customAccessor; // Use custom accessor if present
                const rowAccessor = _get(row, customAccessor || accessor);

                if (columnsMap[key]?.customFilter) {
                    const isMatch =
                        columnsMap[key]?.customFilter?.({
                            cellValue: rowAccessor,
                            filterState: filter,
                            row,
                            column: columnsMap[key]
                        }) || false;
                    isMultiFilterMatch = isMatch;
                    return isMatch;
                }
                if (_isArray(rowAccessor)) {
                    const existsOne = _find(rowAccessor, value => filter.values[value]);
                    if (!existsOne) {
                        isMultiFilterMatch = false;
                        return false;
                    }
                } else if (!filter.values[rowAccessor]) {
                    isMultiFilterMatch = false;
                    return false;
                }
            }
        });

        return isTextFilterMatch && isMultiFilterMatch;
    });
};

const ACTIONS = {
    TOGGLE_SORT: 'TOGGLE_SORT',
    SET_FILTER: 'SET_FILTER',
    RESET_FILTERS: 'RESET_FILTERS',
    TOGGLE_ROW_SELECTION: 'TOGGLE_ROW_SELECTION',
    TOGGLE_SELECT_ALL: 'TOGGLE_SELECT_ALL',
    UPDATE_TEXT_FILTER: 'UPDATE_TEXT_FILTER',
    GO_TO_PAGE: 'GO_TO_PAGE',
    UPDATE_ROW: 'UPDATE_ROW',
    UPDATE_COLUMN_STATE: 'UPDATE_COLUMN_STATE'
};

type PageStateType =
    | {
          pageIndex?: number;
      }
    | undefined;

interface ReducerStateType {
    sortState: SortStateType;
    initialSortState: SortStateType;
    filterState: FilterStateType;
    initialFilterState: FilterStateType;
    columnsState: HashTable<ColumnStateType>;
    rowsState: HashTable<RowsStateType>;
    selectionState: SelectionStateType;
    selectionType: SelectionType;
    pageState: PageStateType;
    initialPageState: PageStateType;
    columns: ColumnProps[];
    isSorting: boolean;
    initialColumnState: HashTable<ColumnStateType>;
    pageSize: number;
}

type InitialStateType = {
    columns: ColumnProps[];
    isSorting: boolean;
    selectionType: SelectionType;
    initialSortState: SortStateType;
    initialFilterState: FilterStateType;
    initialColumnState?: HashTable<ColumnStateType>;
    pageSize: number;
};

function init(initialState: InitialStateType): any {
    let sortState = null;

    if (initialState.isSorting && initialState.columns) {
        sortState = {
            column: _isString(initialState.columns[0]) ? initialState.columns[0] : initialState.columns[0].id || '0',
            sortOrder: 'asc'
        } as SortStateType;
    }

    const initialPageState = initialState.pageSize ? { pageIndex: 0 } : undefined;
    return {
        ...initialState,
        sortState: initialState.initialSortState || sortState,
        initialSortState: initialState.initialSortState || sortState,
        filterState: initialState.initialFilterState || noFilterState,
        initialFilterState: initialState.initialFilterState || noFilterState,
        columnsState: initialState.initialColumnState || {},
        rowsState: {},
        selectionState: initialState.selectionType !== SELECTION_TYPE.NONE ? { rows: {}, count: 0 } : undefined,
        selectionType: initialState.selectionType,
        pageState: initialPageState,
        initialPageState
    };
}
type ActionType = {
    type: string;
    payload: any;
};

function reducer(state: ReducerStateType, action: ActionType): ReducerStateType {
    const { type, payload } = action;

    switch (type) {
        case ACTIONS.TOGGLE_SORT: {
            const { id } = payload;

            let newSortState: SortStateType = {};
            const currentSortOrder = state?.sortState?.sortOrder;
            const currentSortColumn = state?.sortState?.column;
            if (currentSortColumn === id) {
                if (currentSortOrder === 'asc') {
                    newSortState.sortOrder = 'desc';
                    newSortState.column = id;
                } else if (currentSortColumn !== state.initialSortState?.column) {
                    newSortState = state.initialSortState;
                } else {
                    newSortState.sortOrder = 'asc';
                    newSortState.column = id;
                }
            } else {
                newSortState.sortOrder = 'asc';
                newSortState.column = id;
            }
            return {
                ...state,
                sortState: newSortState,
                pageState: state.initialPageState
            };
        }
        case ACTIONS.SET_FILTER: {
            const { id, values } = payload;

            const newValues = _pickBy(values);

            const newColumnFilter = {
                values: newValues,
                valuesArray: _values(values),
                activeCount: _size(newValues)
            };

            const columns = { ...state!.filterState!.columns, [id]: newColumnFilter };
            let count = 0;

            _forEach(columns, (columnsState: ColumnStateType) => {
                if (columnsState.activeCount && columnsState.activeCount > 0) {
                    count += 1;
                }
            });

            return {
                ...state,
                filterState: { ...state?.filterState, columns, count },
                pageState: state!.initialPageState
            };
        }
        case ACTIONS.RESET_FILTERS: {
            return {
                ...state,
                filterState: noFilterState,
                pageState: state.initialPageState
            };
        }
        case ACTIONS.TOGGLE_ROW_SELECTION: {
            const { id, value } = payload;
            let { count } = state!.selectionState!;
            let updatedValue = value;
            let oldSelectedRows = state!.selectionState!.rows;
            if (state.selectionType === SELECTION_TYPE.MULTIPLE) {
                const currentValue = state!.selectionState!.rows[id] || false;
                if (currentValue && !value) {
                    count -= 1;
                } else if (!currentValue && value) {
                    count += 1;
                }
            }
            if (state.selectionType === SELECTION_TYPE.SINGULAR) {
                count = 1;
                updatedValue = true;
                oldSelectedRows = {};
            }

            return {
                ...state,
                selectionState: {
                    count,
                    rows: { ...oldSelectedRows, [id]: updatedValue }
                }
            };
        }
        case ACTIONS.TOGGLE_SELECT_ALL: {
            const { value, rows } = payload;
            const selectionState: SelectionStateType = {
                rows: {},
                count: 0,
                allSelected: value
            };
            if (value) {
                const notDisabledRows = rows.filter((row: rowDataType) => !row?.cellProps?.isDisabled);
                _forEach(notDisabledRows, (row: rowDataType) => {
                    if (row?.id && !row?.cellProps?.isDisabled) {
                        selectionState.rows[row.id] = value;
                    }
                });
                selectionState.count = notDisabledRows.length;
            }
            return { ...state, selectionState };
        }
        case ACTIONS.UPDATE_TEXT_FILTER: {
            const { value } = payload;
            return {
                ...state,
                filterState: { ...state?.filterState, textFilter: value },
                pageState: state.initialPageState
            };
        }
        case ACTIONS.GO_TO_PAGE: {
            return { ...state, pageState: { pageIndex: payload.index } };
        }
        case ACTIONS.UPDATE_ROW: {
            const { id, state: newState } = payload;
            const currentState = state.rowsState[id] || {};

            return {
                ...state,
                rowsState: {
                    ...state.rowsState,
                    [id]: { ...currentState, ...newState }
                }
            };
        }
        case ACTIONS.UPDATE_COLUMN_STATE: {
            return { ...state, columnsState: payload.state };
        }
    }

    return state;
}

export const getFilterOptions = (data: rowDataType[], column: ColumnProps) => {
    const { accessor, renderFilterPanelLabel } = column;
    return !data || data?.length === 0
        ? undefined
        : _orderBy(
              _uniqBy(
                  _compact(
                      _map(data, row => {
                          const value = _get(row, accessor, null);
                          if (!value) return null;
                          // renderFilterPanelLabel is a simpler version of renderCell, for filters
                          return {
                              value,
                              label: renderFilterPanelLabel ? renderFilterPanelLabel(value) : value
                          };
                      })
                  ),
                  'value'
              ),
              [
                  ({ value }: { value: string | object | null }) =>
                      typeof value === 'string' ? value.toLowerCase() : JSON.stringify(value)
              ],
              ['asc']
          );
};

export type RowsStateType = {
    isExpanded?: boolean;
};
export type rowDataType = {
    id: string;
    cellProps?: {
        /** Custom classname for every cell in the row */
        className?: string;
        /** Show skeleton instead of the row data */
        isLoading?: boolean;
        /** Is the row disabled? including selection */
        isDisabled?: boolean;
        /** In case of selection, props to add for the Checkbox or CheckButton */
        selectionProps?: any;
    };
};

export type SortOrderType = 'asc' | 'desc' | null;

export type SortStateType = {
    sortOrder?: SortOrderType;
    column?: string;
} | null;

export interface ColumnFilterStateType {
    values: HashTable<boolean>;
    valuesArray: boolean[];
    activeCount: number;
}

export type FilterStateType = {
    textFilter: string;
    columns: { [p: string]: ColumnFilterStateType };
    count: number;
};

export interface ColumnStateType {
    activeCount?: number;
    isHidden?: boolean;
    isRemovalDisabled?: boolean;
}

export type SelectionType = 'none' | 'singular' | 'multiple';

export interface UseTableProps {
    /** Should the first column should be sorted by default */
    isSorting: boolean;
    /** Are the rows selectable? */
    selectionType?: SelectionType;
    /** Table columns */
    columns: ColumnProps[];
    /** Table Rows */
    rows: rowDataType[];
    /** Should the internal sorting mechanism be disabled */
    isExternalSort?: boolean;
    /** Should the internal filtering mechanism be disabled */
    isExternalFilter?: boolean;
    /** What should be the initial sorting state */
    initialSortState?: SortStateType;
    /** What should be the initial filter state */
    initialFilterState?: FilterStateType;
    /** What should be the initial column state */
    initialColumnState?: HashTable<ColumnStateType>;
    /** How many rows in every page */
    pageSize?: number;
    /** If selection type is not none, which rows ID should be selected by default */
    defaultSelectedRows?: string[];
    /** In case of text filter, these keys in the data will also be searched */
    additionalSearchKeys?: string[];
    /** Can the user add or remove columns? */
    isManagedColumns?: boolean;
    /** Is the table have horizontal scroll, if true, all the columns need fixed width properties */
    isHorizontalScroll?: boolean;
    /** The state if the column, used in case column is hidden (isManagedColumns prop) */
    columnsState?: HashTable<ColumnStateType>;
    /** If we didnt finish loading the rows it should be true */
    isLazyLoading?: boolean;
    /** when selection type selected, Props for the select all checkbox * */
    selectAllProps?: Partial<any>;
    /** When isManagedColumns is true, there are props for the newly created column  * */
    manageColumnsProps?: Partial<ColumnProps>;
}

export const useTable = ({
    isSorting,
    selectionType = 'none',
    columns,
    rows: data,
    isExternalSort = false,
    isExternalFilter = false,
    initialSortState = null,
    initialFilterState = noFilterState,
    initialColumnState,
    pageSize = 50,
    defaultSelectedRows,
    additionalSearchKeys,
    isManagedColumns = false,
    isHorizontalScroll = false,
    isLazyLoading = false,
    selectAllProps = {},
    manageColumnsProps = {}
}: UseTableProps) => {
    const { pColumns, columnsMap } = useMemo<{
        pColumns: ColumnProps[];
        columnsMap: HashTable<ColumnProps>;
    }>(() => {
        const columnsMap: HashTable<ColumnProps> = {};

        const pColumns: ColumnProps[] = columns?.map((column, index) => {
            const pColumn = {
                ...column,
                id: _isUndefined(column.id) ? index.toString() : column.id
            };
            columnsMap[pColumn.id] = pColumn;
            return pColumn;
        });

        return { pColumns, columnsMap };
    }, [columns]);

    const [table, dis] = useReducer(
        reducer,
        init({
            columns,
            isSorting,
            selectionType,
            initialSortState,
            initialFilterState,
            initialColumnState,
            pageSize
        })
    );
    const dispatch = dis as unknown as any;

    const toggleRowSelection = useCallback(
        (id: string) => (value: boolean) => {
            dispatch({
                type: ACTIONS.TOGGLE_ROW_SELECTION,
                payload: {
                    id,
                    value
                }
            });
        },
        [dispatch]
    );

    const processedRows = useMemo(
        () =>
            _map(data, (row, index) => {
                const id = _isUndefined(row.id) ? index.toString() : row.id;
                return {
                    ...row,
                    id
                };
            }),
        [data]
    );

    const shownColumns = useMemo(
        () => pColumns.filter(column => !table.columnsState[column.id]?.isHidden),
        [pColumns, table.columnsState]
    );

    const toggleSort = useCallback(
        ({ id }: { id: string }) => {
            dispatch({
                type: ACTIONS.TOGGLE_SORT,
                payload: {
                    id
                }
            });
        },
        [dispatch]
    );

    const updateFilterState = useCallback(
        (payload: { id: string; values: HashTable<boolean> }) => {
            dispatch({
                type: ACTIONS.SET_FILTER,
                payload
            });
        },
        [dispatch]
    );

    const resetFilters = useCallback(() => {
        dispatch({
            type: ACTIONS.RESET_FILTERS
        });
    }, [dispatch]);

    const updateRowState = useCallback(
        (id: string) => (state: any) => {
            dispatch({
                type: ACTIONS.UPDATE_ROW,
                payload: {
                    id,
                    state
                }
            });
        },
        [dispatch]
    );

    const updateTextFilter = useCallback(
        (value: string) => {
            dispatch({
                type: ACTIONS.UPDATE_TEXT_FILTER,
                payload: {
                    value
                }
            });
        },
        [dispatch]
    );

    const filteredRows: rowDataType[] = useMemo(() => {
        if ((table.filterState?.count > 0 || table.filterState?.textFilter) && !isExternalFilter) {
            return filterFunc(table.filterState, processedRows, columns, columnsMap, additionalSearchKeys);
        }
        return processedRows;
    }, [table.filterState, processedRows, isExternalFilter, columns, columnsMap, additionalSearchKeys]);

    const columnsWithFilterOptions = useMemo(
        () =>
            _map(shownColumns, (col: ColumnProps) => ({
                ...col,
                filterOptions: col.filterOptions === 'auto' ? getFilterOptions(filteredRows, col) : col.filterOptions
            })),
        [filteredRows, shownColumns]
    ) as any as ColumnProps[];

    const organizedRows = useMemo(() => {
        if (!isExternalSort) {
            return sort(table.sortState, columnsMap, filteredRows);
        }
        return filteredRows;
    }, [isExternalSort, filteredRows, table.sortState, columnsMap]) as rowDataType[];

    const selectRows = useCallback(
        (rows: rowDataType[], value: boolean) => {
            dispatch({
                type: ACTIONS.TOGGLE_SELECT_ALL,
                payload: {
                    value,
                    rows
                }
            });
        },
        [dispatch]
    );

    const pageChunks = useMemo(() => {
        if (pageSize) {
            return _chunk(organizedRows, pageSize);
        }
        return null;
    }, [organizedRows, pageSize]);

    const pagination = useMemo(() => {
        if (pageChunks) {
            const pageIndex = table?.pageState?.pageIndex || 0;
            const pageCount = pageChunks.length;
            const gotoPage = (i: number) => {
                if (i >= 0 && i < pageCount) {
                    dispatch({
                        type: ACTIONS.GO_TO_PAGE,
                        payload: {
                            index: i
                        }
                    });
                }
            };
            return {
                pageIndex,
                pageRows: pageChunks[pageIndex],
                pageCount,
                gotoPage
            };
        }
        return null;
    }, [pageChunks, table.pageState, dispatch]);

    const processedColumns = useMemo(
        () =>
            columnsWithFilterOptions.map((column: ColumnProps) => ({
                ...column,
                width: isManagedColumns ? `minmax(${column.width}, 1fr)` : undefined,
                toggleSort: () => toggleSort({ id: column.id }),
                sortState: column.id === table.sortState?.column ? table.sortState?.sortOrder : null,
                filterState: table.filterState?.columns[column.id],
                updateColumnFilter: (values: any) => updateFilterState({ id: column.id, values })
            })),
        [toggleSort, table.sortState, updateFilterState, table.filterState, columnsWithFilterOptions, isManagedColumns]
    );

    const columnsWithSelection = useMemo(() => {
        const selectableRows = organizedRows?.filter((row: rowDataType) => !row?.cellProps?.isDisabled) || [];

        const isAllSelected =
            selectableRows.length > 0 &&
            selectableRows.every((row: rowDataType) => !!table.selectionState?.rows[row.id]);

        const isAllPageRowsDisabled = pagination?.pageRows?.every(row => row?.cellProps?.isDisabled);
        const isAllRowsDisabled = organizedRows?.every(row => row?.cellProps?.isDisabled);
        return table.selectionState
            ? [
                  {
                      Header: () => {
                          if (selectionType === SELECTION_TYPE.MULTIPLE) {
                              if (pagination!.pageCount > 1) {
                                  return (
                                      <Checkbox
                                          isChecked={isAllSelected}
                                          isDisabled={isAllRowsDisabled}
                                          isPartial={table!.selectionState!.count > 0 && !isAllSelected}
                                          variant="tableHeader"
                                          menuOptions={[
                                              {
                                                  label: 'Select this page',
                                                  isDisabled: isAllPageRowsDisabled,
                                                  onClick: () => {
                                                      selectRows(pagination!.pageRows, true);
                                                  }
                                              },
                                              {
                                                  label: 'Select all pages',
                                                  isActive: isAllSelected,
                                                  onClick: () => {
                                                      selectRows(organizedRows, true);
                                                  }
                                              },
                                              {
                                                  label: 'Clear all',
                                                  isDisabled: table?.selectionState?.count === 0,
                                                  onClick: () => {
                                                      selectRows(organizedRows, false);
                                                  }
                                              }
                                          ]}
                                          {...selectAllProps}
                                      />
                                  );
                              }

                              return (
                                  <Checkbox
                                      variant="tableCheckbox"
                                      isDisabled={isAllPageRowsDisabled}
                                      isPartial={
                                          table!.selectionState!.count > 0 &&
                                          !isAllSelected &&
                                          selectableRows.length > 0
                                      }
                                      isChecked={isAllSelected}
                                      onChange={() => {
                                          // toggle selection for all selectable rows (ignore disabled rows)
                                          selectRows(organizedRows, !isAllSelected);
                                      }}
                                      {...selectAllProps}
                                  />
                              );
                          }
                      },
                      accessor: '',
                      id: 'selectionColumn',
                      className: noRightPaddingClass,
                      isSticky: true,
                      width: '72px',
                      renderCell: (value: any, row: rowDataType) => {
                          const isSelected = table.selectionState?.rows[row.id] || false;
                          return (
                              <SelectionCell
                                  selectionType={selectionType}
                                  isSelected={isSelected}
                                  isDisabled={row.cellProps?.isDisabled || false}
                                  onChange={() => toggleRowSelection(row.id)(!isSelected)}
                                  {...row?.cellProps?.selectionProps}
                              />
                          );
                      }
                  },
                  ...processedColumns
              ]
            : processedColumns;
    }, [
        processedColumns,
        organizedRows,
        pagination,
        toggleRowSelection,
        table,
        selectionType,
        selectRows,
        selectAllProps
    ]);

    const updateColumnState = useCallback(
        (state: any) => {
            dispatch({
                type: ACTIONS.UPDATE_COLUMN_STATE,
                payload: {
                    state
                }
            });
        },
        [dispatch]
    );

    const columnsWithManageColumns = useMemo(
        () =>
            isManagedColumns
                ? [
                      ...columnsWithSelection,
                      {
                          Header: () => (
                              <ManageColumns
                                  allColumns={pColumns}
                                  columnsState={table.columnsState}
                                  updateColumnState={updateColumnState}
                              />
                          ),
                          accessor: '',
                          isSticky: true,
                          width: '62px',
                          ...manageColumnsProps
                      }
                  ]
                : columnsWithSelection,
        [table.columnsState, updateColumnState, columnsWithSelection, isManagedColumns, pColumns, manageColumnsProps]
    ) as ColumnProps[];

    const columnsWithStickyClasses = useMemo(
        () =>
            columnsWithManageColumns.map((column, index) => ({
                ...column,
                className: classNames(
                    column.className,
                    isHorizontalScroll ? getStickyClass(columnsWithManageColumns, index) : null
                )
            })),
        [columnsWithManageColumns, isHorizontalScroll]
    );

    useRunOnceWhenTruthy(() => {
        defaultSelectedRows?.forEach(rowId => {
            toggleRowSelection(rowId)(true);
        });
    }, !!defaultSelectedRows && !!table.selectionState);

    return useMemo(
        () => ({
            rows: processedRows,
            organizedRows,
            allColumns: columns,
            columns: columnsWithStickyClasses,
            sortState: table.sortState,
            filterState: table.filterState,
            rowsState: table.rowsState,
            selectionState: table.selectionState,
            toggleSort,
            updateFilterState,
            updateRowState,
            updateTextFilter,
            toggleRowSelection,
            selectRows,
            resetFilters,
            pagination,
            pageSize,
            updateColumnState,
            isHorizontalScroll,
            columnsState: table.columnsState,
            isLazyLoading
        }),
        [
            table,
            columns,
            columnsWithStickyClasses,
            isHorizontalScroll,
            pageSize,
            organizedRows,
            toggleSort,
            updateFilterState,
            updateRowState,
            updateTextFilter,
            toggleRowSelection,
            selectRows,
            processedRows,
            resetFilters,
            pagination,
            updateColumnState,
            isLazyLoading
        ]
    );
};
