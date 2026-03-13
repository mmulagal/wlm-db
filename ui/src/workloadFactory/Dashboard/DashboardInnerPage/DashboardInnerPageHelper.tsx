import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import store from '../../../store/store';
import { setSelectedRowsForOptimize } from '../../../store/workloadFactory/databaseHomeSlice';
import { setInProgressStateData } from '../../../store/workloadFactory/getWellOptimizeSlice';
import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATE_ACTIONS,
    CONFIG_STATES,
    DBType,
    FINDINGS,
    GETWELL_STATUS,
    INVENTORY_STATUS,
    STATUS_CONST,
    WLF_TABS
} from '../../../utils/consts';
import { categorizeStateInstances } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { updateConfigStateStatus } from '../../GetWell/GetWellUtils';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import { updateConfigStateStatusOracle } from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

const getPayloadType = (type: string) => {
    switch (type) {
        case ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS:
            type = 'ontap-volumes';
            break;
        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM:
            type = 'operating-system';
            break;
        case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
            type = 'high-availability';
            break;
        case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
            type = 'performance-tier';
            break;
        case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
            type = 'headroom';
            break;
        case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
            type = 'log-drive-size';
            break;
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
            type = 'tempdb-drive-size';
            break;
        case ASSESSMENT_CONFIG_NAMES.SWAP_SPACE:
            type = 'swap-space';
            break;
        case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
            type = 'data-files-location';
            break;
        case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
            type = 'log-files-location';
            break;
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
            type = 'tempdb-files-location';
            break;
        case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
            type = 'compute-rightsizing';
            break;
        case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
            type = 'rss-config';
            break;
        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
            type = 'snapshot-policy';
            break;
        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
            type = 'backup-configuration';
            break;
        case ASSESSMENT_CONFIG_NAMES.MAXDOP:
            type = 'maxdop';
            break;
        case ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH:
            type = 'mssql-patch';
            break;
        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
            type = 'host-os-patch';
            break;
        case ASSESSMENT_CONFIG_NAMES.LICENSE:
            type = 'sql-license';
            break;
        case ASSESSMENT_CONFIG_NAMES.CRR:
            type = 'crr';
            break;
        case ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH:
            type = 'oracle-security-patch';
            break;
        case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
            type = 'clone-management';
            break;
        case ASSESSMENT_CONFIG_NAMES.MTU:
            type = 'mtu-alignment';
            break;
        case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
            type = 'oracle-binary-placement';
            break;
        case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
            type = 'datafiles-placement';
            break;
        case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
            type = 'controlfiles-placement';
            break;
        case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
            type = 'redologs-placement';
            break;
        case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
            type = 'templogs-placement';
            break;
        case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
            type = 'archive-placement';
            break;
        case ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT:
            type = 'data-dg-lun-layout';
            break;
        case ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT:
            type = 'redolog-dg-lun-layout';
            break;
        case ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT:
            type = 'fra-dg-lun-layout';
            break;
        case ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT:
            type = 'archivelog-dg-lun-layout';
            break;
        default:
            break;
    }
    return type;
};

