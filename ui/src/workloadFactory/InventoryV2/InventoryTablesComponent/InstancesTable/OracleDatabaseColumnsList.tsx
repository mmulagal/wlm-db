import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { BlueXPListeners, Popover, postBlueXPMessage, TooltipInfo } from '@netapp/design-system';
import { TFunction } from 'i18next';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    ACTION_CTA,
    DATABASE_DEPLOYMENT_MODE,
    DBType,
    INVENTORY_STATUS,
    INVENTORY_TABLE_STATUS,
    PROTECTION_COLUMN_TEXT_STATUS,
    REGISTER_INSTANCE_STATE,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import styles from '../InventoryTable.module.scss';
import { formatSize, getFilterOptions } from '../../../../utils/utilityFunctions';
import { instanceNameHyperLink, optimizeAction, protectionTooltipText } from './InstanceTableColumnsHelper';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import {
    setBreadCrumbSelectedFrom,
    setManageSingleInstanceData,
    setRegisterHostType,
    setSelectedHeaderTab,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { manageActionCol } from '../../InventoryUtilsV2';
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';
import { setFSXId } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { logAnalyzerStatusCol } from './InstanceTableHelper';

export function getOracleDatabaseColumnsList({
    t,
    updatedTableData,
    isBulkSelectionActive
}: {
    t: TFunction;
    updatedTableData: any[];
    isBulkSelectionActive?: boolean;
}): ColumnProps[] {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const notAvailableWithTooltip = (unlockKey: string) => (
        <div className={styles.naWithTooltip}>
            <TooltipInfo className={styles['tooltip-icon']} trigger="hover">
                <div>
                    <DsTypography variant="Regular_13">{t(unlockKey)}</DsTypography>
                </div>
            </TooltipInfo>
            <div className={styles.colText}>
                <DsTypography variant="Regular_13">{t('databases.general.not-available-table-columns')}</DsTypography>
            </div>
        </div>
    );

    const allColumns: ColumnProps[] = [
        {
            Header: t('databases.databases-table.oracle.headers.database-name'),
            accessor: 'dbOrInstanceName',
            customAccessor: 'statusAccessor',
            id: '1',
            isSortable: true,
            filterOptions: [
                { label: 'Online', value: 'Online' },
                { label: 'Offline', value: 'Offline' }
            ],
            width: '260px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.firstColumnClass}>
                    <DsTypography
                        title={cellData || t('databases.general.not-available-table-columns')}
                        className={styles.textClass}
                        variant="Semibold_14"
                    >
                        {cellData && instanceNameHyperLink(rowData, cellData, dispatch)}
                        {!cellData && t('databases.general.not-available-table-columns')}
                    </DsTypography>
                    <div className={styles.firstColText}>
                        {(rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                            rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                            <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                        )}
                        {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                            rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                            <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                        )}
                        {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                            <div className={`${styles.statusIcon} ${styles.circle} ${styles.unknown}`} />
                        )}
                        <DsTypography variant="Regular_13">
                            {(() => {
                                if (
                                    rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
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
                                return rowData?.status;
                            })()}
                            {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                            {!rowData?.status && !rowData?.loading && INVENTORY_STATUS.UNKNOWN}
                        </DsTypography>
                    </div>
                </div>
            )
        },
        {
            Header: t('databases.databases-table.oracle.headers.sid'),
            accessor: 'databaseInstanceName',
            id: '2',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'databaseInstanceName'),
            renderCell: (cellData: string, rowData: any) => {
                let name = cellData;
                if (
                    rowData?.serverInstallationMode === DATABASE_DEPLOYMENT_MODE.DATAGUARD &&
                    rowData?.dataguardDetails?.dbUniqueName
                ) {
                    name = rowData?.dataguardDetails?.dbUniqueName;
                }
                return (
                    <DsTypography
                        title={name || t('databases.general.not-available-table-columns')}
                        variant="Regular_13"
                        className={`${styles.colText} ${styles.textClass}`}
                    >
                        {name || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.host-name'),
            accessor: 'hostRow.name',
            id: '3',
            width: '240px',
            filterOptions: getFilterOptions(updatedTableData, 'hostRow.name'),
            renderCell: (cellData: string, rowData: any) => (
                <DsTypography
                    title={cellData || t('databases.general.not-available-table-columns')}
                    variant="Regular_13"
                    className={`${styles.colText} ${styles.textClass}`}
                >
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
        },
        {
            Header: t('databases.databases-table.oracle.headers.deployment-model'),
            accessor: 'serverInstallationMode',
            id: '8',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'serverInstallationMode'),
            renderCell: (cellData: string, rowData: any) => {
                if (cellData === DATABASE_DEPLOYMENT_MODE.DATAGUARD) {
                    return (
                        <div className={styles.firstColumnClass}>
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </DsTypography>

                            <div className={styles.firstColText}>
                                {rowData.replicasCount > 0 && rowData?.dataguardDetails?.isPrimaryNode && (
                                    <DsTypography variant="Regular_13" className={styles.colText}>
                                        {`${t('databases.general.primary')} | ${rowData.replicasCount || 0} ${
                                            rowData.replicasCount <= 1
                                                ? t('databases.general.replica')
                                                : t('databases.general.replicas')
                                        }`}
                                    </DsTypography>
                                )}
                                {!rowData.hasReplicas && rowData?.dataguardDetails?.isPrimaryNode && (
                                    <DsTypography variant="Regular_13" className={styles.colText}>
                                        {`${t('databases.general.primary')}`}
                                    </DsTypography>
                                )}
                            </div>

                            {!rowData?.dataguardDetails?.isPrimaryNode && (
                                <div className={styles.firstColText}>
                                    <DsTypography variant="Regular_13" className={styles.colText}>
                                        {`${t('databases.general.standby')}`}
                                    </DsTypography>
                                </div>
                            )}
                        </div>
                    );
                }
                if (!cellData) {
                    return notAvailableWithTooltip('databases.databases-table.oracle.unlock-deployment-model');
                }
                return (
                    <DsTypography variant="Regular_13" className={styles.colText}>
                        {cellData}
                    </DsTypography>
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.registration-status'),
            accessor: 'managementStatus',
            id: '4',
            isSortable: false,
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'managementStatus'),
            renderCell: (cellData: string) => {
                if (cellData === INVENTORY_STATUS.NOT_REGISTERED) {
                    return <DotComponent color="var(--toggle-off-bg)" value={t('databases.general.not_registered')} />;
                }
                if (cellData === INVENTORY_STATUS.IN_PROGRESS) {
                    return (
                        <div className={styles.inProgress}>
                            <DsFlashingDotsLoader />
                            <DsTypography variant="Regular_14">{INVENTORY_STATUS.IN_PROGRESS}</DsTypography>
                        </div>
                    );
                }
                if (cellData === INVENTORY_STATUS.REGISTERED) {
                    return <DotComponent color="var(--success)" value={t('databases.general.registered')} />;
                }
                return <DotComponent color="var(--toggle-off-bg)" value={t('databases.general.not_registered')} />;
            }
        },
        {
            Header: t('databases.instance-table.headers.error-analyzer'),
            accessor: 'logAnalyzer.status',
            id: '17',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'logAnalyzer.status'),
            renderCell: (cellData: string, rowData: any) => logAnalyzerStatusCol(styles, t, rowData, cellData)
        },
        {
            Header: t('databases.databases-table.oracle.headers.well-architected-status'),
            accessor: 'optimizationStatus',
            id: '5',
            width: '240px',
            filterOptions: getFilterOptions(updatedTableData, 'optimizationStatus'),
            renderCell: (cellData: string, rowData: any) => {
                // If the computed display value is "Not analyzed", show with tooltip
                if (cellData === INVENTORY_TABLE_STATUS.NOT_ANALYZED) {
                    return (
                        <div className={styles.naContainer}>
                            <Popover
                                popoverClass=""
                                trigger="hover"
                                isAppendedToBody
                                placement="bottom"
                                container={<TooltipIcon />}
                            >
                                <DsTypography variant="Regular_14">{rowData.optimizationDisableMsg}</DsTypography>
                            </Popover>
                            <DsTypography variant="Regular_14">
                                {t('databases.instance-table.not-analyzed')}
                            </DsTypography>
                        </div>
                    );
                }
                if (rowData?.optimizationStatusLoading) {
                    return <DsFlashingDotsLoader />;
                }
                return (
                    <div className={styles.statusCol}>
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    </div>
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.protection-status'),
            accessor: 'protectionText',
            id: '6',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'protectionText'),
            renderCell: (cellData: string, rowData: any) => {
                let loading = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loading = true;
                }
                const protectedByList = [];
                const protection = rowData?.protection ?? {};
                if (
                    [
                        protection?.isSqlNativeEnabled,
                        protection?.isAwsBackupEnabled?.fsxn,
                        protection?.isCRREnabled,
                        protection?.isFsxOntapSnapshotsEnabled
                    ].some(Boolean)
                ) {
                    protectedByList.push(t('databases.general.storage-consistent'));
                }

                if (protection?.isAppConsistentBackupEnabled) {
                    protectedByList.push(t('databases.general.application-consistent'));
                }
                return (
                    <>
                        {cellData && (
                            <div className={styles.colTextProtection}>
                                <div className={styles.protection}>
                                    {cellData === PROTECTION_COLUMN_TEXT_STATUS.PROTECTED && (
                                        <ProtectedIcon
                                            style={{
                                                // @ts-ignore
                                                '--icon-primary-color': 'var(--green-60)'
                                            }}
                                        />
                                    )}
                                    {cellData === PROTECTION_COLUMN_TEXT_STATUS.NOT_PROTECTED && (
                                        <NotProtectedIcon
                                            style={{
                                                // @ts-ignore
                                                '--icon-primary-color': 'var(--grey-45)'
                                            }}
                                        />
                                    )}
                                    <DsTypography variant="Regular_14">{cellData}</DsTypography>
                                </div>
                                {protectedByList?.length > 0 && (
                                    <div className={commonStyles.protectionTooltipPopOver}>
                                        <TooltipInfo className={styles['tooltip-icon']} trigger="hover">
                                            {protectionTooltipText(protectedByList)}
                                        </TooltipInfo>
                                    </div>
                                )}
                            </div>
                        )}
                        {!cellData && loading && <DsFlashingDotsLoader />}
                        {!cellData &&
                            !loading &&
                            notAvailableWithTooltip('databases.databases-table.oracle.unlock-protection-status')}
                    </>
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.tenancy'),
            accessor: 'instanceType',
            id: '7',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'instanceType'),
            info: t('databases.databases-table.oracle.tenancy-column-info'),
            renderCell: (cellData: string) => {
                let displayText = cellData;
                if (cellData === 'Multi Tenant') {
                    displayText = t('databases.oracle-inner-page.multi-tenant');
                } else if (cellData === 'Single Tenant') {
                    displayText = t('databases.oracle-inner-page.single-tenant');
                }

                if (!displayText) {
                    return notAvailableWithTooltip('databases.databases-table.oracle.unlock-tenancy');
                }
                return (
                    <DsTypography variant="Regular_13" className={styles.colText}>
                        {displayText}
                    </DsTypography>
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.performance'),
            accessor: 'performance.assessment',
            id: '9',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'performance.assessment'),
            renderCell: (cellData: string, rowData: any) => {
                let loadingPA = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loadingPA = true;
                }
                return (
                    <>
                        {cellData && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </DsTypography>
                        )}
                        {!cellData && loadingPA && <DsFlashingDotsLoader />}
                        {!cellData &&
                            !loadingPA &&
                            notAvailableWithTooltip('databases.databases-table.oracle.unlock-performance-metrics')}
                    </>
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.protocol'),
            accessor: 'protocol',
            id: '10',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'protocol'),
            renderCell: (cellData: string, rowData: any) => {
                let loading = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loading = true;
                }
                const isNotAvailable = !cellData || cellData === INVENTORY_STATUS.NOT_AVAILABLE;
                return (
                    <>
                        {!isNotAvailable && !loading && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </DsTypography>
                        )}
                        {loading && <DsFlashingDotsLoader />}
                        {isNotAvailable &&
                            !loading &&
                            notAvailableWithTooltip('databases.databases-table.oracle.unlock-protocol')}
                    </>
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.database-size'),
            accessor: 'sizeRange',
            csvAccessor: t('databases.databases-table.oracle.headers.database-size'),
            id: '11',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'sizeRange'),
            renderCell: (cellData: any, rowData: any) => {
                let loading = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loading = true;
                }
                return (
                    <>
                        {loading && <DsFlashingDotsLoader />}
                        {!loading &&
                            !rowData?.size &&
                            notAvailableWithTooltip('databases.databases-table.oracle.unlock-database-size')}
                        {!loading && rowData?.size && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {formatSize(rowData?.size)}
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            id: '12',
            Header: t('databases.databases-table.oracle.headers.fsx-for-ontap'),
            accessor: 'fileSystemName',
            isSortable: false,
            filterOptions: getFilterOptions(updatedTableData, 'fileSystemName'),
            width: '213px',
            renderCell: (cellData: any, rowData: any) => {
                let loading = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loading = true;
                }

                const fsxList = rowData?.fsxList || [];
                const hasManyFsx = fsxList.length > 1;

                return (
                    <>
                        {!loading && hasManyFsx && (
                            <div className={styles.fsxNameContainer}>
                                <div className={styles.ssmOffline}>
                                    <Popover
                                        popoverClass=""
                                        children={
                                            <div
                                                className={`${styles.tooltipContainer} ${styles.tooltipContainerMulti} ${styles.fsxNamePopOver}`}
                                            >
                                                {fsxList.map((fsx: any, index: number) => (
                                                    <div
                                                        key={index}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            marginBottom: index < fsxList.length - 1 ? '8px' : '0'
                                                        }}
                                                    >
                                                        <DsTypography variant="Regular_13">
                                                            {fsx?.fileSystemName ||
                                                                t('databases.general.not-available-table-columns')}{' '}
                                                            | ID:{' '}
                                                            {fsx?.id ||
                                                                t('databases.general.not-available-table-columns')}
                                                        </DsTypography>
                                                        <Popover
                                                            popoverClass={styles['copy-popover']}
                                                            children="Copied"
                                                            container={
                                                                <CopyToClipboardCommon
                                                                    value={fsx?.id}
                                                                    iconProvided={<CopyIcon fill="#A7A7A7" />}
                                                                />
                                                            }
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                        trigger="hover"
                                        delayHide={200}
                                        interactive
                                        isAppendedToBody={false}
                                        container={<TooltipIcon />}
                                    />
                                </div>
                                <div className={styles.fsxName}>
                                    <DsTypography
                                        className={styles.fsxNameText}
                                        variant="Regular_13"
                                        title={`${fsxList.length} ${t('databases.general.fsx-for-ontap')}`}
                                    >
                                        {`${fsxList.length} ${t('databases.general.fsx-for-ontap')}`}
                                    </DsTypography>
                                </div>
                            </div>
                        )}
                        {!loading && !hasManyFsx && rowData?.fsxId && (
                            <div className={styles.fsxNameContainer}>
                                <div className={styles.ssmOffline}>
                                    <Popover
                                        popoverClass=""
                                        children={
                                            <div className={`${styles.tooltipContainer} ${styles.fsxNamePopOver}`}>
                                                <DsTypography variant="Regular_13">{`ID: ${rowData?.fsxId}`}</DsTypography>
                                                <Popover
                                                    popoverClass={styles['copy-popover']}
                                                    children="Copied"
                                                    container={
                                                        <CopyToClipboardCommon
                                                            value={rowData?.fsxId}
                                                            iconProvided={<CopyIcon fill="#A7A7A7" />}
                                                        />
                                                    }
                                                />
                                            </div>
                                        }
                                        trigger="hover"
                                        delayHide={200}
                                        interactive
                                        isAppendedToBody={false}
                                        container={<TooltipIcon />}
                                    />
                                </div>
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
                        )}
                        {loading && <DsFlashingDotsLoader />}
                        {!cellData && !loading && !rowData?.fsxId && !hasManyFsx && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.general.not-available-table-columns')}
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            id: '13',
            Header: t('databases.databases-table.oracle.headers.aws-credentials'),
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'credentialName'),
            width: '213px',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
        },
        {
            id: '14',
            Header: t('databases.databases-table.oracle.headers.aws-account'),
            accessor: 'accountId',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'accountId'),
            width: '213px',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
        },
        {
            id: '15',
            Header: t('databases.databases-table.oracle.headers.region'),
            accessor: 'regionName',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'regionName'),
            width: '213px',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
        },
        {
            id: '16',
            Header: '',
            accessor: '',
            isSortable: false,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const { colText, disableMsg } = manageActionCol(t, DBType.ORACLE, rowData);

                // Disable action button when bulk selection is active
                const isDisabledByBulkSelection = isBulkSelectionActive;
                const effectiveDisableMsg = isDisabledByBulkSelection
                    ? t('databases.bulk-register.action-disabled-during-bulk-selection')
                    : disableMsg;
                return (
                    <>
                        {effectiveDisableMsg ? (
                            <Popover
                                isAppendedToBody
                                children={effectiveDisableMsg}
                                trigger="hover"
                                container={
                                    <div className={styles.buttonContainer}>
                                        <DsButton
                                            variant="secondary"
                                            data-testid={`wlm-db-oracle-${colText}`}
                                            isThin
                                            isDisabled
                                        >
                                            {colText}
                                        </DsButton>
                                    </div>
                                }
                            />
                        ) : (
                            <div className={styles.buttonContainer}>
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    data-testid={`wlm-db-oracle-${colText}`}
                                    onClick={() => {
                                        if (
                                            colText === ACTION_CTA.FIX_ISSUES ||
                                            colText === ACTION_CTA.WELL_ARCHITECTED
                                        ) {
                                            dispatch(
                                                setFSXId({
                                                    fsxId: rowData?.fsxId,
                                                    ec2InstanceId: rowData?.ec2InstanceId,
                                                    isInstanceStorageAsmManaged: rowData?.isInstanceStorageAsmManaged
                                                })
                                            );
                                            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                                            dispatch(
                                                setSelectedOracleInnerPageTab(
                                                    WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                                                )
                                            );
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            optimizeAction(rowData, dispatch);
                                        } else {
                                            dispatch(setManageSingleInstanceData(rowData));
                                            dispatch(setWizardOperationType('single'));
                                            dispatch(setRegisterHostType(DBType.ORACLE));
                                            navigate('../register-wizard');
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: './register-wizard',
                                                    replace: true
                                                }
                                            });
                                        }
                                    }}
                                >
                                    {colText}
                                </DsButton>
                            </div>
                        )}
                    </>
                );
            }
        }
    ];

    return allColumns;
}

export const oracleDatabaseColumnFilterMap = {
    hostName: '3', // id of host name column
    credentialName: '13', // id of credential name column
    regionName: '15' // id of region column
};
