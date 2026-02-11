import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import styles from './InnerTable.module.scss';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { getWadCellProps } from '../../GetWellUtils';

const ASMExternalRedundency = ({ type, data, lastColDetails, handleBulkAction, isWad = false }: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);

    const tableData = useMemo(() => {
        let id = 0;
        return data?.violationDetails?.map((row: any) => ({
            ...row,
            id: String(id++),
            name: row?.objectName,
            value: row?.value,
            recommendedValue: row?.recommendedValue || row?.recommendation,
            cellProps: getWadCellProps(isWad, t)
        }));
    }, [data, isWad, t]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: t('databases.oracle-inner-page.disk-group'),
            accessor: 'name',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.oracle-inner-page.redundancy'),
            accessor: 'value',
            id: '2',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.oracle-inner-page.recommended-value'),
            accessor: 'recommendedValue',
            id: '3',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        lastColDetails(type, {})
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

        if (
            rowsData.length > 0 &&
            inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY]?.length
        ) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.oracle-inner-page.impacted-disk-groups')}
                singularTitle={t('databases.oracle-inner-page.impacted-disk-group')}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer
                    action={
                        type === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY
                            ? t('databases.well-architect.view')
                            : t('databases.well-architect.fix')
                    }
                    onClick={handleBulkAction}
                />
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

export default ASMExternalRedundency;
