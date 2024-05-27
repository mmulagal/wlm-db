import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ManagedHostDialog.module.scss';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import { useEffect } from 'react';

const ManagedHostDialog = () => {
    const mockData = [
        {
            id: '1',
            cellProps: { isDisabled: true },
            serverInstance: 'SQL Server instance 1',
            status: 'Unmanaged',
            storageType: 'FSx for ONTAP'
        },
        { id: '2', serverInstance: 'SQL Server instance 2', status: 'Unmanaged', storageType: 'FSx for ONTAP' },
        { id: '3', serverInstance: 'SQL Server instance 3', status: 'Unmanaged', storageType: 'FSx for ONTAP' },
        { id: '4', serverInstance: 'SQL Server instance 4', status: 'Unmanaged', storageType: 'FSx for ONTAP' },
        { id: '5', serverInstance: 'SQL Server instance 5', status: 'Unmanaged', storageType: 'FSx for ONTAP' }
    ];
    const managedHostDialogColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance',
            accessor: 'serverInstance',
            id: '1',
            isSortable: true,
            width: '212px'
        },
        {
            Header: 'Status',
            accessor: 'status',
            id: '2',
            width: '192px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return <DotComponent color={'var(--toggle-off-bg)'} value="Unmanaged" />;
            }
        },
        {
            Header: 'Storage type',
            accessor: 'storageType',
            id: '3',
            width: '180px',
            filterOptions: 'auto'
        },
        {
            Header: '',
            accessor: '',
            id: '4',
            width: '56px'
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,

        isSorting: false,
        selectionType: 'multiple',
        columns: managedHostDialogColDefs,
        rows: mockData,
        pageSize: 10,
        defaultSelectedRows: ['1', '2', '3', '4', '5']
    });

    useEffect(() => {
        console.log('changed props', tableProps);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState]);
    return (
        <div className={styles.managedHostDialog}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
            />
        </div>
    );
};

export default ManagedHostDialog;
