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
import FirstColumnComponent from './FirstColumnComponent';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_VALUES } from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';

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
    const tableData = useMemo(() => {
        let snapshotAssessmentData: any = [];
        let uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
            if (
                !headerSelectedMultiCredIdsList.includes(hostData?.credentialId) ||
                !headerSelectedMultiRegionIdsList.includes(hostData?.regionId) ||
                uniqueResourceList.includes(hostData?.databaseHostId)
            ) {
                return;
            }
            uniqueResourceList.push(hostData?.databaseHostId);

            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    const snapshotObj = instanceData?.assessments?.snapshotPolicy;
                    const isStorageTierOptimized = isOptimized(snapshotObj?.status);
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
                            id: hostData?.databaseHostId + '_' + instanceData?.databaseInstanceId,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[snapshotObj?.status],
                            data: instanceData,
                            objectsInViolation: snapshotObj?.objectsInViolation
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
        } else {
            return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT);
        }
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
            renderCell: (cellData: any, rowData: any) => {
                return <FirstColumnComponent rowData={rowData} />;
            }
        },
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '2',
            width: 'auto',
            filterOptions: 'auto'
        },
        {
            Header: 'Impacted volumes',
            accessor: 'totalObjectsInViolation',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return (rowData?.totalObjectsInViolation || 0) + ' out of ' + (rowData?.totalObjectsAssessed || 0);
            }
        },
        lastColDetails(
            ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
            {},
            inProgressOptimizationData,
            inProgressHostData
        )
    ];

    const tableProps = useTable({
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'none',
        defaultSelectedRows: []
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
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Not-optimized instances`}
                singularTitle={'Not-optimized instance'}
            />
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                key={Date.now()}
            />
        </div>
    );
};

export default ScheduledLocalSnapshotTable;
