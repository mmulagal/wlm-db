import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import styles from './RenderTables.module.scss';

import { useAppSelector } from '../../../../store/storeHooks';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import FirstColumnComponent from './FirstColumnComponent';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_VALUES } from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const ScheduledLocalSnapshotTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
    const disptach = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { credentialData } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);
    const tableData = useMemo(() => {
        const snapshotAssessmentData: any = [];
        const uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
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
                    const snapshotObj = instanceData?.assessments?.snapshotPolicy;
                    const snapshotStateObj = instanceData?.assessments?.dismissedConfigurations?.snapshotPolicy;
                    const isStorageTierOptimized = isOptimized(snapshotObj?.status, snapshotStateObj?.configState);
                    if (!isStorageTierOptimized) {
                        snapshotAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            performanceTier: snapshotObj?.current,
                            totalObjectsAssessed: snapshotObj?.totalObjectsAssessed,
                            totalObjectsInViolation: snapshotObj?.totalObjectsInViolation,
                            id: `${hostData?.databaseHostId}_${instanceData?.databaseInstanceId}`,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[snapshotObj?.status],
                            data: instanceData,
                            objectsInViolation: snapshotObj?.objectsInViolation,
                            configObj: snapshotStateObj,
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
            snapshotAssessmentData,
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
        if (inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(
                tableData,
                ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
                selectedRowsForOptimize
            );
        }
        return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT);
    }, [selectedRowsForOptimize, tableData, inProgressOptimizationData]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance name ',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '376px',
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
            Header: 'Impacted volumes',
            accessor: 'totalObjectsInViolation',
            id: '3',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) =>
                `${rowData?.totalObjectsInViolation || 0} out of ${rowData?.totalObjectsAssessed || 0}`
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
        lastColDetails(
            ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
            {},
            inProgressOptimizationData,
            inProgressHostData
        )
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'none',
        defaultSelectedRows: [],
        isManagedColumns: true,
        initialColumnState: initialDashboardInnerPageOptimizeColState
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        disptach(setSelectedRowsForOptimize(rowsData));

        if (
            rowsData.length > 0 &&
            inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]?.length
        ) {
            checkBoxHandle(tableProps.selectionState, rowsData, disptach);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);

    const handleBulkOperation = () => {
        handleBulkAction(ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT, selectedRowsForOptimize);
    };
    return (
        <div className={styles.renderTable}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Not-optimized instances"
                singularTitle="Not-optimized instance"
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
                key={Date.now()}
            />
        </div>
    );
};

export default ScheduledLocalSnapshotTable;
