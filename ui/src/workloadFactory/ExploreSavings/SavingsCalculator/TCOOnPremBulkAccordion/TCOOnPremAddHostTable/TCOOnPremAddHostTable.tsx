import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { DsTypography } from '@netapp/design-system';
import { ColumnProps, Table } from '../../../../../common/Lib/Table/Table';
import { useTable } from '../../../../../common/Lib/Table/useTable';
import {
    setSelectedRowsForExploreSavingsOnPremBulk,
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
import { GIB_IN_BYTE } from '../../../../../utils/consts';
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
    const { selectedRowsForExploreSavingsOnPremBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const { onPremiseData, onPremiseDataLoading, onPremStorageAndComputeInfo } = useAppSelector(
        state => state.exploreSavings
    );

    // Format on-premises data for table
    useEffect(() => {
        if (onPremiseData && Array.isArray(onPremiseData)) {
            // Don't filter - show ALL hosts (like EBS does)
            // The already selected hosts will be pre-checked via defaultSelectedRows
            const formattedData = onPremiseData.map((item: any) => ({
                id: item.id || item.resourceId, // Use existing id or resourceId as fallback
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
    }, [onPremiseData]);

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
            Header: t('databases.explore-savings.instances'),
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
        defaultSelectedRows: selectedRowsForExploreSavingsOnPremBulk.map((row: any) => row.id || row.resourceId),
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
    }, [onPremTableData, selectedRowsForExploreSavingsOnPremBulk, tableProps.selectionState]);

    const handleExploreSavings = () => {
        const selectedRows: any = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        // Replace the entire selection- this allows both adding and removing hosts
        dispatch(setSelectedRowsForExploreSavingsOnPremBulk(selectedRows));

        // Populate compute/storage data for selected hosts
        const storagePerfAndCompute: any = {};
        selectedRows.forEach((rowData: any) => {
            if (rowData?.sqlServerInstances?.length) {
                rowData.sqlServerInstances.forEach((instance: any) => {
                    const uniqueKey = `${rowData.resourceId}_${instance.sqlInstanceName}`;
                    if (!storagePerfAndCompute[uniqueKey]) {
                        storagePerfAndCompute[uniqueKey] = {};
                    }
                    storagePerfAndCompute[uniqueKey].totalStorage = formatFractionalNumber(
                        Number(instance?.totalStorage || 0) / GIB_IN_BYTE,
                        3
                    );
                    storagePerfAndCompute[uniqueKey].totalIops = formatFractionalNumber(instance?.totalIops, 3);
                    storagePerfAndCompute[uniqueKey].totalThroughput = formatFractionalNumber(
                        instance?.totalThroughput,
                        3
                    );
                    storagePerfAndCompute[uniqueKey].noOfVcpusInUse = instance?.noOfVcpusInUse;
                    storagePerfAndCompute[uniqueKey].memory = formatFractionalNumber(
                        Number(instance?.memory || 0) / GIB_IN_BYTE,
                        3
                    );
                    storagePerfAndCompute[uniqueKey].sqlInstanceName = instance?.sqlInstanceName;
                    storagePerfAndCompute[uniqueKey].sqlInstanceId = instance?.sqlInstanceId;
                    storagePerfAndCompute[uniqueKey].networkPerformance = instance?.networkPerformance;
                    storagePerfAndCompute[uniqueKey].hostResourceName = rowData?.resourceName;
                });
            }
        });

        // Replace the entire compute/storage data to match the current selection
        dispatch(setOnPremStorageAndComputeInfoFull(storagePerfAndCompute));

        // Update server name to reflect current host count or name
        if (selectedRows.length > 0) {
            // Show host name if only 1 host, otherwise show count (matching EBS pattern)
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

        // Trigger data fetch after updating selection
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
                pluralTitle={t('databases.explore-savings.mssql-on-prem')}
                singularTitle={t('databases.explore-savings.mssql-on-prem')}
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
