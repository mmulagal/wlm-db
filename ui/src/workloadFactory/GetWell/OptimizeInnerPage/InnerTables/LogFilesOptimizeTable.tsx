import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';

import { GENERAL } from '../../../../utils/appConstants';
import { getWadCellProps } from '../../GetWellUtils';

const LogFilesOptimizeTable = ({ type, data, lastColDetails, handleBulkAction, isWad = false }: any) => {
    const { t } = useTranslation();
    const tableData = useMemo(() => {
        let id = 0;
        return data?.objectsInViolation?.map((row: any) => ({
            databaseName: row,
            id: String(id++),
            cellProps: getWadCellProps(isWad, t, { ...row.cellProps, isDisabled: true })
        }));
    }, [data, isWad, t]);
    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Database name',
            accessor: 'databaseName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },

        lastColDetails(type, {}, '230px')
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'none',
        defaultSelectedRows: tableData.map((item: any) => item.id)
    });

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Impacted databases"
                singularTitle="Impacted database"
            />

            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
                key={Date.now()}
            />
        </div>
    );
};

export default LogFilesOptimizeTable;
