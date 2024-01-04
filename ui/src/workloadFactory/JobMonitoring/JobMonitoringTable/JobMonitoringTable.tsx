import { Table, TableTopBar, useTable } from '@netapp/design-system';
import styles from './JobMonitoringTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import SubJobTable from '../SubJobTable/SubJobTable';

const JobMonitoringTable = () => {
    
    const ExpandedRow = ({ rowData }: any) => {
        const statusType = rowData?.status.toLowerCase();
        return (
            <SubJobTable statusType={statusType}/>
        )
      };

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

    const expandRow = (updateRowState: (arg0: any) => { (arg0: { isExpanded: boolean; }): void; new(): any; }, rowData: { id: any; }, currentRowState: { isExpanded: any; }) => {
        updateRowState(rowData.id)({
            isExpanded: !currentRowState?.isExpanded,
        });
    };

    const JobsColDefs: ColumnProps[] = [
        {
            id: '0',
            Header: '',
            accessor: 'name',
            width: '56px',
            isSticky: true,
            renderCell: (
              value: any,
              rowData: any,
              { updateRowState, rowsState }: any
            ) => {
              const currentRowState = rowsState[rowData.id];
              const statusType = rowData?.status.toLowerCase();
              return (
                <>
                    <div className={`${styles.statusbar} ${styles[statusType]}`}>&nbsp;</div>
                    <div className={styles.arrow}>
                        <ArrowIcon 
                            className={currentRowState?.isExpanded ? styles['arrow-down'] : ''} 
                            onClick={() => expandRow(updateRowState, rowData, currentRowState)}  />
                    </div>
                </>
              );
            },
        },
        {
            id: '1',
            Header: 'Job ID',
            accessor: 'jobId',
            className: styles.firstCol,
            isSortable: true,
            width: '286px',
            isSticky: true,
        },
        {
            id: '2',
            Header: 'Type',
            accessor: 'type',
            isSortable: true,
            width: '160px',
            filterOptions: 'auto',
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            isSortable: true,
            width: '160px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return (
                    <div className={styles.statusCol}>
                        <div>
                            {cellData === 'Completed' && <Success />}
                            {cellData === 'Failed' && <ErrorIcon />}
                            {cellData === 'Running' && <InProgress />}
                        </div>
                        <div>{cellData}</div>
                    </div>
                )
            }
        },
        {
            id: '4',
            Header: 'Resource Name',
            accessor: 'resourceName',
            isSortable: true,
            width: '168px',
        },
        {
            id: '5',
            Header: 'Job Name',
            accessor: 'jobName',
            isSortable: true,
            width: '340px',
        },
        {
            id: '6',
            Header: 'Start Time',
            accessor: 'startTime',
            isSortable: true,
            width: '200px',
        },
        {
            id: '7',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '200px',
        },
        {
            id: '8',
            Header: '',
            accessor: '',
            width: '40px',
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
        ExpandedRow,
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
