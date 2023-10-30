import { Table, TableTopBar, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import DatabaseSummary from './DatabasesSummary/DatabasesSummary';
import StatusComponent from '../../../common/StatusComponent/StatusComponent';
import { formatDate, isNotNumberOrNA, formatSizeOrString, formatSizeSplit } from '../../../utils/utilityFunctions';
import styles from './Databases.module.scss';
import { useOutletContext } from 'react-router-dom';
import { useMemo } from 'react';

const Databases = () => {
    let { databasesList } = useOutletContext<{ databasesList: any }>();
    //@ts-ignore
    const summaryData = useMemo(() => {
        const totalSize = databasesList.reduce((sum: number, item: any) => sum + parseInt(item.databaseSize), 0);
        const totalSizeObj = formatSizeSplit(totalSize);
        return {
            count: databasesList.length,
            sizeValue: totalSizeObj.value,
            sizeUnit: totalSizeObj.format
        };
    }, [databasesList]);

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

    const databaseTableData = databasesList.length ? databasesList : [];

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
