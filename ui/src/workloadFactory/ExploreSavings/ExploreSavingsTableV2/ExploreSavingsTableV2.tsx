import { Table, useTable, Typography, TableTopBar, DsFlashingDotsLoader, DsButton } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ExploreSavingsTableV2.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import {
    renderAllocatedCapacity,
    renderEstimatedCost,
    renderInstanceListText,
    renderUnmanagedAZ
} from '../../Inventory/InventoryUtils';
import { onClickESHost } from '../ExploreSavingsUtils';
import { INVENTORY_ACTIONS, INVENTORY_STATUS } from '../../../utils/consts';
import { useEffect, useState } from 'react';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';

const ExploreSavingsTableV2 = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const [tableData, setTableData] = useState<any>([]);

    useEffect(() => {
        if (unManagedHostFormatedList) {
            let result: any = [];
            unManagedHostFormatedList?.map((perRow: any) => {
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
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    nameForSorting: perRow?.name?.toLowerCase()
                };
                result.push(rowData);
            });
            setTableData(result);
        } else {
            setTableData([]);
        }
    }, [unManagedHostFormatedList]);

    const lastColDetails = () => {
        return {
            id: '9',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '181px',
            renderCell: (cellData: any, rowData: any) => {
                //Check for all Explore Savings FSXW rows
                if (
                    rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS &&
                    rowData?.storageType === GENERAL.FSX_FOR_WINDOWS
                ) {
                    return (
                        <TooltipComponent title={GENERAL.COMING_SOON} placement="bottom" width="110px" height="32px">
                            <div className={styles.detectManageDisable} id="explore-savings-table-button">
                                <Typography variant="Regular_14" className={styles.textStyle}>
                                    {GENERAL.ES_SAVINGS}
                                </Typography>
                            </div>
                        </TooltipComponent>
                    );
                } else {
                    return (
                        <div
                            className={styles.detectManage}
                            onClick={() => {
                                onClickESHost(dispatch, rowData);
                            }}
                            id="explore-savings-table-button"
                        >
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                {GENERAL.ES_SAVINGS}
                            </Typography>
                        </div>
                    );
                }
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
            width: '270px',
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
            width: '225px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'storageType',
            id: '3',
            width: '160px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'SQL server instances',
            accessor: 'totalInstance',
            id: '4',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <>
                                <Typography variant="Regular_14">{cellData + ' instances'}</Typography>
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
            width: '211px',
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
            width: '190px',
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
            width: '170px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => {
                return renderUnmanagedAZ(cellData, rowData, styles);
            }
        },
        // {
        //     Header: GENERAL.DB_HOST_ESTIMATED_COST,
        //     accessor: 'totalCost',
        //     id: '8',
        //     width: '176px',
        //     isSortable: true,
        //     renderCell: (cellData: any, rowData: any) => {
        //         return renderEstimatedCost(cellData, rowData, styles);
        //     }
        // },
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
        rows: tableData || [],
        pageSize: 50,
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading
    });

    return (
        <div className={styles.exploreSavingTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`${GENERAL.ES_TABLE_TITLE}s`}
                singularTitle={GENERAL.ES_TABLE_TITLE}
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
