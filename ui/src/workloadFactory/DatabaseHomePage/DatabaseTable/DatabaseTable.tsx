import { Table, TableTopBar, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './DatabaseTable.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';
import { GENERAL } from '../../../utils/appConstants';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { useRef, useState } from 'react';
import DatabaseEstimatedCost from './DatabaseEstimatedCost';
import { useAppSelector } from '../../../store/storeHooks';
import { STATUS_CONST } from '../../../utils/consts';
import { formatSizeOnePrecision } from '../../../utils/utilityFunctions';

const DatabaseTable = () => {
    const { databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsLoading } = useAppSelector(state => state.databaseHome.getDatabaseJobs);
    const databaseHostsList = useAppSelector(state => state.databaseHome.databaseHostsList);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    const menuItems = [
        {
            id: 'resourceView',
            displayName: 'View resource details'
        },
        {
            id: 'clone',
            displayName: 'Clone',
            disabled: true
        },
        {
            id: 'migrate',
            displayName: 'Migrate',
            disabled: true
        },
        {
            id: 'protect',
            displayName: 'Protect',
            disabled: true
        },
        {
            id: 'remove',
            displayName: 'Remove'
        }
    ];

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

    const lastColDetails = () => {
        return {
            id: '10',
            Header: '',
            accessor: '',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.jobMenuPopover}>
                        <MenuPopover
                            isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                            menuItems={menuItems}
                            toggleMenu={(toggleType: string, menuId: string) => {
                                if (toggleType === 'close') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(null);
                                } else if (toggleType === 'open') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(rowData.id);
                                    menuOpenedRowDetail.current = rowData.id;
                                } else if (toggleType === 'selectedOption') {
                                    menuOpenedRowDetail.current = null;
                                    setOpenedRow(null);
                                }
                            }}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                );
            },
            showHide: true,
            width: '56px',
            isSticky: true
        };
    };

    const notAvailable = () => {
        return (
            <Typography variant="Regular_13" className={styles.colText}>
                {GENERAL.NOT_AVAILABLE}
            </Typography>
        );
    };

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'status',
            isSortable: true,
            width: '280px',
            isSticky: true,
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div>
                        <Typography variant="Semibold_14">{rowData?.name || GENERAL.NOT_AVAILABLE}</Typography>
                        <div className={styles.colText}>
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
                            <Typography variant="Regular_13">{rowData?.status || GENERAL.NOT_AVAILABLE}</Typography>
                            <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">{rowData?.topology?.serverType || GENERAL.NOT_AVAILABLE}</Typography>
                        </div>
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: GENERAL.DB_HOST_PROTECTION,
            accessor: 'protection',
            isSortable: true,
            width: '184px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                let protectedChk = false;
                if (
                    cellData?.isAwsBackUpEnabled ||
                    cellData?.isFsxOntapSnapshotsEnabled ||
                    cellData?.isSqlNativeEnabled
                ) {
                    protectedChk = true;
                }
                let protectedByList = [];
                if (cellData?.isFsxOntapSnapshotsEnabled) {
                    protectedByList.push(GENERAL.FSX_ONTAP_SNAPSHOTS);
                }
                if (cellData?.isAwsBackUpEnabled) {
                    protectedByList.push(GENERAL.AWS_BACKUP);
                }
                if (cellData?.isSqlNativeEnabled) {
                    protectedByList.push(GENERAL.SQL_SERVER_BACKUP);
                }
                return (
                    <>
                        {cellData && (
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
                        {!cellData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_PERFORMANCE,
            accessor: 'performance',
            isSortable: true,
            width: '184px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData && (
                            <Typography variant="Regular_13" className={styles.colText}>
                                {cellData?.assessment + ' ( <' + cellData?.latency + ' ms )'}
                            </Typography>
                        )}
                        {!cellData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '4',
            Header: GENERAL.DB_HOST_STORAGE_SAVINGS,
            accessor: 'storage',
            isSortable: true,
            width: '184px',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData && (
                            <Typography variant="Regular_13" className={styles.colText}>
                                {cellData?.spaceSavingsPercent +
                                    '% (' +
                                    formatSizeOnePrecision(cellData?.spaceSavings) +
                                    ')'}
                            </Typography>
                        )}
                        {!cellData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'estimatedUsageCost',
            isSortable: true,
            width: '184px',
            renderCell: (cellData: any) => {
                const totalCost = cellData?.compute + cellData?.storage + cellData?.connectivity + cellData?.others;
                return (
                    <>
                        {cellData && (
                            <div className={styles.cost}>
                                <TooltipInfo className={styles.tooltipClass} onVisibleChange={function noRefCheck() {}}>
                                    {DatabaseEstimatedCost({ ...cellData, totalCost: totalCost })}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{totalCost}</Typography>
                            </div>
                        )}
                        {!cellData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '6',
            Header: GENERAL.DB_HOST_TYPE,
            accessor: 'topology.serverType',
            isSortable: true,
            width: '184px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'topology.serverInstallationMode',
            isSortable: true,
            width: '184px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_REGION,
            accessor: 'topology.region',
            isSortable: true,
            width: '184px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '9',
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'topology.fileSystemType',
            isSortable: true,
            width: '184px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: databaseHostsList || [],
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: databaseHostsLoading || databaseJobsLoading
    });

    const tableComponentProps = {
        lazyLoadingText: 'Loading'
    };

    return (
        <>
            <div className={styles.databaseTable}>
                <div
                    //  @ts-ignore
                    className={databaseHostsList?.length ? `${styles.table} ${styles.tableScroll}` : `${styles.table}`}
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle={GENERAL.DATABASE_HOSTS}
                        singularTitle={GENERAL.DATABASE_HOST}
                    />
                    <Table
                        {...tableComponentProps}
                        //@ts-ignore
                        tableProps={tableProps}
                        isDoubleRow={true}
                    />
                </div>
            </div>
        </>
    );
};

export default DatabaseTable;
