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
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import { buildSubConfigValues, ColumnConfig } from '../../../../utils/configRegistry';
import { ASSESSMENT_CONFIG_IDS, GETWELL_STATUS, RSS_COLUMN_KEYS } from '../../../../utils/consts';

interface DynamicInnerTableProps {
    configId: string;
    data: any;
    columnConfig: ColumnConfig;
    engineType: string;
    isWad?: boolean;
    canOptimize?: boolean;
    isViewOnly?: boolean;
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
    isViewOnly = false,
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
        const addRowMeta = (row: any) => {
            const baseProps = { ...row, id: String(id++), cellProps: getWadCellProps(isWad, t) };

            // For log-drive-size and tempdb-drive-size: disable checkboxes for over-provisioned and shared/ignored drives
            if (
                (configId === ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE ||
                    configId === ASSESSMENT_CONFIG_IDS.TEMPDB_DRIVE_SIZE) &&
                row.status
            ) {
                const translatedOverProvisioned = t('databases.well-architect.over-provisioned');
                const translatedSharedDrive = t('databases.well-architect.shared-drive');

                const isOverProvisioned = row.status === translatedOverProvisioned;
                const isSharedDrive = row.status === translatedSharedDrive;

                if (isOverProvisioned || isSharedDrive) {
                    baseProps.cellProps = {
                        ...baseProps.cellProps,
                        isDisabled: true,
                        selectionProps: {
                            title: isOverProvisioned
                                ? configId === ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE
                                    ? t('databases.well-architect.log-drive-over-provisioned-error')
                                    : t('databases.well-architect.tempdb-drive-over-provisioned-error')
                                : t('databases.well-architect.not-optimized-shared-drive')
                        }
                    };
                }
            }

            return baseProps;
        };

        // Handle custom data mapping (read from alternate paths)
        if (columnConfig.dataMapping?.sources) {
            return columnConfig.dataMapping.sources.flatMap(({ path, status }) => {
                const sourceData = path.split('.').reduce((obj: any, key) => obj?.[key], data);
                if (!Array.isArray(sourceData)) return [];
                return sourceData.map((item: any) =>
                    addRowMeta({
                        // Handle both object items and primitive (string) items
                        ...(typeof item === 'object' ? item : { objectName: item }),
                        recommended: data?.recommended,
                        ...(status && { status: t(status) }),
                        // For RSS config, include top-level settings
                        ...(configId === ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION && {
                            tcpOffloadState: data?.tcpOffloadState,
                            recommendedAdapterSettings: data?.recommendedAdapterSettings
                        })
                    })
                );
            });
        }

        // Default: violationDetails
        if (data?.violationDetails?.length) {
            return data.violationDetails.map((row: any) =>
                addRowMeta({
                    ...row,
                    ...(columnConfig.hasSubConfigs ? buildSubConfigValues(row, data?.configDetails) : {})
                })
            );
        }

        // Fallback: objectsInViolation
        if (data?.objectsInViolation?.length) {
            return data.objectsInViolation.map((name: string) => addRowMeta({ objectName: name }));
        }

