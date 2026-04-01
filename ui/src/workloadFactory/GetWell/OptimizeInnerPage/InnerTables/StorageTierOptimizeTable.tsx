import { Table, useTable, TableTopBar, DsButton } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import useResize from '../../../../common/hooks/useResize';
import { getWadCellProps } from '../../GetWellUtils';

const StorageTierOptimizeTable = ({ type, data, lastColDetails, handleBulkAction, isWad = false }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);
    const windowSize = useResize();

    const tableData = useMemo(() => {
        let id = 0;
        return data?.violationDetails?.map((row: any) => ({
            ...row,
            id: String(id++),
            cellProps: getWadCellProps(isWad, t)
        }));
    }, [data, isWad, t]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Volume name',
            accessor: 'objectName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: windowSize.width >= 1920 ? 'auto' : '481px',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },

        {
            Header: 'SSD storage tier',
            accessor: 'value',
            id: '3',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: string) => (cellData ? `${cellData}%` : GENERAL.NOT_AVAILABLE)
        },
        lastColDetails(type, {}, '310px')
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
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
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

export default StorageTierOptimizeTable;
