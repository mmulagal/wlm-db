import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';

import { useMemo } from 'react';
import { GENERAL } from '../../../../utils/appConstants';

const CRROptimizeTable = ({ type, data, lastColDetails, handleBulkAction }: any) => {
    const tableData = useMemo(() => {
        let id = 0;
        return data?.objectsInViolation?.map((row: any) => ({
            volumeName: row,
            id: String(id++),
            cellProps: { ...row.cellProps, isDisabled: true }
        }));
    }, [data]);
    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Volume name',
            accessor: 'volumeName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },

        lastColDetails(type, {}, '230px')
    ];

    const tableProps = useTable({
        //@ts-ignore
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
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted volumes`}
                singularTitle={'Impacted volume'}
            />

            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                key={Date.now()}
            />
        </div>
    );
};

export default CRROptimizeTable;
