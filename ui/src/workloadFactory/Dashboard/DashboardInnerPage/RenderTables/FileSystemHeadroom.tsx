import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useMemo } from 'react';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import BulkActionContainer from './BulkActionContainer';
import FirstColumnComponent from './FirstColumnCoponent';
import { GETWELL_VALUES } from '../../../../utils/consts';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}
const FileSystemHeadroomTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
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
                    const headroomObj = instanceData?.assessments?.storage?.sizing?.find(
                        (item: any) => item.name === 'headroom'
                    );
                    const isStorageTierOptimized = isOptimized(headroomObj?.status);
                    if (!isStorageTierOptimized) {
                        storageTierAssessmentData.push({
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            fileSystemHeadroom: headroomObj?.current,
                            id: instanceData?.databaseInstanceId,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[headroomObj?.status],
                            sizingViolations: headroomObj?.sizingViolations,
                            recommendedSizeInGib: headroomObj?.recommendedSizeInGib,
                            missingPermissions: headroomObj?.missingPermissions,
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
        if (selectedRowsForOptimize.length === 0 && !optimizingInstanceData) {
            // If no rows are selected, reset `isDisabled` for all rows
            return tableData.map((row: any) => ({
                ...row,
                cellProps: { ...row.cellProps, isDisabled: false }
            }));
        }

        // Extract `databaseHostId` values for all selected rows
        const selectedDatabaseHostIds = selectedRowsForOptimize.map((row: any) => row.databaseHostId);
        if (optimizingInstanceData) {
            // Extract IDs of rows currently selected for optimization
            const selectedInstanceIds = selectedRowsForOptimize.map((row: any) => row.id);

            return tableData.map((row: any) => {
                // Check if the current row is being optimized
                const isBeingOptimized = selectedInstanceIds.includes(row.id);

                // Check if the current row shares a `databaseHostId` with any selected row
                const hasSameDatabaseHostId = selectedDatabaseHostIds.includes(row.databaseHostId);

                // Combine both conditions
                const isDisabled = optimizingInstanceData && (isBeingOptimized || hasSameDatabaseHostId);

                return {
                    ...row,
                    cellProps: {
                        ...row.cellProps,
                        isDisabled
                    }
                };
            });
        }

        if (selectedRowsForOptimize.length > 0) {
            const selectedDatabaseHostId = selectedRowsForOptimize[0].databaseHostId;
            // If no rows are selected, reset `isDisabled` for all rows
            return tableData.map((row: any) => {
                const isSameDatabaseHostId = row.databaseHostId === selectedDatabaseHostId;
                const isAlreadySelected = selectedRowsForOptimize.some((selectedRow: any) => selectedRow.id === row.id);

                return {
                    ...row,
                    cellProps: {
                        ...row.cellProps,
                        isDisabled: !isSameDatabaseHostId && !isAlreadySelected // Disable rows with a different databaseHostId
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
            Header: 'File system headroom',
            accessor: 'fileSystemHeadroom',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails('File system headroom', {}, inProgressOptimizationData, inProgressHostData)
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
        handleBulkAction('File system headroom', selectedRowsForOptimize);
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

export default FileSystemHeadroomTable;
