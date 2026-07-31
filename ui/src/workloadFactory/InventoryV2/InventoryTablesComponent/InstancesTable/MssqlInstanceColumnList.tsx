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
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import styles from '../InventoryTable.module.scss';
import {
    createNACustomFilter,
    getFilterOptions,
    getFilterOptionsWithNA,
    formatDateWithTime
} from '../../../../utils/utilityFunctions';
import { instanceNameHyperLink, optimizeAction, protectionTooltipText } from './InstanceTableColumnsHelper';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import { setSelectedWellArchitectTab } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    logAnalyzerStatusCol,
    handleWadOptimizeAction,
    handleUnregisteredOptimizeAction,
    notAvailableWithTooltip,
    getCanViewAndFix,
    getViewAndFixDisableMsg,
    shouldUseOfflineWadHandler
} from './InstanceTableHelper';
import InventoryStatusIndicator from '../../../../common/InventoryStatusIndicator/InventoryStatusIndicator';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    getFsxIdsForTooltip,
    getInstanceFsxLinkExists,
    getInstanceFsxLinksCount,
    isUnregisteredInventoryRow
} from '../../InventoryUtilsV2';

export function getMssqlInstanceTableColumns({
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
    const aiAnalysisEnabled = useAppSelector(state => state.auth.aiAnalysisEnabled);

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
                            <InventoryStatusIndicator
                                status={rowData?.status}
                                loading={rowData?.loading}
                                isWad={rowData?.isWad}
                                isUnregistered={rowData?.isUnregistered}
                            />
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
            Header: t('databases.instance-table.headers.error-analyzer'),
            accessor: 'logAnalyzer.status',
            id: '14',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'logAnalyzer.status'),
            renderCell: (cellData: string, rowData: any) =>
                logAnalyzerStatusCol(styles, t, rowData, cellData, aiAnalysisEnabled)
        },
        {
            Header: t('databases.instance-table.headers.well-architected-status'),
            accessor: 'optimizationStatus',
            id: '3',
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

                // For WAD (offline assessment) or unregistered rows with valid optimization status, show tooltip
                if ((rowData?.isWad || rowData?.isUnregistered) && cellData) {
                    const tooltipText = rowData?.isUnregistered
                        ? t('databases.inventory.on-demand-assessment')
                        : t('databases.inventory.one-time-assessment');

                    return (
                        <div className={styles.naContainer}>
                            <Popover
                                popoverClass=""
                                trigger="hover"
                                isAppendedToBody
                                placement="bottom"
                                container={<TooltipIcon />}
                            >
                                <div>
                                    <DsTypography variant="Regular_13">{tooltipText}</DsTypography>
                                    {rowData?.optimizationLastTimestamp && (
                                        <DsTypography variant="Semibold_13">
                                            {formatDateWithTime(rowData.optimizationLastTimestamp)}
                                        </DsTypography>
                                    )}
                                </div>
                            </Popover>
                            <DsTypography variant="Regular_14">{cellData}</DsTypography>
                        </div>
                    );
                }

                return (
                    <div className={styles.statusCol}>
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    </div>
                );
            }
        },
        {
            Header: t('databases.instance-table.headers.registration-status'),
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
            Header: t('databases.instance-table.headers.deployment-model'),
            accessor: 'serverInstallationMode',
            id: '5',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'serverInstallationMode'),
            renderCell: (cellData: string, rowData: any) => {
                if (!cellData) {
                    return notAvailableWithTooltip(
                        t,
                        'databases.instance-table.unlock-deployment-model',
                        rowData,
                        'databases.instance-table.offline-deployment-model'
                    );
                }
                return (
                    <DsTypography variant="Regular_13" className={styles.colText} title={cellData}>
                        {cellData}
                    </DsTypography>
                );
            }
        },
        {
            Header: t('databases.instance-table.headers.availability-group'),
            accessor: 'availabilityGroupList',
            id: '15',
            width: '213px',
            filterOptions: getFilterOptionsWithNA(
                updatedTableData,
                'availabilityGroupList',
                t('databases.general.not-available-table-columns')
            ),
            customFilter: createNACustomFilter,
            renderCell: (cellData: string, rowData: any) => {
                const availabilityGroupList = rowData?.availabilityGroupList || [];
                const hasMultipleGroups = availabilityGroupList.length > 1;
                const hasSingleGroup = availabilityGroupList.length === 1;

                return (
                    <>
                        {hasMultipleGroups && (
                            <div className={styles.fsxNameContainer}>
                                <div className={styles.ssmOffline}>
                                    <Popover
                                        popoverClass=""
                                        children={
                                            <div
                                                className={`${styles.tooltipContainer} ${styles.tooltipContainerMulti} ${styles.fsxNamePopOver}`}
                                            >
                                                <DsTypography variant="Semibold_13" className={styles.colText}>
                                                    {t('databases.general.availability-groups')}:
                                                </DsTypography>
                                                {availabilityGroupList.map((group: any, index: number) => (
                                                    <div key={index}>
                                                        <DsTypography variant="Regular_13">
                                                            {group ||
                                                                t('databases.general.not-available-table-columns')}
                                                        </DsTypography>
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
                                        title={`${availabilityGroupList.length} ${t(
                                            'databases.general.availability-groups'
                                        )}`}
                                    >
                                        {`${availabilityGroupList.length} ${t(
                                            'databases.general.availability-groups'
                                        )}`}
                                    </DsTypography>
                                </div>
                            </div>
                        )}
                        {hasSingleGroup && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {availabilityGroupList[0]}
                            </DsTypography>
                        )}
                        {availabilityGroupList.length === 0 && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.general.not-available-table-columns')}
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            Header: t('databases.instance-table.headers.protection-status'),
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
                            notAvailableWithTooltip(
                                t,
                                'databases.instance-table.unlock-protection-status',
                                rowData,
                                'databases.instance-table.offline-protection-status'
                            )}
                    </>
                );
            }
        },
        {
            Header: t('databases.instance-table.headers.performance'),
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
                            notAvailableWithTooltip(
                                t,
                                'databases.instance-table.unlock-performance-metrics',
                                rowData,
                                'databases.instance-table.offline-performance-metrics'
                            )}
                    </>
                );
            }
        },
        {
            id: '7',
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

                const fsxLinksCount = getInstanceFsxLinksCount(rowData);
                const fsxLinkExists = getInstanceFsxLinkExists(rowData);
                const showFsxLinksCount = fsxLinksCount != null && fsxLinksCount > 0;
                const fsxIdsForTooltip = showFsxLinksCount ? getFsxIdsForTooltip(rowData) : [];
                const linkStatusText =
                    fsxLinkExists === true
                        ? t('databases.general.link-associated')
                        : fsxLinkExists === false
                        ? t('databases.general.link-not-associated')
                        : null;

                return (
                    <>
                        {!loading && showFsxLinksCount && (
                            <div className={styles.fsxNameContainer}>
                                <div className={styles.ssmOffline}>
                                    <Popover
                                        popoverClass=""
                                        children={
                                            <div
                                                className={`${styles.tooltipContainer} ${styles.tooltipContainerMulti} ${styles.fsxNamePopOver}`}
                                            >
                                                {fsxIdsForTooltip.map((fsx: any, index: number) => (
                                                    <div key={fsx?.id || index} className={styles.fsxTooltipRow}>
                                                        <DsTypography variant="Regular_13">{`ID: ${fsx?.id}`}</DsTypography>
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
                                                {linkStatusText && (
                                                    <DsTypography
                                                        variant="Regular_13"
                                                        style={{ marginTop: fsxIdsForTooltip.length ? '8px' : '0' }}
                                                    >
                                                        {linkStatusText}
                                                    </DsTypography>
                                                )}
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
                                        title={`${fsxLinksCount} ${t('databases.general.fsx-for-ontap')}`}
                                    >
                                        {`${fsxLinksCount} ${t('databases.general.fsx-for-ontap')}`}
                                    </DsTypography>
                                </div>
                            </div>
                        )}
                        {!loading && !showFsxLinksCount && rowData?.fsxId && (
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
                        {!cellData && !loading && !rowData?.fsxId && !showFsxLinksCount && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.general.not-available-table-columns')}
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            id: '10',
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
            id: '11',
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
            id: '12',
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
            id: '13',
            Header: '',
            accessor: '',
            isSortable: false,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const isDisabledByBulkSelection = isBulkSelectionActive;

                // View and Fix is available for WAD, registered/managed, or unregistered rows with FSx link + permissions
                const isRegisteredOrManaged =
                    rowData?.statusColText === INVENTORY_STATUS.MANAGED || rowData?.resourceId;
                const hasUnregisteredPermissions =
                    !isRegisteredOrManaged && getCanViewAndFix(rowData) && !rowData?.isWad;
                const canViewAndFix = getCanViewAndFix(rowData);

                // Tooltip for disabled button
                const viewAndFixDisableMsg = getViewAndFixDisableMsg(rowData, canViewAndFix, t);

                const effectiveDisableMsg = isDisabledByBulkSelection
                    ? t('databases.bulk-register.action-disabled-during-bulk-selection')
                    : viewAndFixDisableMsg;

                // Determine button text based on optimization status
                const buttonText =
                    rowData?.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED
                        ? t('databases.general.well-architected')
                        : t('databases.general.view-and-fix');

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
                                            data-testid="wlm-db-mssql-view-and-fix"
                                            variant="secondary"
                                            isThin
                                            isDisabled
                                        >
                                            {buttonText}
                                        </DsButton>
                                    </div>
                                }
                            />
                        ) : (
                            <div className={styles.buttonContainer}>
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    data-testid="wlm-db-mssql-view-and-fix"
                                    onClick={() => {
                                        if (shouldUseOfflineWadHandler(rowData)) {
                                            handleWadOptimizeAction(rowData, dispatch);
                                        } else if (
                                            isUnregisteredInventoryRow(rowData) ||
                                            (hasUnregisteredPermissions && !isRegisteredOrManaged)
                                        ) {
                                            // For unregistered instances with permissions, trigger on-demand assessment
                                            handleUnregisteredOptimizeAction(rowData, dispatch);
                                        } else {
                                            // For managed instances, use regular optimize action
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(
                                                setSelectedWellArchitectTab(
                                                    WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                                                )
                                            );
                                            optimizeAction(rowData, dispatch);
                                        }
                                    }}
                                >
                                    {buttonText}
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

export const mssqlInstanceColumnFilterMap = {
    hostName: '2', // id of host name column
    credentialName: '10', // id of credential name column
    regionName: '12' // id of region column
};
