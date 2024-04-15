import { Table, useTable, Typography, TableTopBar, Button } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ExploreSavingsTable.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { STATUS_CONST, WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';

const ExploreSavingsTable = () => {
    const dispatch = useDispatch();
    const data = [
        {
            id: '1',
            name: 'RetailBanking',
            storageType: 'EBS',
            allocatedCapacity: '20 TiB',
            sourceHost: 'NA',
            deployment: 'Failover Cluster Instances',
            estimatedCost: 'NA',
            tag: 'Dev',
            status: 'Up',
            serverType: 'Microsoft SQL Server'
        },
        {
            id: '2',
            name: 'MFGSales',
            storageType: 'EBS',
            allocatedCapacity: '20 TiB',
            sourceHost: 'NA',
            deployment: 'Failover Cluster Instances',
            estimatedCost: 'NA',
            tag: 'QA',
            status: 'Up',
            serverType: 'Microsoft SQL Server'
        },
        {
            id: '3',
            name: 'AssetManagement',
            storageType: 'EBS',
            allocatedCapacity: '20 TiB',
            sourceHost: 'NA',
            deployment: 'Failover Cluster Instances',
            estimatedCost: 'NA',
            tag: 'QA',
            status: 'Up',
            serverType: 'Microsoft SQL Server'
        },
        {
            id: '4',
            name: 'PrivateBanking',
            storageType: 'FSXn',
            allocatedCapacity: '40 TiB',
            sourceHost: 'NA',
            deployment: 'Failover Cluster Instances',
            estimatedCost: 'NA',
            tag: 'QA',
            status: 'Up',
            serverType: 'Microsoft SQL Server'
        },
        {
            id: '5',
            name: 'HRAudit',
            storageType: 'EBS',
            allocatedCapacity: '30 TiB',
            sourceHost: 'NA',
            deployment: 'Standalone',
            estimatedCost: 'NA',
            tag: 'QA',
            status: 'Up',
            serverType: 'Microsoft SQL Server'
        }
    ];

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
                            }}
                        >
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                Explore savings
                            </Typography>
                        </div>
                    </>
                );
            }
        };
    };

    const ExploreSavingsColDefs: ColumnProps[] = [
        {
            Header: 'Database host name',
            accessor: 'name',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '324px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                        <div className={styles.firstColText}>
                            {rowData?.status === STATUS_CONST.UP && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['up']}`}></div>
                            )}
                            {rowData?.status === STATUS_CONST.DOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['down']}`}></div>
                            )}
                            {rowData?.status === STATUS_CONST.INITIALIZING && (
                                <div
                                    className={`${styles.statusIcon} ${styles['circle']} ${styles['initializing']}`}
                                ></div>
                            )}
                            {rowData?.status === STATUS_CONST.FAILED && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['failed']}`}></div>
                            )}
                            <Typography variant="Regular_13">{rowData?.status}</Typography>
                            <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">{rowData?.serverType}</Typography>
                        </div>
                    </div>
                );
            }
        },
        {
            Header: 'Storage type',
            accessor: 'storageType',
            id: '2',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: 'Allocated capacity',
            accessor: 'allocatedCapacity',
            id: '3',
            width: '220px',
            isSortable: true
        },
        {
            Header: 'Availability',
            accessor: 'sourceHost',
            id: '4',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: 'Deployment model',
            accessor: 'deployment',
            id: '5',
            width: '220px',
            isSortable: true
        },
        {
            Header: 'Estimated cost',
            accessor: 'estimatedCost',
            id: '6',
            width: '220px',
            isSortable: true
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
        rows: data,
        pageSize: 50
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
