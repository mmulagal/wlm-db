import { TFunction } from 'i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { Popover, TooltipInfo } from '@netapp/design-system';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import styles from '../InventoryTable.module.scss';
import { DBType, REPLICA_ROLES } from '../../../../utils/consts';
import {
    createNACustomFilter,
    formatSize,
    getFilterOptions,
    getFilterOptionsWithNA
} from '../../../../utils/utilityFunctions';
import ProtectionIcons from '../../../../common/ProtectionIcons/ProtectionIcons';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import InventoryStatusIndicator from '../../../../common/InventoryStatusIndicator/InventoryStatusIndicator';

export function MssqlPgsqlDatabaseTableColDefs({
    t,
    databaseTableRows,
    databaseType
}: {
    t: TFunction;
    databaseTableRows: any[];
    databaseType?: string;
}): ColumnProps[] {
    const allColumns: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.databases-table.headers.database-name'),
            accessor: 'name',
            isSortable: true,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">
                            {name || t('databases.general.not-available-table-columns')}
                        </DsTypography>
                        <div className={styles.firstColText}>
                            <InventoryStatusIndicator status={rowData?.status} loading={rowData?.loading} />
                        </div>
                    </div>
                );
            }
        },
        {
            Header: t('databases.databases-table.headers.instance-name'),
            accessor: 'databaseInstanceName',
            id: '2',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.databases-table.headers.host-name'),
            accessor: 'hostName',
            id: '3',
            width: '200px',
            filterOptions: getFilterOptions(databaseTableRows, 'hostName'),
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
        },
        ...(databaseType === DBType.MSSQL
            ? [
                  {
                      Header: t('databases.databases-table.headers.deployment-model'),
                      accessor: 'serverInstallationMode',
                      id: '11',
                      width: '200px',
                      filterOptions: getFilterOptions(databaseTableRows, 'serverInstallationMode'),
                      renderCell: (cellData: string) => (
                          <DsTypography variant="Regular_13" className={styles.colText} title={cellData}>
                              {cellData || t('databases.general.not-available-table-columns')}
                          </DsTypography>
                      )
                  },
                  {
                      Header: t('databases.databases-table.headers.availability-group'),
                      accessor: 'availabilityGroup',
                      id: '12',
                      width: '200px',
                      filterOptions: getFilterOptionsWithNA(
                          databaseTableRows,
                          'availabilityGroup',
                          t('databases.general.not-available-table-columns')
                      ),
                      customFilter: createNACustomFilter,
                      renderCell: (cellData: string, rowData: any) => {
                          if (cellData) {
                              return (
                                  <div className={styles.firstColumnClass}>
                                      <DsTypography variant="Regular_13" className={styles.colText}>
                                          {cellData || t('databases.general.not-available-table-columns')}
                                      </DsTypography>
                                      {rowData?.isPrimary && (
                                          <div className={styles.firstColText}>
                                              <DsTypography variant="Regular_13" className={styles.colText}>
                                                  {`${t('databases.general.primary')} | ${
                                                      rowData.totalReplicaCount || 0
                                                  } ${
                                                      rowData.totalReplicaCount <= 1
                                                          ? t('databases.general.replica')
                                                          : t('databases.general.replicas')
                                                  }`}
                                              </DsTypography>
                                          </div>
                                      )}
                                      {rowData?.replicaRole === REPLICA_ROLES.SECONDARY && (
                                          <div className={styles.firstColText}>
                                              <DsTypography variant="Regular_13" className={styles.colText}>
                                                  {`${t('databases.general.secondary-replica')}`}
                                              </DsTypography>
                                          </div>
                                      )}
                                  </div>
                              );
                          }
                          return (
                              <div className={styles.naWithTooltip}>
                                  <TooltipInfo trigger="hover">
                                      <div>
                                          <DsTypography variant="Regular_13">
                                              {t('databases.general.availability-group-na-tooltip')}
                                          </DsTypography>
                                      </div>
                                  </TooltipInfo>
                                  <DsTypography variant="Regular_13" className={styles.colText}>
                                      {t('databases.general.not-available-table-columns')}
                                  </DsTypography>
                              </div>
                          );
                      }
                  }
              ]
            : []),
        {
            Header: t('databases.databases-table.headers.protection-status'),
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
                        {!protectionData && t('databases.general.not-available-table-columns')}
                    </>
                );
            }
        },
        {
            Header: t('databases.databases-table.headers.database-type'),
            accessor: 'type',
            id: '5',
            width: '200px',
            filterOptions: getFilterOptions(databaseTableRows, 'type'),
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.databases-table.headers.database-size'),
            accessor: 'sizeRange',
            csvAccessor: t('databases.databases-table.headers.database-size'),
            id: '6',
            width: '200px',
            filterOptions: [
                { label: '0 - 100 MiB', value: '0 - 100 MiB' },
                { label: '100 MiB - 1 GiB', value: '100 MiB - 1 GiB' },
                { label: '1 GiB - 10 GiB', value: '1 GiB - 10 GiB' },
                { label: '10 GiB - 5 TiB', value: '10 GiB - 5 TiB' },
                { label: '5 TiB+', value: '5 TiB+' }
            ],
            renderCell: (cellData: any, rowData: any) =>
                formatSize(rowData?.size) || t('databases.general.not-available-table-columns')
        },
        {
            id: '7',
            Header: t('databases.databases-table.headers.fsx-for-ontap'),
            accessor: 'instanceRow.fileSystemName',
            isSortable: false,
            filterOptions: getFilterOptions(databaseTableRows, 'instanceRow.fileSystemName'),
            width: '213px',
            renderCell: (cellData: any, rowData: any) => (
                <>
                    {cellData && rowData?.instanceRow?.fsxId ? (
                        <div className={styles.fsxNameContainer}>
                            <TooltipInfo className={`${styles.fsxName} ${styles['tooltip-icon']}`} trigger="hover">
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
                            </TooltipInfo>
                            <div className={styles.fsxName}>
                                <DsTypography
                                    className={styles.fsxNameText}
                                    variant="Regular_13"
                                    title={cellData || t('databases.general.not-available-table-columns')}
                                >
                                    {cellData || t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            </div>
                        </div>
                    ) : (
                        <DsTypography variant="Regular_13" className={styles.colText}>
                            {t('databases.general.not-available-table-columns')}
                        </DsTypography>
                    )}
                </>
            )
        },
        {
            Header: t('databases.databases-table.headers.aws-credentials'),
            accessor: 'credentialName',
            id: '8',
            width: '184px',
            isSortable: true,
            filterOptions: getFilterOptions(databaseTableRows, 'credentialName'),
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.databases-table.headers.aws-account'),
            accessor: 'accountId',
            id: '9',
            width: '184px',
            filterOptions: getFilterOptions(databaseTableRows, 'accountId'),
            isSortable: true,
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.databases-table.headers.region'),
            accessor: 'regionName',
            id: '10',
            width: '184px',
            isSortable: true,
            filterOptions: getFilterOptions(databaseTableRows, 'regionName'),
            renderCell: (cellData: string) => cellData || t('databases.general.not-available-table-columns')
        }
    ];

    return allColumns;
}

export const mssqlPgsqlDatabaseColumnFilterMap = {
    hostName: '3', // id of host name column
    credentialName: '8', // id of credential name column
    regionName: '10', // id of region column
    instanceName: '2' // id of instance name column
};
