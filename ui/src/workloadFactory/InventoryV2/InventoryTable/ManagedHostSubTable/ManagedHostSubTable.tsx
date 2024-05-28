import { Table, useTable, useDialog, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHostSubTable.module.scss';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { useEffect, useRef, useState } from 'react';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import ManagedHostDialog from '../ManagedHostDialog/ManagedHostDialog';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import { WLF_TABS } from '../../../../utils/consts';
import { useNavigate } from 'react-router-dom';

const ManagedHostSubTable = () => {
    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [data, setData] = useState<any>();

    const dispatch = useDispatch();

    const mockData = [
        {
            id: '1',
            name: 'instance 1',
            storageType: 'EBS',
            storageSavings: '5.91%',
            protection: '100% protection',
            allocatedCapacity: '7.2 TiB',
            performance: 'High',
            status: 'Unmanaged'
        },
        {
            id: '2',
            name: 'instance 2',
            storageType: 'Fsx for ONTAP',
            storageSavings: 'N/A',
            protection: '100% protection',
            allocatedCapacity: '7.2 TiB',
            performance: 'High',
            status: 'managed'
        }
    ];

    useEffect(() => {
        setData(mockData);
    }, []);

    const handleDialog = () => {
        setDialog(
            <DialogComponent
                header={'Unmanage instance'}
                content={
                    <>
                        <DsTypography variant="Regular_14">
                            Are you sure you want to unmanage the SQL Server instance?{' '}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ marginTop: '24px', width: '700px' }}>
                            This will exclude the instance from Workload Factory's best practices and lifecycle
                            management. Do you wish to proceed?{' '}
                        </DsTypography>
                    </>
                }
                primaryButton={'Unmanage'}
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

    //Function to manage the row
    const handleManage = (rowData: any) => {
        let output = data.map((obj: any) => {
            if (obj.name === rowData.name) {
                return { ...obj, cellProps: { isDisabled: true }, status: 'inProgress' };
            }
            return obj;
        });
        setData(output);

        setTimeout(() => {
            let output = data.map((obj: any) => {
                if (obj.name === rowData.name) {
                    return { ...obj, cellProps: { isDisabled: false }, status: 'managed' };
                }
                return obj;
            });
            setData(output);
        }, 5000);
    };

    const lastColDetails = () => {
        return {
            id: '9',
            Header: '',
            accessor: 'name',
            renderCell: (cellData: any, rowData: any) => {
                const menu = [];
                if (rowData.status === 'Unmanaged') {
                    menu.push({
                        id: 'manage',
                        displayName: 'Manage'
                    });
                } else {
                    menu.push(
                        {
                            id: 'viewInstance',
                            displayName: 'View instance'
                        },

                        {
                            id: 'viewDatabases',
                            displayName: 'View databases'
                        },

                        {
                            id: 'createUserDb',
                            displayName: 'Create user database'
                        },
                        {
                            id: 'unManage',
                            displayName: 'Unmanage'
                        }
                    );
                }

                return (
                    <div className={styles.jobMenuPopover}>
                        <MenuPopover
                            isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                            menuItems={[...menu]}
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

                                    if (menuId === 'manage') {
                                        handleManage(rowData);
                                    }
                                    if (menuId === 'viewInstance') {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.OVERVIEW));
                                        dispatch(selectedTabSelection(WLF_TABS.OVERVIEW));
                                    }
                                    if (menuId === 'viewDatabases') {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.OVERVIEW));
                                        dispatch(selectedTabSelection(WLF_TABS.DATABASE_LIST));
                                    }
                                    if (menuId === 'createUserDb') {
                                        navigate('../create-new-user');
                                    }
                                    if (menuId === 'unManage') {
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
            accessor: 'status',
            id: '2',
            isSortable: false,
            width: '180px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                if (rowData.status === 'Unmanaged') {
                    return <DotComponent color={'var(--toggle-off-bg)'} value="Unmanaged" />;
                }
                if (rowData.status === 'inProgress') {
                    return (
                        <div className={styles.inProgress}>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">In progress</DsTypography>
                        </div>
                    );
                }
                if (rowData.status === 'managed') {
                    return <DotComponent color={'var(--success)'} value="Managed" />;
                }
            }
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
        rows: data,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true
    });
    return (
        <div className={styles.managedHostSubTable}>
            {/* <div className={styles.topDiv} /> */}
            <div className={styles.extraDiv2} />

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