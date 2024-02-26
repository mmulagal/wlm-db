import { FlashingDotsLoader, Popover, Table, Typography, useTable } from '@netapp/design-system';
import styles from './SubJobTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { ReactComponent as NoDataIcon } from '../../../assets/ic_file.svg';
import TaskTable from '../TaskTable/TaskTable';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { CREATE_RESOURCE, JOB_MONITORING_STATUS } from '../../../utils/consts';
import { expandTableRow, formatDateWithTime, jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

const SubJobTable = ({ jobId, statusType }: any) => {
    const [subTaskList, setSubTaskList] = useState<any>({});
    const subJobsData = useAppSelector(state => state.jobMonitoring.subJobsData);
    const subJobsDataLoading = useAppSelector(state => state.jobMonitoring.subJobsDataLoading);

    useEffect(() => {
        setSubTaskList(subJobsData?.subJobs);
    }, [subJobsData]);

    const ExpandedRow = ({ rowData }: any) => {
        return <TaskTable taskList={rowData?.subJobs || []} />;
    };

    const JobsColDefs: ColumnProps[] = [
        {
            id: '0',
            Header: '',
            accessor: 'name',
            width: '56px',
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
            width: '676px',
            isSticky: true,
            renderCell: (cellData: any) => {
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
            width: '230px',
            isSortable: true,
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
            Header: 'Start time',
            accessor: 'startTime',
            isSortable: true,
            width: '240px',
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
            id: '5',
            Header: 'End time',
            accessor: 'endTime',
            isSortable: true,
            width: '240px',
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
            id: '6',
            Header: '',
            accessor: '',
            width: '56px'
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
        <>
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
                            //@ts-ignore
                            tableProps={tableProps}
                            isDoubleRow={true}
                            variant="innerTable"
                        />
                    </div>
                )}
            </div>
        </>
    );
};

export default SubJobTable;
