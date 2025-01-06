import { Button, DsButton, DsTypography, Popover, Table, useTable } from '@netapp/design-system';
import { useDialog } from '@netapp/design-system';
import styles from './RecommendationTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
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
    useOptimizeOperatingSystemMutation,
    useOptimizeStorageConfigMutation
} from '../../../utils/apiService';
import { useAppSelector } from '../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import { GETWELL_STATUS, GW_CONFIG_OPTIMIZE_NA, WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { setOptimizingData, setOptimizingInstanceData } from '../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';

const RecommendationTable = ({ tableData, isLoading, optimizePrintState, from, hostId, instanceId }: any) => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();

    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const { isDemoMode } = useAppSelector(state => state.auth);
    const { selectedResourceId, selectedDatabaseInstance, optimizingData, optimizingInstanceData } = useAppSelector(
        state => state.getWellOptimize
    );

    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeOs] = useOptimizeOperatingSystemMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const isDialogPrimaryBtnDisabled = (rowData: any) => {
        return rowData?.name === 'OS type' || rowData?.name === 'NTFS allocation unit size';
    };

    // This is the function that will be called when the user clicks on the optimize button from sub menus
    const callOptimizeApi = (rowData: any) => {
        // Only 1 config can be passed at a time
        let payload = {};
        let apiCall = null;
        if (rowData?.type === 'volume' || rowData?.type === 'lun') {
            apiCall = optimizeStorageConfig;
            payload = {
                assessments: [
                    {
                        configurationName: rowData?.id,
                        objectsToOptimize: rowData?.objectsInViolation
                    }
                ]
            };
        } else {
            apiCall = optimizeOs;
            payload = {
                configurationName: rowData?.id
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
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Optimization process initiated for ${rowData?.name}. This process can take upto 2 minutes. Track progress in `}
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

        apiCall({
            credentialId: landingFrom === WLF_TABS.INVENTORY ? headerSelectedCred?.data?.credentialsId : credIdFromJM,
            regionId: landingFrom === WLF_TABS.INVENTORY ? headerSelectedRegion?.label2 : regionFromJM,
            databaseHostId: selectedResourceId || hostId,
            instanceId: selectedDatabaseInstance || instanceId,
            payload: payload
        }).then((res: any) => {
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
            handleOptimizeStorageJob(res, rowData, failedMsgData, getJobDetailApi, dispatch);
        });
    };

    const handleOntapDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={`${rowData?.name} optimization`}
                content={<DialogContent type={rowData?.name} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callOptimizeApi(rowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.colorSet}
                primaryButtonDisabled={isDialogPrimaryBtnDisabled(rowData)}
                primaryButtonTooltip={isDialogPrimaryBtnDisabled(rowData) ? GENERAL.COMING_SOON : ''}
            />
        );
    };
    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Configuration',
            accessor: 'name',
            width: from === WLF_TABS.INVENTORY ? '18%' : '280px',
            isSortable: true,
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: '14%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.statusCol}>
                        <div>
                            {cellData === GETWELL_STATUS.OPTIMIZED && <Active className={styles.statusIcon} />}
                            {cellData === GETWELL_STATUS.NOT_OPTIMIZED && <NotActive className={styles.statusIcon} />}
                            {(cellData === GETWELL_STATUS.OPTIMIZING || cellData === GETWELL_STATUS.ANALYZING) && (
                                <InProgress className={styles.statusIcon} />
                            )}
                        </div>
                        <div>{cellData || GENERAL.NOT_AVAILABLE}</div>
                    </div>
                );
            }
        },
        {
            id: '4',
            Header: 'Severity',
            accessor: 'severity',
            width: from === WLF_TABS.INVENTORY ? '14%' : '200px',
            isSortable: true,
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '5',
            Header: 'Tags',
            accessor: 'tags',
            width: from === WLF_TABS.INVENTORY ? '14%' : '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        <div className={styles.tooltipContainer}>
                            {cellData?.length > 0 && (
                                <div className={styles.tooltip}>
                                    <Popover
                                        popoverClass={''}
                                        children={
                                            <div className={styles.tags}>
                                                {cellData?.map((perTag: string) => {
                                                    return <Tag text={perTag} />;
                                                })}
                                            </div>
                                        }
                                        trigger="hover"
                                        delayHide={200}
                                        interactive={true}
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
                                {'Tags (' + cellData.length + ')'}
                            </DsTypography>
                        </div>
                    </>
                );
            }
        },
        {
            id: '6',
            Header: '',
            accessor: 'recommendation',
            width: from === WLF_TABS.INVENTORY ? '40%' : '575px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
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
                                            popoverClass={''}
                                            children={cellData && <RecommendationTooltip data={cellData} />}
                                            trigger="hover"
                                            delayHide={200}
                                            interactive={true}
                                            isAppendedToBody={false}
                                            container={<TooltipIcon />}
                                            placement="bottom"
                                        />
                                    </div>
                                )}
                                <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                    {'View recommendation'}
                                </DsTypography>
                            </div>
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
                                            <DsButton variant="secondary" isDisabled={true}>
                                                Optimize
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
                                            <DsButton variant="secondary" isDisabled={true}>
                                                Optimize
                                            </DsButton>
                                        </div>
                                    </TooltipComponent>
                                ) : (
                                    <div id={`${rowData?.id}-optimize`}>
                                        <DsButton
                                            variant="secondary"
                                            onClick={() => handleOntapDialog(rowData)}
                                            isDisabled={rowData?.status === 'Not optimized' ? false : true}
                                        >
                                            Optimize
                                        </DsButton>
                                    </div>
                                ))}
                        </div>
                    </>
                );
            }
        }
    ];

    const colDefsForDashboard = ColDefs.filter((item: any) => item.id !== '3');

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
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                // variant="innerTable"
            />
            {/* </div> */}
        </div>
    );
};

export default RecommendationTable;
