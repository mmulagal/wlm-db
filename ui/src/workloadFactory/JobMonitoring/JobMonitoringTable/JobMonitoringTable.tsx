import { Popover, Table, TableTopBar, Typography, useTable } from '@netapp/design-system';
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
import { createJobMonitorCSV, downloadCsv, formatDateWithTime, jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
// import { useRunOnce } from '../../../common/hooks/useRunOnce';
import JobMonitoringDownload from '../../JobMonitoring/jobMonitoringDownload.json';
import { useDispatch } from 'react-redux';
import { setDownloadData } from '../../../store/workloadFactory/jobMonitoringSlice';
import { useEffect } from 'react';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';

const JobMonitoringTable = () => {
    const dispatch = useDispatch();
    const jobsListLoading = useAppSelector(state => state.jobMonitoring.jobsListLoading);
    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const downloadData = useAppSelector(state => state.jobMonitoring.downloadData);

    // const [scrollPos, setScrollPos] = useState(0);

    // useRunOnce(() => {
    //     const handleOuterScroll = () => {
    //         setScrollPos(currentTable[0].scrollLeft);
    //     };

    //     const currentTable = document.querySelectorAll("[class^='Table-module_horizontal-scroll__']");

    //     if (currentTable[0]) {
    //         //@ts-ignore
    //         currentTable[0].addEventListener('scroll', handleOuterScroll);
    //     }

    //     return () => {
    //         if (currentTable[0]) {
    //             //@ts-ignore
    //             currentTable[0].removeEventListener('scroll', handleOuterScroll);
    //         }
    //     };
    // });

    useEffect(() => {
        if (downloadData === true) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: 'Download jobs table is in progress'
                })
            );
        } else if (downloadData === false) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: 'Jobs table downloaded successfully'
                })
            );
        }
    }, [downloadData]);

    const ExpandedRow = ({ rowData }: any) => {
        const statusType = rowData?.status.toLowerCase();
        return <SubJobTable jobId={rowData?.id} statusType={statusType} />;
    };

    const expandRow = (
        updateRowState: (arg0: any) => { (arg0: { isExpanded: boolean }): void; new (): any },
        rowData: { id: any },
        currentRowState: { isExpanded: any }
    ) => {
        updateRowState(rowData.id)({
            isExpanded: !currentRowState?.isExpanded
        });
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
                                onClick={() => expandRow(updateRowState, rowData, currentRowState)}
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
            filterOptions: 'auto'
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: '160px',
            filterOptions: 'auto',
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
            Header: 'Resource Name',
            accessor: 'resourceName',
            isSortable: true,
            width: '168px'
        },
        {
            id: '5',
            Header: 'Job Name',
            accessor: 'name',
            isSortable: true,
            className: styles.wrapText,
            width: '340px',
            renderCell: (cellData: any) => {
                return <div className={styles.wrapText}>{cellData}</div>;
            }
        },
        {
            id: '6',
            Header: 'Start Time',
            accessor: 'startTime',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any) => {
                return <div className={styles.wrapText}>{formatDateWithTime(cellData)}</div>;
            }
        },
        {
            id: '7',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any) => {
                return <div className={styles.wrapText}>{formatDateWithTime(cellData)}</div>;
            }
        },
        {
            id: '8',
            Header: '',
            accessor: '',
            width: '40px'
        }
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

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: GENERAL.LOADING_DATA
    };

    const downloadJobMonitoring = (data: any) => {
        dispatch(setDownloadData(true));
        
        // TODO: API integration for download
        setTimeout(() => {
            const keys = JM_DOWNLOAD.MAIN_JOBS_KEYS;
            const headers = JM_DOWNLOAD.MAIN_JOBS_CSV_HEADERS;
            const result = '';
            const csv = createJobMonitorCSV(data, keys, headers, result, 0);
            downloadCsv(csv);
            dispatch(setDownloadData(false));
        }, 5000);
    }

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
                            <div>
                                {downloadData && 
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
                                }
                                {!downloadData && 
                                    <DownloadIcon 
                                        onClick={() => {downloadJobMonitoring(JobMonitoringDownload?.items)}}
                                />}
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
