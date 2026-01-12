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

// This component is used in GetWell -> Optimize page -> Inner drawer -> OS Configuration section for Oracle workloads
const OSOracleTable = ({ type, data, lastColDetails, handleBulkAction }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);

    const [colName, setColName] = useState(t('databases.well-architect.configuration-name'));
    const [tableHeader, setTableHeader] = useState(t('databases.well-architect.configuration'));

    useEffect(() => {
        // Only handle NFS_MOUNT_OPTIONS_DATABASEFILES
        if (type === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES) {
            setColName(t('databases.well-architect.nfs-mount'));
            setTableHeader(t('databases.well-architect.nfs-mount'));
        }
    }, [type, t]);

    const tableData = useMemo(() => {
        let id = 0;
        return data?.violationDetails?.map((row: any) => ({
            ...row,
            id: String(id++),
            name: row?.objectName
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
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        // Only NFS Mount Options column
        {
            Header: t('databases.well-architect.current-mount-options'),
            accessor: 'value',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: false,
            width: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.oracle-inner-page.recommended-value'),
            accessor: 'recommended',
            id: '3',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        lastColDetails(type, {})
    ];

    const tableProps = useTable({
        // @ts-expect-error
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
            inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES]?.length
        ) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);

    // Determine the bulk action text based on configuration type
    const getBulkActionText = () =>
        type === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
        type === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY
            ? 'View'
            : GENERAL.OPTIMIZE;

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted ${tableHeader}s`}
                singularTitle={`Impacted ${tableHeader}`}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer action={getBulkActionText()} onClick={handleBulkAction} />
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

export default OSOracleTable;
