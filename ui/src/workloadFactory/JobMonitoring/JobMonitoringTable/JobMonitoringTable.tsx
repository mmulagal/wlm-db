import { Button, Popover, Typography, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useDispatch } from 'react-redux';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './JobMonitoringTable.module.scss';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { ReactComponent as DownloadIcon } from '../../../assets/ic_download.svg';

import SubJobTable from '../SubJobTable/SubJobTable';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { JM_DOWNLOAD, JOB_MONITORING_STATUS, JOB_MONITORING_TYPE } from '../../../utils/consts';
import {
    collapseAllRows,
    createJobMonitorCSV,
    downloadCsv,
    expandTableRow,
    formatDateWithTime,
    jobMonitoringStatusMapping,
    jobMonitoringTypeMapping
} from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import {
    setDownloadJobsList,
    setDownloadJobsLoading,
    setJobMonitoringColumnState,
    setSubJobsData,
    setSubJobsDataLoading
} from '../../../store/workloadFactory/jobMonitoringSlice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { useGetFullJobsListQuery, useLazyGetSubTaskListQuery } from '../../../utils/apiService';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import CopyToClipboardCommon from '../../../common/CopyToClipboard/copyToClipboard';
import { initialJobMonitorColState } from '../../../utils/manageColumnUtils';
import { useTable } from '../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../common/Lib/Table/Table';

