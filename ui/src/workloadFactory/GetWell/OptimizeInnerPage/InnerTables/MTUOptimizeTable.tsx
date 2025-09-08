import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';

const MTUOptimizeTable = ({ type, data, lastColDetails, handleBulkAction }: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const tableData = useMemo(() => {
        let id = 0;
        const mtuData = data?.violationDetails || [];
        const processedData = mtuData.map((row: any) => ({
            ...row,
            cellProps: { ...row.cellProps, isDisabled: false },
            id: String(id++),
            interfaceName: row.interfaceName || row.objectName
        }));
        return processedData;
    }, [data]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.network-interface-name'),
            accessor: 'interfaceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.well-architect.mtu-value'),
            accessor: 'value',
            id: '2',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        lastColDetails(type, {}, '310px')
    ];

    const tableProps = useTable({
        manageColumnsProps: {},
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);
        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));
    }, [tableProps.selectionState, dispatch, tableData]);

    return (
        <div className={`${styles['inner-table']} ${styles['mtu-table']}`}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.well-architect.impacted-network-interfaces')}
                singularTitle={t('databases.well-architect.impacted-network-interface')}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer action={t('databases.well-architect.fix')} onClick={handleBulkAction} />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
                key={Date.now()}
            />
        </div>
    );
};

export default MTUOptimizeTable;
