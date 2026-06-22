/**
 * DynamicInnerTable - Generic Table Component for ALL GetWell Inner Pages
 *
 * Replaces all individual table components (StorageTierOptimizeTable, LogDriveSizeOptimizeTable, etc.)
 * Renders tables dynamically based on column configuration from the registry.
 * Supports bulk actions, selection, and WAD (offline assessment) styling.
 */

import { Table, useTable, TableTopBar, DsButton, Popover, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from '../InnerTables/InnerTable.module.scss';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import useResize from '../../../../common/hooks/useResize';
import { getWadCellProps } from '../../GetWellUtils';
import { ColumnConfig } from '../../../../utils/getWellConfigRegistry';

interface DynamicInnerTableProps {
    configId: string;
    data: any;
    columnConfig: ColumnConfig;
    engineType: string;
    isWad?: boolean;
    canOptimize?: boolean;
    handleBulkAction: () => void;
    handleRowFix?: (rowData: any) => void;
}

const DynamicInnerTable = ({
    configId,
    data,
    columnConfig,
    engineType,
    isWad = false,
    canOptimize = true,
    handleBulkAction,
    handleRowFix
}: DynamicInnerTableProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector((state: any) => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector((state: any) => state.getWellOptimize);
    const windowSize = useResize();

    // Transform API data to table rows
    const tableData = useMemo(() => {
        let id = 0;
        const violations = data?.violationDetails || [];

        return violations.map((row: any) => ({
            ...row,
            id: String(id++),
            cellProps: getWadCellProps(isWad, t)
        }));
    }, [data, isWad, t]);

    // Build column definitions dynamically from registry
    const TableColDefs: ColumnProps[] = useMemo(() => {
        const dataColumns: ColumnProps[] = columnConfig.columns.map((col: any, index: number) => ({
            Header: col.label,
            accessor: col.accessor || col.key,
            id: String(index + 1),
            isSortable: false,
            filterOptions: 'auto' as const,
            isSticky: index === 0, // First column is sticky
            width: col.width || (windowSize.width >= 1920 ? 'auto' : '481px'),
            renderCell: (cellData: any) => {
                // Handle special formatting based on column key
                if (col.key === 'value' && configId === 'performance-tier') {
                    return cellData ? `${cellData}%` : t('databases.general.unavailable');
                }

                // snapshot-copy-reserve shows percentage
                if (col.key === 'value' && configId === 'snapshot-copy-reserve') {
                    return cellData ? `${cellData}%` : t('databases.general.unavailable');
                }

                if (col.key === 'rss' && typeof cellData === 'boolean') {
                    return cellData ? 'Enabled' : 'Disabled';
                }

                if (col.key === 'divergence' && typeof cellData === 'number') {
                    return `${cellData}%`;
                }

                return cellData || t('databases.general.unavailable');
            }
        }));

        // Add Fix button column if optimization is supported
        if (canOptimize && handleRowFix) {
            const fixButtonColumn = {
                Header: '',
                accessor: 'action',
                id: String(dataColumns.length + 1),
                isSortable: false,
                filterOptions: 'auto' as const,
                isSticky: true,
                width: '230px',
                renderCell: (cellData: any, rowData: any) => {
                    // Show disabled button with popover if bulk selection is active
                    if (selectedRowsForOptimizeInnerPage && selectedRowsForOptimizeInnerPage.length > 0) {
                        return (
                            <div className={styles.buttonContainer}>
                                <div />
                                <Popover
                                    isAppendedToBody
                                    children={
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.bulk-action-enabled-on-selected')}
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
                        );
                    }

                    // Show active Fix button
                    return (
                        <div className={styles.buttonContainer}>
                            <div />
                            <DsButton isThin variant="secondary" onClick={() => handleRowFix(rowData)}>
                                {t('databases.well-architect.fix')}
                            </DsButton>
                        </div>
                    );
                }
            } as unknown as ColumnProps;
            dataColumns.push(fixButtonColumn);
        }

        return dataColumns;
    }, [columnConfig, configId, canOptimize, handleRowFix, selectedRowsForOptimizeInnerPage, windowSize.width, t]);

    // Table props
    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: canOptimize ? 'multiple' : 'none',
        defaultSelectedRows: []
    });

    // Handle row selection
    useEffect(() => {
        if (!canOptimize) return;

        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);
        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        if (rowsData.length > 0 && inProgressOptimizationData?.[configId]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, canOptimize, configId, inProgressOptimizationData, tableData, dispatch]);

    // Determine table titles
    const resourceTypeLabel = columnConfig.resourceTypeLabel || 'Item';
    const tableTitle = columnConfig.tableTitle || `Impacted ${resourceTypeLabel.toLowerCase()}s`;

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={tableTitle}
                singularTitle={resourceTypeLabel}
            />
            {canOptimize && selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer action={t('databases.well-architect.fix')} onClick={handleBulkAction} />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
                key={Date.now()}
            />
        </div>
    );
};

export default DynamicInnerTable;
