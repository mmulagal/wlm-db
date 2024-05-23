import { Table, useTable, Typography, TableTopBar, Popover, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ExploreSavingsTable.module.scss';
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
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const ExploreSavingsTable = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventory.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

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
            accessor: 'databaseServerName',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '280px',
            accessorForTextFilter: 'databaseHostname',
            renderCell: (cellData: any, rowData: any) => {
                return renderUnmanagedHostName(cellData, rowData, styles);
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            id: '6',
            width: '230px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return renderDeploymentModel(cellData, rowData);
            }
        },
        {
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'fileSystemType',
            id: '2',
            width: '160px',
            filterOptions: 'auto',
            accessorForTextFilter: 'fileSystemType',
            renderCell: (cellData: string, rowData: any) => {
                return renderFileSystemType(cellData, rowData);
            }
        },
        {
            Header: GENERAL.DB_HOST_INSTANCE_ID,
            accessor: 'clusterEc2Instances',
            id: '3',
            width: '200px',
            accessorForTextFilter: 'clusterEc2Instances',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        {cellData && (
                            <div className={CommonStyles.wrapTextIn2Line}>
                                <Typography variant="Regular_13" className={styles.colText}>
                                    {cellData}
                                </Typography>
                            </div>
                        )}
                        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!cellData && cellData !== 0 && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'sizeformat',
            id: '4',
            width: '200px',
            isSortable: true,
            accessorForTextFilter: 'sizeformat',
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
        rows: unManagedHostFormatedList || [],
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

export default ExploreSavingsTable;
