import { Table, TableTopBar, useTable } from '@netapp/design-system';
import styles from './JobMonitoringTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

const JobMonitoringTable = () => {

    const jobsList: any[] = [
        {
            jobId: '9876543219236789',
            type: 'Deployment',
            status: 'Completed',
            resourceName: 'SQL',
            jobName: 'Microsoft SQL server deployed with stack <stack-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            jobId: '2876543219236789',
            type: 'Deployment',
            status: 'Completed',
            resourceName: 'SQL',
            jobName: 'Microsoft SQL server deployed with stack <stack-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            jobId: '4876543219006789',
            type: 'Backup',
            status: 'Failed',
            resourceName: 'SQL',
            jobName: 'Backup of <host-name>/<job-name> with policy <policy-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            jobId: '3876543219006789',
            type: 'Backup',
            status: 'Running',
            resourceName: 'SQL',
            jobName: 'Backup of <host-name>/<job-name> with policy <policy-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            jobId: '7876543219036789',
            type: 'Clone',
            status: 'Running',
            resourceName: 'SQL',
            jobName: 'Clone of <host-name>/<job-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            jobId: '8876543219036789',
            type: 'Clone',
            status: 'Completed',
            resourceName: 'SQL',
            jobName: 'Clone of <host-name>/<job-name>',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        }
    ];

    const JobsColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Job ID',
            accessor: 'jobId',
            isSortable: true,
            width: '304px',
        },
        {
            id: '2',
            Header: 'Type',
            accessor: 'type',
            isSortable: true,
            width: '174px',
            filterOptions: 'auto',
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            isSortable: true,
            width: '174px',
            filterOptions: 'auto',
        },
        {
            id: '4',
            Header: 'Resource Name',
            accessor: 'resourceName',
            isSortable: true,
            width: '174px',
        },
        {
            id: '5',
            Header: 'Job Name',
            accessor: 'jobName',
            isSortable: true,
            width: '374px',
        },
        {
            id: '6',
            Header: 'Start Time',
            accessor: 'startTime',
            isSortable: true,
            width: '224px',
        },
        {
            id: '7',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '224px',
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: JobsColDefs,
        rows: jobsList,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
    });

    const tableComponentProps = {
        lazyLoadingText: 'Loading'
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
                        pluralTitle='Jobs'
                        singularTitle='Job'
                    />
                    <Table
                        // {...tableComponentProps}
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
