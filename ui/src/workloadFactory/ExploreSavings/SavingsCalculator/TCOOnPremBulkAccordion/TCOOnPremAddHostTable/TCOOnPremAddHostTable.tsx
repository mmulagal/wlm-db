import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { DsTypography } from '@netapp/design-system';
import { ColumnProps, Table } from '../../../../../common/Lib/Table/Table';
import { useTable } from '../../../../../common/Lib/Table/useTable';
import {
    setSelectedRowsForExploreSavingsOnPremBulk,
    setSelectedRowsForExploreSavingsOracleOnPremBulk,
    setTriggerBulkDataFetch
} from '../../../../../store/workloadFactory/exploreSavingsBulkSlice';
import {
    setOnPremStorageAndComputeInfoFull,
    setSelectedServerName,
    setSelectedEsPageInstance
} from '../../../../../store/workloadFactory/exploreSavingsSlice';
import {
    getSelectedFromSelectionState,
    formatFractionalNumber,
    formatSizeTwoPrecision
} from '../../../../../utils/utilityFunctions';
import { GIB_IN_BYTE, SAVINGS_CALC_MODE } from '../../../../../utils/consts';
import { GENERAL } from '../../../../../utils/appConstants';
import styles from '../../TCOBulkAccordion/TCOAddHostTable/TCOAddHostTable.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { TableTopBar } from '../../../../../common/Lib/Table/TableTopBar';
import { renderAllocatedCapacity } from '../../../../InventoryV2/InventoryUtilsV2';

interface TCOOnPremAddHostTableProps {
    onExploreSavings?: () => void;
    onHandlerReady?: (handler: () => void) => void;
}

