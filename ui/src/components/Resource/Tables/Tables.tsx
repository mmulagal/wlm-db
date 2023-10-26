import { Table, TableTopBar, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import TablesSummary from './TablesSummary/TablesSummary';
import StatusComponent from '../../../common/StatusComponent/StatusComponent';
import { formatDate, isNotNumberOrNA, formatSizeOrString, formatSizeSplit } from '../../../utils/utilityFunctions';
import styles from './Tables.module.scss';
import { useOutletContext } from 'react-router-dom';
import { useMemo } from 'react';

const Tables = () => {
    let { tables, batchingCompleted } = useOutletContext<{ tables: any; batchingCompleted: boolean }>();
    //@ts-ignore
    const summaryData = useMemo(() => {
        const totalSize = tables.reduce((sum: number, item: any) => sum + parseInt(item.tableSize), 0);
        const totalSizeObj = formatSizeSplit(totalSize);
        return {
            count: tables.length,
            sizeValue: totalSizeObj.value,
            sizeUnit: totalSizeObj.format,
            isLoading: !batchingCompleted
        };
    }, [tables, batchingCompleted]);

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

    const tablesTableData = tables.length ? tables : [];

    const tableProps = useTable({
        isSorting: false,
        columns: TablesColDefs,
        rows: tablesTableData,
        pageSize: 10,
        selectionType: 'none',
        isLazyLoading: !batchingCompleted
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
                    lazyLoadingText="Loading Tables"
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
