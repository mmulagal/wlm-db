import { Table, useTable, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHostSubTable.module.scss';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { useRef, useState } from 'react';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import ManagedHostDialog from '../ManagedHostDialog/ManagedHostDialog';

const ManagedHostSubTable = () => {
    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();

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

    const handleDialog = () => {
        setDialog(
            <DialogComponent
                header={'Manage data base host <data base name> instances'}
                content={<ManagedHostDialog />}
                primaryButton={'Manage'}
                secondaryButton={'Close'}
                callback={() => {
                    console.log('action');
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    const lastColDetails = () => {
        return {
            id: '9',
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

                                    if (menuId === 'manageInstance') {
                                        handleDialog();
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
            isSortable: true,
            width: '212px'
        },
        {
            Header: 'Status',
            accessor: 'name',
            id: '2',
            isSortable: false,
            width: '180px',
            filterOptions: 'auto'
        },
        {
            Header: 'Storage type',
            accessor: 'storageType',
            id: '3',
            width: '160px',
            filterOptions: 'auto'
        },
        {
            Header: 'Storage savings',
            accessor: 'storageSavings',
            id: '4',
            width: '172px',
            isSortable: true
        },
        {
            Header: 'Storage availability',
            accessor: 'storageSavings',
            id: '5',
            width: '193px',
            filterOptions: 'auto'
        },
        {
            Header: 'Protection',
            accessor: 'protection',
            id: '6',
            width: '135px',
            filterOptions: 'auto'
        },
        {
            Header: 'Performance',
            accessor: 'performance',
            id: '7',
            width: '150px',
            filterOptions: 'auto'
        },
        {
            Header: 'Allocation capacity',
            accessor: 'allocatedCapacity',
            id: '8',
            width: '190px',
            isSortable: true
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
            {/* <div className={styles.topDiv} /> */}
            {/* <div className={styles.extraDiv2} /> */}

            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
            />

            {/* <div className={styles.topDiv} /> */}
        </div>
    );
};

export default ManagedHostSubTable;
