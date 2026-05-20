import React, { useRef, useEffect, useMemo } from 'react';
import { TFunction } from 'i18next';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { Table, useTable } from '@netapp/design-system';
import styles from './InnerTable.module.scss';

export const toggleExpandedRow = <T extends string | number>(
    id: T,
    setExpandedRows: React.Dispatch<React.SetStateAction<Set<T>>>,
    allowMultiple = true
): void => {
    setExpandedRows(prev => {
        if (allowMultiple) {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        }
        if (prev.has(id)) {
            return new Set();
        }
        return new Set([id]);
    });
};

export const useInitialExpandedRow = <T extends string | number>(
    items: { id: T; drive: string[] }[],
    hasViolationDetails: boolean,
    setExpandedRows: React.Dispatch<React.SetStateAction<Set<T>>>
): void => {
    const hasSetInitialExpanded = useRef(false);

    useEffect(() => {
        if (!hasSetInitialExpanded.current && hasViolationDetails && items.length > 0) {
            const firstExpandableIdx = items.findIndex(item => item.drive.length > 1);
            if (firstExpandableIdx !== -1) {
                setExpandedRows(new Set([items[firstExpandableIdx].id]));
                hasSetInitialExpanded.current = true;
            }
        }
    }, [hasViolationDetails, items, setExpandedRows]);
};

export const useInitialExpandedRowByIndex = (
    rows: string[][],
    isExpandable: boolean,
    setExpandedRows: React.Dispatch<React.SetStateAction<Set<number>>>
): void => {
    const hasSetInitialExpanded = useRef(false);

    useEffect(() => {
        if (!hasSetInitialExpanded.current && isExpandable && rows.length > 0) {
            const firstExpandableIdx = rows.findIndex(row => {
                const drives = row[1]?.split('|') || [];
                return drives.length > 1;
            });
            if (firstExpandableIdx !== -1) {
                setExpandedRows(new Set([firstExpandableIdx]));
                hasSetInitialExpanded.current = true;
            }
        }
    }, [isExpandable, rows, setExpandedRows]);
};

export interface ViolationDetailWithAdditionalInfo {
    value?: string;
    additionalInfo?: {
        driveLetter?: string;
        lunPath?: string;
    };
}

export interface GroupedViolationData {
    databaseName: string;
    drive: string[];
    lunPath: string[];
    id: string;
    cellProps?: Record<string, unknown>;
}

// Group violation details by database name
export const groupViolationDetails = (
    data: { violationDetails?: ViolationDetailWithAdditionalInfo[]; objectsInViolation?: any[] },
    isWad: boolean,
    t: TFunction,
    getWadCellPropsFn: (
        isWadParam: boolean,
        tParam: TFunction,
        propsParam?: Record<string, unknown>
    ) => Record<string, unknown> | undefined
): GroupedViolationData[] => {
    let idCounter = 0;
    const details = data?.violationDetails || [];
    if (details.length > 0 && details.some((d: ViolationDetailWithAdditionalInfo) => d.additionalInfo)) {
        const grouped = new Map<string, { drives: string[]; lunPaths: string[] }>();
        details.forEach(detail => {
            const dbName = String(detail?.value ?? '');
            if (!grouped.has(dbName)) {
                grouped.set(dbName, { drives: [], lunPaths: [] });
            }
            const entry = grouped.get(dbName)!;
            if (detail?.additionalInfo?.driveLetter) entry.drives.push(detail.additionalInfo.driveLetter);
            if (detail?.additionalInfo?.lunPath) entry.lunPaths.push(detail.additionalInfo.lunPath);
        });
        return Array.from(grouped.entries()).map(([dbName, { drives, lunPaths }]) => {
            const currentId = idCounter;
            idCounter += 1;
            return {
                databaseName: dbName,
                drive: drives,
                lunPath: lunPaths,
                id: String(currentId),
                cellProps: getWadCellPropsFn(isWad, t, { isDisabled: true })
            };
        });
    }
    return (data?.objectsInViolation || []).map((row: any) => {
        const currentId = idCounter;
        idCounter += 1;
        return {
            databaseName: row,
            drive: [],
            lunPath: [],
            id: String(currentId),
            cellProps: getWadCellPropsFn(isWad, t, { ...row.cellProps, isDisabled: true })
        };
    });
};

