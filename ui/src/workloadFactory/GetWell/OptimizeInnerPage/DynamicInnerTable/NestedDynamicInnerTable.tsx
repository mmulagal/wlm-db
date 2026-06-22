/**
 * NestedDynamicInnerTable - Expandable Nested Table Component for GetWell Inner Pages
 *
 * Handles configs that require parent-child expandable rows (e.g., data-files-location).
 * Parent rows show database names with aggregated drive counts.
 * Child rows expand to show individual drive letters and LUN paths.
 *
 * Uses ExpandableTableHelper for nested table logic and NetApp DS ExpandedRow component.
 */

import { Table, useTable, DsButton, Popover, DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import styles from '../InnerTables/InnerTable.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';
import { getWadCellProps } from '../../GetWellUtils';
import {
    groupViolationDetails,
    ExpandedRowTable,
    buildParentTableData,
    useAutoExpandFirstRow,
    renderExpandableChevron
} from '../InnerTables/ExpandableTableHelper';
import { ColumnConfig, hasFixSupport } from '../../../../utils/getWellConfigRegistry';

interface NestedDynamicInnerTableProps {
    configId: string;
    data: any;
    columnConfig: ColumnConfig;
    engineType: string;
    isWad?: boolean;
}

const NestedDynamicInnerTable = ({
    configId,
    data,
    columnConfig,
    engineType,
    isWad = false
}: NestedDynamicInnerTableProps) => {
    const { t } = useTranslation();
    const na = t('databases.general.not-available-table-columns');

    // Check if data has nested violation details with additionalInfo
    const hasViolationDetails = data?.violationDetails?.some((d: any) => d.additionalInfo);

    // Group violation details by database name
    const groupedData = useMemo(() => groupViolationDetails(data, isWad, t, getWadCellProps), [data, isWad, t]);

    // Build parent-only table data (children rendered via ExpandedRow)
    const tableData = useMemo(() => buildParentTableData(groupedData, t, na), [groupedData, t, na]);

    // Check if this config supports fix (most nested tables don't)
    const canFix = hasFixSupport(configId, engineType);

    // Build column definitions dynamically from registry config
    const TableColDefs: ColumnProps[] = useMemo(() => {
        const columns: ColumnProps[] = [];

        // Add data columns from config
        columnConfig.columns.forEach((col: any, index: number) => {
            columns.push({
                Header: col.label,
                accessor: col.accessor || col.key,
                id: String(index + 1),
                isSortable: false,
                filterOptions: 'auto' as const,
                isSticky: index === 0, // First column is sticky
                width: col.width || 'auto', // Use width from config or default to 'auto'
                renderCell: (cellData: any, rowData: any) => {
                    // Special rendering for LUN path column (needs truncation)
                    if (col.key === 'lunPathDisplay') {
                        return (
                            <span className={styles.lunPathCell} title={rowData.lunPathDisplay}>
                                {cellData || na}
                            </span>
                        );
                    }
                    return cellData || na;
                }
            });
        });

        // Add Fix button column (always disabled for nested tables - they are view-only)
        columns.push({
            Header: '',
            accessor: 'action',
            id: String(columns.length + 1),
            isSortable: false,
            width: '20%',
            renderCell: () => (
                <div className={styles.buttonContainer}>
                    <div />
                    <Popover
                        isAppendedToBody
                        children={
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.fix-disabled')}
                            </DsTypography>
                        }
                        trigger="hover"
                        delayHide={200}
                        interactive
                        container={
                            <DsButton variant="secondary" isDisabled isThin>
                                {t('databases.well-architect.fix')}
                            </DsButton>
                        }
                    />
                </div>
            )
        } as ColumnProps);

        // Add chevron column for expandable rows (if has violation details)
        if (hasViolationDetails) {
            columns.push({
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
            } as ColumnProps);
        }

        return columns;
    }, [columnConfig, hasViolationDetails, canFix, t, na]);

    // Table props with ExpandedRow support
    const tableProps = useTable({
        // @ts-expect-error - manageColumnsProps type
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData,
        pageSize: 50,
        selectionType: 'none', // Nested tables are view-only
        defaultSelectedRows: tableData.map((item: any) => item.id)
    });

    // Auto-expand first expandable row
    useAutoExpandFirstRow(hasViolationDetails, tableData, tableProps.updateRowState);

    const databaseCount = groupedData.length;
    const tableTitle = columnConfig.tableTitle || 'Impacted databases';

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-expect-error - tableProps type
                tableProps={tableProps}
                pluralTitle={`${tableTitle} (${databaseCount})`}
                singularTitle={`${tableTitle.replace(/s$/, '')} (${databaseCount})`}
                hideCount
            />

            <Table
                // @ts-expect-error - tableProps type
                tableProps={tableProps}
                // @ts-expect-error - ExpandedRow accepts functional component
                ExpandedRow={ExpandedRowTable}
            />
        </div>
    );
};

export default NestedDynamicInnerTable;
