import { Popover, Table, Typography, useTable } from '@netapp/design-system';
import styles from './SubJobTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import TaskTable from '../TaskTable/TaskTable';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import { formatDateWithTime, jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';
import { useEffect, useState } from 'react';
// import { useRunOnce } from '../../../common/hooks/useRunOnce';
import { useGetSubTaskListQuery } from '../../../utils/apiService';

const SubJobTable = ({ jobId, statusType }: any) => {
    // const [leftPos, setLeftPos] = useState(0);
    const [subTaskList, setSubTaskList] = useState<any>([]);

    const ExpandedRow = ({ rowData }: any) => {
        return <TaskTable taskList={rowData?.subJobs} />;
    };

    const { data: jmSubTaskList, isFetching: jmSubTaskListLoading } = useGetSubTaskListQuery(jobId);

    useEffect(() => {
        if(jmSubTaskList){
            setSubTaskList(jmSubTaskList?.subJobs);
        }
    }, [jmSubTaskList]);

    // useRunOnce(() => {
    //     const currentTable = document.querySelectorAll("[class^='Table-module_horizontal-scroll__']");
    //     if (currentTable[0]) {
    //         setTimeout(() => {
    //             currentTable[0].scrollLeft = currentTable[1].scrollLeft;
    //             if (currentTable[1].scrollLeft > 56) {
    //                 setLeftPos(currentTable[1].scrollLeft - 2);
    //             } else {
    //                 setLeftPos(currentTable[1].scrollLeft - 4);
    //             }
    //         });
    //     }
    // });

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
            className: styles.firstCol,
            renderCell: (value: any, rowData: any, { updateRowState, rowsState }: any) => {
                const currentRowState = rowsState[rowData.id];
                const statusType = rowData?.status.toLowerCase();
                return (
                    <>
                        <div className={styles.arrow}>
                            <ArrowIcon
                                className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    expandRow(updateRowState, rowData, currentRowState);
                                }}
                            />
                        </div>
                    </>
                );
            }
        },
        {
            id: '1',
            Header: 'Name',
            accessor: 'name',
            isSortable: true,
            width: '230px',
            isSticky: true
        },
        {
            id: '2',
            Header: 'Description',
            accessor: 'description',
            isSortable: true,
            width: '498px',
            renderCell: (cellData: any) => {
                return <div className={styles.wrapText}>{cellData}</div>;
            }
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: '180px',
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
            Header: 'Start Time',
            accessor: 'startTime',
            isSortable: true,
            width: '240px',
            renderCell: (cellData: any) => {
                return <div className={styles.wrapText}>{formatDateWithTime(cellData)}</div>;
            }
        },
        {
            id: '5',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '240px',
            renderCell: (cellData: any) => {
                return <div className={styles.wrapText}>{formatDateWithTime(cellData)}</div>;
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
        isLazyLoading: jmSubTaskListLoading
    });

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: 'Loading...'
    };

    return (
        <>
            <div className={styles.subJobTable}>
                <div className={`${styles.statusbar} ${styles[statusType]} ${styles.extraDiv}`}>&nbsp;</div>
                <div className={styles.extraDiv2} />
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
            </div>
        </>
    );
};

export default SubJobTable;
