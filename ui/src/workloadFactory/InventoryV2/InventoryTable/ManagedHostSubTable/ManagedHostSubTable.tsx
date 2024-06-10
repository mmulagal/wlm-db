import { Table, useTable, useDialog, DsTypography, Typography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHostSubTable.module.scss';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { useEffect, useRef, useState } from 'react';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import { WLF_TABS } from '../../../../utils/consts';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { formatSizeTwoPrecision, isAwsBackupEnabled } from '../../../../utils/utilityFunctions';
import { renderAllocatedCapacity } from '../../../Inventory/InventoryUtils';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';
import DotComponent from '../../../../common/DotComponent/DotComponent';

const ManagedHostSubTable = ({ rowId, scrollPosition }: { rowId: string; scrollPosition: any }) => {
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);

    const [menuOpenedRow, setOpenedRow] = useState(null);

    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [data, setData] = useState<any>();

    const dispatch = useDispatch();

    useEffect(() => {
        if (inventoryTableData?.[rowId] && inventoryTableData?.[rowId]?.sqlServerInstances) {
            const newTable = inventoryTableData?.[rowId]?.sqlServerInstances?.map(perRow => {
                let protectionText = '';
                if (
                    isAwsBackupEnabled(perRow) ||
                    perRow?.protection?.isFsxOntapSnapshotsEnabled ||
                    perRow?.protection?.isSqlNativeEnabled
                ) {
                    protectionText = 'Yes';
                } else if (perRow?.protection) {
                    protectionText = 'No';
                }
                return {
                    ...perRow,
                    status: perRow?.isManaged ? 'Managed' : 'Unmanaged',
                    protectionText: protectionText,
                    allocatedCapacityText: perRow?.allocatedCapacity
                        ? formatSizeTwoPrecision(perRow?.allocatedCapacity)
                        : ''
                };
            });
            setData(newTable);
        } else {
            setData([]);
        }
    }, [rowId, inventoryTableData]);

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
                return { ...obj, cellProps: { isDisabled: true }, status: 'In progress' };
            }
            return obj;
        });
        setData(output);

        setTimeout(() => {
            let output = data.map((obj: any) => {
                if (obj.name === rowData.name) {
                    return { ...obj, cellProps: { isDisabled: false }, status: 'Managed' };
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
                if (!rowData.isDetected) {
                    menu.push({
                        id: 'detect',
                        displayName: 'Detect'
                    });
                } else if (rowData.status === 'Unmanaged') {
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
                            isDisabled={rowData.fileSystemType === 'EBS'}
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
                            disabledText={rowData.fileSystemType === 'EBS' && GENERAL.EBS_TOOLTIP_MESSAGE}
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
            accessor: 'databaseInstanceName',
            id: '1',
            isSortable: true,
            width: '212px',
            isSticky: true
        },
        {
            Header: 'Status',
            accessor: 'status',
            id: '2',
            isSortable: false,
            width: '180px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                if (cellData === 'Unmanaged') {
                    return <DotComponent color={'var(--toggle-off-bg)'} value="Unmanaged" />;
                }
                if (cellData === 'In progress') {
                    return (
                        <div className={styles.inProgress}>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">In progress</DsTypography>
                        </div>
                    );
                }
                if (cellData === 'Managed') {
                    return <DotComponent color={'var(--success)'} value="Managed" />;
                }
            }
        },
        {
            Header: 'Storage type',
            accessor: 'fileSystemType',
            id: '3',
            width: '160px',
            filterOptions: 'auto'
        },
        {
            Header: 'Storage savings',
            accessor: 'storageSavingsText',
            id: '4',
            width: '172px',
            isSortable: true,
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Storage availability',
            accessor: 'fileSystemDeploymentMode',
            id: '5',
            width: '193px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Protection',
            accessor: 'protectionText',
            id: '6',
            width: '135px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Performance',
            accessor: 'performance.assessment',
            id: '7',
            width: '150px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Allocation capacity',
            accessor: 'allocatedCapacityText',
            id: '8',
            width: '190px',
            isSortable: true,
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(cellData, rowData);
            }
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

            <span className={styles.managedSubTable} style={{ position: 'relative', left: `${scrollPosition}px` }}>
                <Table
                    //@ts-ignore

                    tableProps={tableProps}
                    variant="innerTable"
                />
            </span>

            {/* <div className={styles.topDiv} /> */}
        </div>
    );
};

export default ManagedHostSubTable;
