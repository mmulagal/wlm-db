import { Button, Popover, Table, TableTopBar, Typography, useDialog, useTable } from '@netapp/design-system';
import styles from './JobMonitoringTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { ReactComponent as DownloadIcon } from '../../../assets/ic_download.svg';

import SubJobTable from '../SubJobTable/SubJobTable';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { JM_DOWNLOAD, JOB_MONITORING_STATUS } from '../../../utils/consts';
import {
    collapseAllRows,
    createJobMonitorCSV,
    downloadCsv,
    expandTableRow,
    formatDateWithTime,
    jobMonitoringStatusMapping
} from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import {
    setDownloadJobsList,
    setDownloadJobsLoading,
    setSubJobsData,
    setSubJobsDataLoading
} from '../../../store/workloadFactory/jobMonitoringSlice';
import { useEffect, useRef, useState } from 'react';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { useGetFullJobsListQuery, useLazyGetSubTaskListQuery } from '../../../utils/apiService';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';

const JobMonitoringTable = () => {
    const { setDialog } = useDialog();
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);

    const dispatch = useDispatch();
    const jobsListLoading = useAppSelector(state => state.jobMonitoring.jobsListLoading);
    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const downloadJobsLoading = useAppSelector(state => state.jobMonitoring.downloadJobsLoading);
    const downloadJobsList = useAppSelector(state => state.jobMonitoring.downloadJobsList);
    const timeInterval = useAppSelector(state => state.jobMonitoring.timeInterval);
    const fromTime = useAppSelector(state => state.jobMonitoring.fromTime);
    const toTime = useAppSelector(state => state.jobMonitoring.toTime);
    const subJobsData = useAppSelector(state => state.jobMonitoring.subJobsData);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    const [jobsCursor, setJobsCursor] = useState(null);
    const [time, setTime] = useState<{ startTime: number; endTime: number } | null>(null);
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');

    // Filter options to use while downloading
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    // to get sub jobs data
    const [subTaskListApi] = useLazyGetSubTaskListQuery();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
    }, [headerSelectedCred, headerSelectedRegion]);

    const menuItems = (row: any) => {
        return [
            {
                id: 'goToCf',
                displayName: '',
                customComponent:
                    row?.name && row.name.includes('href') ? (
                        <Button Component="text" variant="link" className={CommonStyles.buttonClass}>
                            {GENERAL.GO_TO_CLOUDFORMATION}
                        </Button>
                    ) : (
                        GENERAL.GO_TO_CLOUDFORMATION
                    ),
                disabled: row?.name && row.name.includes('href') ? false : true
            }
        ];
    };

    const openDemoInfoDialog = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.DEMO_TITLE}
                content={<Typography variant="Regular_14">{`${GENERAL.DEMO_CONTENT}`}</Typography>}
                primaryButton={GENERAL.CONTINUE}
                callback={() => {}}
            />
        );
    };

    const handleGoToCfClick = (cellData: string) => {
        const hrefRegex = /href:(.+)/;
        const hrefMatch = cellData.match(hrefRegex);
        if (hrefMatch) {
            const href = hrefMatch[1];
            handleRedirectToCF(href);
        }
    };

    const handleRedirectToCF = (href: string) => {
        if (isDemoMode) {
            openDemoInfoDialog();
        } else {
            window.open(href, '_blank', 'noopener');
        }
    };

    const getSubJobsData = (jobId: string) => {
        dispatch(setSubJobsDataLoading(true));
        if (subJobsData && subJobsData?.subJobs && subJobsData?.id === jobId) {
            dispatch(setSubJobsDataLoading(false));
        } else {
            subTaskListApi({
                credentialId: credId,
                region: regionId,
                id: jobId
            })
                .then(data => {
                    dispatch(setSubJobsData(data?.data || {}));
                    dispatch(setSubJobsDataLoading(false));
                })
                .catch((error: any) => {
                    dispatch(setSubJobsData({}));
                    dispatch(setSubJobsDataLoading(false));
                });
        }
    };

    useEffect(() => {
        dispatch(setSubJobsData({}));
    }, [timeInterval]);

    // API call to download job monitoring data where includeSubJobs is true. It will include subtasks also.
    const {
        data: jmJobsList,
        isFetching: jmJobsListLoading,
        isError: jmJobsListError
    } = useGetFullJobsListQuery(
        {
            credentialId: credId,
            region: regionId,
            nextToken: jobsCursor,
            startTime: time?.startTime,
            endTime: time?.endTime,
            includeSubJobs: true,
            type: typeFilter,
            status: statusFilter
        },
        { skip: skipApiCall }
    );

    // When download starts it will read timeInterval and start API call
    useEffect(() => {
        if (downloadJobsLoading && timeInterval && fromTime && toTime) {
            setTimeout(() => {
                dispatch(setDownloadJobsList([]));
                setTime({ startTime: fromTime, endTime: toTime });
                setSkipApiCall(false);
            }, 0);
        } else {
            setSkipApiCall(true);
        }
    }, [downloadJobsLoading]);

    // Download Job monitoring download function
    const downloadJMTable = (dataList: any) => {
        const keys = JM_DOWNLOAD.MAIN_JOBS_KEYS;
        const headers = JM_DOWNLOAD.MAIN_JOBS_CSV_HEADERS;
        const result = '';
        let csv = createJobMonitorCSV(dataList, keys, headers, result, 0);
        // remove #
        if (csv) {
            csv = csv.replace('#', '');
        }
        downloadCsv(csv);
        dispatch(setDownloadJobsLoading(false));
    };

    // Logic to read API response and download file
    useEffect(() => {
        if (!jmJobsListLoading) {
            let oldList = downloadJobsList || [];
            let newList = jmJobsList?.items || [];
            let mergedList = [...oldList, ...newList];
            dispatch(setDownloadJobsList(mergedList));
            setJobsCursor(jmJobsList?.nextToken || null);
            if (jmJobsList && !jmJobsList?.nextToken) {
                // Download logic
                downloadJMTable(mergedList);
                dispatch(clearNotifications());
                // success notification
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: GENERAL.JM_DOWNLOAD_SUCCESS
                    })
                );
            } else if (jmJobsListError) {
                // in case of API error set loading as false
                dispatch(setDownloadJobsLoading(false));
            }
        }
    }, [jmJobsList, jmJobsListLoading, jmJobsListError]);

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
                                        handleGoToCfClick(cellData);
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

    const ExpandedRow = ({ rowData }: any) => {
        const statusType = rowData?.status.toLowerCase();
        return <SubJobTable jobId={rowData?.id} statusType={statusType} />;
    };

    const JobsColDefs: ColumnProps[] = [
        {
            id: '0',
            Header: '',
            accessor: 'name',
            width: '56px',
            isSticky: true,
            renderCell: (value: any, rowData: any, { updateRowState, rowsState }: any) => {
                const currentRowState = rowsState[rowData.id];
                const statusType = rowData?.status.toLowerCase();
                return (
                    <>
                        <div className={`${styles.statusbar} ${styles[statusType]}`}>&nbsp;</div>
                        <div className={styles.arrow}>
                            <ArrowIcon
                                className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                onClick={(e: any) => {
                                    getSubJobsData(rowData?.id); // calling sub jobs api on expand click
                                    e.stopPropagation();
                                    expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                }}
                            />
                        </div>
                    </>
                );
            }
        },
        {
            id: '1',
            Header: 'Job ID',
            accessor: 'id',
            className: styles.firstCol,
            isSortable: true,
            width: '286px',
            isSticky: true
        },
        {
            id: '2',
            Header: 'Type',
            accessor: 'type',
            width: '160px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                if (cellData) {
                    return cellData.charAt(0).toUpperCase() + cellData.substr(1).toLowerCase();
                } else {
                    return cellData;
                }
            }
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: '160px',
            filterOptions: [
                { value: JOB_MONITORING_STATUS.IN_PROGRESS, label: GENERAL.JM_RUNNING },
                { value: JOB_MONITORING_STATUS.COMPLETED, label: GENERAL.JM_COMPLETED },
                { value: JOB_MONITORING_STATUS.FAILED, label: GENERAL.JM_FAILED }
            ],
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.statusCol}>
                        <div>
                            {cellData === JOB_MONITORING_STATUS.COMPLETED && <Success />}
                            {cellData === JOB_MONITORING_STATUS.FAILED && (
                                <Popover
                                    popoverClass={CommonStyles['popover']}
                                    children={<Typography variant="Regular_14">{rowData?.error}</Typography>}
                                    trigger="hover"
                                    container={<ErrorIcon className={styles.statusIcon} />}
                                />
                            )}
                            {cellData === JOB_MONITORING_STATUS.IN_PROGRESS && <InProgress />}
                        </div>
                        <div>{jobMonitoringStatusMapping(cellData)}</div>
                    </div>
                );
            }
        },
        {
            id: '4',
            Header: 'Resource name',
            accessor: 'resourceName',
            isSortable: true,
            width: '168px'
        },
        {
            id: '5',
            Header: 'Job name',
            accessor: 'name',
            isSortable: true,
            width: '325px',
            renderCell: (cellData: any) => {
                let jobName = cellData ? cellData.split(';href')[0] : '';
                return (
                    <div className={CommonStyles.wrapTextIn2Line} title={cellData}>
                        {jobName}
                    </div>
                );
            }
        },
        {
            id: '6',
            Header: 'Start time',
            accessor: 'startTime',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any) => {
                const formatDate = cellData ? formatDateWithTime(cellData) : 'N/A';
                return (
                    <div className={CommonStyles.wrapTextIn2Line} title={formatDate}>
                        {formatDate}
                    </div>
                );
            }
        },
        {
            id: '7',
            Header: 'End time',
            accessor: 'endTime',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any) => {
                const formatDate = cellData ? formatDateWithTime(cellData) : 'N/A';
                return (
                    <div className={CommonStyles.wrapTextIn2Line} title={formatDate}>
                        {formatDate}
                    </div>
                );
            }
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: JobsColDefs,
        rows: jobsList,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: jobsListLoading
    });

    // logic to get type and status filter values
    useEffect(() => {
        const filters = tableProps?.filterState?.columns;
        JobsColDefs.map((col: any) => {
            if (col?.id in filters) {
                let filterValues = Object.keys(filters[col?.id]?.values);
                if (col?.accessor === 'type' && filterValues) {
                    setTypeFilter(filterValues.join(','));
                }
                if (col?.accessor === 'status' && filterValues) {
                    setStatusFilter(filterValues.join(','));
                }
            }
        });
    }, [tableProps]);

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: GENERAL.LOADING_DATA
    };

    useEffect(() => {
        // Even if jobsList is changed than also collapse subjobs
        collapseAllRows(tableProps?.updateRowState, tableProps?.rowsState);
        tableProps?.pagination?.gotoPage(0);
    }, [timeInterval, jobsList]);

    const downloadJobMonitoring = () => {
        dispatch(setDownloadJobsLoading(true));
        dispatch(clearNotifications());
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: GENERAL.JM_DOWNLOAD_PROGRESS
            })
        );
    };

    return (
        <>
            <div className={styles.jobMonitoringTable}>
                <div
                    //  @ts-ignore
                    className={`${styles.table}`}
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle="Jobs"
                        singularTitle="Job"
                        className={styles.topBarStyle}
                        actionsRight={
                            <div className={styles.downloadButton}>
                                {(jobsListLoading && !downloadJobsLoading) ||
                                    (jobsList.length === 0 && (
                                        <div className={styles.downloadDisable}>
                                            <DownloadIcon />
                                        </div>
                                    ))}
                                {downloadJobsLoading && (
                                    <Popover
                                        popoverClass={CommonStyles['popover']}
                                        children={
                                            <Typography variant="Regular_14">{GENERAL.JM_DOWNLOAD_PROGRESS}</Typography>
                                        }
                                        trigger="hover"
                                        container={
                                            <div className={styles.downloadDisable}>
                                                <DownloadIcon />
                                            </div>
                                        }
                                    />
                                )}
                                {!downloadJobsLoading && !jobsListLoading && jobsList.length > 0 && (
                                    <DownloadIcon onClick={downloadJobMonitoring} />
                                )}
                            </div>
                        }
                    />

                    <Table
                        {...tableComponentProps}
                        //@ts-ignore
                        tableProps={tableProps}
                        isDoubleRow={true}
                    />
                </div>
            </div>
        </>
    );
};

export default JobMonitoringTable;
