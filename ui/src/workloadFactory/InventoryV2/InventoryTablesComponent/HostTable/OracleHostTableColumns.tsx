import { TFunction } from 'i18next';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { Button, Popover, Typography } from '@netapp/design-system';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import styles from '../InventoryTable.module.scss';
import { INVENTORY_STATUS, SSM_TROUBLESHOOTING_LINK } from '../../../../utils/consts';
import { getFilterOptions } from '../../../../utils/utilityFunctions';
import { renderCellData, renderEstimatedCost, renderInstanceListText, renderVpcText } from '../../InventoryUtilsV2';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import { GENERAL } from '../../../../utils/appConstants';

export function OracleHostTableColDefs({ t, hostTableRows }: { t: TFunction; hostTableRows: any[] }): ColumnProps[] {
    const allColumns: ColumnProps[] = [
        {
            id: '0',
            Header: t('databases.host-table.headers.host-name'),
            accessor: 'nameForSorting',
            isSortable: true,
            width: '228px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div className={styles.firstColumnClass}>
                        <DsTypography
                            title={name || t('databases.general.not-available-table-columns')}
                            className={styles.textClass}
                            variant="Semibold_14"
                        >
                            {name || t('databases.general.not-available-table-columns')}
                        </DsTypography>
                        <div className={styles.firstColText}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP ||
                                rowData?.status === INVENTORY_STATUS.ONLINE) && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN ||
                                rowData?.status === INVENTORY_STATUS.OFFLINE) && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.unknown}`} />
                            )}
                            <DsTypography variant="Regular_13">
                                {(() => {
                                    if (
                                        rowData?.status === INVENTORY_STATUS.RUNNING ||
                                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                    ) {
                                        return INVENTORY_STATUS.ONLINE;
                                    }
                                    if (
                                        rowData?.status === INVENTORY_STATUS.STOPPED ||
                                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                    ) {
                                        return INVENTORY_STATUS.OFFLINE;
                                    }
                                    if (rowData?.status) {
                                        return rowData?.status;
                                    }
                                    if (rowData?.loading) {
                                        return <DsFlashingDotsLoader />;
                                    }
                                    return INVENTORY_STATUS.UNKNOWN;
                                })()}
                            </DsTypography>
                        </div>
                    </div>
                );
            }
        },
        {
            id: '1',
            Header: t('databases.host-table.headers.registered-instances'),
            accessor: 'totalInstance',
            width: '200px',
            isSortable: true,
            accessorForTextFilter: 'sqlServerInstancesText',
            renderCell: (cellData: any, rowData: any) => (
                <div>
                    {cellData && rowData?.sqlServerInstancesText && cellData !== 0 ? (
                        <>
                            {/* <Typography variant="Semibold_14">
                                    {cellData === 1 ? cellData + ' instance' : cellData + ' instances'}
                                </Typography> */}
                            <Typography variant="Regular_13">{rowData?.sqlServerInstancesText}</Typography>
                        </>
                    ) : (
                        ''
                    )}
                    {!cellData || !rowData?.sqlServerInstancesText
                        ? t('databases.general.not-available-table-columns')
                        : ''}
                </div>
            )
        },
        {
            id: '2',
            Header: t('databases.host-table.headers.deployment-model'),
            accessor: 'serverAllInstallationModeText',
            width: '236px',
            filterOptions: getFilterOptions(hostTableRows, 'serverAllInstallationModeText'),
            renderCell: (cellData: string, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '3',
            Header: t('databases.host-table.headers.attached-ec2-nodes'),
            accessor: 'instanceListText',
            isSortable: true,
            width: '329px',
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => renderInstanceListText(cellData, rowData, styles)
        },
        {
            id: '4',
            Header: t('databases.host-table.headers.vpc'),
            accessor: 'vpcName',
            isSortable: true,
            width: '150px',
            renderCell: (cellData: any, rowData: any) => renderVpcText(cellData, rowData, styles)
        },
        {
            id: '5',
            Header: t('databases.host-table.headers.ssm-connectivity'),
            accessor: 'ssmState',
            width: '200px',
            filterOptions: getFilterOptions(hostTableRows, 'ssmState'),
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.firstColText}>
                    {rowData?.ssmState === INVENTORY_STATUS.ONLINE && (
                        <>
                            <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                            <Typography variant="Regular_13">{rowData?.ssmState}</Typography>
                        </>
                    )}
                    {rowData?.ssmState === INVENTORY_STATUS.OFFLINE && (
                        <>
                            <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                            <Typography variant="Regular_13">{rowData?.ssmState}</Typography>

                            <div className={styles.ssmOffline}>
                                <Popover
                                    popoverClass=""
                                    children={
                                        <div>
                                            <Typography variant="Regular_14">{GENERAL.SSM_NO_CONNECTION[0]}</Typography>
                                            <Button
                                                className={styles.ssmLink}
                                                variant="link"
                                                onClick={() =>
                                                    window.open(SSM_TROUBLESHOOTING_LINK, '_blank', 'noopener')
                                                }
                                            >
                                                {GENERAL.SSM_NO_CONNECTION[1]}
                                            </Button>
                                        </div>
                                    }
                                    trigger="hover"
                                    delayHide={200}
                                    interactive
                                    isAppendedToBody
                                    container={<TooltipIcon />}
                                />
                            </div>
                        </>
                    )}
                </div>
            )
        },
        {
            id: '6',
            Header: t('databases.host-table.headers.estimated-cost'),
            accessor: 'totalCost',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any, rowData: any) => renderEstimatedCost(cellData, rowData, styles)
        },
        {
            id: '7',
            Header: t('databases.host-table.oracle.headers.operating-system'),
            accessor: 'operatingSystem',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '8',
            Header: t('databases.host-table.oracle.headers.fsx-for-ontap'),
            accessor: 'fsxForOntap',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '9',
            Header: t('databases.host-table.headers.aws-credentials'),
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: getFilterOptions(hostTableRows, 'credentialName'),
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '10',
            Header: t('databases.host-table.headers.aws-account'),
            accessor: 'accountId',
            isSortable: true,
            filterOptions: getFilterOptions(hostTableRows, 'accountId'),
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '11',
            Header: t('databases.host-table.headers.region'),
            accessor: 'regionName',
            isSortable: true,
            filterOptions: getFilterOptions(hostTableRows, 'regionName'),
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        }
    ];
    return allColumns;
}
