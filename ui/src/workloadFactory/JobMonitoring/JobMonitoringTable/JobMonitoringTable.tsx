import React, { useRef, useEffect, useState } from 'react';
import { Popover, Table, TableTopBar, Typography, useTable } from '@netapp/design-system';
import styles from './JobMonitoringTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';

import SubJobTable from '../SubJobTable/SubJobTable';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { JOB_MONITORING_STATUS, STATUS_CONST } from '../../../utils/consts';
import { jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';

const JobMonitoringTable = () => {
    const jobsListLoading = useAppSelector(state => state.jobMonitoring.jobsListLoading);
    // const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);

    const [scrollPos, setScrollPos] = useState(0);

    useEffect(() => {
        const handleOuterScroll = () => {
            setScrollPos(currentTable[0].scrollLeft);
        };

        const currentTable = document.querySelectorAll("[class^='Table-module_horizontal-scroll__']");

        console.log(currentTable);

        if (currentTable[0]) {
            //@ts-ignore
            currentTable[0].addEventListener('scroll', handleOuterScroll);
        }

        return () => {
            if (currentTable[0]) {
                //@ts-ignore
                currentTable[0].removeEventListener('scroll', handleOuterScroll);
            }
        };
    }, []);

    const ExpandedRow = ({ rowData }: any) => {
        const statusType = rowData?.status.toLowerCase();
        return <SubJobTable statusType={statusType} scrollPosition={scrollPos} />;
    };

    const jobsList: any[] = [
        {
            id: '9876543219236789',
            type: 'Deployment',
            status: 'COMPLETED',
            resourceName: 'SQL',
            name: 'Microsoft SQL server deployed with stack <stack-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            id: '2876543219236789',
            type: 'Deployment',
            status: 'COMPLETED',
            resourceName: 'SQL',
            name: 'Microsoft SQL server deployed with stack <stack-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            id: '4876543219006789',
            type: 'Backup',
            status: 'FAILED',
            resourceName: 'SQL',
            name: 'Backup of <host-name>/<job-name> with policy <policy-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45',
            error: 'Embedded stack arn:aws:cloudformation:ap-southeast-1:464262061435:stack/WLMDB-SqlFciStack-1704443882020-ValidationStack1-1DM7D6502JCM8/d389a1b0-aba5-11ee-9f10-067d5fa9eb92 was not successfully created: The following resource(s) failed to create: [ValidationNode1].'
        },
        {
            id: '3876543219006789',
            type: 'Backup',
            status: 'IN_PROGRESS',
            resourceName: 'SQL',
            name: 'Backup of <host-name>/<job-name> with policy <policy-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            id: '7876543219036789',
            type: 'Clone',
            status: 'IN_PROGRESS',
            resourceName: 'SQL',
            name: 'Clone of <host-name>/<job-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            id: '8876543219036789',
            type: 'Clone',
            status: 'COMPLETED',
            resourceName: 'SQL',
            name: 'Clone of <host-name>/<job-name>',
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
                            {cellData === JOB_MONITORING_STATUS.FAILED && 
                                <Popover
                                    popoverClass={CommonStyles['popover']}
                                    children={<Typography variant="Regular_14">{rowData?.error}</Typography>}
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
                return <div className={styles.wrapText}>{cellData}</div>;
            }
        },
        {
            id: '7',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any) => {
                return <div className={styles.wrapText}>{cellData}</div>;
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
        lazyLoadingText: 'Loading'
    };

    const exportToCsv = {
        options: {},
        fileName: 'Test'
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
                        exportToCsvOptions={exportToCsv}
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
