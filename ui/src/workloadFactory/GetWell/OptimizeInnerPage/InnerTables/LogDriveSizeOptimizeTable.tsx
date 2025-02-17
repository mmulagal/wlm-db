import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';
import FirstColumnComponent from '../../../Dashboard/DashboardInnerPage/RenderTables/FirstColumnCoponent';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useMemo } from 'react';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../Dashboard/DashboardInnerPage/RenderTables/BulkActionContainer';

const LogDriveSizeOptimizeTable = ({ type, lastColDetails, handleBulkAction }: any) => {
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const data = [
        {
            serverInstanceName: 'Volume 1',
            status: 'Up',
            LogDrivePercent: '50%',
            LogDriveStatus: 'Under-provisioned',
            driveName: 'Drive 1',
            id: '1'
        },
        {
            serverInstanceName: 'Volume 2',
            status: 'Up',
            LogDrivePercent: '50%',
            LogDriveStatus: 'Over-provisioned',
            driveName: 'Drive 2',
            id: '2'
        }
    ];

    const tableData = useMemo(() => {
        return data.map((row: any) => ({
            ...row,
            cellProps: { ...row.cellProps, isDisabled: true }
        }));
    }, [data]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Drive name',
            accessor: 'driveName',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '244px',
            renderCell: (cellData: any, rowData: any) => {
                return <FirstColumnComponent rowData={rowData} />;
            }
        },

        {
            Header: 'Databases',
            accessor: 'serverInstanceName',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '244px',
            renderCell: (cellData: any, rowData: any) => {
                return <FirstColumnComponent rowData={rowData} />;
            }
        },

        {
            Header: 'Status',
            accessor: 'LogDriveStatus',
            id: '3',
            width: '244px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'File system headroom percentage',
            accessor: 'LogDrivePercent',
            id: '4',
            width: '302px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
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
        defaultSelectedRows: tableData.map(item => item.id)
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
                pluralTitle={`Impacted volumes`}
                singularTitle={'Impacted volume'}
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
