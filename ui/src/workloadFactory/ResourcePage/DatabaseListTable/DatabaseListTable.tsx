import { Table, useTable, TableTopBar, Typography, TooltipInfo } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';

import styles from './DatabaseListTable.module.scss';
import { WorkloadFactoryDatabaseItem } from '../../../utils/types/workloadFactoryResourceTypes';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSize, isAwsBackupEnabled } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';

const DatabaseListTable = () => {
    const data: WorkloadFactoryDatabaseItem[] = useAppSelector(state => state.workloadFactoryResource.databaseList);
    const databaseListLoading = useAppSelector(state => state.workloadFactoryResource.databaseListLoading);

    const formatData = (tableData: WorkloadFactoryDatabaseItem[]) => {
        return tableData?.map(perRow => {
            let isProtected = GENERAL.NOT_PROTECTED;
            if (
                isAwsBackupEnabled(perRow) ||
                perRow?.protection?.isFsxOntapSnapshotsEnabled ||
                perRow?.protection?.isSqlNativeEnabled
            ) {
                isProtected = GENERAL.PROTECTED;
            }
            return {
                ...perRow,
                isProtected: isProtected
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
            Header: GENERAL.DB_HOST_PROTECTION,
            accessor: 'isProtected',
            filterOptions: 'auto',
            id: '4',
            width: '15%',
            renderCell: (cellData: any, rowData: any) => {
                const protectionData = rowData?.protection;
                let protectedChk = false;
                if (
                    isAwsBackupEnabled(rowData) ||
                    protectionData?.isFsxOntapSnapshotsEnabled ||
                    protectionData?.isSqlNativeEnabled
                ) {
                    protectedChk = true;
                }
                let protectedByList = [];
                if (protectionData?.isFsxOntapSnapshotsEnabled) {
                    protectedByList.push(GENERAL.FSX_ONTAP_SNAPSHOTS);
                }
                if (isAwsBackupEnabled(rowData)) {
                    protectedByList.push(GENERAL.AWS_BACKUP);
                }
                if (protectionData?.isSqlNativeEnabled) {
                    protectedByList.push(GENERAL.SQL_SERVER_BACKUP);
                }
                return (
                    <>
                        {protectionData && (
                            <div className={styles.colText}>
                                <div className={styles.protection}>
                                    {protectedChk && (
                                        <ProtectedIcon
                                            style={{
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--green-60)'
                                            }}
                                        />
                                    )}
                                    {!protectedChk && (
                                        <NotProtectedIcon
                                            style={{
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--grey-45)'
                                            }}
                                        />
                                    )}
                                    <Typography variant="Regular_14">
                                        {protectedChk ? GENERAL.PROTECTED : GENERAL.NOT_PROTECTED}
                                    </Typography>
                                </div>
                                {protectedChk && (
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
            Header: '',
            accessor: '',
            id: '6',
            width: '24.6%'
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
