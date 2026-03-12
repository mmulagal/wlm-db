import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useTable } from '../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import { Table, ColumnProps } from '../../../common/Lib/Table/Table';
import { WorkloadFactoryDatabaseItem } from '../../../utils/types/workloadFactoryResourceTypes';
import { formatSize } from '../../../utils/utilityFunctions';
import { getProtectionText } from '../../InventoryV2/InventoryUtilsV2';
import { PROTECTION_TEXT_STATUS, DATABASE_STATUS } from '../../../utils/consts';
import ProtectionIcons from '../../../common/ProtectionIcons/ProtectionIcons';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import styles from './ResourcePageReplicaTable.module.scss';

type ResourcePageReplicaTableProps = {
    width?: number;
    replicaDatabases: WorkloadFactoryDatabaseItem[];
    isLoading?: boolean;
};

const ResourcePageReplicaTable = ({ width, replicaDatabases, isLoading }: ResourcePageReplicaTableProps) => {
    const { t } = useTranslation();
    const notAvailableText = t('databases.general.not-available');

    const columns: ColumnProps[] = [
        {
            Header: t('databases.general.database-name'),
            accessor: 'name',
            id: 'r1',
            width: '14%',
            renderCell: (cellData: any, rowData: any) => (
                <div>
                    <DsTypography variant="Semibold_14">{cellData || notAvailableText}</DsTypography>
                    <div className={styles.statusCell}>
                        <div
                            className={`${styles.statusIcon} ${
                                rowData?.status === DATABASE_STATUS.ONLINE
                                    ? styles.onIcon
                                    : rowData?.status === DATABASE_STATUS.OFFLINE
                                    ? styles.offIcon
                                    : ''
                            }`}
                        />
                        <DsTypography variant="Regular_13">{rowData?.status || notAvailableText}</DsTypography>
                    </div>
                </div>
            )
        },
        {
            Header: t('databases.general.instance-name'),
            accessor: 'databaseInstanceName',
            id: 'r2',
            width: '12%',
            filterOptions: 'auto',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13">{cellData || notAvailableText}</DsTypography>
            )
        },
        {
            Header: t('databases.general.host-name'),
            accessor: 'replicaHostName',
            id: 'r3',
            width: '12%',
            filterOptions: 'auto',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13">{cellData || notAvailableText}</DsTypography>
            )
        },
        {
            Header: t('databases.general.role'),
            accessor: 'replicaRole',
            id: 'r4',
            width: '10%',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13">
                    {cellData
                        ? `${cellData.charAt(0).toUpperCase()}${cellData.slice(1).toLowerCase()} ${t(
                              'databases.general.replica'
                          )}`
                        : t('databases.general.secondary-replica')}
                </DsTypography>
            )
        },
        {
            Header: t('databases.general.protection-type'),
            accessor: 'isProtected',
            id: 'r5',
            width: '14%',
            filterOptions: 'auto',
            renderCell: (_cellData: any, rowData: any) => {
                const protectionData = rowData?.protection;
                if (!protectionData) {
                    return <DsTypography variant="Regular_13">{notAvailableText}</DsTypography>;
                }
                return (
                    <div className={styles.colText}>
                        <div className={styles.protection}>
                            <div className={commonStyles.protectionIcons}>
                                <ProtectionIcons protectionData={protectionData} />
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            Header: t('databases.general.type'),
            accessor: 'type',
            id: 'r6',
            width: '10%',
            filterOptions: 'auto',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13">{cellData || notAvailableText}</DsTypography>
            )
        },
        {
            Header: t('databases.general.size'),
            accessor: 'size',
            id: 'r7',
            width: '9%',
            renderCell: (cellData: any) => formatSize(cellData)
        },
        {
            Header: t('databases.general.sync-state'),
            accessor: 'synchronizationState',
            id: 'r8',
            width: '12%',
            filterOptions: 'auto',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13">{cellData || notAvailableText}</DsTypography>
            )
        }
    ];

    const formattedRows = replicaDatabases?.map(row => {
        const protectionText = getProtectionText(row);
        let protectionVal = '';
        if (protectionText === PROTECTION_TEXT_STATUS.YES) {
            protectionVal = t('databases.general.protected');
        } else if (protectionText === PROTECTION_TEXT_STATUS.NO) {
            protectionVal = t('databases.general.not_protected');
        } else {
            protectionVal = t('databases.general.not-available-table-columns');
        }
        return { ...row, isProtected: protectionVal };
    });

    const tableProps = useTable({
        isSorting: false,
        columns,
        rows: formattedRows,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: isLoading
    });

    return (
        <div className={styles.replica} style={width ? { width: `${width}px` } : undefined}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.general.replicas')}
                singularTitle={t('databases.general.replica')}
                className={styles.replicaTopBar}
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
                variant="innerTable"
                isDoubleRow
            />
        </div>
    );
};

export default ResourcePageReplicaTable;
