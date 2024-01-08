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
import { jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';
import { useEffect, useState } from 'react';

const SubJobTable = ({ statusType }: any) => {
    const [leftPos, setLeftPos] = useState(0);
    const ExpandedRow = () => {
        return <TaskTable />;
    };

    useEffect(() => {
        const currentTable = document.querySelectorAll("[class^='Table-module_horizontal-scroll__']");
        if (currentTable[0]) {
            setTimeout(() => {
                currentTable[0].scrollLeft = currentTable[1].scrollLeft;
                if (currentTable[1].scrollLeft > 56) {
                    setLeftPos(currentTable[1].scrollLeft - 3);
                } else {
                    setLeftPos(0);
                }
            }, 0);
        }
    }, []);

    const jobsList: any[] = [
        {
            name: '9876543219236789',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'COMPLETED',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '2876543219236789',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'COMPLETED',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '4876543219006789',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'FAILED',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45',
            errorMsg:
                'Embedded stack arn:aws:cloudformation:ap-southeast-1:464262061435:stack/WLMDB-SqlFciStack-1704443882020-ValidationStack1-1DM7D6502JCM8/d389a1b0-aba5-11ee-9f10-067d5fa9eb92 was not successfully created: The following resource(s) failed to create: [ValidationNode1].'
        },
        {
            name: '3876543219006789',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'IN_PROGRESS',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '7876543219036789',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'IN_PROGRESS',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '8876543219036789',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'COMPLETED',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        }
    ];

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
                            {cellData === JOB_MONITORING_STATUS.FAILED &&
                                <Popover
                                    popoverClass={CommonStyles['popover']}
                                    children={<Typography variant="Regular_14">{rowData?.errorMsg}</Typography>}
                                    trigger="hover"
                                    container={<ErrorIcon className={styles.statusIcon} />}
                                />
                            }
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
            width: '240px'
        },
        {
            id: '5',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '240px'
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
        rows: jobsList,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
        // isLazyLoading: subJobsLoading
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
                    style={{ position: 'relative', left: `${leftPos}px` }}
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