const TCOOnPremAddHostTable = ({ onExploreSavings, onHandlerReady }: TCOOnPremAddHostTableProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [onPremTableData, setOnPremTableData] = useState<any>([]);
    const [updatedTableData, setUpdatedTableData] = useState<any>([]);
    const { selectedRowsForExploreSavingsOnPremBulk, selectedRowsForExploreSavingsOracleOnPremBulk } = useAppSelector(
        state => state.exploreSavingsBulk
    );
    const { onPremiseData, onPremiseOracleData, savingsCalculatorFrom, onPremStorageAndComputeInfo } = useAppSelector(
        state => state.exploreSavings
    );

    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;
    const activeSelectedRows = isOracleOnPrem
        ? selectedRowsForExploreSavingsOracleOnPremBulk
        : selectedRowsForExploreSavingsOnPremBulk;

    // Format on-premises data for table
    useEffect(() => {
        if (isOracleOnPrem) {
            if (onPremiseOracleData && Array.isArray(onPremiseOracleData)) {
                const formattedData = onPremiseOracleData.map((item: any) => ({
                    id: item.id || item.resourceId,
                    resourceName: item.resourceName,
                    resourceId: item.resourceId,
                    deploymentModel: item.deploymentModel,
                    oracleEdition: item.oracleEdition,
                    instanceCount: item.oracleDatabases?.length || 0,
                    nodeCount: item.onPremisesNodes?.length || 0,
                    nameForSorting: item.resourceName?.toLowerCase(),
                    oracleDatabases: item.oracleDatabases,
                    onPremisesNodes: item.onPremisesNodes,
                    databaseNameList: item.databaseNameList,
                    totalAllocatedCapacity: formatSizeTwoPrecision(item.totalAllocatedCapacityGB * GIB_IN_BYTE)
                }));
                setOnPremTableData(formattedData);
            } else {
                setOnPremTableData([]);
            }
        } else if (onPremiseData && Array.isArray(onPremiseData)) {
            const formattedData = onPremiseData.map((item: any) => ({
                id: item.id || item.resourceId,
                resourceName: item.resourceName,
                resourceId: item.resourceId,
                deploymentModel: item.deploymentModel,
                instanceCount: item.sqlServerInstances?.length || 0,
                nodeCount: item.onPremisesNodes?.length || 0,
                nameForSorting: item.resourceName?.toLowerCase(),
                sqlServerInstances: item.sqlServerInstances,
                onPremisesNodes: item.onPremisesNodes,
                totalAllocatedCapacity: formatSizeTwoPrecision(item.totalAllocatedCapacity)
            }));
            setOnPremTableData(formattedData);
        } else {
            setOnPremTableData([]);
        }
    }, [onPremiseData, onPremiseOracleData, isOracleOnPrem]);

    const AddHostColDefs: ColumnProps[] = [
        {
            Header: t('databases.explore-savings.host-name'),
            accessor: 'nameForSorting',
            id: '1',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.resourceName;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                    </div>
                );
            }
        },
        {
            Header: isOracleOnPrem
                ? t('databases.explore-savings.databases')
                : t('databases.explore-savings.instances'),
            accessor: 'instanceCount',
            isSortable: true,
            id: '2',
            width: '132px'
        },
        {
            Header: t('databases.explore-savings.allocated-capacity'),
            accessor: 'totalAllocatedCapacity',
            isSortable: true,
            id: '3',
            width: '120px',
            renderCell: (cellData: string | number, rowData: any) => renderAllocatedCapacity(cellData, rowData)
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'multiple',
        columns: AddHostColDefs,
        // Todo : what is resuorceId here
        defaultSelectedRows: activeSelectedRows.map((row: any) => row.id || row.resourceId),
        rows: updatedTableData,
        pageSize: 10
    });

    // Update table data with disabled states based on selection
    useEffect(() => {
        if (onPremTableData.length === 0) {
            setUpdatedTableData([]);
            return;
        }

        // Get currently selected rows in the table
        const currentTableSelection = getSelectedFromSelectionState(tableProps.selectionState, onPremTableData);

        const updatedData = onPremTableData.map((item: any) => {
            const isCurrentlySelected = currentTableSelection.some((row: any) => row.id === item.id);

            // Check if the limit of 5 selections has been reached
            const limitReached = currentTableSelection.length >= 5;
            const shouldDisableDueToLimit = limitReached && !isCurrentlySelected;

            // Disable if only 1 selected and it's this row (can't deselect the last one)
            const shouldDisable =
                shouldDisableDueToLimit || (currentTableSelection.length === 1 && isCurrentlySelected);

            let tooltipTitle = '';
            if (shouldDisableDueToLimit) {
                tooltipTitle = t('databases.explore-savings.disabled-tooltip-limit-exceed');
            } else if (currentTableSelection.length === 1 && isCurrentlySelected) {
                tooltipTitle = t('databases.explore-savings.disabled-tooltip-limit-reached');
            }

            return {
                ...item,
                cellProps: {
                    ...item.cellProps,
                    isDisabled: shouldDisable,
                    selectionProps: {
                        title: tooltipTitle,
                        titleProps: {
                            placement: 'bottom'
                        }
                    }
                }
            };
        });

        setUpdatedTableData(updatedData);
    }, [onPremTableData, activeSelectedRows, tableProps.selectionState]);

    const handleExploreSavings = () => {
        const selectedRows: any = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        if (isOracleOnPrem) {
            dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk(selectedRows));

            const storagePerfAndCompute: any = {};
            selectedRows.forEach((rowData: any) => {
                if (rowData?.oracleDatabases?.length) {
                    rowData.oracleDatabases.forEach((db: any) => {
                        const uniqueKey = `${rowData.resourceId}_${db.databaseName}`;
                        const existing = onPremStorageAndComputeInfo?.[uniqueKey];
                        storagePerfAndCompute[uniqueKey] = existing || {
                            totalStorage: formatFractionalNumber(Number(db?.totalStorage || 0) / GIB_IN_BYTE, 3),
                            totalIops: formatFractionalNumber(db?.totalIops, 3),
                            totalThroughput: formatFractionalNumber(db?.totalThroughput, 3),
                            noOfVcpusInUse: db?.vCPUs || 0,
                            memory: formatFractionalNumber(Number(db?.memory || 0) / GIB_IN_BYTE, 3),
                            databaseName: db?.databaseName,
                            databaseId: db?.databaseId,
                            networkPerformance: rowData?.networkPerformance || 'upTo10',
                            monthlyOracleCost: db?.monthlyOracleCost || '',
                            hostResourceName: rowData?.resourceName
                        };
                    });
                }
            });
            dispatch(setOnPremStorageAndComputeInfoFull(storagePerfAndCompute));
        } else {
            dispatch(setSelectedRowsForExploreSavingsOnPremBulk(selectedRows));

            const storagePerfAndCompute: any = {};
            selectedRows.forEach((rowData: any) => {
                if (rowData?.sqlServerInstances?.length) {
                    rowData.sqlServerInstances.forEach((instance: any) => {
                        const uniqueKey = `${rowData.resourceId}_${instance.sqlInstanceName}`;
                        const existing = onPremStorageAndComputeInfo?.[uniqueKey];
                        storagePerfAndCompute[uniqueKey] = existing || {
                            totalStorage: formatFractionalNumber(Number(instance?.totalStorage || 0) / GIB_IN_BYTE, 3),
                            totalIops: formatFractionalNumber(instance?.totalIops, 3),
                            totalThroughput: formatFractionalNumber(instance?.totalThroughput, 3),
                            noOfVcpusInUse: instance?.noOfVcpusInUse,
                            memory: formatFractionalNumber(Number(instance?.memory || 0) / GIB_IN_BYTE, 3),
                            sqlInstanceName: instance?.sqlInstanceName,
                            sqlInstanceId: instance?.sqlInstanceId,
                            networkPerformance: instance?.networkPerformance,
                            hostResourceName: rowData?.resourceName
                        };
                    });
                }
            });
            dispatch(setOnPremStorageAndComputeInfoFull(storagePerfAndCompute));
        }

        if (selectedRows.length > 0) {
            const serverName =
                selectedRows.length === 1 ? selectedRows[0]?.resourceName : `${selectedRows.length} hosts selected`;
            dispatch(setSelectedServerName(serverName));
            dispatch(
                setSelectedEsPageInstance({
                    instanceId: '',
                    credentialId: '',
                    regionId: '',
                    deploymentModel: selectedRows[0]?.deploymentModel,
                    serverName
                })
            );
        }

        dispatch(setTriggerBulkDataFetch(true));

        if (onExploreSavings) {
            onExploreSavings();
        }
    };

    // Expose the handler to parent component
    useEffect(() => {
        if (onHandlerReady) {
            onHandlerReady(handleExploreSavings);
        }
    }, [onHandlerReady, tableProps.selectionState, updatedTableData]);

    return (
        <div className={styles.tcoAddHost}>
            <DsTypography variant="Regular_14" className={styles.text}>
                {t('databases.explore-savings.select-upto-five')}
            </DsTypography>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={
                    isOracleOnPrem
                        ? t('databases.explore-savings.oracle-on-prem')
                        : t('databases.explore-savings.mssql-on-prem')
                }
                singularTitle={
                    isOracleOnPrem
                        ? t('databases.explore-savings.oracle-on-prem')
                        : t('databases.explore-savings.mssql-on-prem')
                }
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
                variant="innerTable"
            />
        </div>
    );
};

export default TCOOnPremAddHostTable;
