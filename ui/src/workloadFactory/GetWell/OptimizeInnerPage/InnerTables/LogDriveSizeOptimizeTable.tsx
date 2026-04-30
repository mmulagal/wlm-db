import { Table, useTable, TableTopBar, Typography, Popover, DsButton, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { checkBoxHandle, getSelectedFromSelectionState, getTruncatedItems } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_STATUS } from '../../../../utils/consts';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';

const LogDriveSizeOptimizeTable = ({ type, data, lastColDetails, handleBulkAction, isWad = false }: any) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);

    const na = t('databases.general.not-available-table-columns');

    const tableData = useMemo(() => {
        let id = 0;
        const uniqueViolatedRows: any = [];
        const uniqueViolatedList: any = [];

        data?.sizingViolations?.overProvisionedDrives?.forEach((row: any) => {
            if (!uniqueViolatedList.includes(row.logAccessPath)) {
                uniqueViolatedList.push(row.logAccessPath);
                uniqueViolatedRows.push({
                    ...row,
                    status: GETWELL_STATUS.OVER_PROVISIONED
                });
            }
        });
        data?.sizingViolations?.underProvisionedDrives?.forEach((row: any) => {
            if (!uniqueViolatedList.includes(row.logAccessPath)) {
                uniqueViolatedList.push(row.logAccessPath);
                uniqueViolatedRows.push({
                    ...row,
                    status: GETWELL_STATUS.UNDER_PROVISIONED
                });
            }
        });
        data?.sizingViolations?.ignoredDrives?.forEach((row: any) => {
            if (!uniqueViolatedList.includes(row.logAccessPath)) {
                uniqueViolatedList.push(row.logAccessPath);
                uniqueViolatedRows.push({
                    ...row,
                    status: GETWELL_STATUS.SHARED_DRIVE
                });
            }
        });
        return uniqueViolatedRows?.map((row: any) => ({
            ...row,
            id: String(id++),
            cellProps: {
                isDisabled:
                    row?.status === GETWELL_STATUS.OVER_PROVISIONED || row?.status === GETWELL_STATUS.SHARED_DRIVE,
                selectionProps: {
                    title:
                        row?.status === GETWELL_STATUS.OVER_PROVISIONED
                            ? t('databases.well-architect.log-drive-over-provisioned-error')
                            : row?.status === GETWELL_STATUS.SHARED_DRIVE
                            ? t('databases.well-architect.not-optimized-shared-drive')
                            : ''
                }
            }
        }));
    }, [data, isWad]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.drive-name'),
            accessor: 'logAccessPath',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any, rowData: any) => cellData || na
        },
        {
            Header: t('databases.well-architect.lun-path'),
            accessor: 'lunPath',
            id: '6',
            isSortable: false,
            filterOptions: 'auto',
            width: 'auto',
            renderCell: (cellData: any) =>
                cellData ? (
                    <Typography title={String(cellData)} variant="Regular_14" className={styles.lunPathCell}>
                        {cellData}
                    </Typography>
                ) : (
                    na
                )
        },

        {
            Header: t('databases.well-architect.databases'),
            accessor: 'databases',
            id: '7',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                const truncatedItems = getTruncatedItems(cellData);

                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <div className={styles.container}>
                                <Typography
                                    title={truncatedItems?.maxItemsToShow.join(', ')}
                                    variant="Regular_14"
                                    className={styles.sqlServerInstance}
                                >
                                    {truncatedItems?.maxItemsToShow.join(', ')}
                                </Typography>
                                {truncatedItems?.remaining.length > 0 && (
                                    <Popover
                                        popoverClass={styles['log-drive-size-popover']}
                                        children={truncatedItems?.remaining.map((item: any) => (
                                            <Typography variant="Regular_14">{item}</Typography>
                                        ))}
                                        trigger="click"
                                        interactive
                                        isAppendedToBody
                                        delayHide={200}
                                        container={
                                            <Typography variant="Regular_14" className={styles.colorText}>
                                                {`+ ${truncatedItems?.remaining.length}`}
                                            </Typography>
                                        }
                                    />
                                )}
                            </div>
                        ) : (
                            ''
                        )}
                        {!cellData ? na : ''}
                    </div>
                );
            }
        },

        {
            Header: t('databases.well-architect.status'),
            accessor: 'status',
            id: '3',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: string) => cellData || na
        },
        {
            Header: t('databases.well-architect.log-drive-size-percentage'),
            accessor: 'sizePercentToDataDrive',
            id: '4',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: string) => (cellData ? `${cellData}%` : na)
        },
        lastColDetails(type, {}, '240px') // 230
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.well-architect.impacted-drives')}
                singularTitle={t('databases.well-architect.impacted-drive')}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer action={t('databases.well-architect.fix')} onClick={handleBulkAction} />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default LogDriveSizeOptimizeTable;
