import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import { useMemo, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

import { useAppSelector } from '../../../../store/storeHooks';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import FirstColumnComponent from './FirstColumnComponent';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_VALUES, INVENTORY_STATUS } from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const TempDBDriveSizeTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);
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
                    const tempdbDriveSizeObj = instanceData?.assessments?.storage?.sizing?.find(
                        (item: any) => item.name === 'tempdb-drive-size'
                    );
                    const tempdbDriveSizeStateObj =
                        instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                            (item: any) => item?.configurationName === 'tempdb-drive-size'
                        );
                    const isStorageTierOptimized = isOptimized(
                        tempdbDriveSizeObj?.status,
                        tempdbDriveSizeStateObj?.configState
                    );
                    if (!isStorageTierOptimized) {
                        storageTierAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            percentDataDriveSize: tempdbDriveSizeObj?.current,
                            id: `${hostData?.databaseHostId}_${instanceData?.databaseInstanceId}`,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[tempdbDriveSizeObj?.status],
                            sizingViolations: tempdbDriveSizeObj?.sizingViolations,
                            missingPermissions: tempdbDriveSizeObj?.missingPermissions,
                            data: instanceData,
                            configObj: tempdbDriveSizeStateObj,
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

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(
                tableData,
                ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
                selectedRowsForOptimize
            );
        }
        return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE);
    }, [selectedRowsForOptimize, tableData]);

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
            filterOptions: 'auto'
        },
        {
            Header: 'Percentage of data drive size',
            accessor: 'percentDataDriveSize',
            id: '3',
            width: '250px',
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
        lastColDetails(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE, {}, inProgressOptimizationData, inProgressHostData)
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
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
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        dispatch(setSelectedRowsForOptimize(rowsData));
        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);
    const handleBulkOperation = () => {
        handleBulkAction(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE, selectedRowsForOptimize);
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

export default TempDBDriveSizeTable;
