import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import { useMemo, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { useAppSelector } from '../../../../store/storeHooks';
import { checkBoxHandle, getFilterOptions, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setEnableFilter, setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import FirstColumnComponent from './FirstColumnComponent';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_VALUES, INVENTORY_STATUS } from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const ComputeRightSizingTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { selectedRowsForOptimize, enableFilter } = useAppSelector(state => state.databaseHome);
    const { credentialData } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);
    const tableData = useMemo(() => {
        const storageTierAssessmentData: any = [];
        const uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData?.map((hostData: any) => {
            if (
                !headerSelectedMultiCredIdsList.includes(hostData?.credentialId) ||
                !headerSelectedMultiRegionIdsList.includes(hostData?.regionId) ||
                uniqueResourceList.includes(hostData?.databaseHostId)
            ) {
                return;
            }
            uniqueResourceList.push(hostData?.databaseHostId);
            const matchingCredEntry =
                credentialData && credentialData?.find(entry => entry.credentialsId === hostData?.credentialId);

            const matchingRegionEntry =
                regionsData && regionsData?.regions?.find(entry => entry.regionCode === hostData?.regionId);

            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error && instanceData?.assessments?.lastAssessmentTimestamp) {
                    const computeRightSizingObj = instanceData?.assessments?.compute;
                    const computeRightSizingStateObj = instanceData?.assessments?.dismissedConfigurations?.compute;
                    const isStorageTierOptimized = isOptimized(
                        computeRightSizingObj?.status,
                        computeRightSizingStateObj?.configState
                    );
                    if (!isStorageTierOptimized) {
                        let computeMissingPermissions = false;
                        if (
                            computeRightSizingObj?.errorMessage &&
                            computeRightSizingObj?.errorMessage.includes('is not authorized to perform: ')
                        ) {
                            computeMissingPermissions = true;
                        }
                        storageTierAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            findingReasons: `${computeRightSizingObj?.objectsInViolation?.length || 0} Findings`,
                            id: `${hostData?.databaseHostId}_${instanceData?.databaseInstanceId}`,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[computeRightSizingObj?.status],
                            recommendationOptions: computeRightSizingObj?.recommendationOptions,
                            isMissingPermissions: computeMissingPermissions,
                            data: instanceData,
                            configObj: computeRightSizingStateObj,
                            credentialName: matchingCredEntry?.name,
                            regionName: matchingRegionEntry?.regionName,
                            accountId: matchingCredEntry?.providerAccountId
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
    }, [
        allmssqlHostAssessmentData,
        inventoryTableData,
        getDatabaseHosts,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    ]);

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
        }
        return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING);
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
            renderCell: (cellData: any, rowData: any) => <FirstColumnComponent rowData={rowData} />
        },
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '2',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'hostName')
        },
        {
            Header: 'Finding reasons',
            accessor: 'findingReasons',
            id: '3',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            id: '4',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            filterOptions: 'auto',
            width: '180px'
        },
        {
            id: '5',
            Header: 'AWS account',
            accessor: 'accountId',
            filterOptions: 'auto',
            width: '180px'
        },
        {
            id: '6',
            Header: 'Region',
            accessor: 'regionName',
            filterOptions: 'auto',
            width: '180px'
        },
        lastColDetails(ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING, {}, inProgressOptimizationData, inProgressHostData)
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: {
            isDisabled: enableFilter,
            title:
                enableFilter &&
                'Multi-select is available for instances associated with the same host. To activate the multi-select checkbox, first filter the host column.'
        },
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: [],
        isManagedColumns: true,
        initialColumnState: initialDashboardInnerPageOptimizeColState
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
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Not-optimized instances"
                singularTitle="Not-optimized instance"
            />
            {selectedRowsForOptimize.length > 0 && (
                <BulkActionContainer action={GENERAL.OPTIMIZE} onClick={handleBulkOperation} />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default ComputeRightSizingTable;
