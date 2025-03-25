import { Table, useTable, Typography, TableTopBar, Popover } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ExploreSavingsTableV2.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { onClickESHost } from '../ExploreSavingsUtils';
import { WLF_TABS } from '../../../utils/consts';
import { useEffect, useState } from 'react';
import {
    renderAllocatedCapacity,
    renderCellData,
    renderInstanceListText,
    renderUnmanagedAZ,
    uniqueHostRow
} from '../../InventoryV2/InventoryUtilsV2';
import { getFilterOptions } from '../../../utils/utilityFunctions';

const ExploreSavingsTableV2 = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const [ebsTableData, setEBSTableData] = useState<any>([]);
    const [fsxWTableData, setFSXWTableData] = useState<any>([]);
    // const selectedHeaderTab = useAppSelector(state => state.inventoryV2.selectedHeaderTab);
    const selectedExploreSavingsTab = useAppSelector(state => state.exploreSavings.selectedExploreSavingsTab);
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);

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
            let result: any = [];
            unManagedHostFormatedList?.map((perRow: any) => {
                if (
                    !headerSelectedMultiCredIdsList.includes(perRow?.credentialId) ||
                    !headerSelectedMultiRegionIdsList.includes(perRow?.regionId)
                ) {
                    return;
                }
                let instanceList: any = [];
                let instanceNameList: any = [];
                perRow?.ec2Details?.map((row: any) => {
                    if (row?.name) {
                        instanceNameList.push(row?.name);
                    }
                    if (row?.name && row?.id) {
                        instanceList.push(row?.name + ' | ID: ' + row?.id);
                    } else if (row?.id) {
                        instanceList.push(GENERAL.NOT_AVAILABLE + ' | ID: ' + row?.id);
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
            setFSXWTableData(fsxArray);
        } else {
            setEBSTableData([]);
            setFSXWTableData([]);
        }
    }, [unManagedHostFormatedList]);

    const lastColDetails = () => {
        return {
            id: '11',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '247px',
            renderCell: (cellData: any, rowData: any) => {
                return !rowData?.isDetected ? (
                    <Popover
                        popoverClass={styles['copy-popover']}
                        children={'To explore savings on this host first detect the instances.'}
                        trigger="hover"
                        isAppendedToBody={true}
                        container={
                            <div
                                className={styles.detectManageDisable}
                                onClick={() => {}}
                                id="explore-savings-table-button"
                            >
                                <Typography variant="Regular_14" className={styles.textStyle}>
                                    {GENERAL.ES_SAVINGS}
                                </Typography>
                            </div>
                        }
                    />
                ) : (
                    <div
                        className={styles.detectManage}
                        onClick={() => {
                            onClickESHost(dispatch, rowData, isWorkloadFactory);
                        }}
                        id="explore-savings-table-button"
                    >
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {GENERAL.ES_SAVINGS}
                        </Typography>
                    </div>
                );
            }
        };
    };

    const ExploreSavingsColDefs: ColumnProps[] = [
        {
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'nameForSorting',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '228px',
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
            width: '228px',
            filterOptions: getFilterOptions(
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? ebsTableData : fsxWTableData,
                'serverInstallationMode'
            ),
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
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
            width: '216px',
            filterOptions: getFilterOptions(
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? ebsTableData : fsxWTableData,
                'totalInstance'
            ),
            renderCell: (cellData: string) => {
                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <>
                                <Typography variant="Regular_14">
                                    {cellData} {Number(cellData) > 1 ? 'instances' : 'instance'}
                                </Typography>
                            </>
                        ) : (
                            ''
                        )}
                        {!cellData ? GENERAL.NOT_AVAILABLE : ''}
                    </div>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_INSTANCE,
            accessor: 'instanceListText',
            id: '5',
            width: '243px',
            isSortable: true,
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => {
                return renderInstanceListText(cellData, rowData, styles);
            }
        },
        {
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'allocatedCapacityText',
            id: '6',
            width: '202px',
            isSortable: true,
            accessorForTextFilter: 'allocatedCapacityText',
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(cellData, rowData);
            }
        },
        {
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'azType',
            id: '7',
            width: '243px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => {
                return renderUnmanagedAZ(cellData, rowData, styles);
            }
        },
        {
            id: '8',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            id: '9',
            Header: 'AWS account',
            accessor: 'accountId',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            id: '10',
            Header: 'Region',
            accessor: 'regionName',
            isSortable: true,
            filterOptions: 'auto',
            width: '254px',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: ExploreSavingsColDefs,
        rows: selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE ? ebsTableData : fsxWTableData || [],
        pageSize: 50,
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading
    });

    return (
        <div className={styles.exploreSavingTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
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
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default ExploreSavingsTableV2;
