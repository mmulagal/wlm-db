import { Table, useTable, Typography, TableTopBar, Popover, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ExploreSavingsTableV2.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import {
    renderAllocatedCapacity,
    renderDeploymentModel,
    renderEstimatedCost,
    renderFileSystemType,
    renderUnmanagedAZ,
    renderUnmanagedHostName
} from '../../Inventory/InventoryUtils';
import { onClickESHost } from '../ExploreSavingsUtils';
import { INVENTORY_STATUS } from '../../../utils/consts';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useEffect, useState } from 'react';

const ExploreSavingsTableV2 = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const [tableData, setTableData] = useState<any>([]);

    useEffect(() => {
        if (unManagedHostFormatedList) {
            let result: any = [];
            unManagedHostFormatedList?.map((perRow: any) => {
                let instanceList: any = [];
                perRow?.ec2Details?.map((row: any) => {
                    instanceList.push(row?.id);
                });
                const rowData = {
                    ...perRow,
                    instanceListText: instanceList.join(',')
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
            id: '8',
            Header: '',
            accessor: '',
            width: '181px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        <div
                            className={styles.detectManage}
                            onClick={() => {
                                onClickESHost(dispatch, rowData, isDemoMode);
                            }}
                        >
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                {GENERAL.ES_SAVINGS}
                            </Typography>
                        </div>
                    </>
                );
            }
        };
    };

    const ExploreSavingsColDefs: ColumnProps[] = [
        {
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'status',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '280px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                        <div className={styles.firstColText}>
                            {rowData?.status === INVENTORY_STATUS.ONLINE && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.OFFLINE && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                            )}
                            <Typography variant="Regular_13">
                                {rowData?.status}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && 'Unknown'}
                            </Typography>
                            <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">{GENERAL.MSSQL}</Typography>
                        </div>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            id: '6',
            width: '230px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'storageType',
            id: '2',
            width: '160px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: GENERAL.DB_HOST_INSTANCE_ID,
            accessor: 'instanceListText',
            id: '3',
            width: '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                let instanceList: any = cellData ? cellData.split(',') : null;
                return (
                    <>
                        {instanceList && (
                            <div>
                                {instanceList?.[0] && (
                                    <Typography
                                        variant="Regular_13"
                                        className={`${styles.colText}`}
                                        title={instanceList[0]}
                                    >
                                        {instanceList[0]}
                                    </Typography>
                                )}
                                {instanceList?.[1] && (
                                    <Typography
                                        variant="Regular_13"
                                        className={`${styles.colText}`}
                                        title={instanceList[1]}
                                    >
                                        {instanceList[1]}
                                    </Typography>
                                )}
                            </div>
                        )}
                        {!instanceList && rowData?.loading && <DsFlashingDotsLoader />}
                        {!instanceList && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'allocatedCapacityText',
            id: '4',
            width: '200px',
            isSortable: true,
            accessorForTextFilter: 'allocatedCapacityText',
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(cellData, rowData);
            }
        },
        {
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'azType',
            id: '5',
            width: '180px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => {
                return renderUnmanagedAZ(cellData, rowData, styles);
            }
        },
        {
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'totalCost',
            id: '7',
            width: '176px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                return renderEstimatedCost(cellData, rowData, styles);
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
