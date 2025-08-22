import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { BlueXPListeners, DsTooltipInfo, Popover, postBlueXPMessage, TooltipInfo } from '@netapp/design-system';
import { TFunction } from 'i18next';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    ACTION_CTA,
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
    setSelectedHeaderTab,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { manageActionCol } from '../../InventoryUtilsV2';
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';

export function getOracleDatabaseColumnsList({
    t,
    updatedTableData
}: {
    t: TFunction;
    updatedTableData: any[];
}): ColumnProps[] {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const allColumns: ColumnProps[] = [
        {
            Header: t('databases.databases-table.oracle.headers.database-name'),
            accessor: 'databaseInstanceName',
            customAccessor: 'statusAccessor',
            id: '1',
            isSortable: true,
            filterOptions: [
                { label: 'Online', value: 'Online' },
                { label: 'Offline', value: 'Offline' }
            ],
            width: '256px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.databaseInstanceName;
                return (
                    <div className={styles.firstColumnClass}>
                        <DsTypography
                            title={name || t('databases.general.not-available-table-columns')}
                            className={styles.textClass}
                            variant="Semibold_14"
                        >
                            {name && instanceNameHyperLink(rowData, name, dispatch)}
                            {!name && t('databases.general.not-available-table-columns')}
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
                );
            }
        },
        {
            Header: t('databases.databases-table.oracle.headers.sid'),
            accessor: 'databaseInstanceName',
            id: '2',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'databaseInstanceName'),
            renderCell: (cellData: string) => (
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
            Header: t('databases.databases-table.oracle.headers.host-name'),
            accessor: 'hostRow.ec2InstanceName',
            id: '3',
            width: '240px',
            filterOptions: getFilterOptions(updatedTableData, 'hostRow.ec2InstanceName'),
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
                        {!cellData && !loading && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.general.not-available-table-columns')}
                            </DsTypography>
                        )}
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
            renderCell: (cellData: string) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
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
            renderCell: (cellData: string) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
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
                        {!cellData && !loadingPA && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.general.not-available-table-columns')}
                            </DsTypography>
                        )}
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
                return (
                    <>
                        {loading && <DsFlashingDotsLoader />}
                        {!loading && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </DsTypography>
                        )}
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
                        {!loading && !rowData?.size && (
                            <div className={styles.databaseSize}>
                                <DsTooltipInfo
                                    className={`${styles.databaseSizeTooltipContainer} ${styles['tooltip-icon']}`}
                                    trigger="hover"
                                >
                                    <div>
                                        <DsTypography variant="Regular_13">
                                            {t('databases.databases-table.oracle.credentials-not-available')}
                                        </DsTypography>
                                    </div>
                                </DsTooltipInfo>
                                <div className={styles.colText}>
                                    <DsTypography variant="Regular_13">
                                        {REGISTER_INSTANCE_STATE.NOT_AVAILABLE}
                                    </DsTypography>
                                </div>
                            </div>
                        )}
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
                return (
                    <>
                        {!loading && rowData?.fsxId && (
                            <div className={styles.fsxNameContainer}>
                                <DsTooltipInfo
                                    className={`${styles.fsxName} ${styles['tooltip-icon']}`}
                                    trigger="hover"
                                >
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
                                </DsTooltipInfo>
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
                        {!cellData && !loading && !rowData?.fsxId && (
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
                return (
                    <>
                        {disableMsg ? (
                            <Popover
                                isAppendedToBody
                                children={disableMsg}
                                trigger="hover"
                                container={
                                    <div className={styles.buttonContainer}>
                                        <DsButton variant="secondary" isThin isDisabled>
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
                                    onClick={() => {
                                        if (
                                            colText === ACTION_CTA.FIX_ISSUES ||
                                            colText === ACTION_CTA.WELL_ARCHITECTED
                                        ) {
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
