import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './DatabaseListTable.module.scss';

const DatabaseListTable = () => {
    const data: any = [
        {
            databaseName: 'Database name 1',
            status: 'On',
            size: '1.125 TiB',
            id: '1',
            protection: 'Protected',
            type: 'System Database'
        },
        {
            databaseName: 'Database name 2',
            status: 'On',
            size: '1.125 TiB',
            id: '2',
            protection: 'Protected',
            type: 'System Database'
        },
        {
            databaseName: 'Database name 3',
            status: 'On',
            size: '1.125 TiB',
            id: '3',
            protection: 'Protected',
            type: 'System Database'
        },
        {
            databaseName: 'Database name 4',
            status: 'On',
            size: '1.125 TiB',
            id: '4',
            protection: 'Protected',
            type: 'System Database'
        },
        {
            databaseName: 'Database name 5',
            status: 'On',
            size: '1.125 TiB',
            id: '5',
            protection: 'Not Protected',
            type: 'User Database'
        },
        {
            databaseName: 'Database name 6',
            status: 'On',
            size: '1.125 TiB',
            id: '6',
            protection: 'Protected',
            type: 'System Database'
        },
        {
            databaseName: 'Database name 7',
            status: 'On',
            size: '1.125 TiB',
            id: '7',
            protection: 'Protected',
            type: 'User Database'
        },
        {
            databaseName: 'Database name 11',
            status: 'On',
            size: '1.125 TiB',
            id: '8',
            protection: 'Protected',
            type: 'System Database'
        },
        {
            databaseName: 'Database name 8',
            status: 'On',
            size: '1.125 TiB',
            id: '9',
            protection: 'Not Protected',
            type: 'System Database'
        },
        {
            databaseName: 'Database name 9',
            status: 'Off',
            size: '1.125 TiB',
            id: '10',
            protection: 'Not protected',
            type: 'User Database'
        }
    ];

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: 'Database name',
            accessor: 'databaseName',
            isSortable: true,
            id: '1',
            width: '311px'
        },
        {
            Header: 'Status',
            accessor: 'status',
            filterOptions: 'auto',
            id: '2',
            width: '180px'
        },
        {
            Header: 'Size',
            accessor: 'size',
            isSortable: true,
            id: '3',
            width: '240px'
        },
        {
            Header: 'Protection',
            accessor: 'protection',
            filterOptions: 'auto',
            id: '4',
            width: '240px'
        },
        {
            Header: 'Type',
            accessor: 'type',
            filterOptions: 'auto',
            id: '5',
            width: '240px'
        },
        {
            Header: '',
            accessor: '',
            id: '6',
            width: '398px'
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        columns: EncryptionColDefs,
        rows: data,
        pageSize: 10
    });
    return (
        <div className={styles.databaseListTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={'Databases'}
                singularTitle={'Database'}
            />
            <Table
                //@ts-ignore
                tableProps={tableProps}
            />
        </div>
    );
};

export default DatabaseListTable;
