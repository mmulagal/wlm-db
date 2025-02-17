import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';
import FirstColumnComponent from '../../../Dashboard/DashboardInnerPage/RenderTables/FirstColumnCoponent';

import { useMemo } from 'react';

const LogFilesOptimizeTable = ({ type, lastColDetails, handleBulkAction }: any) => {
    const data = [
        {
            serverInstanceName: 'Volume 1',
            status: 'Up',

            id: '1'
        },
        {
            serverInstanceName: 'Volume 2',
            status: 'Up',

            id: '2'
        }
    ];

    const tableData = useMemo(() => {
        return data.map((row: any) => ({
            ...row
        }));
    }, [data]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Database name',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '1106px',
            renderCell: (cellData: any, rowData: any) => {
                return <FirstColumnComponent rowData={rowData} />;
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
        selectionType: 'none',
        defaultSelectedRows: tableData.map(item => item.id)
    });

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted volumes`}
                singularTitle={'Impacted volume'}
            />

            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                key={Date.now()}
            />
        </div>
    );
};

export default LogFilesOptimizeTable;
