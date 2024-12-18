import { Table, useTable, TableTopBar, DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { INVENTORY_STATUS, WLF_TABS } from '../../../../utils/consts';
import { expandTableRow } from '../../../../utils/utilityFunctions';
import { useCallback } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import RecommendationTable from '../../../GetWell/RecommendationTable/RecommendationTable';
import { useMemo } from 'react';
import { mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';

const OperatingSystemTable = () => {
    const { ontapConfigTableData } = useAppSelector(state => state.getWellOptimize);

    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const tableData = useMemo(() => {
        let storageTierAssessmentData: any = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    const data = instanceData?.assessments?.storage?.configuration?.os;
                    const notOptimized = data.filter((item: any) => item.status === 'not-optimized');

                    storageTierAssessmentData.push({
                        databaseHostId: hostData?.databaseHostId,
                        instanceId: instanceData?.databaseInstanceId,
                        configuration: `${notOptimized.length} out of ${data.length}`,
                        id: instanceData?.databaseInstanceId,
                        hostName: hostData?.hostName
                    });
                }
            });
        });
        return mapHostStatusToAssessmentData(
            inventoryTableData,
            storageTierAssessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
    }, [allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts]);

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
                        <div className={styles.arrow}>
                            <ArrowIcon
                                className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                }}
                            />
                        </div>
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
                return (
                    <div>
                        <DsTypography variant="Semibold_14">
                            {rowData?.serverInstanceName || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                        <div className={styles.statusContainer}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                            )}
                            <DsTypography variant="Regular_13">
                                {rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                    ? INVENTORY_STATUS.ONLINE
                                    : rowData?.status === INVENTORY_STATUS.STOPPED ||
                                      rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                    ? INVENTORY_STATUS.OFFLINE
                                    : rowData?.status}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && 'Unknown'}
                            </DsTypography>
                        </div>
                    </div>
                );
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
            Header: 'Not-optimizes configuration',
            accessor: 'configuration',
            id: '3',
            width: '320px',
            filterOptions: 'auto'
        },
        lastColDetails()
    ];
    const ExpandedRow = useCallback(({ rowData }: any) => {
        return (
            <RecommendationTable
                tableData={ontapConfigTableData}
                isLoading={false}
                optimizePrintState={false}
                from={WLF_TABS.DASHBOARD}
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

export default OperatingSystemTable;
