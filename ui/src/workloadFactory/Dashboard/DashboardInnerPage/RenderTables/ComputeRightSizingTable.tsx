import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { useAppSelector } from '../../../../store/storeHooks';
import { useMemo, useEffect } from 'react';
import { checkBoxHandle, getFilterOptions, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setEnableFilter, setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import BulkActionContainer from './BulkActionContainer';
import FirstColumnComponent from './FirstColumnCoponent';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_VALUES, INVENTORY_STATUS } from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const ComputeRightSizingTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { selectedRowsForOptimize, enableFilter } = useAppSelector(state => state.databaseHome);
    const tableData = useMemo(() => {
        let storageTierAssessmentData: any = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    const computeRightSizingObj = instanceData?.assessments?.compute;
                    const isStorageTierOptimized = isOptimized(computeRightSizingObj?.status);
                    if (!isStorageTierOptimized) {
                        let computeMissingPermissions = false;
                        if (
                            computeRightSizingObj?.errorMessage &&
                            computeRightSizingObj?.errorMessage.includes('is not authorized to perform: ')
                        ) {
                            computeMissingPermissions = true;
                        }
                        storageTierAssessmentData.push({
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            findingReasons: `${computeRightSizingObj?.objectsInViolation?.length || 0} Findings`,
                            id: hostData?.databaseHostId + '_' + instanceData?.databaseInstanceId,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[computeRightSizingObj?.status],
                            recommendationOptions: computeRightSizingObj?.recommendationOptions,
                            isMissingPermissions: computeMissingPermissions,
                            data: instanceData
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

    const updatedTableData = useMemo(() => {
        if (
            selectedRowsForOptimize.length > 0 &&
            !inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]?.length
        ) {
            const selectedDatabaseHostId = selectedRowsForOptimize[0].databaseHostId;
            // If no rows are selected, reset `isDisabled` for all rows
            return tableData.map((row: any) => {
                const isSameDatabaseHostId = row.databaseHostId === selectedDatabaseHostId;
                const isAlreadySelected = selectedRowsForOptimize.some((selectedRow: any) => selectedRow.id === row.id);
                return {
                    ...row,
                    cellProps: {
                        ...row.cellProps,
                        isDisabled: !isSameDatabaseHostId && !isAlreadySelected, // Disable rows with a different databaseHostId
                        selectionProps: {
                            title:
                                !isSameDatabaseHostId && !isAlreadySelected
                                    ? 'You can select multiple instances associated with the same host.'
                                    : '',
                            titleProps: {
                                placement: 'bottom'
                            }
                        }
                    }
                };
            });
        }
        if (inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(
                tableData,
                ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
                selectedRowsForOptimize
            );
        } else {
            return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING);
        }
    }, [selectedRowsForOptimize, inProgressOptimizationData, tableData]);

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
            filterOptions: getFilterOptions(updatedTableData, 'hostName')
        },
        {
            Header: 'Finding reasons',
            accessor: 'findingReasons',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails(ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING, {}, inProgressOptimizationData, inProgressHostData)
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: {
            isDisabled: enableFilter,
            title:
                enableFilter &&
                'Multi-select is available for instances associated with the same host. To activate the multi-select checkbox, first filter the host column.'
        },
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
        if (tableProps.filterState?.columns[2]?.activeCount === 1) {
            dispatch(setEnableFilter(false));
        } else {
            dispatch(setEnableFilter(true));
        }
    }, [tableProps.filterState]);
    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);
        dispatch(setSelectedRowsForOptimize(rowsData));

        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);

    const handleBulkOperation = () => {
        handleBulkAction(ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING, selectedRowsForOptimize);
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

export default ComputeRightSizingTable;
