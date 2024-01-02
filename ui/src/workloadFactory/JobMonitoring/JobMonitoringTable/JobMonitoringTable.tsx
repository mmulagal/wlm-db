import { Table, TableTopBar, useTable } from '@netapp/design-system';
import styles from './JobMonitoringTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ChevronIconCollapse } from '@netapp/icons/ic_card_arrow_collapse.svg';
import { ReactComponent as ChevronIconExpand } from '@netapp/icons/ic_card_arrow_expand.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';

const JobMonitoringTable = () => {

    const ExpandedRow = ({ rowData, columns, rowsState }: any) => {
        const currentRowState = rowsState[rowData.id];
        return (
          <div className={styles.secondLevel}>
            Second level job monitoring data
          </div>
        );
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
            width: '60px',
            renderCell: (
              value: any,
              rowData: any,
              { updateRowState, rowsState }: any
            ) => {
              const currentRowState = rowsState[rowData.id];
              const statusType = rowData.status.toLowerCase();
              return (
                <>
                    <div className={`${styles.statusbar} ${styles[statusType]}`}>&nbsp;</div>
                    <div className={styles.arrow}>
                        {!currentRowState?.isExpanded && 
                            <ChevronIconExpand onClick={() => expandRow(updateRowState, rowData, currentRowState)} />
                        }
                        {currentRowState?.isExpanded && 
                            <ChevronIconCollapse onClick={() => expandRow(updateRowState, rowData, currentRowState)} />
                        }
                    </div>
                </>
              );
            },
        },
        {
            id: '1',
            Header: 'Job ID',
            accessor: 'jobId',
            isSortable: true,
            width: '244px',
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
            width: '174px',
        },
        {
            id: '5',
            Header: 'Job Name',
            accessor: 'jobName',
            isSortable: true,
            width: '374px',
            renderCell: (cellData: any) => {
                return (
                    <div className={styles.jobname}>
                        {cellData}
                    </div>
                )
            }
        },
        {
            id: '6',
            Header: 'Start Time',
            accessor: 'startTime',
            isSortable: true,
            width: '234px',
        },
        {
            id: '7',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '234px',
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
