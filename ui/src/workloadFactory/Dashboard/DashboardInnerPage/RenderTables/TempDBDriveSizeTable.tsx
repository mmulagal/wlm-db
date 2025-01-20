import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

import { useAppSelector } from '../../../../store/storeHooks';
import { useMemo, useEffect } from 'react';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import BulkActionContainer from './BulkActionContainer';
import FirstColumnComponent from './FirstColumnCoponent';
import { INVENTORY_STATUS } from '../../../../utils/consts';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const TempDBDriveSizeTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { optimizingInstanceData, inProgressOptimizationData, inProgressHostData } = useAppSelector(
        state => state.getWellOptimize
    );
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);
    const tableData = useMemo(() => {
        let storageTierAssessmentData: any = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    const tempdbDriveSizeObj = instanceData?.assessments?.storage?.sizing?.find(
                        (item: any) => item.name === 'tempdb-drive-size'
                    );
                    const isStorageTierOptimized = isOptimized(tempdbDriveSizeObj?.status);
                    if (!isStorageTierOptimized) {
                        storageTierAssessmentData.push({
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            percentDataDriveSize: tempdbDriveSizeObj?.current,
                            id: instanceData?.databaseInstanceId,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: tempdbDriveSizeObj?.status,
                            missingPermissions: tempdbDriveSizeObj?.missingPermissions,
                            data: instanceData,
                            cellProps: {
                                isDisabled:
                                    optimizingInstanceData &&
                                    selectedRowsForOptimize[0]?.id === instanceData?.databaseInstanceId,
                                selectionProps: undefined
                            }
                        });
                    }
                }
            });
        });
        return mapHostStatusToAssessmentData(
            inventoryTableData,
            storageTierAssessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
    }, [allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts]);

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (!optimizingInstanceData) {
            // If no rows are selected, reset `isDisabled` for all rows
            return tableData.map((row: any) => ({
                ...row,
                cellProps: { ...row.cellProps, isDisabled: row?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP }
            }));
        }

        if (optimizingInstanceData) {
            // Extract IDs of rows currently selected for optimization
            const selectedInstanceIds = selectedRowsForOptimize.map((row: any) => row.id);

            return tableData.map((row: any) => {
                // Check if the current row is being optimized
                const isBeingOptimized = selectedInstanceIds.includes(row.id);

                const hasStatusOffline = row?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP;

                // Combine both conditions
                const isDisabled = optimizingInstanceData && (isBeingOptimized || hasStatusOffline);

                return {
                    ...row,
                    cellProps: {
                        ...row.cellProps,
                        isDisabled
                    }
                };
            });
        }
    }, [selectedRowsForOptimize, optimizingInstanceData, tableData]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance name ',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '310px',
            renderCell: (cellData: any, rowData: any) => {
                return <FirstColumnComponent rowData={rowData} />;
            }
        },
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '2',
            width: '320px',
            filterOptions: 'auto'
        },
        {
            Header: 'Percentage of data drive size',
            accessor: 'percentDataDriveSize',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails('TempDB drive size', {}, inProgressOptimizationData, inProgressHostData)
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        dispatch(setSelectedRowsForOptimize(rowsData));
        if (rowsData.length > 0 && optimizingInstanceData) {
            checkBoxHandle(tableProps.selectionState, rowsData);
        }
    }, [tableProps.selectionState, optimizingInstanceData]);
    const handleBulkOperation = () => {
        handleBulkAction('TempDB drive size', selectedRowsForOptimize);
    };
    return (
        <div className={styles.renderTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Not-optimized instances`}
                singularTitle={'Not-optimized instance'}
            />
            {selectedRowsForOptimize.length > 0 && <BulkActionContainer onClick={handleBulkOperation} />}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default TempDBDriveSizeTable;
