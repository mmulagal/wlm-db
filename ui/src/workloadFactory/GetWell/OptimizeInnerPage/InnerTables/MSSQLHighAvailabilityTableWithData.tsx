import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';

const MSSQLHighAvailabilityTableWithData = ({ type, data, lastColDetails, handleBulkAction }: any) => {
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);

    const [tableConfig, setTableConfig] = useState({
        colName: 'LUN name',
        tableHeader: 'LUN'
    });
    const tableData = useMemo(() => {
        let id = 0;
        if (data?.name === ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE) {
            setTableConfig({
                colName: 'LUN Name',
                tableHeader: 'LUN'
            });
        } else if (data?.name === ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM) {
            setTableConfig({
                colName: 'Quorum Type',
                tableHeader: 'Cluster'
            });
        } else if (data?.name === ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS) {
            setTableConfig({
                colName: 'Settings',
                tableHeader: 'heartbeat setting'
            });
        } else if (data?.name === ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE) {
            setTableConfig({
                colName: 'SQL instance',
                tableHeader: 'SQL instance'
            });
        }
        return (
            data?.objectsInViolation?.map((violationItem: string) => ({
                id: String(id++),
                resourceName: violationItem,
                objectName: violationItem,
                name: violationItem,
                status: 'In Violation',
                configurationType: data?.name || type,
                severity: data?.severity || 'critical'
            })) || []
        );
    }, [data, type]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: tableConfig.colName,
            accessor: 'resourceName',
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

        if (
            rowsData.length > 0 &&
            inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]?.length
        ) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted ${tableConfig.tableHeader}s`}
                singularTitle={`Impacted ${tableConfig.tableHeader}`}
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

export default MSSQLHighAvailabilityTableWithData;
