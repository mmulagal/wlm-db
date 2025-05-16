import { Table, useTable, TableTopBar, Typography, TooltipInfo } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';

import styles from './DatabaseListTable.module.scss';
import { WorkloadFactoryDatabaseItem } from '../../../utils/types/workloadFactoryResourceTypes';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSize } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { getProtectionText, isAwsBackupEnabledText } from '../../InventoryV2/InventoryUtilsV2';
import { PROTECTION_TEXT_STATUS } from '../../../utils/consts';
import DatabaseHostOverviewApiV2 from '../ResourceHomePage/DatabaseHostOverviewApiV2';

const DatabaseListTable = () => {
    const data: WorkloadFactoryDatabaseItem[] = useAppSelector(state => state.workloadFactoryResource.databaseList);
    const databaseListLoading = useAppSelector(state => state.workloadFactoryResource.databaseListLoading);

    DatabaseHostOverviewApiV2();

    const formatData = (tableData: WorkloadFactoryDatabaseItem[]) => {
        return tableData?.map(perRow => {
            let protectionText = getProtectionText(perRow);
            let protectionVal = '';
            if (protectionText === PROTECTION_TEXT_STATUS.YES) {
                protectionVal = GENERAL.PROTECTED;
            } else if (protectionText === PROTECTION_TEXT_STATUS.NO) {
                protectionVal = GENERAL.NOT_PROTECTED;
            } else {
                protectionVal = GENERAL.NOT_AVAILABLE;
            }
            return {
                ...perRow,
                isProtected: protectionVal
            };
        });
    };

    const protectionTooltipText = (data: any) => {
        return (
            <div className={styles.protectionTooltip}>
                <Typography variant="Semibold_13" className={styles.textHeight}>
                    {GENERAL.PROTECTED_BY}:
                </Typography>
                {data.map((val: any, index: number) => (
                    <Typography key={index} variant="Regular_13" className={styles.textHeight}>
                        {val}
                    </Typography>
                ))}
            </div>
        );
    };

    const notAvailable = () => {
        return (
            <Typography variant="Regular_13" className={styles.colText}>
                {GENERAL.NOT_AVAILABLE}
            </Typography>
        );
    };

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: GENERAL.DATABASE_NAME,
            accessor: 'name',
            isSortable: true,
            id: '1',
            width: '19.3%'
        },
        {
            Header: GENERAL.STATUS,
            accessor: 'status',
            filterOptions: 'auto',
            id: '2',
            width: '11.2%',
            renderCell: (cellData: any) => {
                return (
                    <div className={styles.statusCell}>
                        <div
                            className={`${styles.statusIcon} ${
                                cellData === 'ONLINE' ? styles.onIcon : cellData === 'OFFLINE' ? styles.offIcon : ''
                            }`}
                        ></div>
                        <Typography variant="Regular_14">{cellData}</Typography>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.SIZE,
            accessor: 'size',
            isSortable: true,
            id: '3',
            width: '15%',
            renderCell: (cellData: any) => {
                return formatSize(cellData);
            }
        },
        {
            Header: GENERAL.DB_HOST_PROTECTION_TYPE,
            accessor: 'isProtected',
            filterOptions: 'auto',
            id: '4',
            width: '15%',
            renderCell: (cellData: any, rowData: any) => {
                const protectionData = rowData?.protection;
                let protectedByList = [];
                let awsBackup = isAwsBackupEnabledText(rowData, '');
                if (
                    protectionData?.isFsxOntapSnapshotsEnabled &&
                    String(protectionData?.isFsxOntapSnapshotsEnabled)?.toLowerCase() !== GENERAL.NOT_AVAILABLE
                ) {
                    protectedByList.push(GENERAL.FSX_ONTAP_SNAPSHOTS);
                }
                if (awsBackup && String(awsBackup)?.toLowerCase() !== GENERAL.NOT_AVAILABLE) {
                    protectedByList.push(GENERAL.AWS_BACKUP);
                }
                if (
                    protectionData?.isSqlNativeEnabled &&
                    String(protectionData?.isSqlNativeEnabled)?.toLowerCase() !== GENERAL.NOT_AVAILABLE
                ) {
                    protectedByList.push(GENERAL.SQL_SERVER_BACKUP);
                }

                return (
                    <>
                        {protectionData && (
                            <div className={styles.colText}>
                                <div className={styles.protection}>
                                    {cellData === GENERAL.PROTECTED && (
                                        <ProtectedIcon
                                            style={{
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--green-60)'
                                            }}
                                        />
                                    )}
                                    {cellData === GENERAL.NOT_PROTECTED && (
                                        <NotProtectedIcon
                                            style={{
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--grey-45)'
                                            }}
                                        />
                                    )}
                                    <Typography variant="Regular_14">{cellData}</Typography>
                                </div>
                                {protectedByList?.length > 0 && (
                                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                        {protectionTooltipText(protectedByList)}
                                    </TooltipInfo>
                                )}
                            </div>
                        )}
                        {!protectionData && notAvailable()}
                    </>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_TYPE,
            accessor: 'type',
            filterOptions: 'auto',
            id: '5',
            width: '15%'
        },
        {
            Header: GENERAL.DB_HOST_COLLATION,
            accessor: 'collation',
            isSortable: true,
            id: '6',
            width: '24.6%',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        columns: EncryptionColDefs,
        rows: formatData(data),
        pageSize: 50,
        isLazyLoading: databaseListLoading
    });
    return (
        <div className={styles.databaseListTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={'Databases'}
                singularTitle={'Database'}
            />
            <Table
                //@ts-ignore
                tableProps={tableProps}
            />
        </div>
    );
};

export default DatabaseListTable;
