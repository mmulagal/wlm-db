import { TFunction } from 'i18next';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { DsTooltipInfo, Popover } from '@netapp/design-system';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import styles from '../InventoryTable.module.scss';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { formatSize, getFilterOptions } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import ProtectionIcons from '../../../../common/ProtectionIcons/ProtectionIcons';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';

export function OraclePDBTableColDefs({
    t,
    databaseTableRows
}: {
    t: TFunction;
    databaseTableRows: any[];
}): ColumnProps[] {
    const allColumns: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.pdb-table.headers.pdb-name'),
            accessor: 'name',
            isSortable: true,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                        <div className={styles.firstColText}>
                            {rowData?.status === 'ONLINE' && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                            )}
                            {rowData?.status === 'OFFLINE' && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.unknown}`} />
                            )}
                            <DsTypography variant="Regular_13">
                                {rowData?.status === 'ONLINE'
                                    ? INVENTORY_STATUS.ONLINE
                                    : rowData?.status === 'OFFLINE'
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
            Header: t('databases.pdb-table.headers.cdb-name'),
            accessor: 'databaseInstanceName',
            id: '2',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.pdb-table.headers.host-name'),
            accessor: 'hostName',
            id: '3',
            width: '200px',
            filterOptions: getFilterOptions(databaseTableRows, 'hostName'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.pdb-table.headers.protection-status'),
            accessor: 'isProtected',
            id: '4',
            width: '300px',
            filterOptions: getFilterOptions(databaseTableRows, 'isProtected'),
            renderCell: (cellData: any, rowData: any) => {
                const protectionData = rowData?.protection;

                return (
                    <>
                        {protectionData && (
                            <div className={styles.colTextProtection}>
                                <div className={styles.protection}>
                                    <div className={commonStyles.protectionIcons}>
                                        <ProtectionIcons protectionData={protectionData} />
                                    </div>
                                </div>
                            </div>
                        )}
                        {!protectionData && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            Header: t('databases.pdb-table.headers.database-size'),
            accessor: 'sizeRange',
            csvAccessor: t('databases.pdb-table.headers.database-size'),
            id: '5',
            width: '200px',
            filterOptions: [
                { label: '0 - 100 MiB', value: '0 - 100 MiB' },
                { label: '100 MiB - 1 GiB', value: '100 MiB - 1 GiB' },
                { label: '1 GiB - 10 GiB', value: '1 GiB - 10 GiB' },
                { label: '10 GiB - 5 TiB', value: '10 GiB - 5 TiB' },
                { label: '5 TiB+', value: '5 TiB+' }
            ],
            renderCell: (cellData: any, rowData: any) => formatSize(rowData?.size)
        },
        {
            id: '6',
            Header: t('databases.pdb-table.headers.fsx-for-ontap'),
            accessor: 'instanceRow.fileSystemName',
            isSortable: false,
            filterOptions: getFilterOptions(databaseTableRows, 'instanceRow.fileSystemName'),
            width: '213px',
            renderCell: (cellData: any, rowData: any) => (
                <>
                    {cellData && rowData?.instanceRow?.fsxId ? (
                        <div className={styles.fsxNameContainer}>
                            <DsTooltipInfo className={`${styles.fsxName} ${styles['tooltip-icon']}`} trigger="hover">
                                <div className={`${styles.tooltipContainer} ${styles.fsxNamePopOver}`}>
                                    <DsTypography variant="Regular_13">{rowData?.instanceRow?.fsxId}</DsTypography>
                                    <Popover
                                        popoverClass={styles['copy-popover']}
                                        children="Copied"
                                        container={
                                            <CopyToClipboardCommon
                                                value={rowData?.instanceRow?.fsxId}
                                                iconProvided={<CopyIcon fill="#A7A7A7" />}
                                            />
                                        }
                                    />
                                </div>
                            </DsTooltipInfo>
                            <div className={styles.fsxName}>
                                <DsTypography
                                    className={styles.fsxNameText}
                                    variant="Regular_13"
                                    title={cellData || GENERAL.NOT_AVAILABLE}
                                >
                                    {cellData || GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </div>
                        </div>
                    ) : (
                        <DsTypography variant="Regular_13" className={styles.colText}>
                            {GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    )}
                </>
            )
        },
        {
            Header: t('databases.databases-table.headers.aws-credentials'),
            accessor: 'credentialName',
            id: '7',
            width: '184px',
            isSortable: true,
            filterOptions: getFilterOptions(databaseTableRows, 'credentialName'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.aws-account'),
            accessor: 'accountId',
            id: '8',
            width: '184px',
            filterOptions: getFilterOptions(databaseTableRows, 'accountId'),
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.region'),
            accessor: 'regionName',
            id: '9',
            width: '184px',
            isSortable: true,
            filterOptions: getFilterOptions(databaseTableRows, 'regionName'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        }
    ];

    return allColumns;
}

export const oraclePDBColumnFilterMap = {
    hostName: '3', // id of host name column
    credentialName: '7', // id of credential name column
    regionName: '9' // id of region column
};
