import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { INVENTORY_ACTIONS, INVENTORY_STATUS, PROTECTION_TEXT_STATUS } from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { initialDatabaseTableColState } from '../../../../utils/manageColumnUtils';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setSelectedFilterValue } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { useEffect, useRef, useState } from 'react';
import { formatSize } from '../../../../utils/utilityFunctions';
import { getProtectionText, isAwsBackupEnabledText } from '../../InventoryUtilsV2';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import { useNavigate } from 'react-router-dom';

const DatabasesTable = () => {
    const { selectedInventoryTab, selectedFilterValue, inventoryTableData } = useAppSelector(
        state => state.inventoryV2
    );
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqldatabaseHostsLoading, fullHostDataLoading: pgsqlfullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const dispatch = useDispatch();
    const [data, setData] = useState<any>();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        let newTable: any = [];
        if (inventoryTableData) {
            Object.keys(inventoryTableData).map((rowId: string) => {
                if (inventoryTableData[rowId]?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS) {
                    return;
                }
                if (inventoryTableData?.[rowId] && inventoryTableData?.[rowId]?.sqlServerInstances) {
                    let perHost = inventoryTableData?.[rowId];
                    inventoryTableData?.[rowId]?.sqlServerInstances?.map((perRow: any) => {
                        if (
                            perRow?.fileSystemType === GENERAL.EBS ||
                            perRow?.fileSystemType === GENERAL.FSX_FOR_WINDOWS ||
                            !perRow?.databases
                        ) {
                            return;
                        }
                        perRow?.databases?.map((perDatabase: any) => {
                            let protectionText = getProtectionText({
                                ...perDatabase,
                                fileSystemType: perRow?.fileSystemType
                            });
                            let protectionVal = '';
                            if (protectionText === PROTECTION_TEXT_STATUS.YES) {
                                protectionVal = GENERAL.PROTECTED;
                            } else if (protectionText === PROTECTION_TEXT_STATUS.NO) {
                                protectionVal = GENERAL.NOT_PROTECTED;
                            } else {
                                protectionVal = GENERAL.NOT_AVAILABLE;
                            }
                            let perRowData = {
                                ...perDatabase,
                                isProtected: protectionVal,
                                hostRow: perHost,
                                instanceRow: perRow,
                                hostName: perHost?.name,
                                hostType: perHost?.hostType,
                                databaseInstanceId: perRow?.databaseInstanceId,
                                databaseInstanceName: perRow?.databaseInstanceName,
                                credentialId: perHost?.credentialId,
                                regionId: perHost?.regionId,
                                credentialName: perHost?.credentialName,
                                accountId: perHost?.accountId,
                                regionName: perHost?.regionName,
                                resourceId: perHost?.resourceId,
                                ec2InstanceId: perHost?.ec2InstanceId
                            };
                            newTable.push(perRowData);
                        });
                    });
                }
            });
        }
        setData(newTable);
    }, [inventoryTableData]);

    const getInitialFilter = () => {
        if (
            selectedInventoryTab === 'Databases' &&
            selectedFilterValue?.flag === true &&
            selectedFilterValue?.filterType === 'single'
        ) {
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
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        } else if (
            selectedInventoryTab === 'Databases' &&
            selectedFilterValue?.flag === true &&
            selectedFilterValue?.filterType === 'multi'
        ) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
            return {
                textFilter: '',
                count: 2,
                columns: {
                    '2': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    },
                    '4': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.instanceName]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        } else {
            return undefined;
        }
    };

    const protectionTooltipText = (data: any) => {
        return (
            <div className={styles.protectionTooltip}>
                <DsTypography variant="Semibold_13" className={styles.textHeight}>
                    {GENERAL.PROTECTED_BY}:
                </DsTypography>
                {data.map((val: any, index: number) => (
                    <DsTypography key={index} variant="Regular_13" className={styles.textHeight}>
                        {val}
                    </DsTypography>
                ))}
            </div>
        );
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
                const name = rowData?.name;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                        <div className={styles.firstColText}>
                            {rowData?.status === 'ONLINE' && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {rowData?.status === 'OFFLINE' && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
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
            accessor: 'hostType',
            id: '3',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Instance name',
            accessor: 'databaseInstanceName',
            id: '4',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Protection status',
            accessor: 'isProtected',
            id: '5',
            width: '200px',
            filterOptions: 'auto',
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
                            <div className={styles.colTextProtection}>
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
                                    <DsTypography variant="Regular_14">{cellData}</DsTypography>
                                </div>
                                {protectedByList?.length > 0 && (
                                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                        {protectionTooltipText(protectedByList)}
                                    </TooltipInfo>
                                )}
                            </div>
                        )}
                        {!protectionData && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            Header: 'Database Type',
            accessor: 'type',
            id: '6',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Database size',
            accessor: 'size',
            id: '7',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return formatSize(cellData);
            }
        },
        {
            Header: 'AWS credentials',
            accessor: 'credentialName',
            id: '8',
            width: '184px',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'AWS account',
            accessor: 'accountId',
            id: '9',
            width: '184px',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Region',
            accessor: 'regionName',
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
        rows: data,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading:
            databaseHostsLoading || fullHostDataLoading || pgsqldatabaseHostsLoading || pgsqlfullHostDataLoading,
        //@ts-ignore
        initialFilterState: getInitialFilter(),
        initialColumnState: initialDatabaseTableColState,
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                let disableOption = false;
                let disableMessage = '';

                if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
                    disableOption = true;
                    disableMessage = 'Create sandbox option is not available for PostgreSQL databases.';
                }
                const menu = [
                    {
                        id: 'createSandbox',
                        displayName: 'Create sandbox',
                        disabled: disableOption,
                        infoText: disableMessage
                    }
                ];
                return (
                    <div className={styles.jobMenuPopover}>
                        <MenuPopover
                            isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                            menuItems={[...menu]}
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

                                    if (menuId === 'createSandbox') {
                                        dispatch(
                                            setSelectedSandboxHeaderValue({
                                                credId: rowData?.credentialId,
                                                regionId: rowData?.regionId
                                            })
                                        );
                                        dispatch(
                                            setSelectedCsData({
                                                host: rowData?.hostName,
                                                instance: rowData?.databaseInstanceName,
                                                database: rowData?.name
                                            })
                                        );
                                        navigate('../create-new-sandbox');
                                    }
                                }
                            }}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                );
            }
        }
    });

    useEffect(() => {
        console.log(tableProps);
    }, [tableProps]);
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
