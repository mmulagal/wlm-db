import { Button, DsButton, DsTypography, Popover, Table, useTable } from '@netapp/design-system';
import { useDialog } from '@netapp/design-system';
import styles from './RecommendationTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Active } from '../../../assets/success.svg';
import { ReactComponent as TooltipIcon } from '../../../assets/tooltipGrey.svg';
import { ReactComponent as DisabledTooltipIcon } from '../../../assets/tooltipDisabled.svg';
import Tag from '../../../common/Tag/Tag';
import RecommendationTooltip from '../RecommendationTooltip/RecommendationTooltip';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../StorageCardComponent/DialogContent/DialogContent';
import { GENERAL } from '../../../utils/appConstants';
import { useLazyGetSubTaskListQuery, useOptimizeStorageConfigMutation } from '../../../utils/apiService';
import { useAppSelector } from '../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import SmallLoader from '../../../common/SmallLoader/SmallLoader';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import { GETWELL_STATUS, GW_CONFIG_OPTIMIZE_NA, WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { setOptimizingData, setOptimizingInstanceData } from '../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';

const RecommendationTable = ({ tableData, isLoading, optimizePrintState }: any) => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();

    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const { selectedResourceId, selectedDatabaseInstance, optimizingData, optimizingInstanceData } = useAppSelector(
        state => state.getWellOptimize
    );

    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    // This is the function that will be called when the user clicks on the optimize button from sub menus
    const callOptimizeApi = (rowData: any) => {
        // Only 1 config can be passed at a time
        let payload = {
            assessments: [
                {
                    configurationName: rowData?.id,
                    objectsToOptimize: rowData?.objectsInViolation
                }
            ]
        };
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

        optimizeStorageConfig({
            credentialId: headerSelectedCred?.data?.credentialsId,
            regionId: headerSelectedRegion?.label2,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
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
                hidePrimaryButton={GW_CONFIG_OPTIMIZE_NA.includes(rowData?.name)}
            />
        );
    };
    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Configuration',
            accessor: 'name',
            width: '18%',
            isSortable: true
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
                            {cellData === 'Optimized' && <Active className={styles.statusIcon} />}
                            {cellData === 'Not optimized' && <NotActive className={styles.statusIcon} />}
                            {cellData === 'Optimizing' && <SmallLoader />}
                        </div>
                        <div>{cellData}</div>
                    </div>
                );
            }
        },
        {
            id: '4',
            Header: 'Severity',
            accessor: 'severity',
            width: '14%',
            isSortable: true
        },
        {
            id: '5',
            Header: 'Tags',
            accessor: 'tags',
            width: '14%',
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
            width: '40%',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        <div className={styles.recommendation}>
                            <div className={styles.tooltipContainer}>
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
                                <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                    {'View recommendations'}
                                </DsTypography>
                            </div>
                            {!optimizePrintState &&
                                (GW_CONFIG_OPTIMIZE_NA.includes(rowData?.name) &&
                                rowData?.status !== GETWELL_STATUS.OPTIMIZED ? (
                                    <TooltipComponent
                                        title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                                        placement="bottom"
                                        width="250px"
                                        height="50px"
                                    >
                                        <div>
                                            <DsButton variant="secondary" isDisabled={true}>
                                                Optimize
                                            </DsButton>
                                        </div>
                                    </TooltipComponent>
                                ) : optimizingInstanceData && rowData?.status !== GETWELL_STATUS.OPTIMIZED ? (
                                    <TooltipComponent
                                        title={GENERAL.OPTIMIZATION_IN_PROGRESS}
                                        placement="bottom"
                                        width="330px"
                                        height="65px"
                                    >
                                        <div>
                                            <DsButton variant="secondary" isDisabled={true}>
                                                Optimize
                                            </DsButton>
                                        </div>
                                    </TooltipComponent>
                                ) : (
                                    <div id={'assessment-optimization'}>
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

    const tableProps = useTable({
        isSorting: false,
        columns: ColDefs,
        rows: tableData,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: isLoading
    });

    return (
        <div className={styles.recommendationTable}>
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
