import { Table, useTable, TableTopBar, Typography, Popover } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useMemo } from 'react';
import { getSelectedFromSelectionState, getTruncatedItems } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../Dashboard/DashboardInnerPage/RenderTables/BulkActionContainer';

const LogDriveSizeOptimizeTable = ({ type, data, lastColDetails, handleBulkAction }: any) => {
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);

    const tableData = useMemo(() => {
        let id = 0;
        let uniqueViolatedRows: any = [];
        let uniqueViolatedList: any = [];

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
            cellProps: { ...row.cellProps, isDisabled: true }
        }));
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
            renderCell: (cellData: any, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
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
                                    <>
                                        <Popover
                                            popoverClass={styles['popover']}
                                            children={truncatedItems?.remaining.map((item: any) => (
                                                <Typography variant="Regular_14">{item}</Typography>
                                            ))}
                                            trigger="click"
                                            interactive={true}
                                            delayHide={200}
                                            container={
                                                <Typography variant="Regular_14" className={styles.colorText}>
                                                    {`+ ${truncatedItems?.remaining.length}`}
                                                </Typography>
                                            }
                                        />
                                    </>
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
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Log drive size percentage',
            accessor: 'sizePercentToDataDrive',
            id: '4',
            width: '302px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData ? cellData + '%' : GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails(type, {}, '230px')
    ];

    const tableProps = useTable({
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: tableData.map((item: any) => item.id)
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        // if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length) {
        //     checkBoxHandle(tableProps.selectionState, rowsData, disptach);
        // }
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted drives`}
                singularTitle={'Impacted drive'}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && <BulkActionContainer onClick={handleBulkAction} />}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                key={Date.now()}
            />
        </div>
    );
};

export default LogDriveSizeOptimizeTable;
