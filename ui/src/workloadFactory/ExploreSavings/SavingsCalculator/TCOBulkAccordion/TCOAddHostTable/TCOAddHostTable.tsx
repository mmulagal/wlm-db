import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { DsTypography } from '@netapp/design-system';
import { ColumnProps, Table } from '../../../../../common/Lib/Table/Table';
import { useTable } from '../../../../../common/Lib/Table/useTable';
import {
    setRowsRequiringAuthBulk,
    setSelectedRowsForExploreSavingsEBSBulk,
    setTriggerBulkDataFetch
} from '../../../../../store/workloadFactory/exploreSavingsBulkSlice';
import { getSelectedFromSelectionState } from '../../../../../utils/utilityFunctions';
import styles from './TCOAddHostTable.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { TableTopBar } from '../../../../../common/Lib/Table/TableTopBar';
import { renderAllocatedCapacity, renderUnmanagedAZ, uniqueHostRow } from '../../../../InventoryV2/InventoryUtilsV2';
import { GENERAL } from '../../../../../utils/appConstants';
import { shouldAuthDialogOpenBulk } from '../../../ExploreSavingsUtils';

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
    const { selectedRowsForExploreSavingsEBSBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);

    useEffect(() => {
        if (unManagedHostFormatedList) {
            const result: any = [];
            unManagedHostFormatedList?.map((perRow: any) => {
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
            const fsxArray: any = [];
            result.forEach((item: any) => {
                if (item.storageType === 'EBS') {
                    ebsArray.push(item);
                } else if (item.storageType === 'FSx for Windows') {
                    fsxArray.push(item);
                }
            });
            setEBSTableData(ebsArray);
        } else {
            setEBSTableData([]);
        }
    }, [unManagedHostFormatedList]);

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
            Header: t('databases.explore-savings.instances'),
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
            renderCell: (cellData: any, rowData: any) => renderUnmanagedAZ(cellData, rowData, styles)
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
        defaultSelectedRows: selectedRowsForExploreSavingsEBSBulk.map((row: any) => row.id),
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

        // Calculate combined selection (already confirmed + currently selected in table)
        const existingIds = new Set(selectedRowsForExploreSavingsEBSBulk.map((row: any) => row.id));

        const updatedData = ebsTableData.map((item: any) => {
            const isCurrentlySelected = currentTableSelection.some((row: any) => row.id === item.id);

            const shouldDisable =
                (currentTableSelection.length >= 5 && !isCurrentlySelected) ||
                (currentTableSelection.length === 1 && isCurrentlySelected);

            return {
                ...item,
                cellProps: {
                    ...item.cellProps,
                    isDisabled: shouldDisable
                }
            };
        });

        setUpdatedTableData(updatedData);
    }, [ebsTableData, selectedRowsForExploreSavingsEBSBulk, tableProps.selectionState]);

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
            // Replace the entire selection with whatever is currently selected in the table
            dispatch(setSelectedRowsForExploreSavingsEBSBulk(selectedRows));
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
                pluralTitle={t('databases.explore-savings.mssql-ebs')}
                singularTitle={t('databases.explore-savings.mssql-ebs')}
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
