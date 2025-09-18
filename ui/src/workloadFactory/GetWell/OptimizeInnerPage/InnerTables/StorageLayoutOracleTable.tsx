import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';

// This component is used in GetWell -> Optimize page -> Inner drawer -> Storage Layout section for Oracle workloads
const StorageLayoutOracleTable = ({ type, data, lastColDetails, handleBulkAction }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);

    const [colName, setColName] = useState(t('databases.well-architect.volume-name'));
    const [tableHeader, setTableHeader] = useState(t('databases.well-architect.volume'));

    useEffect(() => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
                setColName(t('databases.well-architect.volume-name'));
                setTableHeader(t('databases.well-architect.volume'));
                break;
            case ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT:
                setColName(t('databases.well-architect.disk-group-name'));
                setTableHeader(t('databases.well-architect.disk-group'));
                break;
            default:
                setColName(t('databases.well-architect.volume-name'));
                setTableHeader(t('databases.well-architect.volume'));
        }
    }, [type]);

    const tableData = useMemo(() => {
        let id = 0;
        return data?.objectsInViolation?.map((row: any) => ({
            id: String(id++),
            name: row
        }));
    }, [data]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: colName,
            accessor: 'name',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
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

        if (rowsData.length > 0 && inProgressOptimizationData?.[type]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={`${t('databases.well-architect.impacted')} ${tableHeader}s`}
                singularTitle={`${t('databases.well-architect.impacted')} ${tableHeader}`}
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

export default StorageLayoutOracleTable;