        return [];
    }, [data, isWad, t, columnConfig, configId]);

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
            renderCell: (cellData: any, rowData: any) => {
                // snapshot-copy-reserve shows percentage
                if (col.key === 'value' && configId === ASSESSMENT_CONFIG_IDS.SNAPSHOT_COPY_RESERVE) {
                    return cellData != null ? `${cellData}%` : t('databases.general.unavailable');
                }

                if (col.key === 'rss' && typeof cellData === 'boolean') {
                    return cellData ? 'Enabled' : 'Disabled';
                }

                // Percentage values (divergence, drive size percentage)
                if ((col.key === 'divergence' || col.key === 'sizePercentToDataDrive') && cellData != null) {
                    return `${cellData}%`;
                }

                // Databases array - join with comma
                if (col.key === 'databases' && Array.isArray(cellData)) {
                    return cellData.join(', ') || t('databases.general.unavailable');
                }

                // RSS status columns (Network Adapter Settings)
                if (configId === ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION) {
                    const recommended = rowData?.recommendedAdapterSettings;
                    let isOptimized = false;
                    let tooltipValue = cellData;

                    // Determine if optimized based on column key
                    switch (col.key) {
                        case RSS_COLUMN_KEYS.TCP_OFFLOADING:
                            isOptimized = rowData?.tcpOffloadState === 'Disabled';
                            tooltipValue = rowData?.tcpOffloadState || cellData;
                            break;
                        case RSS_COLUMN_KEYS.NUMBER_OF_RECEIVE_QUEUES:
                            isOptimized = cellData === recommended?.recommendedReceiveQueues;
                            break;
                        case RSS_COLUMN_KEYS.RSS_PROFILE:
                            isOptimized = cellData === recommended?.recommendedRssProfile;
                            break;
                        case RSS_COLUMN_KEYS.RSS_ENABLED:
                            isOptimized = cellData === true;
                            tooltipValue = cellData ? 'Enabled' : 'Disabled';
                            break;
                        case RSS_COLUMN_KEYS.BASE_PROCESSOR_NUMBER:
                            isOptimized = cellData === recommended?.recommendedBaseProcessorNumber;
                            break;
                    }

                    const statusText = isOptimized ? GETWELL_STATUS.OPTIMIZED : GETWELL_STATUS.NOT_OPTIMIZED;
                    return (
                        <div className={styles.rssCell}>
                            <Popover
                                popoverClass=""
                                children={String(tooltipValue)}
                                trigger="hover"
                                container={<TooltipIcon />}
                            />
                            <DsTypography variant="Regular_13">{statusText}</DsTypography>
                        </div>
                    );
                }

                return cellData || t('databases.general.unavailable');
            }
        }));

        // Add action button column: "Fix" for fixable configs, "View" for view-only configs
        const showFixButton = canOptimize && handleRowFix;
        const showViewButton = !canOptimize && isViewOnly && handleRowFix;

        if ((showFixButton || showViewButton) && handleRowFix) {
            const buttonLabel = t('databases.well-architect.fix');

            const actionColumn = {
                Header: '',
                accessor: 'action',
                id: String(dataColumns.length + 1),
                isSortable: false,
                filterOptions: 'auto' as const,
                isSticky: true,
                width: '230px',
                renderCell: (cellData: any, rowData: any) => {
                    // Check if row is disabled (for log/tempdb drive sizing with over-provisioned or shared drives)
                    const isRowDisabled = rowData?.cellProps?.isDisabled;
                    const disabledTooltip = rowData?.cellProps?.selectionProps?.title;

                    if (
                        showFixButton &&
                        selectedRowsForOptimizeInnerPage &&
                        selectedRowsForOptimizeInnerPage.length > 0
                    ) {
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
                                            {buttonLabel}
                                        </DsButton>
                                    }
                                />
                            </div>
                        );
                    }

                    // If row is disabled (over-provisioned or shared drive), show disabled button with tooltip
                    if (showFixButton && isRowDisabled && disabledTooltip) {
                        return (
                            <div className={styles.buttonContainer}>
                                <div />
                                <Popover
                                    isAppendedToBody
                                    children={<DsTypography variant="Regular_14">{disabledTooltip}</DsTypography>}
                                    trigger="hover"
                                    container={
                                        <DsButton variant="secondary" isDisabled isThin>
                                            {buttonLabel}
                                        </DsButton>
                                    }
                                />
                            </div>
                        );
                    }

                    return (
                        <div className={styles.buttonContainer}>
                            <div />
                            <DsButton isThin variant="secondary" onClick={() => handleRowFix(rowData)}>
                                {buttonLabel}
                            </DsButton>
                        </div>
                    );
                }
            } as unknown as ColumnProps;
            dataColumns.push(actionColumn);
        }

        return dataColumns;
    }, [
        columnConfig,
        configId,
        canOptimize,
        isViewOnly,
        handleRowFix,
        selectedRowsForOptimizeInnerPage,
        windowSize.width,
        t
    ]);

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
