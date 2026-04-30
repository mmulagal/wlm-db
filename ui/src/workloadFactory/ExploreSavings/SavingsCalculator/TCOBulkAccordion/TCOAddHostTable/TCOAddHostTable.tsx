import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { DsTypography } from '@netapp/design-system';
import { ColumnProps, Table } from '../../../../../common/Lib/Table/Table';
import { useTable } from '../../../../../common/Lib/Table/useTable';
import {
    setRowsRequiringAuthBulk,
    setSelectedRowsForExploreSavingsEBSBulk,
    setSelectedRowsForExploreSavingsOracleEbsBulk,
    setTriggerBulkDataFetch
} from '../../../../../store/workloadFactory/exploreSavingsBulkSlice';
import { getSelectedFromSelectionState } from '../../../../../utils/utilityFunctions';
import styles from './TCOAddHostTable.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { TableTopBar } from '../../../../../common/Lib/Table/TableTopBar';
import { renderAllocatedCapacity, renderUnmanagedAZ, uniqueHostRow } from '../../../../InventoryV2/InventoryUtilsV2';
import { GENERAL } from '../../../../../utils/appConstants';
import { shouldAuthDialogOpenBulk } from '../../../ExploreSavingsUtils';
import { DBType, SAVINGS_CALC_MODE } from '../../../../../utils/consts';

interface TCOAddHostTableProps {
    onExploreSavings?: () => void;
    onHandlerReady?: (handler: () => void) => void;
    onAuthRequired?: (selectedRows: any[]) => void;
}

