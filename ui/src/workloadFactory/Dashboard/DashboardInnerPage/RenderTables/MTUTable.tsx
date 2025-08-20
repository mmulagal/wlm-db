import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'i18next';
import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
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
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table, type TableProps } from '../../../../common/Lib/Table/Table';

interface MTUTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const MTUTable = ({ lastColDetails, handleBulkAction }: MTUTableProps) => {
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
        const mtuAssessmentData: any = [];
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
                    const mtuObj = instanceData?.assessments?.mtuAlignment;
                    const mtuStateObj = instanceData?.assessments?.dismissedConfigurations?.mtuAlignment;
                    const isMTUOptimized = isOptimized(mtuObj?.status, mtuStateObj?.configState);

                    if (!isMTUOptimized) {
                        mtuAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            totalObjectsAssessed: mtuObj?.totalObjectsAssessed || 0,
                            totalObjectsInViolation: mtuObj?.totalObjectsInViolation || 0,
                            id: `${hostData?.databaseHostId}_${instanceData?.databaseInstanceId}`,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[mtuObj?.status],
                            data: instanceData,
                            objectsInViolation: mtuObj?.objectsInViolation || [instanceData?.databaseInstanceId],
                            violationDetails: mtuObj?.violationDetails || [],
                            configObj: mtuStateObj,
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
            mtuAssessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
    }, [
        allmssqlHostAssessmentData,
        inventoryTableData,
        getDatabaseHosts,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList,
        credentialData,
        regionsData
    ]);

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.MTU]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(
                tableData,
                ASSESSMENT_CONFIG_NAMES.MTU,
                selectedRowsForOptimize
            );
        }
        return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.MTU);
    }, [selectedRowsForOptimize, tableData, inProgressOptimizationData]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.dashboard-table-headers.sql-server-instance-name'),
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '310px',
            renderCell: (cellData: any, rowData: any) => <FirstColumnComponent rowData={rowData} />
        },
        {
            Header: t('databases.well-architect.dashboard-table-headers.host-name'),
            accessor: 'hostName',
            id: '2',
            width: '200px',
            filterOptions: 'auto'
        },
        {
            Header: 'Network Interface',
            accessor: 'totalObjectsInViolation',
            id: '3',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) =>
                `${rowData?.totalObjectsInViolation || 0} out of ${rowData?.totalObjectsAssessed || 0}`
        },
        {
            id: '4',
            Header: t('databases.well-architect.dashboard-table-headers.aws-credentials'),
            accessor: 'credentialName',
            filterOptions: 'auto',
            width: '180px'
        },
        {
            id: '5',
            Header: t('databases.well-architect.dashboard-table-headers.aws-account'),
            accessor: 'accountId',
            filterOptions: 'auto',
            width: '180px'
        },
        {
            id: '6',
            Header: t('databases.well-architect.dashboard-table-headers.region'),
            accessor: 'regionName',
            filterOptions: 'auto',
            width: '180px'
        },
        lastColDetails(ASSESSMENT_CONFIG_NAMES.MTU, {}, inProgressOptimizationData, inProgressHostData)
    ];

    const tableProps = useTable({
        manageColumnsProps: {},
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

        disptach(setSelectedRowsForOptimize(rowsData));

        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.MTU]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, disptach);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);

    const handleBulkOperation = () => {
        handleBulkAction(ASSESSMENT_CONFIG_NAMES.MTU, selectedRowsForOptimize);
    };

    return (
        <div className={styles.renderTable}>
            <TableTopBar
                tableProps={tableProps as unknown as TableProps}
                pluralTitle="Not-optimized instances"
                singularTitle="Not-optimized instance"
            />
            {selectedRowsForOptimize.length > 0 && (
                <BulkActionContainer action={GENERAL.OPTIMIZE} onClick={handleBulkOperation} />
            )}
            <Table tableProps={tableProps as unknown as TableProps} isDoubleRow key={Date.now()} />
        </div>
    );
};

export default MTUTable;
