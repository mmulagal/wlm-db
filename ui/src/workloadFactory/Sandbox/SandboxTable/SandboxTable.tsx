import { Table, useTable, useDialog, TableTopBar, Button, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './SandboxTable.module.scss';
import { useNavigate } from 'react-router-dom';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSandboxListData } from '../SandboxUtility';
import { useEffect, useRef, useState } from 'react';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import RebaseLineContent from './RebaseLineContent/RebaseLineContent';
import RebaseSplitContent from './RebaseSplitContent/RebaseSplitContent';
import RebaseRollbackContent from './RebaseRollbackContent/RebaseRollbackContent';
import ViewDialog from '../../../common/ViewDialog/ViewDialog';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { useDispatch } from 'react-redux';
import {
    setAggregatedSandboxList,
    setSandboxSavingsState,
    updateConnectionInfo
} from '../../../store/workloadFactory/sandboxSlice';
import SmallLoader from '../../../common/SmallLoader/SmallLoader';
import {
    useDeleteSandboxMutation,
    useLazyGetSandboxSavingsQuery,
    useLazyGetSubTaskListQuery
} from '../../../utils/apiService';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import store from '../../../store/store';

const SandboxTable = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { aggregatedSandboxList, connectionInfo } = useAppSelector(state => state.sandbox);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const [data, setData] = useState<any>();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const [deletedSandboxes, setDeletedSandboxes] = useState<any>([]);
    const [connectionInfoClicked, setConnectionInfoClicked] = useState(false);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();

    const [deleteSandboxApi] = useDeleteSandboxMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [getSandboxSavingsApi] = useLazyGetSandboxSavingsQuery();

    useEffect(() => {
        if (aggregatedSandboxList[0] && 'id' in aggregatedSandboxList[0]) {
            setData(aggregatedSandboxList);
        } else {
            const newData = formatSandboxListData(aggregatedSandboxList);
            setData(newData);
        }
    }, [aggregatedSandboxList]);

    useEffect(() => {
        if (connectionInfoClicked && connectionInfo?.connectionString) {
            const connectionString = connectionInfo.connectionString
                ? Object.keys(connectionInfo.connectionString)
                      .map((key: any) => `${key}=${connectionInfo.connectionString?.[key]}`)
                      .join(';')
                : '';
            setDialog(
                <DialogComponent
                    header={' Show connection info'}
                    content={<ViewDialog data={connectionString} />}
                    primaryButton={GENERAL.CLOSE}
                    callback={() => {}}
                    customClass={styles.setWidth}
                />
            );
            setConnectionInfoClicked(false);
        }
    }, [connectionInfoClicked, connectionInfo]);

    const menuItems = (row: any) => {
        return [
            {
                id: 'reBaseline',
                displayName: 'Re-baseline'
            },
            {
                id: 'refresh',
                displayName: 'Refresh'
            },
            {
                id: 'connectToTools',
                displayName: 'Connect to CI/CD tools'
            },
            {
                id: 'showConnectionInfo',
                displayName: 'Show connection info'
            },
            {
                id: 'split',
                displayName: 'Split'
            },
            {
                id: 'delete',
                displayName: 'Delete'
            }
        ];
    };

    const handleRebaseLine = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.REBASE_LINE}
                content={<RebaseLineContent dialogType="rebase" />}
                primaryButton={GENERAL.REBASE_LINE}
                secondaryButton={GENERAL.CANCEL}
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

    const handleRefresh = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={'Refresh'}
                content={<RebaseLineContent dialogType="refresh" />}
                primaryButton={'Refresh'}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    let output = data.map((obj: any) => {
                        if (obj.name === rowData.name) {
                            return { ...obj, cellProps: { isDisabled: true }, status: 'refresh' };
                        }
                        return obj;
                    });
                    dispatch(setAggregatedSandboxList(output));

                    setTimeout(() => {
                        let output = data.map((obj: any) => {
                            if (obj.name === rowData.name) {
                                return { ...obj, cellProps: { isDisabled: false }, status: 'active' };
                            }
                            return obj;
                        });
                        dispatch(setAggregatedSandboxList(output));
                    }, 5000);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    const handleDelete = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={'Delete'}
                content={
                    <DsTypography variant="Regular_14">
                        Are you sure you want to delete this sandbox database{' '}
                        <span style={{ fontWeight: '590' }}>{rowData?.name}</span>?
                    </DsTypography>
                }
                primaryButton={'Delete'}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    let output = data.map((obj: any) => {
                        if (obj?.id === rowData?.id && obj.name === rowData.name) {
                            return { ...obj, cellProps: { isDisabled: true }, status: 'delete', menuDisable: true };
                        }
                        return obj;
                    });
                    dispatch(setAggregatedSandboxList(output));
                    deleteSandboxApi({
                        credentialsId: headerSelectedCred?.data?.credentialsId,
                        regionId: headerSelectedRegion?.label2,
                        databaseHostId: rowData?.databaseHostId,
                        sandboxName: rowData?.name
                    }).then((res: any) => {
                        if (res?.data) {
                            const jobInterval = setInterval(() => {
                                getJobDetailApi({
                                    credentialId: headerSelectedCred?.data?.credentialsId,
                                    region: headerSelectedRegion?.label2,
                                    id: res?.data?.jobId
                                }).then((jobRes: any) => {
                                    const status = jobRes?.data?.status;
                                    const state = store.getState();
                                    const { aggregatedSandboxList } = state?.sandbox;
                                    if (status === JOB_MONITORING_STATUS.COMPLETED) {
                                        dispatch(
                                            setSandboxSavingsState({
                                                sandboxSavings: {
                                                    consumedStorage: 0,
                                                    savedStorage: 0,
                                                    sandboxSavingsPercentage: 0
                                                },
                                                sandboxSavingsLoading: true,
                                                sandboxSavingsError: ''
                                            })
                                        );
                                        const updatedSandboxList = aggregatedSandboxList.filter(
                                            (item: any) => rowData?.id !== item?.id
                                        );
                                        dispatch(setAggregatedSandboxList(updatedSandboxList));
                                        clearInterval(jobInterval);
                                        dispatch(
                                            addNotification({
                                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                                message: `Sandbox database ${rowData?.name} deleted successfully.`
                                            })
                                        );
                                        getSandboxSavingsApi({
                                            credentialId: headerSelectedCred?.data?.credentialsId,
                                            region: headerSelectedRegion?.label2
                                        }).then((savingsRes: any) => {
                                            if (savingsRes?.data) {
                                                dispatch(
                                                    setSandboxSavingsState({
                                                        sandboxSavings: savingsRes?.data,
                                                        sandboxSavingsLoading: false,
                                                        sandboxSavingsError: ''
                                                    })
                                                );
                                            }
                                        });
                                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                                        let output = aggregatedSandboxList.map((obj: any) => {
                                            if (obj?.id === rowData?.id && obj.name === rowData.name) {
                                                return {
                                                    ...obj,
                                                    cellProps: { isDisabled: false },
                                                    status: 'active',
                                                    menuDisable: false
                                                };
                                            }
                                            return obj;
                                        });
                                        dispatch(setAggregatedSandboxList(output));
                                        dispatch(
                                            addNotification({
                                                notificationType: NOTIFICATION_TYPES.ERROR,
                                                message: `Sandbox database ${rowData?.name} failed to delete.`
                                            })
                                        );
                                        clearInterval(jobInterval);
                                    }
                                });
                            }, 5000);
                        }
                    });
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    const handleSplit = () => {
        setDialog(
            <DialogComponent
                header={'Split'}
                content={<RebaseSplitContent />}
                primaryButton={'Split'}
                secondaryButton={GENERAL.CANCEL}
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

    const handleRollback = () => {
        setDialog(
            <DialogComponent
                header={'Roll-back'}
                content={<RebaseRollbackContent />}
                primaryButton={'Roll-back'}
                secondaryButton={GENERAL.CANCEL}
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

    const handleConnectToTools = () => {
        const dataToDisplay = {
            toggleState: false,
            toggle: true
        };
        setDialog(
            <DialogComponent
                header={'Connect to CI/CD tools'}
                content={<ViewDialog data={JSON.stringify(dataToDisplay, null, 2)} isDownload={true} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
                customClass={styles.setWidth}
            />
        );
    };

    const handleShowConnectionInfo = (rowData: any) => {
        const { databaseHostId, name } = rowData;
        dispatch(
            updateConnectionInfo({
                selectedDatabaseHostId: databaseHostId,
                selectedSandboxName: name,
                connectionString: connectionInfo?.connectionString,
                isLoading: false
            })
        );
        setConnectionInfoClicked(true);
    };

    const lastColDetails = () => {
        return {
            id: '8',
            Header: '',
            accessor: '',
            width: '56px',
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

                                    switch (menuId) {
                                        case 'reBaseline':
                                            handleRebaseLine();
                                            break;
                                        case 'refresh':
                                            handleRefresh(rowData);
                                            break;

                                        case 'delete':
                                            handleDelete(rowData);
                                            break;
                                        case 'split':
                                            handleSplit();
                                            break;
                                        case 'connectToTools':
                                            handleConnectToTools();
                                            break;

                                        case 'showConnectionInfo':
                                            handleShowConnectionInfo(rowData);
                                            break;
                                    }
                                }
                            }}
                            isDisabled={rowData?.menuDisable}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                );
            },
            showHide: true,
            isSticky: true
        };
    };

    const SandboxColDefs: ColumnProps[] = [
        {
            Header: GENERAL.SANDBOX_DB_NAME,
            accessor: 'name',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '200px'
        },
        {
            Header: GENERAL.SANDBOX_DB_HOST_NAME,
            accessor: 'hostName',
            id: '2',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SANDBOX_SOURCE_DB_NAME,
            accessor: 'source',
            id: '3',
            width: '220px',
            isSortable: true
        },
        {
            Header: GENERAL.SANDBOX_SOURCE_DB_HOST_NAME,
            accessor: 'sourceHost',
            id: '4',
            width: '256px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SANDBOX_LAST_UPDATED,
            accessor: 'updatedAt',
            id: '5',
            width: '220px',
            isSortable: true
        },
        {
            Header: GENERAL.AGE,
            accessor: 'age',
            id: '6',
            width: '128px',
            filterOptions: 'auto'
        },

        {
            Header: GENERAL.SANDBOX_TAG,
            accessor: 'tag',
            id: '7',
            width: '128px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SB_STATUS,
            accessor: 'status',
            id: '7',
            width: '180px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return (
                    <div className={styles.statusCol}>
                        {cellData === 'active' && (
                            <>
                                <Success />
                                <DsTypography variant="Regular_14">Active</DsTypography>
                            </>
                        )}
                        {cellData === 'refresh' && (
                            <>
                                <SmallLoader />
                                <DsTypography variant="Regular_14">Refresh</DsTypography>
                            </>
                        )}
                        {cellData === 'delete' && (
                            <>
                                <SmallLoader />
                                <DsTypography variant="Regular_14">{GENERAL.DELETING}</DsTypography>
                            </>
                        )}
                    </div>
                );
            }
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: SandboxColDefs,
        rows: data ? data.filter((item: any) => !deletedSandboxes.includes(item?.id)) : [],
        pageSize: 50
    });
    return (
        <div className={styles.sandboxTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle="Sandboxes"
                singularTitle="Sandbox"
                actionsRight={
                    <div className={styles.sandboxButton}>
                        <Button
                            variant={'primary'}
                            className={'continue-button'}
                            isThin={true}
                            onClick={() => navigate('../create-new-sandbox')}
                        >
                            {GENERAL.CREATE_SANDBOX}
                        </Button>
                    </div>
                }
            />
            <Table
                //@ts-ignore
                tableProps={tableProps}
            />
        </div>
    );
};

export default SandboxTable;
