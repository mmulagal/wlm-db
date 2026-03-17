import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import FirstColumnComponent from '../../../Dashboard/DashboardInnerPage/RenderTables/FirstColumnComponent';
import { GENERAL } from '../../../../utils/appConstants';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { getWadCellProps } from '../../GetWellUtils';

const FileSystemHeadroomOptimizeTable = ({ type, lastColDetails, handleBulkAction, isWad = false }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const data = [
        {
            serverInstanceName: 'Volume 1',
            status: 'Up',
            fileSystemPercent: '50%',
            fileSystemStatus: 'Under-provisioned',

            id: '1'
        },
        {
            serverInstanceName: 'Volume 2',
            status: 'Up',
            fileSystemPercent: '50%',
            fileSystemStatus: 'Over-provisioned',
            id: '2'
        }
    ];

    const tableData = useMemo(
        () =>
            data.map((row: any) => ({
                ...row,
                isWad,
                cellProps: getWadCellProps(isWad, t, { ...row.cellProps, isDisabled: true })
            })),
        [data, isWad, t]
    );

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Database name',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '366px',
            renderCell: (cellData: any, rowData: any) => <FirstColumnComponent rowData={rowData} />
        },

        {
            Header: 'Status',
            accessor: 'fileSystemStatus',
            id: '3',
            width: '366px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: 'File system headroom percentage',
            accessor: 'fileSystemPercent',
            id: '4',
            width: '302px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => cellData || GENERAL.NOT_AVAILABLE
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
        selectionType: 'multiple',
        defaultSelectedRows: tableData.map(item => item.id)
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        // if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length) {
        //     checkBoxHandle(tableProps.selectionState, rowsData, disptach);
        // }
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Impacted volumes"
                singularTitle="Impacted volume"
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer action={GENERAL.OPTIMIZE} onClick={handleBulkAction} />
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

export default FileSystemHeadroomOptimizeTable;
