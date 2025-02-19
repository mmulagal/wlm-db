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

const RSSOptimizeTable = ({ type, lastColDetails, handleBulkAction }: any) => {
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const data = [
        {
            serverInstanceName: 'Network adapter name 1',
            status: 'Up',
            tcpOffloading: 'Not optimized ',
            receivingQueue: 'Not optimized ',
            rssProfile: 'Not optimized ',
            rssStatus: 'Not optimized',
            baseProcessor: 'Not optimized ',

            id: '1'
        },
        {
            serverInstanceName: 'Network adapter name 2',
            status: 'Up',
            tcpOffloading: 'Optimized ',
            receivingQueue: 'Optimized ',
            rssProfile: 'Optimized ',
            rssStatus: 'Not optimized',
            baseProcessor: 'Optimized ',

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
            Header: 'Volume name',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '219px',
            renderCell: (cellData: any, rowData: any) => {
                return <FirstColumnComponent rowData={rowData} />;
            }
        },

        {
            Header: 'TCP offloading',
            accessor: 'tcpOffloading',
            id: '3',
            width: '174px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Receive queues',
            accessor: 'receivingQueue',
            id: '4',
            width: '174px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'RSS profile',
            accessor: 'rssProfile',
            id: '5',
            width: '174px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'RSS status',
            accessor: 'rssStatus',
            id: '6',
            width: '174px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Base processor',
            accessor: 'baseProcessor',
            id: '7',
            width: '174px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails(type, {})
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

export default RSSOptimizeTable;