const TCOAddHostTable = ({ onExploreSavings, onHandlerReady, onAuthRequired }: TCOAddHostTableProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [ebsTableData, setEBSTableData] = useState<any>([]);
    const [updatedTableData, setUpdatedTableData] = useState<any>([]);
    const { selectedRowsForExploreSavingsEBSBulk, selectedRowsForExploreSavingsOracleEbsBulk } = useAppSelector(
        state => state.exploreSavingsBulk
    );
    const { savingsCalculatorFrom } = useAppSelector(state => state.exploreSavings);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);

    const isOracleEbs = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
    const activeRows = isOracleEbs ? selectedRowsForExploreSavingsOracleEbsBulk : selectedRowsForExploreSavingsEBSBulk;
    const setActiveRows = isOracleEbs
        ? setSelectedRowsForExploreSavingsOracleEbsBulk
        : setSelectedRowsForExploreSavingsEBSBulk;
    const targetDbType = isOracleEbs ? DBType.ORACLE : DBType.MSSQL;

    useEffect(() => {
        if (unManagedHostFormatedList) {
            const result: any = [];
            unManagedHostFormatedList?.map((perRow: any) => {
                if (
                    !headerSelectedMultiCredIdsList.includes(perRow?.credentialId) ||
                    !headerSelectedMultiRegionIdsList.includes(perRow?.regionId)
                ) {
                    return;
                }
                const instanceList: any = [];
                const instanceNameList: any = [];
                perRow?.ec2Details?.map((row: any) => {
                    if (row?.name) {
                        instanceNameList.push(row?.name);
                    }
                    if (row?.name && row?.id) {
                        instanceList.push(`${row?.name} | ID: ${row?.id}`);
                    } else if (row?.id) {
                        instanceList.push(`${GENERAL.NOT_AVAILABLE} | ID: ${row?.id}`);
                    }
                });
                const rowData = {
                    ...perRow,
                    id: uniqueHostRow(perRow?.id, perRow?.credentialId, perRow?.regionId),
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    nameForSorting: perRow?.name?.toLowerCase()
                };
                result.push(rowData);
            });
            // Initialize two empty arrays
            const ebsArray: any = [];
            result.forEach((item: any) => {
                if (item?.hostType !== targetDbType) {
                    return;
                }
                if (item.storageType === 'EBS') {
                    ebsArray.push(item);
                }
            });
            setEBSTableData(ebsArray);
        } else {
            setEBSTableData([]);
        }
    }, [unManagedHostFormatedList, targetDbType]);

    const AddHostColDefs: ColumnProps[] = [
        {
            Header: t('databases.explore-savings.host-name'),
            accessor: 'nameForSorting',
            id: '1',
            isSortable: true,
            width: '139px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                    </div>
                );
            }
        },
        {
            Header: isOracleEbs ? t('databases.explore-savings.databases') : t('databases.explore-savings.instances'),
            accessor: 'totalInstance',
            isSortable: true,
            id: '2',
            width: '132px'
        },
        {
            Header: t('databases.explore-savings.allocated-capacity'),
            accessor: 'allocatedCapacityText',
            isSortable: true,
            id: '3',
            width: '190px',
            renderCell: (cellData: string | number, rowData: any) => renderAllocatedCapacity(cellData, rowData)
        },
        {
            Header: t('databases.explore-savings.availability'),
            accessor: 'azType',
            id: '4',
            width: '158px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => renderUnmanagedAZ(cellData, rowData, CommonStyles)
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
        defaultSelectedRows: activeRows.map((row: any) => row.id),
        rows: updatedTableData,
        pageSize: 10
    });

    // Update table data with disabled states based on selection
    useEffect(() => {
        if (ebsTableData.length === 0) {
            setUpdatedTableData([]);
            return;
        }

        // Get currently selected rows in the table
        const currentTableSelection = getSelectedFromSelectionState(tableProps.selectionState, ebsTableData);

        const updatedData = ebsTableData.map((item: any) => {
            const isCurrentlySelected = currentTableSelection.some((row: any) => row.id === item.id);

            // Check if there's any selection
            const hasSelection = currentTableSelection.length > 0;

            // Check if this item shares the same credentialId and regionId with any selected row
            const sharesGroupWithSelection = hasSelection
                ? currentTableSelection.some(
                      (selectedRow: any) =>
                          selectedRow.credentialId === item.credentialId && selectedRow.regionId === item.regionId
                  )
                : true;

            // Check if the limit of 5 selections has been reached
            const limitReached = currentTableSelection.length >= 5;
            const shouldDisableDueToLimit = limitReached && !isCurrentlySelected;

            const shouldDisable =
                !sharesGroupWithSelection ||
                shouldDisableDueToLimit ||
                (currentTableSelection.length === 1 && isCurrentlySelected);

            let tooltipTitle = '';
            if (!sharesGroupWithSelection) {
                tooltipTitle = t('databases.explore-savings.disabled-tooltip');
            } else if (shouldDisableDueToLimit) {
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
    }, [ebsTableData, activeRows, tableProps.selectionState]);

    const handleExploreSavings = () => {
        const selectedRows = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        // Check if any of the selected hosts need authentication
        const rowsNeedingAuth = shouldAuthDialogOpenBulk(selectedRows || []);

        if (rowsNeedingAuth && rowsNeedingAuth.length > 0) {
            dispatch(setRowsRequiringAuthBulk(rowsNeedingAuth));

            if (onAuthRequired) {
                onAuthRequired(selectedRows);
            }
        } else {
            const existingHostsMap = new Map(activeRows.map((host: any) => [host.id, host]));

            const rowsWithByolPreserved = selectedRows.map((row: any) => {
                const existingHost: any = existingHostsMap.get(row.id);
                return {
                    ...row,
                    monthlySqlByolCost:
                        existingHost?.monthlySqlByolCost !== undefined ? existingHost.monthlySqlByolCost : null
                };
            });

            dispatch(setActiveRows(rowsWithByolPreserved));
            // Trigger data fetch after adding hosts when authentication is not required
            dispatch(setTriggerBulkDataFetch(true));
            if (onExploreSavings) {
                onExploreSavings();
            }
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
                    isOracleEbs ? t('databases.explore-savings.oracle-ebs') : t('databases.explore-savings.mssql-ebs')
                }
                singularTitle={
                    isOracleEbs ? t('databases.explore-savings.oracle-ebs') : t('databases.explore-savings.mssql-ebs')
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

export default TCOAddHostTable;
