import { DsFlashingDotsLoader, DsTooltipInfo, DsTypography, Popover } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedFilterValue, setTableManageColumnState } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { ColumnProps, Table } from '../../../../common/Lib/Table/Table';
import { formatSize, getFilterOptions } from '../../../../utils/utilityFunctions';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import ProtectionIcons from '../../../../common/ProtectionIcons/ProtectionIcons';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { useTranslation } from 'react-i18next';

const DatabasesTable = () => {
    const { t } = useTranslation();
    const { selectedInventoryTab, selectedFilterValue, databaseTableRows, tableManageColumnState } = useAppSelector(
        state => state.inventoryV2
    );
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqldatabaseHostsLoading, fullHostDataLoading: pgsqlfullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { multiDataLoading } = useAppSelector(state => state.headers);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                fullHostDataLoading ||
                pgsqldatabaseHostsLoading ||
                pgsqlfullHostDataLoading ||
                multiDataLoading
        );
    }, [
        databaseHostsLoading,
        fullHostDataLoading,
        pgsqldatabaseHostsLoading,
        pgsqlfullHostDataLoading,
        multiDataLoading
    ]);

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
                count: 3,
                columns: {
                    '2': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    },
                    '9': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.credentialName]: true
                        },
                        valuesArray: [true]
                    },
                    '11': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.regionName]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        }
        if (
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
                count: 4,
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
                    },
                    '9': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.credentialName]: true
                        },
                        valuesArray: [true]
                    },
                    '11': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.regionName]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        }
        return undefined;
    };

    const DatabasesColDefs: ColumnProps[] = [
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
            Header: t('databases.databases-table.headers.host-name'),
            accessor: 'hostName',
            id: '2',
            width: '200px',
            filterOptions: getFilterOptions(databaseTableRows, 'hostName'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.engine-type'),
            accessor: 'hostType',
            id: '3',
            width: '200px',
            filterOptions: getFilterOptions(databaseTableRows, 'hostType'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.instance-name'),
            accessor: 'databaseInstanceName',
            id: '4',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.protection-status'),
            accessor: 'isProtected',
            id: '5',
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
            id: '6',
            Header: t('databases.databases-table.headers.fsx-for-ontap'),
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
            Header: t('databases.databases-table.headers.database-type'),
            accessor: 'type',
            id: '7',
            width: '200px',
            filterOptions: getFilterOptions(databaseTableRows, 'type'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.database-size'),
            accessor: 'sizeRange',
            csvAccessor: t('databases.databases-table.headers.database-size'),
            id: '8',
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
            Header: t('databases.databases-table.headers.aws-credentials'),
            accessor: 'credentialName',
            id: '9',
            width: '184px',
            isSortable: true,
            filterOptions: getFilterOptions(databaseTableRows, 'credentialName'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.aws-account'),
            accessor: 'accountId',
            id: '10',
            width: '184px',
            filterOptions: getFilterOptions(databaseTableRows, 'accountId'),
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: t('databases.databases-table.headers.region'),
            accessor: 'regionName',
            id: '11',
            width: '184px',
            isSortable: true,
            filterOptions: getFilterOptions(databaseTableRows, 'regionName'),
            renderCell: (cellData: string, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        }
    ];
    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: databaseTableRows,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        // @ts-ignore
        initialFilterState: getInitialFilter(),
        initialColumnState: tableManageColumnState.databaseTable,
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                let disableOption = false;
                let disableMessage = '';

                if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
                    disableOption = true;
                    disableMessage = GENERAL.COMING_SOON;
                } else if (rowData?.type === GENERAL.SYSTEM_DATABASE) {
                    disableOption = true;
                    disableMessage = 'Create sandbox option is not available for system database.';
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
        dispatch(setTableManageColumnState({ ...tableManageColumnState, databaseTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);
    return (
        <div className={styles.inventoryTable}>
            <div
                //  @ts-ignore
                className={styles.table}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Databases"
                    singularTitle="Database"
                    exportToCsvOptions={{ fileName: `DatabaseTable-${new Date(Date.now()).toLocaleString()}.csv` }}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
                />
                <Table
                    // @ts-ignore
                    tableProps={tableProps}
                    isDoubleRow
                />
            </div>
        </div>
    );
};

export default DatabasesTable;
