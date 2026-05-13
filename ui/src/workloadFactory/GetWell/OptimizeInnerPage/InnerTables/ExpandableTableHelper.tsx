import React, { useRef, useEffect } from 'react';
import { TFunction } from 'i18next';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

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
    na: string
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
                    cellProps: item.cellProps
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
        width: '20%',
        renderCell: (_cellData: any, rowData: any) => (rowData.isSubRow ? '' : rowData.databaseName || na)
    },
    ...(hasViolationDetails
        ? [
              {
                  Header: t('databases.well-architect.drive-name'),
                  accessor: 'driveDisplay',
                  id: '2',
                  isSortable: false,
                  width: '15%',
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
                  width: '50%',
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
              } as ColumnProps,
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
        : []),
    {
        ...lastColDetails(type, {}, '10%'),
        renderCell: (_cellData: any, rowData: any) => {
            if (rowData.isSubRow) return null;
            const originalCol = lastColDetails(type, {}, '10%');
            return originalCol.renderCell ? originalCol.renderCell(_cellData, rowData) : null;
        }
    }
];
