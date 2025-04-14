import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { WLF_TABS } from '../../../../utils/consts';
import { expandTableRow } from '../../../../utils/utilityFunctions';
import { useCallback } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import RecommendationTable from '../../../GetWell/RecommendationTable/RecommendationTable';
import { useMemo } from 'react';
import {
    disableOfflineRows,
    formatAssessmentTableData,
    mapHostStatusToAssessmentData
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import { useDispatch } from 'react-redux';
import { setGwPageLoadInstanceData } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import FirstColumnComponent from './FirstColumnComponent';

const OntapConfig = () => {
    const dispatch = useDispatch();

    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);

    const tableData = useMemo(() => {
        let ontapConfigAssessmentData: any = [];
        let uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData?.map((hostData: any) => {
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
                    const lunsData = instanceData?.assessments?.storage?.configuration?.luns;
                    const volData = instanceData?.assessments?.storage?.configuration?.volumes;
                    const mergedData = [
                        ...(lunsData?.map((item: any) => {
                            return { ...item, type: 'lun', id: item?.name };
                        }) || []),
                        ...(volData?.map((item: any) => {
                            return { ...item, type: 'volume', id: item?.name };
                        }) || [])
                    ];
                    const notOptimized = mergedData.filter(
                        (item: any) => item.status !== 'optimized' && !item?.errorMessage
                    );
                    const errorCase =
                        instanceData?.assessments?.storage?.configuration?.luns?.[0]?.errorMessage &&
                        instanceData?.assessments?.storage?.configuration?.volumes?.[0]?.errorMessage;

                    if (notOptimized.length > 0 || errorCase) {
                        ontapConfigAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            configuration: !errorCase
                                ? `${notOptimized.length} out of ${mergedData.length}`
                                : `0 out of 0`,
                            hostName: hostData?.databaseHostName,
                            fullData: formatAssessmentTableData(notOptimized)
                        });
                    }
                }
            });
        });
        let tableRows = mapHostStatusToAssessmentData(
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

    const lastColDetails = () => {
        return {
            id: '4',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '318px',
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
        };
    };

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
            width: '320px',
            filterOptions: 'auto'
        },
        {
            Header: 'Not-optimized configuration',
            accessor: 'configuration',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
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
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50
    });
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
                {...tableComponentProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default OntapConfig;
