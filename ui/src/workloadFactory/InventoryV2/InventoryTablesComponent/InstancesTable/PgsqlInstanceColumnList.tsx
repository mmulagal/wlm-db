import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { BlueXPListeners, Popover, postBlueXPMessage, TooltipInfo } from '@netapp/design-system';
import { TFunction } from 'i18next';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    ACTION_CTA,
    DBType,
    INVENTORY_STATUS,
    PROTECTION_COLUMN_TEXT_STATUS,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import styles from '../InventoryTable.module.scss';
import { getFilterOptions } from '../../../../utils/utilityFunctions';
import { instanceNameHyperLink, optimizeAction, protectionTooltipText } from './InstanceTableColumnsHelper';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import {
    setBreadCrumbSelectedFrom,
    setManageSingleInstanceData,
    setSelectedHeaderTab,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import { setSelectedWellArchitectTab } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { manageActionCol } from '../../InventoryUtilsV2';

export function getPgsqlInstanceTableColumns({
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
            Header: t('databases.instance-table.headers.instance-name'),
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
            Header: t('databases.instance-table.headers.host-name'),
            accessor: 'name',
            id: '2',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'name'),
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
            Header: t('databases.instance-table.headers.deployment-model'),
            accessor: 'serverInstallationMode',
            id: '3',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'serverInstallationMode'),
            renderCell: (cellData: string) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
        },
        {
            Header: t('databases.instance-table.headers.protection-status'),
            accessor: 'protectionText',
            id: '4',
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
            Header: t('databases.instance-table.headers.performance'),
            accessor: 'performance.assessment',
            id: '5',
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
            id: '6',
            Header: t('databases.instance-table.headers.fsx-for-ontap'),
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
            id: '7',
            Header: t('databases.instance-table.headers.aws-credentials'),
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
            id: '8',
            Header: t('databases.instance-table.headers.aws-account'),
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
            id: '9',
            Header: t('databases.instance-table.headers.region'),
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
            id: '10',
            Header: '',
            accessor: '',
            isSortable: false,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const { colText, disableMsg } = manageActionCol(t, DBType.POSTGRESQL, rowData);
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
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(
                                                setSelectedWellArchitectTab(
                                                    WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                                                )
                                            );
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

export const pgsqlInstanceColumnFilterMap = {
    hostName: '2', // id of host name column
    credentialName: '7', // id of credential name column
    regionName: '9' // id of region column
};