const JobMonitoringTable = React.memo(() => {
    const { t } = useTranslation();
    const { setDialog } = useDialog();
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);

    const dispatch = useDispatch();
    const jobsListLoading = useAppSelector(state => state.jobMonitoring.jobsListLoading);
    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const downloadJobsLoading = useAppSelector(state => state.jobMonitoring.downloadJobsLoading);
    const columnState = useAppSelector(state => state.jobMonitoring.columnState);
    const downloadJobsList = useAppSelector(state => state.jobMonitoring.downloadJobsList);
    const timeInterval = useAppSelector(state => state.jobMonitoring.timeInterval);
    const fromTime = useAppSelector(state => state.jobMonitoring.fromTime);
    const toTime = useAppSelector(state => state.jobMonitoring.toTime);
    const subJobsData = useAppSelector(state => state.jobMonitoring.subJobsData);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);
    const { credentialData, credentialLoading } = useAppSelector(state => state.headers.getCredentials);
    const refreshTimeJobMonitor = useAppSelector(state => state.headers.refreshTimeJobMonitor);

    const [jobsCursor, setJobsCursor] = useState(null);
    const [time, setTime] = useState<{ startTime: number; endTime: number } | null>(null);
    const [skipApiCall, setSkipApiCall] = useState(true);

    // Filter options to use while downloading
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    // to get sub jobs data
    const [subTaskListApi] = useLazyGetSubTaskListQuery();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    const setRegion = (name: string, code: string) => {
        if (name && code) {
            return `${name} | ${code}`;
        }
        if (name && !code) {
            return name;
        }
        if (!name && code) {
            return code;
        }
        return GENERAL.NOT_AVAILABLE;
    };

    const tableFullData = useMemo(
        () =>
            jobsList.map((job: any) => {
                const matchingEntry =
                    credentialData && credentialData?.find(entry => entry.credentialsId === job.credentialsId);

                return {
                    ...job,
                    regions: setRegion(job?.region?.name, job?.region?.code),
                    credName: matchingEntry ? matchingEntry.name : GENERAL.NOT_AVAILABLE,
                    providerAccountId: matchingEntry ? matchingEntry.providerAccountId : GENERAL.NOT_AVAILABLE
                };
            }),
        [jobsList, credentialData]
    );

    const menuItems = (row: any) => [
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
            disabled: !(row?.name && row.name.includes('href'))
        }
    ];

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
    const downloadJMTable = (dataList: any, columnsState: any) => {
        const keys = columnsState
            .filter((column: any) => column.Header && typeof column.Header === 'string' && column.Header.trim() !== '')
            .map((column: any) => column.accessor)
            .filter((accessor: any) => accessor);

        const headers = columnsState
            .filter((column: any) => typeof column.Header === 'string' && column.Header.trim() !== '')
            .map((column: any) => column.Header)
            .join(',');

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
            const oldList = downloadJobsList || [];
            // let newList = jmJobsList?.items || [];
            const newList =
                (jmJobsList &&
                    jmJobsList?.items.map((job: any) => {
                        const matchingEntry =
                            credentialData && credentialData?.find(entry => entry.credentialsId === job.credentialsId);

                        return {
                            ...job,
                            regions: setRegion(job?.region?.name, job?.region?.code),
                            credName: matchingEntry ? matchingEntry.name : GENERAL.NOT_AVAILABLE,
                            providerAccountId: matchingEntry ? matchingEntry.providerAccountId : GENERAL.NOT_AVAILABLE
                        };
                    })) ||
                [];
            const mergedList = [...oldList, ...newList];
            dispatch(setDownloadJobsList(mergedList));
            setJobsCursor(jmJobsList?.nextToken || null);
            if (jmJobsList && !jmJobsList?.nextToken) {
                // Download logic
                downloadJMTable(mergedList, columnState);
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

    const ExpandedRow = useCallback(({ rowData }: any) => {
        const statusType = rowData?.status.toLowerCase();
        return <SubJobTable jobId={rowData?.id} statusType={statusType} />;
    }, []);

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
                const isExpandDisable =
                    rowData?.name?.includes('Check data integrity') ||
                    rowData?.type === JOB_MONITORING_TYPE.LOGS_ANALYSIS ||
                    rowData?.name?.includes('offline assessment data upload') ||
                    rowData?.name?.includes('Upload Oracle on-premises data collector results');
                return (
                    <>
                        <div className={`${styles.statusbar} ${styles[statusType]}`}>&nbsp;</div>

                        <div className={isExpandDisable ? `${styles.arrow} ${styles['arrow-disabled']}` : styles.arrow}>
                            <ArrowIcon
                                className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    if (!isExpandDisable) {
                                        getSubJobsData(rowData?.id); // calling sub jobs api on expand click
                                        expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                    }
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
            width: '220px',
            isSticky: true,
            renderCell: (cellData: any) => (
                <CopyToClipboardCommon value={cellData} iconProvided={<div title={cellData}>{cellData}</div>} />
            )
        },
        {
            id: '2',
            Header: 'Type',
            accessor: 'type',
            width: '140px',
            filterOptions: [
                { value: JOB_MONITORING_TYPE.DEPLOYMENT, label: t('databases.job-monitor.jm-type-deployment') },
                {
                    value: JOB_MONITORING_TYPE.CREATE_RESOURCE,
                    label: t('databases.job-monitor.jm-type-create-resource')
                },
                { value: JOB_MONITORING_TYPE.SANDBOX, label: t('databases.job-monitor.jm-type-sandbox') },
                { value: JOB_MONITORING_TYPE.ASSESSMENT, label: t('databases.job-monitor.jm-type-assessment') },
                { value: JOB_MONITORING_TYPE.WELL_ARCHITECTED, label: t('databases.job-monitor.jm-type-optimize') },
                {
                    value: JOB_MONITORING_TYPE.REGISTER_RESOURCE,
                    label: t('databases.job-monitor.jm-type-register-resource')
                },
                { value: JOB_MONITORING_TYPE.LOGS_ANALYSIS, label: t('databases.job-monitor.jm-type-logs-analysis') }
            ],
            renderCell: (cellData: any) => jobMonitoringTypeMapping(cellData, t)
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: '248px',
            filterOptions: [
                { value: JOB_MONITORING_STATUS.IN_PROGRESS, label: GENERAL.JM_RUNNING },
                { value: JOB_MONITORING_STATUS.COMPLETED, label: GENERAL.JM_COMPLETED },
                { value: JOB_MONITORING_STATUS.FAILED, label: GENERAL.JM_FAILED },
                { value: JOB_MONITORING_STATUS.WARNING, label: GENERAL.JM_WARNING }
            ],
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
                        {cellData === JOB_MONITORING_STATUS.IN_PROGRESS && <InProgress />}
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
                    </div>
                    <div>{jobMonitoringStatusMapping(cellData)}</div>
                </div>
            )
        },
        {
            id: '4',
            Header: 'Resource name',
            accessor: 'resourceName',
            isSortable: true,
            width: '168px'
        },
        {
            id: '8',
            Header: 'AWS credentials',
            accessor: 'credName',
            filterOptions: 'auto',
            width: '250px'
        },
        {
            id: '9',
            Header: 'AWS Account',
            accessor: 'providerAccountId',
            filterOptions: 'auto',
            width: '200px'
        },
        {
            id: '11',
            Header: 'Region',
            accessor: 'regions',
            filterOptions: 'auto',
            width: '300px'
        },
        {
            id: '5',
            Header: 'Job name',
            accessor: 'name',
            isSortable: true,
            width: '320px',
            renderCell: (cellData: any) => {
                const jobName = cellData ? cellData.split(';href')[0] : '';
                return (
                    <CopyToClipboardCommon
                        value={jobName}
                        iconProvided={
                            <div className={CommonStyles.wrapTextIn2Line} title={cellData}>
                                {jobName}
                            </div>
                        }
                    />
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
                const formatDate = cellData ? formatDateWithTime(cellData) : GENERAL.NOT_AVAILABLE;
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
            width: '196px',
            renderCell: (cellData: any) => {
                const formatDate = cellData ? formatDateWithTime(cellData) : GENERAL.NOT_AVAILABLE;
                return (
                    <div className={CommonStyles.wrapTextIn2Line} title={formatDate}>
                        {formatDate}
                    </div>
                );
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: JobsColDefs,
        rows: tableFullData,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: jobsListLoading || credentialLoading,
        isManagedColumns: true,
        initialColumnState: initialJobMonitorColState,
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => (
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
                                    handleGoToCfClick(rowData?.name);
                                }
                            }
                        }}
                        CustomMenu={undefined}
                        disabledText={undefined}
                    />
                </div>
            )
        },
        ...(isDemoMode
            ? {
                  initialSortState: {
                      sortOrder: 'desc',
                      column: '6'
                  }
              }
            : {})
    });

    // logic to get type and status filter values
    useEffect(() => {
        const filters = tableProps?.filterState?.columns;
        JobsColDefs.map((col: any) => {
            if (col?.id in filters) {
                const filterValues = Object.keys(filters[col?.id]?.values);
                if (col?.accessor === 'type' && filterValues) {
                    setTypeFilter(filterValues.join(','));
                }
                if (col?.accessor === 'status' && filterValues) {
                    setStatusFilter(filterValues.join(','));
                }
            }
        });
    }, [tableProps]);

    useEffect(() => {
        dispatch(setJobMonitoringColumnState(tableProps?.columns));
    }, [tableProps.columnsState]);

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: GENERAL.LOADING_DATA
    };

    useEffect(() => {
        collapseAllRows(tableProps?.updateRowState, tableProps?.rowsState);
        tableProps?.pagination?.gotoPage(0);
    }, [timeInterval, refreshTime]);

    useEffect(() => {
        const allRowIds = Object.keys(tableProps?.rowsState);
        if (allRowIds && allRowIds.length > 0) {
            allRowIds.forEach(rowId => {
                tableProps.updateRowState(rowId)({
                    isExpanded: false
                });
            });
        }
    }, [refreshTimeJobMonitor]);

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
        <div className={styles.jobMonitoringTable}>
            <div
                //  @ts-ignore
                className={`${styles.table}`}
            >
                <TableTopBar
                    // @ts-ignore
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
                                    popoverClass={CommonStyles.popover}
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
                    // @ts-ignore
                    tableProps={tableProps}
                    isDoubleRow
                />
            </div>
        </div>
    );
});

export default JobMonitoringTable;
