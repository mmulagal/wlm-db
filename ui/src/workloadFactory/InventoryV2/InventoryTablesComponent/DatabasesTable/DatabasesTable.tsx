import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { initialDatabaseTableColState } from '../../../../utils/manageColumnUtils';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setSelectedFilterValue } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';

const DatabasesTable = () => {
    const { selectedInventoryTab, selectedFilterValue } = useAppSelector(state => state.inventoryV2);
    const dispatch = useDispatch();
    const mockdata: any = [];
    // const mockdata = [
    //     {
    //         databaseName: 'Database name 1',
    //         id: '1',
    //         status: 'Running',
    //         hostName: 'Database hostname 1',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 1',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 2',
    //         hostName: 'Database hostname 1',
    //         id: '2',
    //         status: 'Running',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 2',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 3',
    //         hostName: 'Host name 3',
    //         id: '3',
    //         status: 'Running',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 3',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 4',
    //         hostName: 'Host name 4',
    //         status: 'Running',
    //         id: '4',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 4',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 5',
    //         hostName: 'Host name 5',
    //         status: 'Running',
    //         id: '5',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 5',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 6',
    //         hostName: 'Host name 6',
    //         status: 'Running',
    //         id: '6',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 6',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 7',
    //         hostName: 'Host name 7',
    //         status: 'Running',
    //         id: '7',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 7',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 8',
    //         hostName: 'Host name 8',
    //         status: 'Running',
    //         id: '8',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 8',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 9',
    //         hostName: 'Host name 9',
    //         status: 'Running',
    //         id: '9',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 9',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     },
    //     {
    //         databaseName: 'Database name 10',
    //         hostName: 'Host name 10',
    //         status: 'Running',
    //         id: '10',
    //         engineType: 'MS SQL Server',
    //         instanceName: 'Instance name 10',
    //         protectionStatus: 'Protected',
    //         databaseType: 'USer database',
    //         databaseSize: '1.5 TiB',
    //         awsCredentials: 'AWS credentials',
    //         awsAccount: 'AWS account',
    //         region: 'US West'
    //     }
    // ];

    const getInitialFilter = () => {
        if (selectedInventoryTab === 'Databases' && selectedFilterValue?.flag === true) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
            return {
                textFilter: '',
                count: 1,
                columns: {
                    '2': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        } else {
            return undefined;
        }
    };

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Database name',
            accessor: 'name',
            isSortable: true,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.databaseName;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                        <div className={styles.firstColText}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP ||
                                rowData?.status === INVENTORY_STATUS.ONLINE) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN ||
                                rowData?.status === INVENTORY_STATUS.OFFLINE) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                            )}
                            <DsTypography variant="Regular_13">
                                {rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                    ? INVENTORY_STATUS.ONLINE
                                    : rowData?.status === INVENTORY_STATUS.STOPPED ||
                                      rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                    ? INVENTORY_STATUS.OFFLINE
                                    : rowData?.status}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && 'Unknown'}
                            </DsTypography>
                        </div>
                    </div>
                );
            }
        },
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '2',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Engine type',
            accessor: 'engineType',
            id: '3',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Instance name',
            accessor: 'instanceName',
            id: '4',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Protection status',
            accessor: 'protectionStatus',
            id: '5',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Database Type',
            accessor: 'databaseType',
            id: '6',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Database size',
            accessor: 'databaseSize',
            id: '7',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'AWS credentials',
            accessor: 'awsCredentials',
            id: '8',
            width: '184px',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'AWS account',
            accessor: 'awsAccount',
            id: '9',
            width: '184px',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Region',
            accessor: 'region',
            id: '10',
            width: '184px',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        }
    ];
    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: mockdata,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: false,
        initialFilterState: getInitialFilter(),
        initialColumnState: initialDatabaseTableColState
    });
    return (
        <>
            <div className={styles.inventoryTable}>
                <div
                    //  @ts-ignore
                    className={styles.table}
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle="Databases"
                        singularTitle="Database"
                        exportToCsvOptions={{ fileName: 'databaseTable.csv' }}
                        className={styles.topBarStyle}
                        subTitle="This table may display duplicate records for the same resource, as each resource can be linked to multiple sets of credentials."
                    />
                    <Table
                        //@ts-ignore
                        tableProps={tableProps}
                        isDoubleRow={true}
                    />
                </div>
            </div>
        </>
    );
};

export default DatabasesTable;
