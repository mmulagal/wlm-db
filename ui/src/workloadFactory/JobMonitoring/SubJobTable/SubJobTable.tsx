import { Button, FlashingDotsLoader, Popover, Table, Typography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import styles from './SubJobTable.module.scss';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { ReactComponent as NoDataIcon } from '../../../assets/ic_file.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import TaskTable from '../TaskTable/TaskTable';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import {
    CREATE_RESOURCE,
    DBType,
    JOB_MONITORING_STATUS,
    JOB_MONITORING_TYPE,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../utils/consts';
import {
    expandTableRow,
    formatDateWithTime,
    jobMonitoringStatusMapping,
    sortListOfDict
} from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import {
    setCredIdFromJM,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setRegionFromJM,
    setSelectedWellArchitectTab
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setSelectedOracleInnerPageTab } from '../../../store/workloadFactory/oracleSlice';
import useResize from '../../../common/hooks/useResize';

const SubJobTable = ({ jobId, statusType }: any) => {
    const { t } = useTranslation();
    const [subTaskList, setSubTaskList] = useState<any>({});
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const windowSize = useResize();
    const subJobsData = useAppSelector(state => state.jobMonitoring.subJobsData);
    const subJobsDataLoading = useAppSelector(state => state.jobMonitoring.subJobsDataLoading);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const dispatch = useDispatch();

    useEffect(() => {
        let sortedSubTaskList = subJobsData?.subJobs;
        if (isDemoMode) {
            sortedSubTaskList = sortListOfDict(subJobsData?.subJobs, 'startTime', false);
        }
        setSubTaskList(sortedSubTaskList);
    }, [subJobsData, isDemoMode]);

    const navigateToInventory = () => {
        if (isWorkloadFactory) {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: '../databases/inventory',
                    replace: true
                }
            });
        } else {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: '../fsxdb/inventory',
                    replace: true
                }
            });
        }
    };

    const ExpandedRow = useCallback(({ rowData }: any) => <TaskTable taskList={rowData?.subJobs || []} />, []);

    const navigateToContinuosOptimization = (message: string, rowData: any) => {
        const splitMessage = message.split(';');

        // Extract the JSON part of the split message
        const jsonString = splitMessage[1];

        // Parse the JSON string into an object
        const jsonObject = JSON.parse(jsonString);

        // Extract the required properties
        const resourceId = jsonObject?.resourceId;
        const databaseInstanceId = jsonObject?.databaseInstanceId; // Assuming you want the first ID in the array
        const databaseInstanceName = jsonObject?.databaseInstanceName;
        const sqlServerDeploymentType = jsonObject?.sqlServerDeploymentType;
        const hostName = jsonObject?.hostName;

        if (sqlServerDeploymentType.toLowerCase() === DBType.ORACLE.toLowerCase()) {
            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
            dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
            navigateToInventory();
        } else {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
            dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
            navigateToInventory();
        }

        if (subJobsData?.type === JOB_MONITORING_TYPE.ASSESSMENT) {
            dispatch(setCredIdFromJM(rowData?.credentialsId));
            dispatch(setRegionFromJM(rowData?.region?.code));
        } else {
            dispatch(setCredIdFromJM(subJobsData?.credentialsId));
            dispatch(setRegionFromJM(subJobsData?.region?.code));
        }

        dispatch(setLandingFrom(WLF_TABS.JOB_MONITORING));

        dispatch(
            setGwPageLoadInstanceData({
                hostname: hostName,
                resourceId,
                instanceId: databaseInstanceId,
                instanceName: databaseInstanceName,
                credId: rowData?.credentialsId,
                regionId: rowData?.region?.code,
                storageType: sqlServerDeploymentType
            })
        );
    };

    const JobsColDefs: ColumnProps[] = [
        {
            id: '0',
            Header: '',
            accessor: 'name',
            width: windowSize.width >= 1920 ? '3.73%' : '56px',
            isSticky: true,
            className: styles.firstCol,
            renderCell: (value: any, rowData: any, { updateRowState, rowsState }: any) => {
                const currentRowState = rowsState[rowData.id];
                const statusType = rowData?.status.toLowerCase();
                return (
                    <>
                        {rowData?.subJobs ? (
                            <div className={styles.arrow}>
                                <ArrowIcon
                                    className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                    onClick={(e: any) => {
                                        e.stopPropagation();
                                        expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className={styles.arrow}>
                                {rowData?.type !== CREATE_RESOURCE && <ArrowIcon className={styles['arrow-disable']} />}
                            </div>
                        )}
                    </>
                );
            }
        },
        {
            id: '1',
            Header: 'Name',
            accessor: 'description',
            isSortable: true,
            width: windowSize.width >= 1920 ? '45.12%' : '676px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                if (cellData.includes('databaseInstanceId') && cellData.includes('resourceId')) {
                    const splitMessage = cellData.split(';');

                    // Extract the first part of the split message
                    let extractedMessage = splitMessage[0];

                    // Remove the trailing period if it exists
                    if (extractedMessage.endsWith('.')) {
                        extractedMessage = extractedMessage.slice(0, -1);
                    }
                    return (
                        <div className={styles.linkMessage} title={extractedMessage}>
                            <span>{extractedMessage}</span>&nbsp;
                            <span>
                                <Button
                                    variant="link"
                                    onClick={() => {
                                        navigateToContinuosOptimization(cellData, rowData);
                                    }}
                                >
                                    {cellData.includes('Oracle assessment')
                                        ? t('databases.general.database-well-architected-dashboard-for-oracle')
                                        : t('databases.general.instance-well-architected-dashboard')}
                                </Button>
                            </span>
                        </div>
                    );
                }
                return (
                    <div className={CommonStyles.wrapTextIn2Line} title={cellData}>
                        {cellData}
                    </div>
                );
            }
        },
        // {
        //     id: '2',
        //     Header: 'Description',
        //     accessor: 'description',
        //     isSortable: true,
        //     width: '498px',
        //     renderCell: (cellData: any) => {
        //         return <div className={CommonStyles.wrapTextIn2Line} title={cellData}>{cellData}</div>;
        //     }
        // },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: windowSize.width >= 1920 ? '15.35%' : '230px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.statusCol}>
                    <div>
                        {cellData === JOB_MONITORING_STATUS.COMPLETED && <Success />}
                        {cellData === JOB_MONITORING_STATUS.FAILED && (
                            <Popover
                                popoverClass={CommonStyles.popover}
                                children={
                                    <Typography variant="Regular_14" style={{ wordBreak: 'break-word' }}>
                                        {rowData?.error}
                                    </Typography>
                                }
                                trigger="hover"
                                delayHide={200}
                                interactive
                                container={<ErrorIcon className={styles.statusIcon} />}
                            />
                        )}
                        {cellData === JOB_MONITORING_STATUS.WARNING &&
                            (rowData?.error ? (
                                <Popover
                                    popoverClass={CommonStyles.popover}
                                    children={
                                        <Typography variant="Regular_14" style={{ wordBreak: 'break-word' }}>
                                            {rowData?.error}
                                        </Typography>
                                    }
                                    trigger="hover"
                                    delayHide={200}
                                    interactive
                                    container={<Warning className={styles.statusIcon} />}
                                />
                            ) : (
                                <Warning />
                            ))}
                        {cellData === JOB_MONITORING_STATUS.IN_PROGRESS && <InProgress />}
                    </div>
                    <div>{jobMonitoringStatusMapping(cellData)}</div>
                </div>
            )
        },
        {
            id: '4',
            Header: 'Start time',
            accessor: 'startTime',
            isSortable: true,
            width: windowSize.width >= 1920 ? '16.02%' : '240px',
            renderCell: (cellData: any) => {
                const formatDate = cellData ? formatDateWithTime(cellData) : GENERAL.NOT_AVAILABLE;
                return (
                    <div className={CommonStyles.wrapTextIn2Line} title={formatDate}>
                        {formatDate}
                    </div>
                );
            }
        },
        {
            id: '5',
            Header: 'End time',
            accessor: 'endTime',
            isSortable: true,
            width: windowSize.width >= 1920 ? '16.02%' : '240px',
            renderCell: (cellData: any) => {
                const formatDate = cellData ? formatDateWithTime(cellData) : GENERAL.NOT_AVAILABLE;
                return (
                    <div className={CommonStyles.wrapTextIn2Line} title={formatDate}>
                        {formatDate}
                    </div>
                );
            }
        },
        {
            id: '6',
            Header: '',
            accessor: '',
            width: windowSize.width >= 1920 ? '3.73%' : '56px'
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: JobsColDefs,
        rows: subTaskList,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: subJobsDataLoading
    });

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: GENERAL.LOADING_DATA
    };

    return (
        <div className={styles.subJobTable}>
            <div className={`${styles.statusbar} ${styles[statusType]} ${styles.extraDiv}`}>&nbsp;</div>
            <div className={styles.extraDiv2} />
            {subJobsDataLoading && (
                <Typography variant="Regular_14" className={styles.loadingTable}>
                    <FlashingDotsLoader />
                    <div>{GENERAL.LOADING_DATA}</div>
                </Typography>
            )}
            {!subJobsDataLoading && !subTaskList && (
                <Typography variant="Regular_14" className={styles.loadingTable}>
                    <NoDataIcon />
                    <div>{GENERAL.NO_DATA}</div>
                </Typography>
            )}
            {!subJobsDataLoading && subTaskList && (
                <div
                    //  @ts-ignore
                    className={`${styles.table}`}
                    // style={{ position: 'relative', left: `${leftPos}px` }}
                >
                    <Table
                        {...tableComponentProps}
                        // @ts-ignore
                        tableProps={tableProps}
                        isDoubleRow
                        variant="innerTable"
                    />
                </div>
            )}
        </div>
    );
};

export default SubJobTable;