export interface ExpandableTableRow {
    id: string;
    databaseName: string;
    driveDisplay: string;
    lunPathDisplay: string;
    isMulti: boolean;
    isExpanded: boolean;
    isSubRow: boolean;
    drive?: string[];
    lunPath?: string[];
    cellProps?: Record<string, unknown>;
}

export const buildExpandableTableData = (
    groupedData: GroupedViolationData[],
    expandedRows: Set<string>,
    t: TFunction,
    na: string,
    subRowClassName?: string
): ExpandableTableRow[] => {
    const rows: ExpandableTableRow[] = [];
    groupedData.forEach(item => {
        const isMulti = item.drive.length > 1;
        const isExpanded = expandedRows.has(item.id);
        rows.push({
            ...item,
            driveDisplay: isMulti
                ? `${item.drive.length} ${t('databases.well-architect.drives')}`
                : item.drive[0] || na,
            lunPathDisplay: isMulti
                ? `${item.lunPath.length} ${t('databases.well-architect.lun-paths')}`
                : item.lunPath[0] || na,
            isMulti,
            isExpanded,
            isSubRow: false
        });
        if (isMulti && isExpanded) {
            item.drive.forEach((drive: string, idx: number) => {
                rows.push({
                    id: `${item.id}-sub-${idx}`,
                    databaseName: '',
                    driveDisplay: drive,
                    lunPathDisplay: item.lunPath[idx] || na,
                    isMulti: false,
                    isExpanded: false,
                    isSubRow: true,
                    cellProps: {
                        ...item.cellProps,
                        className: subRowClassName || ''
                    }
                });
            });
        }
    });
    return rows;
};

export interface ExpandableChevronProps {
    rowData: {
        isSubRow?: boolean;
        isMulti?: boolean;
        isExpanded?: boolean;
        id?: string;
        parentIdx?: number;
    };
    toggleRow: (id: string | number) => void;
    commonStyles: Record<string, string>;
    ArrowIcon: React.ComponentType;
    useParentIdx?: boolean;
}

export const renderExpandableChevron = ({
    rowData,
    toggleRow,
    commonStyles,
    ArrowIcon,
    useParentIdx = false
}: ExpandableChevronProps): React.ReactNode => {
    if (rowData.isSubRow) return null;
    const isDisabled = !rowData.isMulti;
    const toggleId = useParentIdx ? rowData.parentIdx : rowData.id;

    const handleClick = () => {
        if (!isDisabled && toggleId !== undefined) {
            toggleRow(toggleId);
        }
    };

    return (
        <span
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            className={`${commonStyles.expandableArrow} ${rowData.isExpanded ? commonStyles.expanded : ''} ${
                isDisabled ? commonStyles.disabled : ''
            }`}
            onClick={handleClick}
        >
            <ArrowIcon />
        </span>
    );
};

export const buildColumnProps = (
    columns: string[],
    renderCell?: (cellData: unknown) => React.ReactNode
): ColumnProps[] =>
    columns.map((name, idx) => ({
        Header: name,
        accessor: name,
        id: `col-${idx}`,
        isSortable: true,
        width: 'auto',
        ...(renderCell && { renderCell })
    }));

