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
import FirstColumnComponent from './FirstColumnCoponent';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_VALUES } from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const LogDriveSizeTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);
    const tableData = useMemo(() => {
        let storageTierAssessmentData: any = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    const logDriveSizeObj = instanceData?.assessments?.storage?.sizing?.find(
                        (item: any) => item.name === 'log-drive-size'
                    );
                    const isStorageTierOptimized = isOptimized(logDriveSizeObj?.status);
                    if (!isStorageTierOptimized) {
                        storageTierAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            percentDataDriveSize: logDriveSizeObj?.current,
                            id: hostData?.databaseHostId + '_' + instanceData?.databaseInstanceId,
                            totalObjectsAssessed: logDriveSizeObj?.totalObjectsAssessed,
                            totalObjectsInViolation: logDriveSizeObj?.totalObjectsInViolation,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[logDriveSizeObj?.status],
                            sizingViolations: logDriveSizeObj?.sizingViolations,
                            missingPermissions: logDriveSizeObj?.missingPermissions,
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

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(
                tableData,
                ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
                selectedRowsForOptimize
            );
        } else {
            return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE);
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
            filterOptions: 'auto'
        },
        {
            Header: 'Impacted drives',
            accessor: 'totalObjectsInViolation',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return (rowData?.totalObjectsInViolation || 0) + ' out of ' + (rowData?.totalObjectsAssessed || 0);
            }
        },
        lastColDetails(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE, {}, inProgressOptimizationData, inProgressHostData)
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
        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);

    const handleBulkOperation = () => {
        handleBulkAction(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE, selectedRowsForOptimize);
    };
    return (
        <div className={styles.renderTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Not-optimized instances`}
                singularTitle={'Not-optimized instance'}
            />
            {selectedRowsForOptimize.length > 0 && (
                <BulkActionContainer action={GENERAL.OPTIMIZE} onClick={handleBulkOperation} />
            )}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default LogDriveSizeTable;
