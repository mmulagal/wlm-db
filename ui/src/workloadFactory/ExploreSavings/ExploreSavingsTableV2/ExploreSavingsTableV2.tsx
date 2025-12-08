import { Table, useTable, Typography, TableTopBar, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from 'i18next';
import styles from './ExploreSavingsTableV2.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import {
    handleAuthenticate,
    onClickESHost,
    shouldAuthDialogOpen,
    shouldAuthDialogOpenBulk
} from '../ExploreSavingsUtils';
import { DBType, FROM_DIALOG, WLF_TABS } from '../../../utils/consts';
import {
    renderAllocatedCapacity,
    renderCellData,
    renderInstanceListText,
    renderUnmanagedAZ,
    uniqueHostRow
} from '../../InventoryV2/InventoryUtilsV2';
import { getFilterOptions, getSelectedFromSelectionState } from '../../../utils/utilityFunctions';
import useResize from '../../../common/hooks/useResize';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import AuthDialog from './AuthDialog/AuthDialog';
import { useRegisterResourceCredentialsBulkMutation } from '../../../utils/apiService';
import {
    resetOptimizedStorage,
    resetServerDetailsCredentials
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { resetDialogComponent } from '../../../store/workloadFactory/dialogComponentSlice';
import {
    setEbsTCOAction,
    setSelectedRowsForExploreSavingsEBSBulk,
    setRowsRequiringAuthBulk,
    resetRowsRequiringAuthBulk,
    resetBulkAuthCredentialsAndStatus
} from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import BulkActionContainer from '../../../common/BulkAction/BulkActionContainer';
import AuthBulkDialog from './AuthDialog/AuthBulkDialog';

const ExploreSavingsTableV2 = () => {
    const dispatch = useDispatch();
    const windowSize = useResize();
    const { setDialog, closeDialog } = useDialog();
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const navigate = useNavigate();
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const [ebsTableData, setEBSTableData] = useState<any>([]);
    const [fsxWTableData, setFSXWTableData] = useState<any>([]);
    // const selectedHeaderTab = useAppSelector(state => state.inventoryV2.selectedHeaderTab);
    const selectedExploreSavingsTab = useAppSelector(state => state.exploreSavings.selectedExploreSavingsTab);
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading } = useAppSelector(
        state => state.headers
    );
    const { selectedRowsForExploreSavingsEBSBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const selectedExploreSavingsTabFileSystemType =
        selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? GENERAL.EBS : GENERAL.FSX_FOR_WINDOWS;

    // const getInitialFilter = () => {
    //     if (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS || selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_FsxW) {
    //         return {
    //             textFilter: '',
    //             count: 1,
    //             columns: {
    //                 '3': {
    //                     activeCount: 1,
    //                     values: {
    //                         [selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS
    //                             ? GENERAL.EBS
    //                             : GENERAL.FSX_FOR_WINDOWS]: true
    //                     },
    //                     valuesArray: [true]
    //                 }
    //             }
    //         };
    //     } else {
    //         return undefined;
    //     }
    // };

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
            const fsxArray: any = [];
            result.forEach((item: any) => {
                // currently filtering for MSSQL hosts only
                if (item?.hostType !== DBType.MSSQL) {
                    return;
                }
                if (item.storageType === 'EBS') {
                    ebsArray.push(item);
                } else if (item.storageType === 'FSx for Windows') {
                    fsxArray.push(item);
                }
            });
            setEBSTableData(ebsArray);
            setFSXWTableData(fsxArray);
        } else {
            setEBSTableData([]);
            setFSXWTableData([]);
        }
    }, [unManagedHostFormatedList, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList]);

    const updatedTableData = useMemo(
        () =>
            ebsTableData.map((item: any) => {
                const isSelected = selectedRowsForExploreSavingsEBSBulk.some(
                    (selectedRow: any) => selectedRow.id === item.id
                );

                const hasSelection = selectedRowsForExploreSavingsEBSBulk.length > 0;
                const sharesGroupWithSelection = hasSelection
                    ? selectedRowsForExploreSavingsEBSBulk.some(
                          (selectedRow: any) =>
                              selectedRow.credentialId === item.credentialId && selectedRow.regionId === item.regionId
                      )
                    : true;

                const limitReached = selectedRowsForExploreSavingsEBSBulk.length >= 5;
                const shouldDisableDueToLimit = limitReached && !isSelected;

                const isDisabled = !sharesGroupWithSelection || shouldDisableDueToLimit;

                let tooltipTitle = '';
                if (!sharesGroupWithSelection) {
                    tooltipTitle = t('databases.explore-savings.disabled-tooltip');
                } else if (shouldDisableDueToLimit) {
                    tooltipTitle = t('databases.explore-savings.disabled-tooltip-limit-exceed');
                }

                // Only create new object if cellProps actually changed
                const currentIsDisabled = item.cellProps?.isDisabled;
                const currentTooltip = item.cellProps?.selectionProps?.title;

                if (currentIsDisabled === isDisabled && currentTooltip === tooltipTitle) {
                    // Return same object reference if nothing changed - prevents useTable reset
                    return item;
                }

                // Only create new object when cellProps actually need to change
                return {
                    ...item,
                    cellProps: {
                        ...item.cellProps,
                        isDisabled,
                        selectionProps: {
                            title: tooltipTitle,
                            titleProps: {
                                placement: 'bottom'
                            }
                        }
                    }
                };
            }),
        [ebsTableData, selectedRowsForExploreSavingsEBSBulk]
    );

    const handleBulkDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={t('databases.explore-savings.authentication-required')}
                content={<AuthBulkDialog />}
                primaryButton={t('databases.explore-savings.apply')}
                secondaryButton={t('databases.explore-savings.close')}
                closeCallback={() => {
                    dispatch(resetDialogComponent());
                    dispatch(resetBulkAuthCredentialsAndStatus());
                    dispatch(resetRowsRequiringAuthBulk());
                    closeDialog();
                }}
                dialogFrom={FROM_DIALOG.EXPLORE_SAVINGS}
                callback={() => {
                    handleAuthenticate(
                        rowData,
                        dispatch,
                        selectedExploreSavingsTabFileSystemType,
                        isWorkloadFactory,
                        navigate,
                        () => closeDialog(),
                        t,
                        registerResourceCredBulk
                    );
                }}
            />
        );
    };

    const handleDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={t('databases.explore-savings.authentication-required')}
                content={<AuthDialog databaseHostName={rowData?.name} />}
                primaryButton={t('databases.explore-savings.authenticate')}
                secondaryButton={t('databases.explore-savings.close')}
                closeCallback={() => {
                    dispatch(resetDialogComponent());
                    dispatch(resetServerDetailsCredentials());
                    closeDialog();
                }}
                dialogFrom={FROM_DIALOG.EXPLORE_SAVINGS}
                callback={() => {
                    handleAuthenticate(
                        rowData,
                        dispatch,
                        selectedExploreSavingsTabFileSystemType,
                        isWorkloadFactory,
                        navigate,
                        () => closeDialog(),
                        t,
                        registerResourceCredBulk
                    );
                }}
                customClass={styles.protectionDialog}
            />
        );
    };

    const lastColDetails = () => ({
        id: '11',
        Header: '',
        accessor: '',
        isSticky: true,
        width: windowSize.width >= 1920 ? '15.37%' : '247px',
        renderCell: (cellData: any, rowData: any) => (
            <div
                className={
                    selectedRowsForExploreSavingsEBSBulk.length > 0 ? styles.detectManageDisable : styles.detectManage
                }
                onClick={
                    selectedRowsForExploreSavingsEBSBulk.length > 0
                        ? undefined
                        : () => {
                              dispatch(setEbsTCOAction('bulk'));
                              dispatch(resetOptimizedStorage());
                              shouldAuthDialogOpen(rowData)
                                  ? handleDialog(rowData)
                                  : onClickESHost(dispatch, rowData, isWorkloadFactory, navigate);
                          }
                }
                id="wlm-db-ebs-explore-savings-table-button"
            >
                <Typography variant="Regular_14" className={styles.textStyle}>
                    {GENERAL.ES_SAVINGS}
                </Typography>
            </div>
        )
    });

    const ExploreSavingsColDefs: ColumnProps[] = [
        {
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'nameForSorting',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: windowSize.width >= 1920 ? '14.18%' : '228px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            id: '2',
            width: windowSize.width >= 1920 ? '14.18%' : '228px',
            filterOptions: getFilterOptions(
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? updatedTableData : fsxWTableData,
                'serverInstallationMode'
            ),
            renderCell: (cellData: string) => cellData || GENERAL.NOT_AVAILABLE
        },
        // {
        //     Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
        //     accessor: 'storageType',
        //     id: '3',
        //     width: '170px',
        //     filterOptions: [
        //         { label: GENERAL.EBS, value: GENERAL.EBS },
        //         { label: GENERAL.FSX_FOR_WINDOWS, value: GENERAL.FSX_FOR_WINDOWS }
        //     ],
        //     renderCell: (cellData: string) => {
        //         return cellData === 'EBS' ? 'Elastic Block Store (EBS)' : cellData || GENERAL.NOT_AVAILABLE;
        //     }
        // },
        {
            Header: 'SQL server instances',
            accessor: 'totalInstance',
            id: '4',
            width: windowSize.width >= 1920 ? '13.44%' : '216px',
            filterOptions: getFilterOptions(
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? updatedTableData : fsxWTableData,
                'totalInstance'
            ),
            renderCell: (cellData: string) => (
                <div>
                    {cellData && Number(cellData) !== 0 ? (
                        <Typography variant="Regular_14">
                            {cellData} {Number(cellData) > 1 ? 'instances' : 'instance'}
                        </Typography>
                    ) : (
                        ''
                    )}
                    {!cellData ? GENERAL.NOT_AVAILABLE : ''}
                </div>
            )
        },
        {
            Header: GENERAL.DB_HOST_INSTANCE,
            accessor: 'instanceListText',
            id: '5',
            width: windowSize.width >= 1920 ? '15.12%' : '243px',
            isSortable: true,
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => renderInstanceListText(cellData, rowData, styles)
        },
        {
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'allocatedCapacityText',
            id: '6',
            width: windowSize.width >= 1920 ? '12.57%' : '202px',
            isSortable: true,
            accessorForTextFilter: 'allocatedCapacityText',
            renderCell: (cellData: string | number, rowData: any) => renderAllocatedCapacity(cellData, rowData)
        },
        {
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'azType',
            id: '7',
            width: windowSize.width >= 1920 ? '15.12%' : '243px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => renderUnmanagedAZ(cellData, rowData, styles)
        },
        {
            id: '8',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '9',
            Header: 'AWS account',
            accessor: 'accountId',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '10',
            Header: 'Region',
            accessor: 'regionName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: ExploreSavingsColDefs,
        selectionType: 'multiple',
        rows: selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? updatedTableData : fsxWTableData || [],
        pageSize: 50,
        defaultSelectedRows: [],
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading || multiDataLoading
    });

    // Sync table selection state to Redux
    useEffect(() => {
        const dataForSelection =
            selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? updatedTableData : fsxWTableData || [];

        if (dataForSelection.length > 0) {
            const rowsData = getSelectedFromSelectionState(tableProps.selectionState, dataForSelection);
            dispatch(setSelectedRowsForExploreSavingsEBSBulk(rowsData));
        }
    }, [tableProps.selectionState, selectedExploreSavingsTab]);

    // Sync Redux selection state back to table when rows are removed externally (e.g., from auth dialog)
    // or after temporarily empty (during zoom operations)
    useEffect(() => {
        const dataForSelection =
            selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? updatedTableData : fsxWTableData || [];

        // only sync if we have dataForSelection
        if (dataForSelection.length === 0) return;

        const currentTableSelectedIds = new Set(
            Object.keys(tableProps.selectionState?.rows || {}).filter(id => tableProps.selectionState?.rows[id])
        );
        const reduxSelectedIds = new Set(selectedRowsForExploreSavingsEBSBulk.map((row: any) => row.id));

        // Find rows that are selected in table but not in Redux (these need to be deselected)
        currentTableSelectedIds.forEach(id => {
            if (!reduxSelectedIds.has(id)) {
                tableProps.toggleRowSelection(id)(false);
            }
        });

        // Find rows that are in Redux but not selected in table
        reduxSelectedIds.forEach(id => {
            if (!currentTableSelectedIds.has(id as string)) {
                tableProps.toggleRowSelection(id as string)(true);
            }
        });
    }, [selectedRowsForExploreSavingsEBSBulk, updatedTableData, fsxWTableData, selectedExploreSavingsTab]);

    const handleEBSBulkAction = () => {
        dispatch(setEbsTCOAction('bulk'));
        dispatch(resetOptimizedStorage());

        // Check if any of the selected hosts need authentication
        const rowsNeedingAuth = shouldAuthDialogOpenBulk(selectedRowsForExploreSavingsEBSBulk || []);

        dispatch(setRowsRequiringAuthBulk(rowsNeedingAuth));

        if (rowsNeedingAuth && rowsNeedingAuth.length > 0) {
            handleBulkDialog(rowsNeedingAuth[0]);
        } else {
            // Use the first host for both single and multiple selections
            const firstHost = selectedRowsForExploreSavingsEBSBulk[0];
            const isBulk = selectedRowsForExploreSavingsEBSBulk.length > 1;
            const bulkServerName = isBulk ? `${selectedRowsForExploreSavingsEBSBulk.length} hosts selected` : undefined;

            onClickESHost(dispatch, firstHost, isWorkloadFactory, navigate, isBulk, bulkServerName);
        }
    };

    return (
        <div className={styles.exploreSavingTable}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                subTitle={t('databases.explore-savings.select-upto-five')}
                pluralTitle={
                    selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE
                        ? `${GENERAL.ES_TABLE_TITLE}`
                        : `${GENERAL.ES_TABLE_FSXW_TITLE}`
                }
                singularTitle={
                    selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE
                        ? `${GENERAL.ES_TABLE_TITLE_SINGLE}`
                        : `${GENERAL.ES_TABLE_FSXW_TITLE_SINGLE}`
                }
            />
            {selectedRowsForExploreSavingsEBSBulk.length > 0 && (
                <BulkActionContainer action="Explore savings" onClick={handleEBSBulkAction} />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default ExploreSavingsTableV2;
