import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';

// Interface for violation detail items
interface ViolationDetail {
    objectName: string;
    value: string;
    recommended: string;
}

// Interface for the data prop
interface OSConfigData {
    violationDetails?: ViolationDetail[];
}

// Interface for component props
interface OSOracleTableProps {
    type: string;
    data: OSConfigData;
    lastColDetails: (type: string, options: Record<string, null>, width?: string) => ColumnProps;
    handleBulkAction: () => void;
}

// This component is used in GetWell -> Optimize page -> Inner drawer -> OS Configuration section for Oracle workloads
const OSOracleTable = ({ type, data, lastColDetails, handleBulkAction }: OSOracleTableProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);

    const [colName, setColName] = useState(t('databases.well-architect.configuration-name'));
    const [tableHeader, setTableHeader] = useState(t('databases.well-architect.configuration'));

    useEffect(() => {
        // Only handle NFS_MOUNT_OPTIONS_DATABASEFILES, DNFS_CONFIGURATION_FILE and DNFS_NO_SHARED_CACHE
        if (
            type === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
            type === ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE ||
            type === ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE
        ) {
            setColName(t('databases.well-architect.nfs-mount'));
            setTableHeader(t('databases.well-architect.nfs-mount'));
        }
    }, [type, t]);

    const tableData = useMemo(() => {
        let id = 0;
        return data?.violationDetails?.map((row: ViolationDetail) => {
            const currentId = id;
            id += 1;
            return {
                ...row,
                id: String(currentId),
                name: row?.objectName
            };
        });
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
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
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
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header:
                type === ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE ||
                type === ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE
                    ? t('databases.oracle-inner-page.recommended-mount-options')
                    : t('databases.oracle-inner-page.recommended-value'),
            accessor: 'recommended',
            id: '3',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
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
        selectionType:
            type === ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE ||
            type === ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE
                ? 'none'
                : 'multiple',
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData || []);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        if (
            rowsData.length > 0 &&
            inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES]?.length
        ) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData, dispatch, tableData]);

    // Determine the bulk action text based on configuration type
    const getBulkActionText = () =>
        type === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
        type === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY
            ? t('databases.oracle-inner-page.view')
            : t('databases.oracle-inner-page.fix');

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted ${tableHeader}s`}
                singularTitle={`Impacted ${tableHeader}`}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 &&
                type !== ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE &&
                type !== ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE && (
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
