import { Table, useTable, TableTopBar, DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { useMemo } from 'react';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';

const LogFileTable = ({ lastColDetails }: any) => {
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
    const tableData = useMemo(() => {
        let storageTierAssessmentData: any = [];
        allmssqlHostAssessmentData.map((hostData: any) => {
            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    const logDataFilesObj = instanceData?.assessments?.storage?.layout?.find(
                        (item: any) => item.name === 'default-log-files-location'
                    );
                    const isStorageTierOptimized = isOptimized(logDataFilesObj?.status);
                    if (!isStorageTierOptimized) {
                        storageTierAssessmentData.push({
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            userDataFiles: logDataFilesObj?.current,
                            id: instanceData?.databaseInstanceId,
                            hostName: hostData?.databaseHostName,
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
            Header: 'Log files',
            accessor: 'userDataFiles',
            id: '3',
            width: '320px',
            filterOptions: 'auto'
        },
        lastColDetails('Log files (.ldf)')
    ];

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
                isDoubleRow={true}
            />
        </div>
    );
};

export default LogFileTable;
