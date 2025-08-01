import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import styles from './RenderTables.module.scss';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { WLF_TABS } from '../../../../utils/consts';
import { expandTableRow } from '../../../../utils/utilityFunctions';
import { useAppSelector } from '../../../../store/storeHooks';
import RecommendationTable from '../../../GetWell/RecommendationTable/RecommendationTable';
import {
    disableOfflineRows,
    formatAssessmentTableData,
    mapHostStatusToAssessmentData
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import { setGwPageLoadInstanceData } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import FirstColumnComponent from './FirstColumnComponent';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';

const OntapConfig = () => {
    const dispatch = useDispatch();

    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { credentialData } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);

    const tableData = useMemo(() => {
        const ontapConfigAssessmentData: any = [];
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
                    const lunsData = instanceData?.assessments?.storage?.configuration?.luns;
                    const volData = instanceData?.assessments?.storage?.configuration?.volumes;
                    const mergedData = [
                        ...(lunsData?.map((item: any) => ({ ...item, type: 'lun', id: item?.name })) || []),
                        ...(volData?.map((item: any) => ({ ...item, type: 'volume', id: item?.name })) || [])
                    ];
                    const notOptimized = mergedData.filter(
                        (item: any) => item.status !== 'optimized' && !item?.errorMessage
                    );
                    const errorCase =
                        (instanceData?.assessments?.storage?.configuration?.luns?.[0]?.errorMessage &&
                            instanceData?.assessments?.storage?.configuration?.volumes?.[0]?.errorMessage) ||
                        instanceData?.assessments?.storage?.errorMessage;

                    if (notOptimized?.length > 0 || errorCase) {
                        ontapConfigAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            configuration: !errorCase
                                ? `${notOptimized.length} out of ${mergedData.length}`
                                : '0 out of 0',
                            hostName: hostData?.databaseHostName,
                            fullData: formatAssessmentTableData(notOptimized),
                            credentialName: matchingCredEntry?.name,
                            regionName: matchingRegionEntry?.regionName,
                            accountId: matchingCredEntry?.providerAccountId
                        });
                    }
                }
            });
        });
        const tableRows = mapHostStatusToAssessmentData(
            inventoryTableData,
            ontapConfigAssessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
        return disableOfflineRows(tableRows);
    }, [
        allmssqlHostAssessmentData,
        inventoryTableData,
        getDatabaseHosts,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    ]);

    const lastColDetails = () => ({
        id: '7',
        Header: '',
        accessor: '',
        isSticky: true,
        width: '250px',
        renderCell: (cellData: any, rowData: any, { updateRowState, rowsState }: any) => {
            const currentRowState = rowsState[rowData.id];
            return (
                <>
                    {!rowData?.cellProps?.isDisabled && (
                        <div className={styles.arrow}>
                            <ArrowIcon
                                className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                }}
                            />
                        </div>
                    )}
                    {rowData?.cellProps?.isDisabled && (
                        <div className={styles.arrow}>
                            <TooltipComponent
                                title={rowData?.cellProps?.selectionProps?.title}
                                placement="bottom"
                                width="278px"
                                height="30px"
                            >
                                <ArrowIcon className={styles['arrow-disable']} />
                            </TooltipComponent>
                        </div>
                    )}
                </>
            );
        }
    });

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
            Header: 'Not-optimized configuration',
            accessor: 'configuration',
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
        lastColDetails()
    ];
    const ExpandedRow = useCallback(({ rowData }: any) => {
        dispatch(
            setGwPageLoadInstanceData({
                hostname: rowData?.hostName,
                resourceId: rowData?.databaseHostId,
                instanceId: rowData?.instanceId,
                instanceName: rowData?.serverInstanceName,
                credId: rowData?.credentialId,
                regionId: rowData?.regionId,
                storageType: rowData?.sqlServerDeploymentType
            })
        );
        return (
            <RecommendationTable
                tableData={rowData?.fullData}
                isLoading={false}
                optimizePrintState={false}
                from={WLF_TABS.DASHBOARD}
                hostId={rowData?.databaseHostId}
                instanceId={rowData?.instanceId}
            />
        );
    }, []);

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: 'Loading'
    };

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        isManagedColumns: true,
        initialColumnState: initialDashboardInnerPageOptimizeColState
    });
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
                {...tableComponentProps}
                isDoubleRow
            />
        </div>
    );
};

export default OntapConfig;