// Nested table component for expanded rows using Design System Table
export const ExpandedRowTable = ({ rowData }: { rowData: any }): React.ReactElement | null => {
    const hasMultipleDrives = rowData.drive && rowData.drive.length > 1;

    const nestedRows = useMemo(
        () =>
            hasMultipleDrives
                ? rowData.drive.map((drive: string, idx: number) => ({
                      id: `${rowData.id}-nested-${idx}`,
                      drive,
                      lunPath: rowData.lunPath[idx] || '-'
                  }))
                : [],
        [hasMultipleDrives, rowData.drive, rowData.lunPath, rowData.id]
    );

    const nestedColumns: ColumnProps[] = useMemo(
        () => [
            {
                Header: '',
                accessor: 'drive',
                id: 'drive',
                isSortable: false,
                width: '220px',
                renderCell: (cellData: string) => cellData
            },
            {
                Header: '',
                accessor: 'lunPath',
                id: 'lunPath',
                isSortable: false,
                width: 'auto',
                renderCell: (cellData: string) => (
                    <span className={styles.lunPathCell} title={cellData}>
                        {cellData}
                    </span>
                )
            }
        ],
        []
    );

    const tableProps = useTable({
        columns: nestedColumns,
        rows: nestedRows,
        pageSize: 100,
        selectionType: 'none',
        isSorting: false,
        isHorizontalScroll: false
    });

    if (!hasMultipleDrives) return null;

    return (
        <div className={styles['expanded-row-inner-table']}>
            <Table
                // @ts-expect-error - tableProps type
                tableProps={tableProps}
                variant="innerTable"
            />
        </div>
    );
};

// Build parent-only table data for nested expandable tables
export const buildParentTableData = (
    groupedData: GroupedViolationData[],
    t: TFunction,
    na: string
): Array<GroupedViolationData & { driveDisplay: string; lunPathDisplay: string; isMulti: boolean }> =>
    groupedData.map((item: GroupedViolationData) => ({
        ...item,
        driveDisplay:
            item.drive.length > 1
                ? `${item.drive.length} ${t('databases.well-architect.drives')}`
                : item.drive[0] || na,
        lunPathDisplay:
            item.lunPath.length > 1
                ? `${item.lunPath.length} ${t('databases.well-architect.lun-paths')}`
                : item.lunPath[0] || na,
        isMulti: item.drive.length > 1
    }));

// Get column definitions for nested expandable table
export interface GetNestedTableColumnsParams {
    t: TFunction;
    na: string;
    hasViolationDetails: boolean;
    lastColDetails: (type: string, props: Record<string, unknown>, width: string) => ColumnProps;
    type: string;
    lunPathCellClassName: string;
    commonStyles: Record<string, string>;
    ArrowIcon: React.ComponentType;
}

export const getNestedTableColumns = ({
    t,
    na,
    hasViolationDetails,
    lastColDetails,
    type,
    lunPathCellClassName,
    commonStyles,
    ArrowIcon
}: GetNestedTableColumnsParams): ColumnProps[] => [
    {
        Header: t('databases.well-architect.database-name'),
        accessor: 'databaseName',
        id: '1',
        isSortable: false,
        filterOptions: 'auto',
        isSticky: true,
        width: '18%',
        renderCell: (cellData: any) => cellData || na
    },
    ...(hasViolationDetails
        ? [
              {
                  Header: t('databases.well-architect.drive-name'),
                  accessor: 'driveDisplay',
                  id: '2',
                  isSortable: false,
                  width: '12%',
                  renderCell: (cellData: any) => cellData
              } as ColumnProps,
              {
                  Header: t('databases.well-architect.lun-path'),
                  accessor: 'lunPathDisplay',
                  id: '3',
                  isSortable: false,
                  width: '45%',
                  renderCell: (cellData: any, rowData: any) => (
                      <span className={lunPathCellClassName} title={rowData.lunPathDisplay}>
                          {cellData}
                      </span>
                  )
              } as ColumnProps
          ]
        : []),
    {
        ...lastColDetails(type, {}, '20%')
    },
    ...(hasViolationDetails
        ? [
              {
                  Header: '',
                  accessor: 'isMulti',
                  id: 'chevron',
                  isSortable: false,
                  width: '5%',
                  renderCell: (_cellData: any, rowData: any, rowMetaData: any) =>
                      renderExpandableChevron({
                          rowData: {
                              ...rowData,
                              isExpanded: rowMetaData?.rowsState?.[rowData.id]?.isExpanded
                          },
                          toggleRow: (id: string | number) => {
                              rowMetaData?.updateRowState(id)({
                                  isExpanded: !rowMetaData?.rowsState?.[id]?.isExpanded
                              });
                          },
                          commonStyles,
                          ArrowIcon
                      })
              } as ColumnProps
          ]
        : [])
];

