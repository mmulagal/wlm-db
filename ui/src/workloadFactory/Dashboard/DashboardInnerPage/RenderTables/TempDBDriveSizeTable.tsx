import { Table, useTable, TableTopBar, DsButton, DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../utils/consts';

interface StorageTierTableProps {
    handleDialog: (dialogType: string) => void;
}

const TempDBDriveSizeTable = ({ handleDialog }: StorageTierTableProps) => {
    const mockData = [
        {
            serverInstanceName: 'SQL Server 1',
            status: 'Running',
            percentDataDriveSize: '25%',
            hostName: 'host1',
            id: '1'
        },
        {
            serverInstanceName: 'SQL Server 2',
            status: 'Running',
            percentDataDriveSize: '25%',
            hostName: 'host1',
            id: '2'
        },
        {
            serverInstanceName: 'SQL Server 3',
            status: 'Down',
            percentDataDriveSize: '25%',
            hostName: 'host1',
            id: '3'
        },
        {
            serverInstanceName: 'SQL Server 4',
            status: 'Down',
            percentDataDriveSize: '25%',
            hostName: 'host1',
            id: '4'
        }
    ];

    const lastColDetails = () => {
        return {
            id: '4',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '318px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.buttonContainer}>
                        <DsButton isThin variant="secondary" onClick={() => handleDialog('TempDB drive size')}>
                            Optimize
                        </DsButton>
                    </div>
                );
            }
        };
    };

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance name ',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '376px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div>
                        <DsTypography variant="Semibold_14">
                            {rowData?.serverInstanceName || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                        <div className={styles.statusContainer}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
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
            width: '320px',
            filterOptions: 'auto'
        },
        {
            Header: 'Percentage of data drive size',
            accessor: 'percentDataDriveSize',
            id: '3',
            width: '320px',
            filterOptions: 'auto'
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
        columns: TableColDefs,
        rows: mockData || [],
        pageSize: 50
    });
    return (
        <div className={styles.renderTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Not-optimized instances`}
                singularTitle={'Not-optimized instance'}
            />
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default TempDBDriveSizeTable;
