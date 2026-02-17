import { Table, useTable, TableTopBar, Typography, Popover, DsButton, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { title } from 'process';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { checkBoxHandle, getSelectedFromSelectionState, getTruncatedItems } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';

const LogDriveSizeOptimizeTable = ({ type, data, lastColDetails, handleBulkAction, isWad = false }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);

    const tableData = useMemo(() => {
        let id = 0;
        const uniqueViolatedRows: any = [];
        const uniqueViolatedList: any = [];

        data?.sizingViolations?.overProvisionedDrives?.map((row: any) => {
            if (!uniqueViolatedList.includes(row.logAccessPath)) {
                uniqueViolatedList.push(row.logAccessPath);
                uniqueViolatedRows.push({
                    ...row,
                    status: 'Over-provisioned'
                });
            }
        });
        data?.sizingViolations?.underProvisionedDrives?.map((row: any) => {
            if (!uniqueViolatedList.includes(row.logAccessPath)) {
                uniqueViolatedList.push(row.logAccessPath);
                uniqueViolatedRows.push({
                    ...row,
                    status: 'Under-provisioned'
                });
            }
        });
        data?.sizingViolations?.ignoredDrives?.map((row: any) => {
            if (!uniqueViolatedList.includes(row.logAccessPath)) {
                uniqueViolatedList.push(row.logAccessPath);
                uniqueViolatedRows.push({
                    ...row,
                    status: 'Shared drive'
                });
            }
        });
        return uniqueViolatedRows?.map((row: any) => ({
            ...row,
            id: String(id++),
            cellProps: {
                isDisabled: row?.status === 'Over-provisioned' || row?.status === 'Shared drive',
                selectionProps: {
                    title:
                        row?.status === 'Over-provisioned'
                            ? GENERAL.LOG_DRIVE_OVER_PROVISIONED_ERROR
                            : row?.status === 'Shared drive'
                            ? GENERAL.NOT_OPTIMIZED_SHARED_DRIVES
                            : ''
                }
            }
        }));
    }, [data, isWad]);

    const disableOptimizeButtonTooltip = useMemo(() => {
        if (
            data?.sizingViolations?.overProvisionedDrives?.length &&
            !data?.sizingViolations?.underProvisionedDrives?.length
        ) {
            return GENERAL.LOG_DRIVE_OVER_PROVISIONED_ERROR;
        }
        if (!data?.sizingViolations?.underProvisionedDrives?.length && data?.sizingViolations?.ignoredDrives?.length) {
            return GENERAL.NOT_OPTIMIZED_SHARED_DRIVES;
        }
        return '';
    }, [data]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Drive name',
            accessor: 'logAccessPath',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '224px',
            renderCell: (cellData: any, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },

        {
            Header: 'Databases',
            accessor: 'databases',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '284px',
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
                        {!cellData ? GENERAL.NOT_AVAILABLE : ''}
                    </div>
                );
            }
        },

        {
            Header: 'Status',
            accessor: 'status',
            id: '3',
            width: '224px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: 'Log drive size percentage',
            accessor: 'sizePercentToDataDrive',
            id: '4',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: string) => (cellData ? `${cellData}%` : GENERAL.NOT_AVAILABLE)
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
                pluralTitle="Impacted drives"
                singularTitle="Impacted drive"
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer action={GENERAL.OPTIMIZE} onClick={handleBulkAction} />
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

export default LogDriveSizeOptimizeTable;