// Hook to auto-expand first expandable row
export const useAutoExpandFirstRow = (
    hasViolationDetails: boolean,
    tableData: Array<{ id: string; isMulti: boolean }>,
    updateRowState: ((id: string) => (state: any) => void) | undefined
): void => {
    const hasInitialExpanded = useRef(false);
    useEffect(() => {
        if (!hasInitialExpanded.current && hasViolationDetails && tableData.length > 0) {
            const firstExpandable = tableData.find((item) => item.isMulti);
            if (firstExpandable && updateRowState) {
                updateRowState(firstExpandable.id)({ isExpanded: true });
                hasInitialExpanded.current = true;
            }
        }
    }, [hasViolationDetails, tableData, updateRowState]);
};

export interface GetExpandableColumnsParams {
    t: TFunction;
    na: string;
    toggleRow: (id: string) => void;
    hasViolationDetails: boolean;
    commonStyles: Record<string, string>;
    ArrowIcon: React.ComponentType;
    lastColDetails: (type: string, props: Record<string, unknown>, width: string) => ColumnProps;
    type: string;
    innerStyles?: Record<string, string>;
}

export const getExpandableTableColumns = ({
    t,
    na,
    toggleRow,
    hasViolationDetails,
    commonStyles,
    ArrowIcon,
    lastColDetails,
    type,
    innerStyles
}: GetExpandableColumnsParams): ColumnProps[] => [
    {
        Header: t('databases.well-architect.database-name'),
        accessor: 'databaseName',
        id: '1',
        isSortable: false,
        filterOptions: 'auto',
        isSticky: true,
        width: '18%',
        renderCell: (_cellData: any, rowData: any) => (rowData.isSubRow ? '' : rowData.databaseName || na)
    },
    ...(hasViolationDetails
        ? [
              {
                  Header: t('databases.well-architect.drive-name'),
                  accessor: 'driveDisplay',
                  id: '2',
                  isSortable: false,
                  width: '12%',
                  renderCell: (_cellData: any, rowData: any) => (
                      <span className={rowData.isSubRow ? commonStyles.expandableSubRowCell : ''}>
                          {rowData.driveDisplay}
                      </span>
                  )
              } as ColumnProps,
              {
                  Header: t('databases.well-architect.lun-path'),
                  accessor: 'lunPathDisplay',
                  id: '3',
                  isSortable: false,
                  width: '45%',
                  renderCell: (_cellData: any, rowData: any) => (
                      <span
                          className={`${innerStyles?.lunPathCell || commonStyles.lunPathCell} ${
                              rowData.isSubRow ? commonStyles.expandableSubRowCell : ''
                          }`}
                          title={rowData.lunPathDisplay}
                      >
                          {rowData.lunPathDisplay}
                      </span>
                  )
              } as ColumnProps
          ]
        : []),
    {
        ...lastColDetails(type, {}, '20%'),
        renderCell: (_cellData: any, rowData: any) => {
            if (rowData.isSubRow) return null;
            const originalCol = lastColDetails(type, {}, '20%');
            return originalCol.renderCell ? originalCol.renderCell(_cellData, rowData) : null;
        }
    },
    ...(hasViolationDetails
        ? [
              {
                  Header: '',
                  accessor: 'isMulti',
                  id: 'chevron',
                  isSortable: false,
                  width: '5%',
                  renderCell: (_cellData: any, rowData: any) =>
                      renderExpandableChevron({
                          rowData,
                          toggleRow,
                          commonStyles,
                          ArrowIcon
                      })
              } as ColumnProps
          ]
        : [])
];
