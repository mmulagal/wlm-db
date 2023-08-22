import { Table, TableTopBar, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import TablesSummary from './TablesSummary/TablesSummary';
import StatusComponent from '../../../common/StatusComponent/StatusComponent';
import { formatDate, isNotNumberOrNA, formatSizeOrString } from '../../../utils/utilityFunctions';
import styles from './Tables.module.scss';

const Tables = () => {
    const summaryData = {
        count: 65,
        sizeValue: '600',
        sizeUnit: 'TiB'
    };

    const TablesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Table name',
            accessor: 'tableName',
            isSortable: true
        },
        {
            id: '2',
            Header: 'Database name',
            accessor: 'databaseName',
            filterOptions: 'auto',
            isSortable: true
        },
        {
            id: '3',
            Header: 'Type',
            accessor: 'tableType',
            filterOptions: 'auto',
            isSortable: true
        },
        {
            id: '4',
            Header: 'Schema',
            accessor: 'tableSchema',
            isSortable: true
        },
        {
            id: '5',
            Header: 'Size',
            accessor: 'tableSize',
            renderCell: (value: number) =>
                isNotNumberOrNA(value) ? (
                    <StatusComponent status={'INFO'} statusText={String(value)} useIcon={true} />
                ) : (
                    formatSizeOrString(value)
                ),
            accessorForTextFilter: 'tableSizeText',
            isSortable: true
        }
    ];

    const tablesTableData = [
        {
            id: '1',
            databaseName: 'Database1',
            tableName: 'table_a',
            tableType: 'Base',
            tableSchema: 'schema_1',
            tableSize: 124354353324
        },
        {
            id: '2',
            databaseName: 'Database2',
            tableName: 'table_b',
            tableType: 'View',
            tableSchema: 'schema_2',
            tableSize: 124356545543
        },
        {
            id: '3',
            databaseName: 'Database3',
            tableName: 'table_c',
            tableType: 'Merged',
            tableSchema: 'schema_3',
            tableSize: 12430989032365
        },
        {
            id: '4',
            databaseName: 'Database4',
            tableName: 'table_d',
            tableType: 'Base',
            tableSchema: 'schema_4',
            tableSize: 124354453355412
        },
        {
            id: '5',
            databaseName: 'Database5',
            tableName: 'table_e',
            tableType: 'Merged',
            tableSchema: 'schema_5',
            tableSize: 12435434532332
        },
        {
            id: '6',
            databaseName: 'Database6',
            tableName: 'table_f',
            tableType: 'Base',
            tableSchema: 'schema_6',
            tableSize: 12435435365323
        },
        {
            id: '7',
            databaseName: 'Database7',
            tableName: 'table_g',
            tableType: 'Base',
            tableSchema: 'schema_7',
            tableSize: 12435435323432
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: TablesColDefs,
        rows: tablesTableData,
        pageSize: 10,
        selectionType: 'none'
    });

    return (
        <div className={styles.tablesContainer}>
            <div className={styles.tablesSummary}>
                <TablesSummary summaryData={summaryData} />
            </div>
            <div className={styles.table}>
                <TableTopBar
                    //@ts-ignore
                    tableProps={tableProps}
                    pluralTitle={'Tables'}
                    singularTitle={'Table'}
                />
                <Table
                    //@ts-ignore
                    tableProps={tableProps}
                />
            </div>
        </div>
    );
};

export default Tables;
