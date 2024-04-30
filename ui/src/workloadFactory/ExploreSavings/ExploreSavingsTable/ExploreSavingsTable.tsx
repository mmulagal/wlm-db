import { Table, useTable, Typography, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ExploreSavingsTable.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { useAppSelector } from '../../../store/storeHooks';
import {
    renderAllocatedCapacity,
    renderDeploymentModel,
    renderEstimatedCost,
    renderFileSystemType,
    renderUnmanagedAZ,
    renderUnmanagedHostName
} from '../../Inventory/InventoryUtils';
import {
    setSelectedHostDetails,
    setSelectedInstanceId,
    setSelectedServerName
} from '../../../store/workloadFactory/exploreSavingsSlice';

const ExploreSavingsTable = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventory.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);

    const lastColDetails = () => {
        return {
            id: '7',
            Header: '',
            accessor: '',
            width: '182px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        <div
                            className={styles.detectManage}
                            onClick={() => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                                dispatch(setSelectedInstanceId(rowData?.id));
                                dispatch(
                                    setSelectedServerName(rowData?.sqlServerInstances?.[0]?.sqlServerName || 'Server name')
                                );
                                dispatch(setSelectedHostDetails(rowData));
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
            accessor: 'databaseServerName',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '324px',
            accessorForTextFilter: 'databaseHostname',
            renderCell: (cellData: any, rowData: any) => {
                return renderUnmanagedHostName(cellData, rowData, styles);
            }
        },
        {
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'fileSystemType',
            id: '2',
            width: '220px',
            filterOptions: 'auto',
            accessorForTextFilter: 'fileSystemType',
            renderCell: (cellData: string, rowData: any) => {
                return renderFileSystemType(cellData, rowData);
            }
        },
        {
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'sizeformat',
            id: '3',
            width: '220px',
            isSortable: true,
            accessorForTextFilter: 'sizeformat',
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(cellData, rowData);
            }
        },
        {
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'azType',
            id: '4',
            width: '220px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => {
                return renderUnmanagedAZ(cellData, rowData, styles);
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            id: '5',
            width: '220px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return renderDeploymentModel(cellData, rowData);
            }
        },
        {
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'totalCost',
            id: '6',
            width: '220px',
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
        rows: unManagedHostFormatedList || [],
        pageSize: 50,
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading
    });
    return (
        <div className={styles.exploreSavingTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle="Microsoft SQL server hosts"
                singularTitle="Microsoft SQL server host"
            />
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default ExploreSavingsTable;
