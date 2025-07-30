import { Button, DsButton, DsTypography, Popover, Table, useTable, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useDispatch } from 'react-redux';
import styles from './RecommendationTable.module.scss';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Active } from '../../../assets/success.svg';
import { ReactComponent as TooltipIcon } from '../../../assets/tooltipGrey.svg';
import { ReactComponent as DisabledTooltipIcon } from '../../../assets/tooltipDisabled.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import Tag from '../../../common/Tag/Tag';
import RecommendationTooltip from '../RecommendationTooltip/RecommendationTooltip';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../StorageCardComponent/DialogContent/DialogContent';
import { GENERAL } from '../../../utils/appConstants';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeHAMssqlMutation,
    useOptimizeOperatingSystemMutation,
    useOptimizeStorageConfigMutation
} from '../../../utils/apiService';
import { useAppSelector } from '../../../store/storeHooks';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_STATUS, GW_CONFIG_OPTIMIZE_NA, WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import store from '../../../store/store';

const RecommendationTable = ({ tableData, isLoading, optimizePrintState, from, hostId, instanceId }: any) => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        optimizingData,
        optimizingInstanceData,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId
    } = useAppSelector(state => state.getWellOptimize);
    const { selectedHeaderTab } = useAppSelector(state => state.inventoryV2);

    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeOs] = useOptimizeOperatingSystemMutation();
    const [optimizeHAMssql] = useOptimizeHAMssqlMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const isDialogPrimaryBtnDisabled = (rowData: any) =>
        rowData?.name === 'OS type' ||
        rowData?.name === 'NTFS allocation unit size' ||
        rowData?.name === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER;

    const getHaPayload = (configurationName: string) => ({
        hostsToOptimize: [
            {
                configurationName,
                databaseHosts: [
                    {
                        id: selectedResourceId || hostId,
                        sqlServerInstances: [selectedDatabaseInstance || instanceId],
                        credentialsId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                        region: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
                    }
                ]
            }
        ]
    });

    const getSharedStoragePayload = (rowData: any) => ({
        hostsToOptimize: [
            {
                configurationName: 'shared-storage',
                databaseHosts: [
                    {
                        id: selectedResourceId || hostId,
                        sqlServerInstances: [
                            {
                                databaseInstanceId: selectedDatabaseInstance || instanceId,
                                ontapLunPaths: rowData?.objectsInViolation
                            }
                        ],
                        credentialsId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                        region: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
                    }
                ]
            }
        ]
    });

    // This is the function that will be called when the user clicks on the optimize button from sub menus
    const callOptimizeApi = (rowData: any) => {
        // Only 1 config can be passed at a time
        const state = store.getState();
        let payload = {};
        let apiInput = {};
        let apiCall = null;
        let statusType = '';

        if (rowData?.name === ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getSharedStoragePayload(rowData);
            apiInput = { configName: 'shared-storage', payload };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getHaPayload('cluster-quorum');
            apiInput = { configName: 'cluster-quorum', payload };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getHaPayload('heartbeat-settings');
            apiInput = { configName: 'heartbeat', payload };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getHaPayload('sqlserver-service');
            apiInput = { configName: 'sqlserver-service', payload };
        } else if (rowData?.type === 'volume' || rowData?.type === 'lun') {
            statusType = 'ontap';
            apiCall = optimizeStorageConfig;
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || hostId,
                instanceId: selectedDatabaseInstance || instanceId,
                payload: {
                    assessments: [
                        {
                            configurationName: rowData?.id,
                            objectsToOptimize: rowData?.objectsInViolation
                        }
                    ]
                }
            };
        } else {
            statusType = 'os';
            apiCall = optimizeOs;
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || hostId,
                instanceId: selectedDatabaseInstance || instanceId,
                payload: {
                    configurationName: rowData?.id
                }
            };
        }

        // call optimize api
        dispatch(setOptimizingInstanceData(true));
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [rowData?.id]: 'optimizing'
            })
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [statusType]: [
                    ...(inProgressOptimizationData[statusType] || []),
                    `${selectedResourceId}_${selectedDatabaseInstance}`
                ]
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [statusType]: [...(inProgressHostData[statusType] || []), selectedResourceId]
            })
        );
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Fixing process initiated for ${rowData?.name}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                dispatch(clearNotifications());
                            }}
                        >
                            {GENERAL.JOB_MONITORING}.
                        </Button>
                    </div>
                )
            })
        );

        apiCall(apiInput).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {rowData?.name} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            dispatch(clearNotifications());
                        }}
                    >
                        {GENERAL.VIEW_JOB_MONITORING}.
                    </Button>
                </div>
            );
            if (!res.error) {
                dispatch(
                    setJobToInstanceMap({
                        ...state.getWellOptimize.jobToInstanceMap,
                        [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                    })
                );
            }
            handleOptimizeStorageJob(
                res,
                {
                    ...rowData,
                    hostId: selectedResourceId || hostId,
                    instanceId: selectedDatabaseInstance || instanceId,
                    credentialId: selectedGwInstanceCredId || credIdFromJM,
                    regionId: selectedGwInstanceRegionId || regionFromJM
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                statusType
            );
        });
    };

    const innerPageCheck = (name: string) => {
        if (
            name === 'Multipath I/O Sessions' ||
            name === 'Multipath I/O Status' ||
            name === 'Multipath I/O Timeout' ||
            name === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER ||
            name === ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM ||
            name === ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS ||
            name === ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE ||
            from === WLF_TABS.DASHBOARD
        ) {
            return false;
        }
        return true;
    };

    const innerPageText = (name: string) => {
        if (name === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER) {
            return 'View';
        }
        return 'View and fix';
    };

    const handleOntapDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={`${rowData?.name}`}
                content={<DialogContent type={rowData?.name} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callOptimizeApi(rowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass="innerPage"
                primaryButtonDisabled={isDialogPrimaryBtnDisabled(rowData)}
                primaryButtonTooltip={isDialogPrimaryBtnDisabled(rowData) ? GENERAL.COMING_SOON : ''}
            />
        );
    };

    const handleNavigateToOptimizePage = (rowData: any) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_ONTAP_INNER_PAGE));
        dispatch(setSelectedOptimizeConfig({ type: rowData?.name, data: rowData, hostId, instanceId }));
    };

    // This is for inner page
    const handleDifferentNavigation = (rowData: any) => {
        if (selectedHeaderTab === WLF_TABS.OPTIMIZE && innerPageCheck(rowData?.name)) {
            handleNavigateToOptimizePage(rowData);
        } else {
            handleOntapDialog(rowData);
        }
    };

    const statusValue = (cellData: string) => {
        if (cellData === GETWELL_STATUS.OPTIMIZED) {
            return GETWELL_STATUS.OPTIMIZED;
        }
        if (cellData === GETWELL_STATUS.OPTIMIZING) {
            return GETWELL_STATUS.OPTIMIZING;
        }
        return cellData || GENERAL.NOT_AVAILABLE;
    };

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Configuration',
            accessor: 'name',
            width: from === WLF_TABS.INVENTORY ? '268px' : '250px',
            isSortable: true,
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            id: '2',
            Header: 'Status',
            accessor: 'status',
            width: '220px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.statusCol}>
                    <div>
                        {cellData === GETWELL_STATUS.OPTIMIZED && <Active className={styles.statusIcon} />}
                        {cellData === GETWELL_STATUS.NOT_OPTIMIZED && <NotActive className={styles.statusIcon} />}
                        {(cellData === GETWELL_STATUS.OPTIMIZING || cellData === GETWELL_STATUS.ANALYZING) && (
                            <InProgress className={styles.statusIcon} />
                        )}
                    </div>
                    <div>{statusValue(cellData)}</div>
                </div>
            )
        },
        {
            id: '3',
            Header: 'Severity',
            accessor: 'severity',
            width: from === WLF_TABS.INVENTORY ? '173px' : '200px',
            isSortable: true,
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            id: '4',
            Header: 'Impacted resources',
            accessor: 'totalObjectsInViolation',
            width: from === WLF_TABS.INVENTORY ? '220px' : '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                let type = '';
                if (rowData?.type === 'volume') {
                    type = 'volumes';
                } else if (rowData?.type === 'lun') {
                    type = 'LUN path';
                } else if (rowData?.type === 'os') {
                    type = 'drives';
                }

                return (
                    <>
                        {rowData?.name !== 'Multipath I/O Sessions' &&
                        rowData?.name !== 'Multipath I/O Status' &&
                        rowData?.name !== 'Multipath I/O Timeout' ? (
                            <div>
                                <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                    {`${rowData?.totalObjectsInViolation || 0} out of ${
                                        rowData?.totalObjectsAssessed || 0
                                    } ${type}`}
                                </DsTypography>
                            </div>
                        ) : (
                            <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                Storage multipath
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            id: '5',
            Header: 'Tags',
            accessor: 'tags',
            width: from === WLF_TABS.INVENTORY ? '220px' : '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.tooltipContainer}>
                    {cellData?.length > 0 && (
                        <div className={styles.tooltip}>
                            <Popover
                                popoverClass=""
                                children={
                                    <div className={styles.tags}>
                                        {cellData?.map((perTag: string) => (
                                            <Tag text={perTag} />
                                        ))}
                                    </div>
                                }
                                trigger="hover"
                                delayHide={200}
                                interactive
                                isAppendedToBody={false}
                                container={<TooltipIcon />}
                            />
                        </div>
                    )}
                    {cellData?.length === 0 && (
                        <div>
                            <DisabledTooltipIcon />
                        </div>
                    )}

                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                        {`Tags (${cellData.length})`}
                    </DsTypography>
                </div>
            )
        },
        {
            id: '6',
            Header: '',
            accessor: 'recommendation',
            width: from === WLF_TABS.INVENTORY ? '202px' : '290px',
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.recommendation}>
                    <div className={styles.tooltipContainer}>
                        {cellData?.length === 0 && (
                            <div>
                                <DisabledTooltipIcon />
                            </div>
                        )}
                        {cellData?.length > 0 && (
                            <div className={styles.tooltip}>
                                <Popover
                                    popoverClass=""
                                    children={cellData && <RecommendationTooltip data={cellData} />}
                                    trigger="hover"
                                    delayHide={200}
                                    container={<TooltipIcon />}
                                    placement="bottom"
                                />
                            </div>
                        )}
                        <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                            View recommendation
                        </DsTypography>
                    </div>
                </div>
            )
        },
        {
            id: '7',
            Header: '',
            accessor: '',
            isSticky: true,
            width: from === WLF_TABS.INVENTORY ? '220px' : '200px',
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.recommendation}>
                    {!optimizePrintState &&
                        (GW_CONFIG_OPTIMIZE_NA.includes(rowData?.name) &&
                        rowData?.status !== GETWELL_STATUS.OPTIMIZED ? (
                            <TooltipComponent
                                title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                                placement="bottom"
                                width="120px"
                                height="30px"
                            >
                                <div>
                                    <DsButton variant="secondary" isDisabled>
                                        {innerPageCheck(rowData?.name) ? 'View & fix' : 'Fix'}
                                    </DsButton>
                                </div>
                            </TooltipComponent>
                        ) : optimizingInstanceData &&
                          rowData?.status !== GETWELL_STATUS.OPTIMIZED &&
                          rowData?.status !== GETWELL_STATUS.OPTIMIZING ? (
                            <TooltipComponent
                                title={GENERAL.OPTIMIZATION_IN_PROGRESS}
                                placement="bottom"
                                width="310px"
                                height="50px"
                            >
                                <div>
                                    <DsButton variant="secondary" isDisabled>
                                        {innerPageText(rowData?.name)}
                                    </DsButton>
                                </div>
                            </TooltipComponent>
                        ) : (
                            <div id={`${rowData?.id}-optimize`}>
                                <DsButton
                                    variant="secondary"
                                    onClick={() => handleDifferentNavigation(rowData)}
                                    isDisabled={rowData?.status !== 'Not optimized'}
                                >
                                    {innerPageText(rowData?.name)}
                                </DsButton>
                            </div>
                        ))}
                </div>
            )
        }
    ];

    const colDefsForDashboard = ColDefs.filter((item: any) => item.id !== '2');

    const tableProps = useTable({
        isSorting: false,
        columns: from === WLF_TABS.INVENTORY ? ColDefs : colDefsForDashboard,
        rows: tableData,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: isLoading
    });

    return (
        <div className={from === WLF_TABS.INVENTORY ? styles.recommendationTable : styles.recommendationTableDashboard}>
            {/* <div className={styles.table}> */}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
                // variant="innerTable"
            />
            {/* </div> */}
        </div>
    );
};

export default RecommendationTable;
