import { Table, useTable, useDialog, TableTopBar, Button, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './SandboxTable.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSandboxListData, getAggregatedSplitEstimate } from '../SandboxUtility';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import RebaseLineContent from './RebaseLineContent/RebaseLineContent';
import RebaseSplitContent from './RebaseSplitContent/RebaseSplitContent';
import ViewDialog from '../../../common/ViewDialog/ViewDialog';
import { ReactComponent as Success } from '../../../assets/success.svg';
import {
    setAggregatedSandboxList,
    setSandboxSavingsState,
    updateConnectionInfoLoading,
    updateSplitEstimateLoading
} from '../../../store/workloadFactory/sandboxSlice';
import SmallLoader from '../../../common/SmallLoader/SmallLoader';
import {
    getBaseUrl,
    useCheckIntegrityMutation,
    useDeleteSandboxMutation,
    useLazyGetConnectionInfoQuery,
    useLazyGetSandboxSavingsQuery,
    useLazyGetSplitEstimateInfoQuery,
    useLazyGetSubTaskListQuery,
    useSplitSandboxMutation,
    useUpdateSandboxMutation
} from '../../../utils/apiService';
import {
    CRED_PLACEHOLDERS,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FROM_DIALOG,
    JOB_MONITORING_STATUS,
    SANDBOX_ACTIONS_POLLING_INTERVAL,
    UPDATE_SANDBOX_CURL_REQ_TEMPLATE,
    WLF_TABS
} from '../../../utils/consts';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import store from '../../../store/store';
import RefreshContent from './RefreshContent/RefreshContent';
import ConnectToCiCdContent from './ConnectToCiCdContent/ConnectToCiCdContent';
import { formatDateWithTime } from '../../../utils/utilityFunctions';
import { SandboxActions } from '../../../utils/types/sandBoxTypes';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { setSelectedSandboxHeaderValue } from '../../../store/workloadFactory/createSandboxSlice';
import useResize from '../../../common/hooks/useResize';

const SandboxTable = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const windowSize = useResize();
    const { aggregatedSandboxList, selectedRollbackSnapshot, isRollbackSelected } = useAppSelector(
        state => state.sandbox
    );
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { sandboxAgeRange } = useAppSelector(state => state.databaseHome);
    const { headerSelectedCredSandbox, headerSelectedRegionSandbox } = useAppSelector(state => state.headers);
    const [data, setData] = useState<any>();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const [deletedSandboxes, setDeletedSandboxes] = useState<any>([]);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();

    const [deleteSandboxApi] = useDeleteSandboxMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [getSandboxSavingsApi] = useLazyGetSandboxSavingsQuery();
    const [getSplitEstimateApi] = useLazyGetSplitEstimateInfoQuery();
    const [updateSandboxApi] = useUpdateSandboxMutation();
    const [splitSandboxApi] = useSplitSandboxMutation();
    const [checkIntegrityApi] = useCheckIntegrityMutation();
    const [getConnectionInfoApi] = useLazyGetConnectionInfoQuery();

    useEffect(() => {
        if (aggregatedSandboxList[0] && 'id' in aggregatedSandboxList[0]) {
            setData(aggregatedSandboxList);
        } else {
            const newData = formatSandboxListData(aggregatedSandboxList);
            setData(newData);
        }
    }, [aggregatedSandboxList]);

    const menuItems = (row: any) => [
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
            id: 'integrityCheck',
            displayName: 'Check integrity'
        },
        {
            id: 'delete',
            displayName: 'Delete'
        }
    ];

    // To set initial filter when navigate from Dashboard
    const getInitialFilter = () => {
        if (sandboxAgeRange?.from === 'Dashboard') {
            return {
                textFilter: '',
                count: 1,
                columns: {
                    '6': {
                        activeCount: 1,
                        values: {
                            [sandboxAgeRange?.range === GENERAL.ONE_THIRTY_DAYS
                                ? GENERAL.ONE_THIRTY_DAYS
                                : sandboxAgeRange?.range === GENERAL.THIRTY_SIXTY_DAYS
                                ? GENERAL.THIRTY_SIXTY_DAYS
                                : GENERAL.SIXTY_PLUS_DAYS]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        }
        return undefined;
    };

    const showJobInProgressNotification = (action: SandboxActions, resourceName: string) => {
        const notificationObj = GENERAL.SANDBOX_ACTIONS_NOTIFICATIONS.IN_PROGRESS[action];
        const msgData = (
            <div className={styles.notification}>
                {notificationObj[0]}
                <span className={styles.bold}>{resourceName}</span>
                {notificationObj[1]}
                <Button
                    Component="button"
                    variant="text"
                    onClick={() => {
                        dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                        const path = isWorkloadFactory
                            ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                            : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: { pathname: path, replace: true }
                        });
                        dispatch(clearNotifications());
                    }}
                >
                    {GENERAL.JOB_MONITORING}.
                </Button>
            </div>
        );
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: msgData
            })
        );
    };

    const handleJob = (res: any, rowData: any, action: SandboxActions) => {
        if (res?.data) {
            showJobInProgressNotification(action, rowData?.name);
            const jobInterval = setInterval(() => {
                getJobDetailApi({
                    id: res?.data?.jobId
                }).then((jobRes: any) => {
                    const status = jobRes?.data?.status;
                    const state = store.getState();
                    const { aggregatedSandboxList } = state?.sandbox;
                    const resourceName =
                        action === 'rebaseline' || action === 'refresh' ? rowData?.source : rowData?.name;
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
                        clearInterval(jobInterval);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                message: `${GENERAL.SANDBOX_ACTIONS_NOTIFICATIONS.SUCCESS[action][0]}${resourceName}${GENERAL.SANDBOX_ACTIONS_NOTIFICATIONS.SUCCESS[action][1]}`
                            })
                        );
                        const output =
                            action === 'delete'
                                ? aggregatedSandboxList.filter((item: any) => rowData?.id !== item?.id)
                                : aggregatedSandboxList.map((obj: any) => {
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
                        getSandboxSavingsApi({
                            credentialId: headerSelectedCredSandbox?.data?.credentialsId,
                            region: headerSelectedRegionSandbox?.label2
                        }).then((savingsRes: any) => {
                            if (savingsRes?.data) {
                                dispatch(
                                    setSandboxSavingsState({
                                        sandboxSavings: savingsRes?.data,
                                        sandboxSavingsLoading: false,
                                        sandboxSavingsError: ''
                                    })
                                );
                            } else {
                                dispatch(
                                    setSandboxSavingsState({
                                        sandboxSavings: {
                                            consumedStorage: 0,
                                            savedStorage: 0,
                                            sandboxSavingsPercentage: 0
                                        },
                                        sandboxSavingsLoading: false,
                                        sandboxSavingsError: ''
                                    })
                                );
                            }
                        });
                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                        const output = aggregatedSandboxList.map((obj: any) => {
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
                                message: `${GENERAL.SANDBOX_ACTIONS_NOTIFICATIONS.FAILED[action][0]}${resourceName}${GENERAL.SANDBOX_ACTIONS_NOTIFICATIONS.FAILED[action][1]}`
                            })
                        );
                        clearInterval(jobInterval);
                    }
                });
            }, SANDBOX_ACTIONS_POLLING_INTERVAL);
        } else {
            const output = aggregatedSandboxList.map((obj: any) => {
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
        }
    };

    const handleRebaseLine = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={GENERAL.REBASE_LINE}
                content={<RebaseLineContent databaseName={rowData?.source} sandboxName={rowData?.name} />}
                primaryButton={GENERAL.REBASE_LINE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    const output = data.map((obj: any) => {
                        if (obj?.id === rowData?.id && obj.name === rowData.name) {
                            return { ...obj, cellProps: { isDisabled: true }, status: 'rebaseline', menuDisable: true };
                        }
                        return obj;
                    });
                    dispatch(setAggregatedSandboxList(output));
                    updateSandboxApi({
                        credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                        regionId: headerSelectedRegionSandbox?.label2,
                        databaseHostId: rowData?.databaseHostId,
                        instanceId: rowData?.instanceId,
                        sandboxName: rowData?.name,
                        payload: { action: 'RE-BASELINE', snapshot: rowData?.baseSnapshot }
                    }).then((res: any) => {
                        handleJob(res, rowData, 'rebaseline');
                    });
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
                header="Refresh"
                content={
                    <RefreshContent databaseName={rowData?.source} sandboxName={rowData?.name} rowData={rowData} />
                }
                primaryButton="Refresh"
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    const output = data.map((obj: any) => {
                        if ((obj?.id === rowData?.id && obj.name) === rowData.name) {
                            return {
                                ...obj,
                                cellProps: { isDisabled: true },
                                status: 'refresh',
                                menuDisable: true
                            };
                        }
                        return obj;
                    });
                    dispatch(setAggregatedSandboxList(output));

                    const updatedState = store.getState();
                    const { isRollbackSelected, selectedRollbackSnapshot } = updatedState?.sandbox;

                    updateSandboxApi({
                        credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                        regionId: headerSelectedRegionSandbox?.label2,
                        databaseHostId: rowData?.databaseHostId,
                        instanceId: rowData?.instanceId,
                        sandboxName: rowData?.name,
                        payload: isRollbackSelected
                            ? { action: 'REFRESH', snapshot: selectedRollbackSnapshot?.value }
                            : { action: 'REFRESH' }
                    }).then((res: any) => {
                        handleJob(res, rowData, 'refresh');
                    });
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
                dialogFrom={FROM_DIALOG.SANDBOX_REFRESH}
            />
        );
    };

    const handleDelete = (rowData: any) => {
        setDialog(
            <DialogComponent
                header="Delete"
                content={
                    <DsTypography variant="Regular_14">
                        Are you sure you want to delete this sandbox database{' '}
                        <span style={{ fontWeight: '590' }}>{rowData?.name}</span>?
                    </DsTypography>
                }
                primaryButton="Delete"
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    const output = data.map((obj: any) => {
                        if (obj?.id === rowData?.id && obj.name === rowData.name) {
                            return { ...obj, cellProps: { isDisabled: true }, status: 'delete', menuDisable: true };
                        }
                        return obj;
                    });
                    dispatch(setAggregatedSandboxList(output));
                    deleteSandboxApi({
                        credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                        regionId: headerSelectedRegionSandbox?.label2,
                        databaseHostId: rowData?.databaseHostId,
                        instanceId: rowData?.instanceId,
                        sandboxName: rowData?.name
                    }).then((res: any) => {
                        handleJob(res, rowData, 'delete');
                    });
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    const handleSplit = (rowData: any) => {
        dispatch(updateSplitEstimateLoading(true));
        const { databaseHostId, name, instanceId } = rowData;
        getSplitEstimateApi({
            credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
            regionId: headerSelectedRegionSandbox?.label2,
            databaseHostId,
            instanceId,
            sandboxName: name
        }).then((splitEstimateRes: any) => {
            dispatch(updateSplitEstimateLoading(false));
            if (splitEstimateRes?.data) {
                const aggSplitEstimate = getAggregatedSplitEstimate(splitEstimateRes?.data?.volumes || []);
                setDialog(
                    <DialogComponent
                        header="Split"
                        content={
                            <RebaseSplitContent
                                databaseName={rowData?.source}
                                sandboxName={rowData?.name}
                                aggSplitEstimate={aggSplitEstimate}
                            />
                        }
                        primaryButton="Split"
                        secondaryButton={GENERAL.CANCEL}
                        callback={() => {
                            const output = data.map((obj: any) => {
                                if (obj?.id === rowData?.id && obj.name === rowData.name) {
                                    return {
                                        ...obj,
                                        cellProps: { isDisabled: true },
                                        status: 'split',
                                        menuDisable: true
                                    };
                                }
                                return obj;
                            });
                            dispatch(setAggregatedSandboxList(output));
                            splitSandboxApi({
                                credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                                regionId: headerSelectedRegionSandbox?.label2,
                                databaseHostId: rowData?.databaseHostId,
                                instanceId: rowData?.instanceId,
                                sandboxName: rowData?.name
                            }).then((res: any) => {
                                handleJob(res, rowData, 'split');
                            });
                        }}
                        closeCallback={() => {
                            closeDialog();
                        }}
                        customClass={styles.setWidth}
                    />
                );
            }
        });
    };

    const handleConnectToTools = (rowData: any) => {
        const baseUrl = getBaseUrl();
        const credID = headerSelectedCredSandbox?.data?.credentialsId;
        const region = headerSelectedRegionSandbox?.label2;
        const copyResponseData = () => {
            const payload = { action: 'REFRESH' };
            const baseUrl = getBaseUrl();
            const restApiPayload = UPDATE_SANDBOX_CURL_REQ_TEMPLATE(
                baseUrl,
                credID,
                region || CRED_PLACEHOLDERS.REGION,
                rowData?.databaseHostId,
                rowData?.name,
                CRED_PLACEHOLDERS.TOKEN,
                JSON.stringify(payload, null, 2)
            );
            return restApiPayload;
        };
        setDialog(
            <DialogComponent
                header="Connect to CI/CD tools"
                content={
                    <ViewDialog
                        data={
                            <ConnectToCiCdContent
                                baseUrl={baseUrl}
                                credID={credID}
                                region={region}
                                databaseHostId={rowData?.databaseHostId}
                                sandboxName={rowData?.name}
                                actualData={{ action: 'REFRESH' }}
                            />
                        }
                        copyResponseData={copyResponseData}
                    />
                }
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
                customClass={styles.setWidth}
            />
        );
    };

    const handleShowConnectionInfo = (rowData: any) => {
        const updatedState = store.getState();
        const { headers } = updatedState;
        const { databaseHostId, name, instanceId } = rowData;
        dispatch(updateConnectionInfoLoading(true));
        getConnectionInfoApi({
            credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
            regionId: headerSelectedRegionSandbox?.label2,
            databaseHostId,
            instanceId,
            sandboxName: name
        }).then(res => {
            if (res?.data) {
                const connectionInfo = res.data;
                const connectionString = connectionInfo
                    ? Object.keys(connectionInfo)
                          .map((key: any) => `${key}=${connectionInfo?.[key]}`)
                          .join(';')
                    : '';
                setDialog(
                    <DialogComponent
                        header=" Show connection info"
                        content={<ViewDialog data={connectionString} />}
                        primaryButton={GENERAL.CLOSE}
                        callback={() => {}}
                        customClass={styles.setWidth}
                    />
                );
                dispatch(updateConnectionInfoLoading(false));
            }
        });
    };

    const handleIntegrityCheck = (rowData: any) => {
        setDialog(
            <DialogComponent
                header="Check integrity"
                content={
                    <DsTypography variant="Regular_14">
                        Do you want to perform integrity check for sandbox{' '}
                        <span style={{ fontWeight: '590' }}>{rowData.name}</span>?
                    </DsTypography>
                }
                primaryButton="Check integrity"
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    const output = data.map((obj: any) => {
                        if (obj?.id === rowData?.id && obj.name === rowData.name) {
                            return {
                                ...obj,
                                cellProps: { isDisabled: true },
                                status: 'integrityCheck',
                                menuDisable: true
                            };
                        }
                        return obj;
                    });
                    dispatch(setAggregatedSandboxList(output));
                    checkIntegrityApi({
                        credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                        regionId: headerSelectedRegionSandbox?.label2,
                        databaseHostId: rowData?.databaseHostId,
                        instanceId: rowData?.instanceId,
                        sandboxName: rowData?.name
                    }).then((res: any) => {
                        handleJob(res, rowData, 'integrityCheck');
                    });
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    const lastColDetails = () => ({
        id: '9',
        Header: '',
        accessor: '',
        width: windowSize.width >= 1920 ? '3.48%' : '56px',
        renderCell: (cellData: any, rowData: any) => (
            <div className={styles.jobMenuPopover}>
                {!rowData?.menuDisable && (
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
                                        handleRebaseLine(rowData);
                                        break;
                                    case 'refresh':
                                        handleRefresh(rowData);
                                        break;

                                    case 'delete':
                                        handleDelete(rowData);
                                        break;
                                    case 'split':
                                        handleSplit(rowData);
                                        break;
                                    case 'connectToTools':
                                        handleConnectToTools(rowData);
                                        break;

                                    case 'showConnectionInfo':
                                        handleShowConnectionInfo(rowData);
                                        break;

                                    case 'integrityCheck':
                                        handleIntegrityCheck(rowData);
                                        break;
                                }
                            }
                        }}
                        isDisabled={rowData?.menuDisable}
                        CustomMenu={undefined}
                        disabledText={undefined}
                    />
                )}

                {rowData?.menuDisable && (
                    <div className={styles.menuPointerDisabled}>
                        <span className={styles.menuPointer}>...</span>
                    </div>
                )}
            </div>
        ),
        showHide: true,
        isSticky: true
    });

    const SandboxColDefs: ColumnProps[] = [
        {
            Header: GENERAL.SANDBOX_DB_NAME,
            accessor: 'name',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: windowSize.width >= 1920 ? '12.44%' : '200px'
        },
        {
            Header: GENERAL.SANDBOX_DB_INSTANCE_NAME,
            accessor: 'instanceName',
            id: '2',
            width: windowSize.width >= 1920 ? '13.69%' : '220px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SANDBOX_SOURCE_DB_NAME,
            accessor: 'source',
            id: '3',
            width: windowSize.width >= 1920 ? '13.69%' : '220px',
            isSortable: true
        },
        {
            Header: GENERAL.SANDBOX_SOURCE_DB_INSTANCE_NAME,
            accessor: 'sourceInstanceName',
            id: '4',
            width: windowSize.width >= 1920 ? '17.17%' : '276px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SANDBOX_LAST_UPDATED,
            accessor: 'actualUpdated',
            id: '5',
            width: windowSize.width >= 1920 ? '12.44%' : '200px',
            isSortable: true,
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_14">{formatDateWithTime(cellData)}</DsTypography>
            )
        },
        {
            Header: GENERAL.AGE,
            accessor: 'ageByRange',
            id: '6',
            width: windowSize.width >= 1920 ? '7.96%' : '128px',
            isSortable: false,
            filterOptions: [
                { label: GENERAL.ONE_THIRTY_DAYS, value: GENERAL.ONE_THIRTY_DAYS },
                { label: GENERAL.THIRTY_SIXTY_DAYS, value: GENERAL.THIRTY_SIXTY_DAYS },
                { label: GENERAL.SIXTY_PLUS_DAYS, value: GENERAL.SIXTY_PLUS_DAYS }
            ],
            renderCell: (cellData: any, rowData: any) => (
                <DsTypography variant="Regular_14">{rowData?.age}</DsTypography>
            )
        },

        {
            Header: GENERAL.SANDBOX_TAG,
            accessor: 'tag',
            id: '7',
            width: windowSize.width >= 1920 ? '7.96%' : '128px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SB_STATUS,
            accessor: 'status',
            id: '8',
            width: windowSize.width >= 1920 ? '11.20%' : '180px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => (
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
                    {cellData === 'rebaseline' && (
                        <>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">{GENERAL.REBASELINE}</DsTypography>
                        </>
                    )}
                    {cellData === 'split' && (
                        <>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">{GENERAL.SPLIT}</DsTypography>
                        </>
                    )}
                    {cellData === 'integrityCheck' && (
                        <>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">{GENERAL.INTEGRITY_CHECK}</DsTypography>
                        </>
                    )}
                </div>
            )
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: SandboxColDefs,
        rows: data ? data.filter((item: any) => !deletedSandboxes.includes(item?.id)) : [],
        pageSize: 50,
        initialFilterState: getInitialFilter()
    });
    return (
        <div className={styles.sandboxTable}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Sandboxes"
                singularTitle="Sandbox"
                actionsRight={
                    <div className={styles.sandboxButton}>
                        <Button
                            variant="primary"
                            className="continue-button"
                            isThin
                            onClick={() => {
                                dispatch(
                                    setSelectedSandboxHeaderValue({
                                        credId: headerSelectedCredSandbox?.data?.credentialsId,
                                        regionId: headerSelectedRegionSandbox?.label2
                                    })
                                );
                                navigate('../create-new-sandbox');
                            }}
                            id="create-sandbox"
                        >
                            {GENERAL.CREATE_SANDBOX}
                        </Button>
                    </div>
                }
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
            />
        </div>
    );
};

export default SandboxTable;
