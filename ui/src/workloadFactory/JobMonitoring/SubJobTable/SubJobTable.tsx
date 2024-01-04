import { Table, useTable } from '@netapp/design-system';
import styles from './SubJobTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import TaskTable from '../TaskTable/TaskTable';

const SubJobTable = ({statusType}: any) => {

    const ExpandedRow = () => {
        return (
            <TaskTable/>
        )
      };

    const jobsList: any[] = [
        {
            name: '9876543219236789',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '2876543219236789',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '4876543219006789',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Failed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '3876543219006789',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Running',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '7876543219036789',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Running',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: '8876543219036789',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
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
            className: styles.firstCol,
            renderCell: (
              value: any,
              rowData: any,
              { updateRowState, rowsState }: any
            ) => {
              const currentRowState = rowsState[rowData.id];
              const statusType = rowData?.status.toLowerCase();
              return (
                <>
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
            Header: 'Name',
            accessor: 'name',
            isSortable: true,
            width: '230px',
            isSticky: true,
        },
        {
            id: '2',
            Header: 'Description',
            accessor: 'description',
            isSortable: true,
            width: '498px',
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: '180px',
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
            Header: 'Start Time',
            accessor: 'startTime',
            isSortable: true,
            width: '240px',
        },
        {
            id: '5',
            Header: 'End Time',
            accessor: 'endTime',
            isSortable: true,
            width: '240px',
        },
        {
            id: '6',
            Header: '',
            accessor: '',
            width: '56px',
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
            <div className={styles.subJobTable}>
                <div className={`${styles.statusbar} ${styles[statusType]}`}>&nbsp;</div>
                <div
                    //  @ts-ignore
                    className={`${styles.table}`}
                >   
                    <Table
                        {...tableComponentProps}
                        //@ts-ignore
                        tableProps={tableProps}
                        isDoubleRow={true}
                        variant='innerTable'
                    />
                </div>
            </div>
        </>
    );
};

export default SubJobTable;