const createSuccessMsg = (
    successList: any[],
    failedList: any[],
    action: string | undefined,
    rowData: any,
    translation: any,
    configEngineType?: string
) => {
    const uniqueSuccessEntries = new Set(
        successList.map((item: any) => `${item.credentialId}_${item.regionId}_${item.hostId}_${item.instanceId}`)
    );
    const successCount = uniqueSuccessEntries.size;
    const uniqueFailedEntries = new Set(
        failedList.map((item: any) => `${item.credentialId}_${item.regionId}_${item.hostId}_${item.instanceId}`)
    );
    const failedCount = uniqueFailedEntries.size;
    const rowLength = rowData?.length;

    let notificationType = '';
    let message = '';
    let resourceType = '';

    if (configEngineType === DBType.ORACLE) {
        resourceType = 'database';
    } else {
        resourceType = 'instance';
    }

    if (rowLength === 1 && successCount) {
        if (action === CONFIG_STATE_ACTIONS.DISMISS) {
            notificationType = NOTIFICATION_TYPES.SUCCESS;
            message = translation('databases.well-architect.dismiss-msg.dismiss-success', {
                name: rowData?.[0].serverInstanceName,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
            notificationType = NOTIFICATION_TYPES.SUCCESS;
            message = translation('databases.well-architect.dismiss-msg.postpone-success', {
                name: rowData?.[0].serverInstanceName,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.ACTIVE) {
            notificationType = NOTIFICATION_TYPES.SUCCESS;
            message = translation('databases.well-architect.dismiss-msg.active-success', {
                name: rowData?.[0].serverInstanceName,
                resourceType
            });
        }
    } else if (rowLength === 1 && failedCount) {
        if (action === CONFIG_STATE_ACTIONS.DISMISS) {
            notificationType = NOTIFICATION_TYPES.ERROR;
            message = translation('databases.well-architect.dismiss-msg.dismiss-failed', {
                name: rowData?.[0].serverInstanceName,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
            notificationType = NOTIFICATION_TYPES.ERROR;
            message = translation('databases.well-architect.dismiss-msg.postpone-failed', {
                name: rowData?.[0].serverInstanceName,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.ACTIVE) {
            notificationType = NOTIFICATION_TYPES.ERROR;
            message = translation('databases.well-architect.dismiss-msg.active-failed', {
                name: rowData?.[0].serverInstanceName,
                resourceType
            });
        }
    } else if (successCount && !failedCount) {
        if (action === CONFIG_STATE_ACTIONS.DISMISS) {
            notificationType = NOTIFICATION_TYPES.SUCCESS;
            message = translation('databases.well-architect.dismiss-msg.bulk-dismiss-success', {
                count: successCount,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
            notificationType = NOTIFICATION_TYPES.SUCCESS;
            message = translation('databases.well-architect.dismiss-msg.bulk-postpone-success', {
                count: successCount,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.ACTIVE) {
            notificationType = NOTIFICATION_TYPES.SUCCESS;
            message = translation('databases.well-architect.dismiss-msg.bulk-active-success', {
                count: successCount,
                resourceType
            });
        }
    } else if (!successCount && failedCount) {
        if (action === CONFIG_STATE_ACTIONS.DISMISS) {
            notificationType = NOTIFICATION_TYPES.ERROR;
            message = translation('databases.well-architect.dismiss-msg.bulk-dismiss-failed', {
                count: failedCount,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
            notificationType = NOTIFICATION_TYPES.ERROR;
            message = translation('databases.well-architect.dismiss-msg.bulk-postpone-failed', {
                count: failedCount,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.ACTIVE) {
            notificationType = NOTIFICATION_TYPES.ERROR;
            message = translation('databases.well-architect.dismiss-msg.bulk-active-failed', {
                count: failedCount,
                resourceType
            });
        }
    } else if (successCount && failedCount) {
        if (action === CONFIG_STATE_ACTIONS.DISMISS) {
            notificationType = NOTIFICATION_TYPES.INFO;
            message = translation('databases.well-architect.dismiss-msg.mix-dismiss-status', {
                successCount,
                failedCount,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.POSTPONED) {
            notificationType = NOTIFICATION_TYPES.INFO;
            message = translation('databases.well-architect.dismiss-msg.mix-postpone-status', {
                successCount,
                failedCount,
                resourceType
            });
        } else if (action === CONFIG_STATE_ACTIONS.ACTIVE) {
            notificationType = NOTIFICATION_TYPES.INFO;
            message = translation('databases.well-architect.dismiss-msg.mix-active-status', {
                successCount,
                failedCount,
                resourceType
            });
        }
    }

    return { notificationType, message };
};

export const callDashboardDismissApi = (
    type: any,
    rowData?: any,
    action?: string,
    dismissApi?: any,
    dispatch?: any,
    translation?: any,
    configEngineType?: any
) => {
    const state = store.getState();
    const { inProgressStateData } = state.getWellOptimize;

    const name = getPayloadType(type);

    const payload = {
        configurationsToDismiss: [
            {
                configurationName: name,
                configState: action,
                databaseHosts: Object.values(
                    rowData.reduce(
                        (
                            acc: Record<
                                string,
                                {
                                    id: string;
                                    sqlServerInstances: string[];
                                    credentialsId: string;
                                    region: string;
                                }
                            >,
                            {
                                databaseHostId,
                                instanceId,
                                hostName,
                                credentialId,
                                regionId,
                                configState
                            }: {
                                databaseHostId: string;
                                instanceId: string;
                                hostName: string;
                                credentialId: string;
                                regionId: string;
                                configState: string;
                            }
                        ) => {
                            if (configState !== action) {
                                const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                if (!acc[uniqueRow]) {
                                    acc[uniqueRow] = {
                                        id: databaseHostId,
                                        sqlServerInstances: [],
                                        credentialsId: credentialId,
                                        region: regionId
                                    };
                                }
                                acc[uniqueRow].sqlServerInstances.push(instanceId);
                            }
                            return acc;
                        },
                        {}
                    )
                )
            }
        ]
    };

    const hostinstances = payload?.configurationsToDismiss?.flatMap((host: any) =>
        host.databaseHosts.flatMap((databaseHost: any) =>
            databaseHost.sqlServerInstances.map(
                (instance: any) =>
                    `${databaseHost.id}_${instance}_${databaseHost?.credentialsId}_${databaseHost?.region}`
            )
        )
    );
    dispatch(
        setInProgressStateData({
            ...inProgressStateData,
            [type]: [...(inProgressStateData[type] || []), ...hostinstances]
        })
    );

    dismissApi({ payload })
        .then((res: any) => {
            if (!res.error) {
                const { successList, failedList } = categorizeStateInstances(res?.data, type);
                if (configEngineType === DBType.ORACLE) {
                    updateConfigStateStatusOracle(successList, dispatch, action, res?.data);
                } else {
                    updateConfigStateStatus(
                        successList,
                        dispatch,
                        action,
                        res?.data,
                        configEngineType,
                        WLF_TABS.DASHBOARD
                    );
                }

                dispatch(
                    setInProgressStateData({
                        ...inProgressStateData,
                        [type]: (inProgressStateData[type] || []).filter(
                            (instance: string) => !hostinstances.includes(instance)
                        )
                    })
                );
                const { notificationType, message } = createSuccessMsg(
                    successList,
                    failedList,
                    action,
                    rowData,
                    translation,
                    configEngineType
                );
                dispatch(
                    addNotification({
                        notificationType,
                        message: message || translation('databases.well-architect.analysis-state-change-success')
                    })
                );
            } else {
                dispatch(
                    setInProgressStateData({
                        ...inProgressStateData,
                        [type]: (inProgressStateData[type] || []).filter(
                            (instance: string) => !hostinstances.includes(instance)
                        )
                    })
                );
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: translation('databases.well-architect.analysis-state-change-failed')
                    })
                );
            }
        })
        .catch((err: any) => {
            dispatch(
                setInProgressStateData({
                    ...inProgressStateData,
                    [type]: (inProgressStateData[type] || []).filter(
                        (instance: string) => !hostinstances.includes(instance)
                    )
                })
            );
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: err
                })
            );
        })
        .finally(() => {
            dispatch(setSelectedRowsForOptimize([]));
        });
};

export const checkSingleRowFix = (inProgressHostData: any, name: string, rowData: any) => {
    let isDisabled = false;

    // Helper function to check if row is over-provisioned with no under-provisioned drives
    const isOverProvisionedWithoutUnderProvisioned = () =>
        rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
        (rowData?.sizingViolations?.overProvisionedDrives?.length &&
            !rowData?.sizingViolations?.underProvisionedDrives?.length);

    // Helper function to check if row is shared drive (not optimized with ignored drives only)
    const isSharedDrive = () =>
        rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.NOT_OPTIMIZED.toLowerCase() &&
        !rowData?.sizingViolations?.underProvisionedDrives?.length &&
        rowData?.sizingViolations?.ignoredDrives?.length;

    // Drive size configurations that have similar validation logic
    const driveSizeConfigs = [
        ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
        ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
        ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM
    ];

    if (inProgressHostData?.[name]?.includes(rowData?.databaseHostId)) {
        isDisabled = true;
    } else if (rowData?.status?.toLowerCase() !== STATUS_CONST.UP.toLowerCase()) {
        isDisabled = true;
    } else if (rowData?.configState && rowData?.configState === CONFIG_STATES.ACTIVATING) {
        isDisabled = true;
    } else if (rowData?.assessmentStatus && rowData?.assessmentStatus === GETWELL_STATUS.OPTIMIZED) {
        isDisabled = true;
    } else if (
        !rowData?.assessmentStatus ||
        rowData?.assessmentStatus?.toLowerCase() === FINDINGS.NOT_APPLICABLE.toLowerCase()
    ) {
        isDisabled = true;
    } else if (driveSizeConfigs.includes(name) && isOverProvisionedWithoutUnderProvisioned()) {
        isDisabled = true;
    } else if (driveSizeConfigs.includes(name) && isSharedDrive()) {
        isDisabled = true;
    }

    return isDisabled;
};

export const bulkFixDisableCheck = (
    configType: string,
    isFixNotSupported: boolean,
    selectedRowsForOptimize: any,
    t: any
) => {
    let isFixDisabled = false;
    let fixDisableMsg = '';
    const state = store.getState();
    const { inProgressHostData } = state.getWellOptimize;
    // Function to check if any selected row has assessmentStatus as "Not optimized"
    const checkIfAnyRowNotOptimized = (selectedRows: any[]) =>
        selectedRows.some((row: any) => row?.assessmentStatus !== GETWELL_STATUS.OPTIMIZED);

    const checkIfAnyRowNotFound = (selectedRows: any[]) =>
        selectedRows.every(
            (row: any) =>
                !row?.assessmentStatus || row?.assessmentStatus?.toLowerCase() === FINDINGS.NOT_APPLICABLE.toLowerCase()
        );

    const checkIfAllRowNotOnline = (selectedRows: any[]) =>
        selectedRows.every((row: any) => row?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP);

    // Function to check if all selected rows has same host
    const checkIfAllRowsSameHost = (selectedRows: any[]) =>
        selectedRows.every((row: any) => row?.databaseHostId === selectedRows[0]?.databaseHostId);

    // Function to check if all shared drives
    const checkIfAllDrivesShared = (selectedRows: any[]) =>
        selectedRows.every(
            (row: any) =>
                row?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.NOT_OPTIMIZED.toLowerCase() &&
                !row?.sizingViolations?.underProvisionedDrives?.length &&
                row?.sizingViolations?.ignoredDrives?.length
        );

    // Function to check if all overprovisioned
    const checkIfAllDrivesOverprovisioned = (selectedRows: any[]) =>
        selectedRows.every(
            (row: any) =>
                row?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OPTIMIZED.toLowerCase() ||
                row?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase() ||
                (row?.sizingViolations?.overProvisionedDrives?.length &&
                    !row?.sizingViolations?.underProvisionedDrives?.length)
        );

    // Function to check if ALL selected rows are not fixable (none have "Not optimized" status)
    const checkIfAllRowsNotFixable = (selectedRows: any[]) =>
        selectedRows.every((row: any) => checkSingleRowFix(inProgressHostData, configType, row));

    if (configType === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.bulk-fix-disable-for-fsx-for-ontap-backup');
    } else if (
        configType === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT ||
        configType === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT ||
        configType === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT ||
        configType === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT
    ) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.bulk-fix-disable-for-asm');
    } else if (isFixNotSupported) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.fix-disabled');
    } else if (!checkIfAnyRowNotOptimized(selectedRowsForOptimize)) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.bulk-fix-disabled');
    } else if (checkIfAnyRowNotFound(selectedRowsForOptimize)) {
        isFixDisabled = true;
        fixDisableMsg = `${configType} ${t('databases.well-architect.assessment-not-available')}`;
    } else if (checkIfAllRowNotOnline(selectedRowsForOptimize)) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.only-online-resource-fix');
    } else if (
        configType === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING &&
        !checkIfAllRowsSameHost(selectedRowsForOptimize)
    ) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.multi-instance-selection-for-same-host');
    } else if (
        configType === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE &&
        checkIfAllDrivesOverprovisioned(selectedRowsForOptimize)
    ) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.log-drive-over-provisioned-error');
    } else if (
        configType === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE &&
        checkIfAllDrivesOverprovisioned(selectedRowsForOptimize)
    ) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.tempdb-drive-over-provisioned-error');
    } else if (
        configType === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM &&
        checkIfAllDrivesOverprovisioned(selectedRowsForOptimize)
    ) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.file-system-headroom-over-provisioned-error');
    } else if (
        (configType === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
            configType === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            configType === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) &&
        checkIfAllDrivesShared(selectedRowsForOptimize)
    ) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.not-optimized-shared-drive');
    } else if (checkIfAllRowsNotFixable(selectedRowsForOptimize)) {
        isFixDisabled = true;
        fixDisableMsg = t('databases.well-architect.mixed-selection-fix-not-supported');
    }

    return { isFixDisabled, fixDisableMsg };
};

export const sortOptimizeDashboardInnerTable = (data: any) => {
    if (!data || data.length < 2) {
        return data;
    }

    const statusWeights: any = {
        [GETWELL_STATUS.NOT_OPTIMIZED]: 5000,
        [GETWELL_STATUS.OVER_PROVISIONED]: 4000,
        [GETWELL_STATUS.UNDER_PROVISIONED]: 3000,
        '': 2000,
        [GETWELL_STATUS.OPTIMIZED]: 1000
    };

    const result = data.slice().sort((a: any, b: any) => {
        const weightA: number = statusWeights[a.assessmentStatus || ''];
        const weightB: number = statusWeights[b.assessmentStatus || ''];

        return weightB - weightA;
    });

    return result;
};

export const filterNotOptimizedRows = (data: any[]) =>
    data.filter(
        row =>
            row?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP &&
            row.assessmentStatus &&
            row.assessmentStatus !== GETWELL_STATUS.OPTIMIZED
    );

// Check if all rowData entries have the same assessment status
export const getAssessmentStatusConsistency = (data: any) => {
    if (Array.isArray(data)) {
        if (data.length === 0) return false;
        if (data.length === 1) return false; // Single entry should return false
        const firstStatus = data[0]?.assessmentStatus;
        // Return true if different, false if same
        return !data.every(item => item?.assessmentStatus === firstStatus);
    }
    return false; // Single object should return false
};

// Helper function to calculate postpone information
export const calculatePostponeInfo = (configObj: any) => {
    if (!configObj) return null;

    const { startTime, endTime } = configObj;

    const postponeStartDate = new Date(startTime);
    const postponeEndDate = new Date(endTime);
    const today = new Date();

    const daysLeft = Math.max(0, Math.ceil((postponeEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // Format postpone date
    const postponeDateFormatted = postponeStartDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return {
        postponeDate: postponeDateFormatted,
        daysLeft
    };
};
