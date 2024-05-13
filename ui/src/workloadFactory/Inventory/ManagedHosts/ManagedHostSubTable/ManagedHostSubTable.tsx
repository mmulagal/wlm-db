import { Table, useTable, Typography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHostSubTable.module.scss';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { useRef, useState } from 'react';

const ManagedHostSubTable = () => {
    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    const menuItems = (row: any) => {
        return [
            {
                id: 'manageInstance',
                displayName: 'Manage instance'
            },
            {
                id: 'refresh',
                displayName: 'Refresh'
            },
            {
                id: 'viewInstance',
                displayName: 'View instance'
            },
            {
                id: 'viewDatabase',
                displayName: 'View database'
            },
            {
                id: 'createNewUserDatabase',
                displayName: 'Create new user database'
            },
            {
                id: 'remove',
                displayName: 'Remove'
            }
        ];
    };
    const mockData = [
        {
            id: '1',
            name: 'instance 1',
            storageType: 'EBS',
            storageSavings: '5.91%',
            protection: '100% protection',
            allocatedCapacity: '7.2 TiB',
            performance: 'High'
        },
        {
            id: '2',
            name: 'instance 2',
            storageType: 'Fsx for ONTAP',
            storageSavings: 'N/A',
            protection: '100% protection',
            allocatedCapacity: '7.2 TiB',
            performance: 'High'
        }
    ];

    const lastColDetails = () => {
        return {
            id: '8',
            Header: '',
            accessor: 'name',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.jobMenuPopover}>
                        <MenuPopover
                            isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                            menuItems={menuItems(rowData)}
                            toggleMenu={(toggleType: string, menuId: string) => {
                                if (toggleType === 'close') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(null);
                                } else if (toggleType === 'open') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(rowData.id);
                                    menuOpenedRowDetail.current = rowData.id;
                                } else if (toggleType === 'selectedOption') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(null);

                                    if (menuId === 'goToCf') {
                                    }
                                }
                            }}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                );
            },
            showHide: true,
            width: '57px',
            isSticky: true
        };
    };
    const managedHostSubTableColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance',
            accessor: 'name',
            id: '1',
            isSortable: false,
            width: '200px'
        },
        {
            Header: 'Storage type',
            accessor: 'storageType',
            id: '2',
            width: '200px'
        },
        {
            Header: 'Storage savings',
            accessor: 'storageSavings',
            id: '3',
            width: '200px'
        },
        {
            Header: 'Protection',
            accessor: 'protection',
            id: '4',
            width: '200px'
        },
        {
            Header: 'Performance',
            accessor: 'performance',
            id: '5',
            width: '240px'
        },
        {
            Header: 'Allocation capacity',
            accessor: 'allocatedCapacity',
            id: '6',
            width: '240px'
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,

        columns: managedHostSubTableColDefs,
        rows: mockData,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true
    });
    return (
        <div className={styles.managedHostSubTable}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
            />
        </div>
    );
};

export default ManagedHostSubTable;
