import { Table, TableTopBar, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import DatabaseSummary from './DatabasesSummary/DatabasesSummary';
import StatusComponent from '../../../common/StatusComponent/StatusComponent';
import { formatDate, isNotNumberOrNA, formatSizeOrString } from '../../../utils/utilityFunctions';
import styles from './Databases.module.scss';

const Databases = () => {
    const summaryData = {
        count: 7,
        sizeValue: '600',
        sizeUnit: 'TiB'
    };

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Database name',
            accessor: 'databaseName',
            isSortable: true
        },
        {
            id: '2',
            Header: 'ID',
            accessor: 'id',
            isSortable: true
        },
        {
            id: '3',
            Header: 'Creation date',
            accessor: 'creationDate',
            renderCell: (time: string) => formatDate(time),
            accessorForTextFilter: 'creationDateText',
            isSortable: true
        },
        {
            id: '4',
            Header: 'Size',
            accessor: 'databaseSize',
            renderCell: (value: number) =>
                isNotNumberOrNA(value) ? (
                    <StatusComponent status={'INFO'} statusText={String(value)} useIcon={true} />
                ) : (
                    formatSizeOrString(value)
                ),
            accessorForTextFilter: 'databaseSizeText',
            isSortable: true
        },
        {
            id: '5',
            Header: 'Status',
            accessor: 'databaseStatus',
            filterOptions: 'auto',
            renderCell: (status: string) =>
                status.toUpperCase() === 'ONLINE' || status.toUpperCase() === 'OFFLINE' ? (
                    <StatusComponent status={status.toUpperCase()} isCircle={true} />
                ) : (
                    status
                ),
            isSortable: true
        }
    ];

    const databaseTableData = [
        {
            databaseName: 'Database1',
            id: '12345531',
            creationDate: 1692547456,
            databaseSize: 123252435343,
            databaseStatus: 'Online'
        },
        {
            databaseName: 'Database2',
            id: '12345532',
            creationDate: 1692547456,
            databaseSize: 123252435876,
            databaseStatus: 'Offline'
        },
        {
            databaseName: 'Database3',
            id: '12345534',
            creationDate: 1692547456,
            databaseSize: 123252435123,
            databaseStatus: 'Restoring'
        },
        {
            databaseName: 'Database4',
            id: '12345554',
            creationDate: 1692547456,
            databaseSize: 1232524356546,
            databaseStatus: 'Recovering'
        },
        {
            databaseName: 'Database5',
            id: '12345231',
            creationDate: 1692547456,
            databaseSize: 123252435212,
            databaseStatus: 'Suspect'
        },
        {
            databaseName: 'Database6',
            id: '12345565',
            creationDate: 1692547456,
            databaseSize: 123252435432,
            databaseStatus: 'Recovery pending'
        },
        {
            databaseName: 'Database7',
            id: '12345512',
            creationDate: 1692547456,
            databaseSize: 123252435432,
            databaseStatus: 'Emergency'
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: databaseTableData,
        pageSize: 10,
        selectionType: 'none'
    });

    return (
        <div className={styles.databasesContainer}>
            <div className={styles.databasesSummary}>
                <DatabaseSummary summaryData={summaryData} />
            </div>
            <div className={styles.table}>
                <TableTopBar
                    //@ts-ignore
                    tableProps={tableProps}
                    pluralTitle={'Databases'}
                    singularTitle={'Database'}
                />
                <Table
                    //@ts-ignore
                    tableProps={tableProps}
                />
            </div>
        </div>
    );
};

export default Databases;
