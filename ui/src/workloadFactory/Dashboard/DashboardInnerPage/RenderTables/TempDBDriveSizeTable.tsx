import { Table, useTable, TableTopBar, DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { useMemo, useEffect } from 'react';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import BulkActionContainer from './BulkActionContainer';

interface StorageTierTableProps {
    lastColDetails: any;
    handleBulkAction: any;
}

const TempDBDriveSizeTable = ({ lastColDetails, handleBulkAction }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const { optimizingInstanceData } = useAppSelector(state => state.getWellOptimize);
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);
    const tableData = useMemo(() => {
        let storageTierAssessmentData: any = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    const tempdbDriveSizeObj = instanceData?.assessments?.storage?.sizing?.find(
                        (item: any) => item.name === 'tempdb-drive-size'
                    );
                    const isStorageTierOptimized = isOptimized(tempdbDriveSizeObj?.status);
                    if (!isStorageTierOptimized) {
                        storageTierAssessmentData.push({
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            percentDataDriveSize: tempdbDriveSizeObj?.current,
                            id: instanceData?.databaseInstanceId,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: tempdbDriveSizeObj?.status,
                            missingPermissions: tempdbDriveSizeObj?.missingPermissions,
                            data: instanceData,
                            cellProps: {
                                isDisabled:
                                    optimizingInstanceData &&
                                    selectedRowsForOptimize[0]?.id === instanceData?.databaseInstanceId,
                                selectionProps: undefined
                            }
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
                return (
                    <div>
                        <DsTypography variant="Semibold_14">
                            {rowData?.serverInstanceName || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                        {rowData?.loadingStatus && <DsFlashingDotsLoader />}
                        {!rowData?.loadingStatus && (
                            <div className={styles.statusContainer}>
                                {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                    <div
                                        className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}
                                    ></div>
                                )}
                                {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                                    <div
                                        className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}
                                    ></div>
                                )}
                                {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                    <div
                                        className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}
                                    ></div>
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
                        )}
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
            Header: 'Percentage of data drive size',
            accessor: 'percentDataDriveSize',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails('TempDB drive size')
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50
    });

    useEffect(() => {
        const rows = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForOptimize(rows));
        if (rows.length === 1 && optimizingInstanceData) {
            //To do here ids will come
            // //@ts-ignore
            // tableProps.selectionState.rows['41'] = false;
            // //@ts-ignore
            // tableProps.selectionState.count = 0;
            // //@ts-ignore
            // tableProps.selectionState.allSelected = false;
        }
    }, [tableProps.selectionState, optimizingInstanceData]);
    const handleBulkOperation = () => {
        handleBulkAction('TempDB drive size', selectedRowsForOptimize);
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

export default TempDBDriveSizeTable;
