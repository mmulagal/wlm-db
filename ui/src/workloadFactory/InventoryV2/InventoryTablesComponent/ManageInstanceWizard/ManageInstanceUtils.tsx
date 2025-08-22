import { useNavigate } from 'react-router-dom';
import { BlueXPListeners, Button, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import { TFunction } from 'i18next';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../../store/notificationSlice';
import {
    setInProgressInstances,
    setInventoryTableData,
    setLandingFromWizard,
    setSelectedHeaderTab
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    AUTHENTICATION_TYPE,
    DBType,
    DETECT_HOST_VAR,
    FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_INVENTORY,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    JOB_MONITORING_STATUS,
    MANAGE_POLLING_INTERVAL,
    MANAGE_STATES,
    REGISTER_INSTANCE_STATE,
    SQL_DEPLOYMENT_MODE,
    WLF_TABS
} from '../../../../utils/consts';
import store, { AppDispatch } from '../../../../store/store';
import { saveFsxInCredRegisteredObj, uniqueHostRow, updateInstanceStatus } from '../../InventoryUtilsV2';
import { InventoryTableInstanceDatInterface, ManageReadinessInterface } from '../../../../utils/types/inventoryV2Types';
import {
    BulkDetectedInstance,
    JobResponse,
    ManageApiPayload,
    ManageApiPayloadItem,
    ManageStates,
    RegisterResourceCredBulkResultItem,
    SubJob
} from '../../../../utils/types/registerTypes';
import {
    getBulkDetectChecksHelper,
    isAuthRequiredForInstance
} from './DetectInstanceStep/DetectContent/DetectContentHelper';

// Checks if the manage readiness data allows for management actions based on missing permissions and modules
export const isAllowManage = (manageReadinessData: ManageReadinessInterface, engineType: string) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell, installMissingJQ } =
        state.inventoryV2.manageInstanceInstallAction;

    let anyListEmpty = false;
    const readinessKeys = Object.keys(manageReadinessData);
    readinessKeys.forEach(key => {
        if (key === 'missingSqlCmd') {
            // Skip the missingSqlCmd key
            return;
        }
        const missingPermissions =
            engineType === DBType.ORACLE
                ? manageReadinessData[key]?.missingPermissions || []
                : manageReadinessData[key]?.missingSqlPermissions || [];
        const missingModules = manageReadinessData[key]?.missingModules || [];
        const otherMissingModules = missingModules.filter(
            (module: string) => module !== MANAGE_STATES.POWERSHELL7 && module !== MANAGE_STATES.JQ
        );
        if (missingPermissions.length === 0 && missingModules.length === 0) {
            anyListEmpty = true;
        } else if (missingPermissions.length === 0 || missingModules.length > 0) {
            const checks = [
                // PowerShell7 check
                (missingModules.includes(MANAGE_STATES.POWERSHELL7) && installMissingPowershell) ||
                    !missingModules.includes(MANAGE_STATES.POWERSHELL7),
                // JQ check
                (missingModules.includes(MANAGE_STATES.JQ) && installMissingJQ) ||
                    !missingModules.includes(MANAGE_STATES.JQ),
                // Other modules check
                otherMissingModules.length === 0 || (otherMissingModules.length > 0 && installMissingAWS)
            ];
            if (checks.every(Boolean)) {
                anyListEmpty = true;
            }
        }
    });
    return anyListEmpty;
};

// Manages the job status for a single instance, updating the inventory table data and in-progress instances
export const manageJobStatus = (
    jobId: string,
    getJobDetailApi: any,
    manageSingleInstanceChecks: ManageStates,
    inProgressId: string,
    dispatch: AppDispatch
) => {
    const jobInterval = setInterval(() => {
        getJobDetailApi({
            id: jobId
        }).then((jobRes: any) => {
            const status = jobRes?.data?.status;
            if (status === JOB_MONITORING_STATUS.COMPLETED || status === JOB_MONITORING_STATUS.WARNING) {
                // Update the inventory table data with the new instance status
                const updatedState = store.getState();
                const { manageSingleInstanceData } = updatedState.inventoryV2;
                const instanceObj = jobRes?.data?.subJobs?.[0]?.metadata?.instanceManagementStatus;
                const resourceId = jobRes?.data?.subJobs?.[0]?.metadata?.resourceId;
                const updatedInventoryTableData = updateInstanceStatus(
                    'manage',
                    manageSingleInstanceData,
                    [manageSingleInstanceChecks?.databaseInstanceName],
                    instanceObj,
                    resourceId
                );
                dispatch(setInventoryTableData(updatedInventoryTableData));
                const { inProgressInstances } = updatedState.inventoryV2;
                const updatedInstances = new Set(Array.from(inProgressInstances).filter(id => id !== inProgressId));
                dispatch(setInProgressInstances(updatedInstances));
                clearInterval(jobInterval);
            } else if (status === JOB_MONITORING_STATUS.FAILED) {
                // If the job failed, remove the in-progress instance from the state
                const updatedState = store.getState();
                const { inProgressInstances } = updatedState.inventoryV2;
                const updatedInstances = new Set(Array.from(inProgressInstances).filter(id => id !== inProgressId));
                dispatch(setInProgressInstances(updatedInstances));
                clearInterval(jobInterval);
            }
        });
    }, MANAGE_POLLING_INTERVAL);
};

// Calls the manage API for a single instance, handles installation of missing modules, and manages job status
export const callManageSingleInstanceApi = async (
    manageSingleInstanceChecks: ManageStates,
    dispatch: AppDispatch,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: ReturnType<typeof useNavigate>
) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell, installMissingJQ } =
        state.inventoryV2.manageInstanceInstallAction;
    const installModules: Array<string> = [
        ...(manageSingleInstanceChecks?.installMissingAWS && installMissingAWS
            ? manageSingleInstanceChecks?.installMissingAWSList || []
            : []),
        ...(manageSingleInstanceChecks?.installMissingPowershell && installMissingPowershell
            ? [MANAGE_STATES.POWERSHELL7]
            : []),
        ...(manageSingleInstanceChecks?.installMissingJQ && installMissingJQ ? [MANAGE_STATES.JQ] : [])
    ];
    const payload = {
        items: [
            {
                ec2InstanceId: manageSingleInstanceChecks?.ec2InstanceId,
                region: manageSingleInstanceChecks?.region,
                credentialsId: manageSingleInstanceChecks?.credentialsId,
                databaseInstanceNames: [manageSingleInstanceChecks?.databaseInstanceName],
                modulesToInstall: installModules
            }
        ]
    };
    manageBulkV2InstanceApi({
        payload
    }).then((result: any) => {
        if (result.data.jobId) {
            // Update the in-progress instances state
            const updatedState = store.getState();
            const { inProgressInstances } = updatedState.inventoryV2;
            const isWorkloadFactoryStatus = updatedState.auth?.isWorkloadFactory;
            const inProgressId = uniqueHostRow(
                `${manageSingleInstanceChecks?.ec2InstanceId}_${manageSingleInstanceChecks?.databaseInstanceName}`,
                manageSingleInstanceChecks?.credentialsId,
                manageSingleInstanceChecks?.region
            );
            dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), inProgressId])));
            const manageInstanceMsg = (
                <DsTypography variant="Regular_14">
                    {`${GENERAL.INSTANCE_MANAGE_REQUEST[0]} ${manageSingleInstanceChecks?.databaseInstanceName} ${GENERAL.INSTANCE_MANAGE_REQUEST[1]}`}
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            const path = store.getState().auth.isWorkloadFactory
                                ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                                : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                            postBlueXPMessage({
                                type: BlueXPListeners.navigate,
                                payload: { pathname: path, replace: true }
                            });
                            dispatch(clearNotifications());
                        }}
                    >
                        {' Track progress.'}
                    </Button>
                </DsTypography>
            );
            setTimeout(() => {
                dispatch(setLandingFromWizard(true));
                navigate(FORM_TO_WLF_NAVIGATE_INVENTORY);
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: {
                        pathname: './inventory',
                        replace: true
                    }
                });

                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.INFO,
                        message: manageInstanceMsg
                    })
                );
                manageJobStatus(result.data.jobId, getJobDetailApi, manageSingleInstanceChecks, inProgressId, dispatch);
            }, 100);
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Register instance failed'
                })
            );
        }
    });
};

const permissionMissing = (engineType: string, manageSingleInstanceChecks: ManageStates) => {
    switch (engineType) {
        case DBType.ORACLE:
            return manageSingleInstanceChecks?.assessment === REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        case DBType.MSSQL:
            return (
                manageSingleInstanceChecks?.assessment === REGISTER_INSTANCE_STATE.NOT_AVAILABLE &&
                manageSingleInstanceChecks?.remediation === REGISTER_INSTANCE_STATE.NOT_AVAILABLE &&
                manageSingleInstanceChecks?.dbcreation === REGISTER_INSTANCE_STATE.NOT_AVAILABLE &&
                manageSingleInstanceChecks?.sandbox === REGISTER_INSTANCE_STATE.NOT_AVAILABLE &&
                manageSingleInstanceChecks?.errorInvestigation === REGISTER_INSTANCE_STATE.NOT_AVAILABLE
            );
        default:
            return false;
    }
};

// Handles manage action for a single instance, including permission checks and API call
export const handleSingleInstanceManage = (
    manageSingleInstanceChecks: ManageStates,
    dispatch: AppDispatch,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: ReturnType<typeof useNavigate>,
    engineType: string,
    t: TFunction
) => {
    const allowManage = isAllowManage(manageSingleInstanceChecks?.manageReadinessData || {}, engineType);
    if (permissionMissing(engineType, manageSingleInstanceChecks)) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: (
                    <>
                        <span style={{ fontWeight: '500' }}>
                            {t('databases.register-flow.manage-min-permissions-requirement-content1')}
                        </span>
                        <span style={{ fontWeight: '400' }}>
                            {engineType === DBType.ORACLE
                                ? t('databases.register-flow.manage-min-permissions-requirement-content2-oracle')
                                : t('databases.register-flow.manage-min-permissions-requirement-content2')}
                        </span>
                    </>
                )
            })
        );
    } else if (!allowManage) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: (
                    <>
                        <span style={{ fontWeight: '500' }}>
                            {t('databases.register-flow.manage-min-permissions-requirement-content1')}
                        </span>
                        <span style={{ fontWeight: '400' }}>
                            {engineType === DBType.ORACLE
                                ? t('databases.register-flow.manage-min-permissions-requirement-content2-oracle')
                                : t('databases.register-flow.manage-min-permissions-requirement-content2')}
                        </span>
                    </>
                )
            })
        );
    } else {
        callManageSingleInstanceApi(
            manageSingleInstanceChecks,
            dispatch,
            manageBulkV2InstanceApi,
            getJobDetailApi,
            navigate
        );
    }
};

// Updates the inventory data for completed instances, checking for completed subJobs and updating the in-progress instances
export const updateInventoryDataforCompletedInstance = (
    jobRes: JobResponse,
    bulkDetectedInstanceList: BulkDetectedInstance,
    dispatch: AppDispatch
) => {
    const updatedState = store.getState();
    const { inProgressInstances } = updatedState.inventoryV2;

    // Loop through first-level subJobs
    const subJobs: SubJob[] = jobRes?.data?.subJobs || [];
    subJobs.forEach((subJob: SubJob) => {
        // Only process if subJob is COMPLETED and WARNING
        if (subJob.status === JOB_MONITORING_STATUS.COMPLETED || subJob.status === JOB_MONITORING_STATUS.WARNING) {
            const { metadata } = subJob;
            const instanceId = subJob.resourceName;
            const resourceId = subJob.metadata?.resourceId;
            const credentialsId = subJob.credentialsId || subJob.metadata?.credentialsId;
            const regionCode = subJob.region?.code || subJob.metadata?.region;
            // Find the matching row in bulkDetectedInstanceList
            const matchedRow = bulkDetectedInstanceList.find((row: any) => {
                const rowCredId = row?.credentialsId || row?.data?.credentialId;
                const rowRegion = row?.region || row?.data?.regionId;
                const rowInstanceId = row?.ec2InstanceId || row?.data?.ec2InstanceId;
                return rowCredId === credentialsId && rowRegion === regionCode && rowInstanceId === instanceId;
            });
            // Get only databaseInstanceNames that are COMPLETED under instanceManagementStatus
            const completedDbNames = (metadata?.instanceManagementStatus || [])
                .filter(
                    (item: any) =>
                        item.status === JOB_MONITORING_STATUS.COMPLETED || item.status === JOB_MONITORING_STATUS.WARNING
                )
                .map((item: any) => item.databaseInstanceName);

            // Check if the unique row is present in inProgressInstances before updating
            if (matchedRow) {
                (completedDbNames || []).forEach((dbInstanceName: string) => {
                    const uniqueIdSuccess = uniqueHostRow(
                        `${instanceId}_${dbInstanceName}`,
                        credentialsId || '',
                        regionCode || ''
                    );
                    if (inProgressInstances.has(uniqueIdSuccess)) {
                        // Call updateInstanceStatus for this row
                        const updatedInventoryTableData = updateInstanceStatus(
                            'manage',
                            matchedRow?.data,
                            [dbInstanceName],
                            metadata?.instanceManagementStatus || [],
                            resourceId
                        );
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                    }
                });
            }
        }
    });

    // Inside your manageBulkJobStatus function, after getting subJobs:
    const inProgressIDListFromSubJobs = subJobs.flatMap((subJob: any) => {
        const metadata = subJob.metadata || {};
        const { ec2InstanceId } = metadata;
        const credentialsId = subJob.credentialsId || metadata.credentialsId;
        const region = subJob.region?.code || metadata.region;
        // Include COMPLETED, WARNING, FAILED databaseInstanceNames to stop loading on inventory page
        const allDbNames = (metadata.instanceManagementStatus || [])
            .filter(
                (item: any) =>
                    item.status === JOB_MONITORING_STATUS.COMPLETED ||
                    item.status === JOB_MONITORING_STATUS.WARNING ||
                    item.status === JOB_MONITORING_STATUS.FAILED
            )
            .map((item: any) => item.databaseInstanceName);

        return allDbNames.map((dbInstanceName: string) =>
            uniqueHostRow(`${ec2InstanceId}_${dbInstanceName}`, credentialsId, region)
        );
    });

    // Remove in-progress IDs as before
    if (inProgressIDListFromSubJobs) {
        const updatedInstances = new Set(
            Array.from(inProgressInstances).filter((id: any) => !inProgressIDListFromSubJobs.includes(id))
        );
        dispatch(setInProgressInstances(updatedInstances));
    }
};

// Manages the job status for bulk operations, checking job status at intervals and updating inventory data accordingly
export const manageBulkJobStatus = (
    jobId: string,
    getJobDetailApi: any,
    inProgressIDList: Array<string>,
    bulkDetectedInstanceList: BulkDetectedInstance[],
    dispatch: AppDispatch
) => {
    const jobInterval = setInterval(() => {
        getJobDetailApi({
            id: jobId
        }).then((jobRes: any) => {
            const status = jobRes?.data?.status;
            if (status === JOB_MONITORING_STATUS.COMPLETED || status === JOB_MONITORING_STATUS.WARNING) {
                // Update the inventory table data with the new instance status
                updateInventoryDataforCompletedInstance(jobRes, bulkDetectedInstanceList, dispatch);
                clearInterval(jobInterval);
            } else if (status === JOB_MONITORING_STATUS.FAILED) {
                // If the job failed, remove the in-progress instances from the state
                const updatedState = store.getState();
                const { inProgressInstances } = updatedState.inventoryV2;
                const updatedInstances = new Set(
                    Array.from(inProgressInstances).filter((id: any) => !inProgressIDList.includes(id))
                );
                dispatch(setInProgressInstances(updatedInstances));
                clearInterval(jobInterval);
            } else if (status === JOB_MONITORING_STATUS.IN_PROGRESS) {
                // If the job is still in progress, update the inventory data for completed instances
                updateInventoryDataforCompletedInstance(jobRes, bulkDetectedInstanceList, dispatch);
            }
        });
    }, MANAGE_POLLING_INTERVAL);
};

// Calls the manage API for multiple instances, groups them by unique identifiers, and manages job status
export const callManageMultiInstanceApi = async (
    bulkDetectedInstanceList: BulkDetectedInstance[],
    dispatch: AppDispatch,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: ReturnType<typeof useNavigate>,
    engineType: string
) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell, installMissingJQ } =
        state.inventoryV2.manageInstanceInstallAction;

    // Build payload for each instance, grouping by ec2InstanceId, region, credentialsId
    const instanceMap = new Map<string, ManageApiPayloadItem>();
    bulkDetectedInstanceList
        ?.filter(
            (instance: BulkDetectedInstance) =>
                instance.authorized &&
                isAllowManage(instance?.manageReadiness || instance?.data?.manageReadiness || {}, engineType)
        )
        .forEach((instance: BulkDetectedInstance) => {
            const installModules: Array<string> = [
                ...(instance?.manageStates?.installMissingAWS && installMissingAWS
                    ? instance?.manageStates?.installMissingAWSList || []
                    : []),
                ...(instance?.manageStates?.installMissingPowershell && installMissingPowershell
                    ? [MANAGE_STATES.POWERSHELL7]
                    : []),
                ...(instance?.manageStates?.installMissingJQ && installMissingJQ ? [MANAGE_STATES.JQ] : [])
            ];

            const ec2InstanceId: string = instance?.ec2InstanceId || instance?.data?.ec2InstanceId || '';
            const region: string = instance?.region || instance?.data?.regionId || '';
            const credentialsId: string = instance?.credentialsId || instance?.data?.credentialId || '';
            const databaseInstanceName: string =
                instance?.databaseInstanceName || instance?.data?.databaseInstanceName || '';

            const key = `${ec2InstanceId}__${region}__${credentialsId}`;

            if (instanceMap.has(key)) {
                const existing = instanceMap.get(key) as ManageApiPayloadItem;
                // Append databaseInstanceName if not already present
                if (!existing.databaseInstanceNames.includes(databaseInstanceName)) {
                    existing.databaseInstanceNames.push(databaseInstanceName);
                }
                // Append modulesToInstall, avoiding duplicates
                existing.modulesToInstall = Array.from(new Set([...existing.modulesToInstall, ...installModules]));
            } else {
                instanceMap.set(key, {
                    ec2InstanceId,
                    region,
                    credentialsId,
                    databaseInstanceNames: [databaseInstanceName],
                    modulesToInstall: installModules
                });
            }
        });

    const items: ManageApiPayloadItem[] = Array.from(instanceMap.values());
    const payload: ManageApiPayload = { items };

    // Call the manage API with the constructed payload
    manageBulkV2InstanceApi({
        payload
    }).then((result: any) => {
        if (result.data.jobId) {
            const updatedState = store.getState();
            const { inProgressInstances } = updatedState.inventoryV2;
            const isWorkloadFactoryStatus = updatedState.auth?.isWorkloadFactory;
            // Use payload.items to create inProgressIDList, covering all databaseInstanceNames
            const inProgressIDList = payload.items.flatMap((item: any) =>
                (item.databaseInstanceNames || [])?.map((dbInstanceName: string) =>
                    uniqueHostRow(`${item.ec2InstanceId}_${dbInstanceName}`, item.credentialsId, item.region)
                )
            );

            dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), ...inProgressIDList])));

            const manageInstanceMsg = (
                <DsTypography variant="Regular_14">
                    {`${GENERAL.MULTI_INSTANCE_MANAGE_REQUEST[0]} ${inProgressIDList?.length} ${GENERAL.MULTI_INSTANCE_MANAGE_REQUEST[1]}`}
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            const path = store.getState().auth.isWorkloadFactory
                                ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                                : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                            postBlueXPMessage({
                                type: BlueXPListeners.navigate,
                                payload: { pathname: path, replace: true }
                            });
                            dispatch(clearNotifications());
                        }}
                    >
                        {' Track progress.'}
                    </Button>
                </DsTypography>
            );
            setTimeout(() => {
                dispatch(setLandingFromWizard(true));
                navigate(FORM_TO_WLF_NAVIGATE_INVENTORY);
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: {
                        pathname: './inventory',
                        replace: true
                    }
                });
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.INFO,
                        message: manageInstanceMsg
                    })
                );
                // Call manageBulkJobStatus to handle the job monitoring
                manageBulkJobStatus(
                    result.data.jobId,
                    getJobDetailApi,
                    inProgressIDList,
                    bulkDetectedInstanceList,
                    dispatch
                );
            }, 100);
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Register instances failed'
                })
            );
        }
    });
};

// Handles manage action for multiple instances, checks readiness and triggers bulk API call
export const handleMultiInstanceManage = (
    bulkDetectedInstanceList: BulkDetectedInstance[],
    dispatch: AppDispatch,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: ReturnType<typeof useNavigate>,
    engineType: string
) => {
    // Check if any instance is fully ready
    const anyInstanceReady =
        Array.isArray(bulkDetectedInstanceList) &&
        bulkDetectedInstanceList.some(
            (instance: any) =>
                (instance.authorized &&
                    instance?.manageReadiness &&
                    isAllowManage(instance.manageReadiness || {}, engineType)) ||
                (instance?.data?.manageReadiness && isAllowManage(instance?.data?.manageReadiness || {}, engineType))
        );

    if (anyInstanceReady) {
        callManageMultiInstanceApi(
            bulkDetectedInstanceList,
            dispatch,
            manageBulkV2InstanceApi,
            getJobDetailApi,
            navigate,
            engineType
        );
    } else {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: (
                    <>
                        <span style={{ fontWeight: '500' }}>{GENERAL.MANAGE_MIN_PERMISSION_REQUIRED[0]}</span>
                        <span style={{ fontWeight: '400' }}>{GENERAL.MANAGE_MIN_PERMISSION_REQUIRED[1]}</span>
                    </>
                )
            })
        );
    }
};

// Checks if the manage readiness data has missing PowerShell 7 modules
export const hasMissingPowershell7 = (manageReadinessData: any) => {
    if (!manageReadinessData) return false;
    return Object.keys(manageReadinessData).some(key =>
        (manageReadinessData[key]?.missingModules || []).includes(MANAGE_STATES.POWERSHELL7)
    );
};

// Checks if the manage readiness data has missing JQ modules
export const hasMissingJQ = (manageReadinessData: any) => {
    if (!manageReadinessData) return false;
    return Object.keys(manageReadinessData).some(key =>
        (manageReadinessData[key]?.missingModules || []).includes(MANAGE_STATES.JQ)
    );
};

// Filters and returns a list of unique missing modules from the manage readiness data, excluding PowerShell 7 and JQ
export const missingModules = (manageReadinessData: ManageReadinessInterface) => {
    if (!manageReadinessData) return [];

    const readinessKeys = Object.keys(manageReadinessData);
    const filteredModulesSet: Set<string> = new Set();

    readinessKeys.forEach(key => {
        const missingModulesList = manageReadinessData[key]?.missingModules || [];
        missingModulesList
            .filter((module: string) => module !== MANAGE_STATES.POWERSHELL7 && module !== MANAGE_STATES.JQ)
            .forEach((module: string) => filteredModulesSet.add(module));
    });

    const filteredModules = Array.from(filteredModulesSet);

    return filteredModules;
};

// Returns the permission state based on the type and manage readiness data
export const getPermissionState = (type: string, manageReadinessData: ManageReadinessInterface, engineType: string) => {
    let readinessData: any;
    if (type === '') {
        readinessData = manageReadinessData;
    } else {
        readinessData = manageReadinessData?.[type];
    }

    if (!readinessData) return GENERAL.NOT_AVAILABLE;

    const missingModulesList = readinessData?.missingModules || [];
    const hasPowershell7 = missingModulesList.includes(MANAGE_STATES.POWERSHELL7);
    const hasJQ = missingModulesList.includes(MANAGE_STATES.JQ);
    const otherModules = missingModulesList.filter((module: string) => module !== MANAGE_STATES.POWERSHELL7);

    const permissions =
        engineType === DBType.ORACLE ? readinessData?.missingPermissions : readinessData?.missingSqlPermissions;

    if (otherModules.length > 0 || (permissions && permissions.length > 0)) {
        return MANAGE_STATES.MISSING_PREREQUISITES;
    }

    if (hasPowershell7) {
        return MANAGE_STATES.MISSING_POWERSHELL;
    }

    if (hasJQ) {
        return MANAGE_STATES.MISSING_JQ;
    }

    return MANAGE_STATES.READY;
};

// Checks the overall manage state based on individual states of assessment, remediation, dbcreation, and sandbox
export const checkOverallManageState = (
    assessment: string,
    remediation: string,
    dbcreation: string,
    sandbox: string
) => {
    let overallState = '';

    if ([assessment, remediation, dbcreation, sandbox].includes(MANAGE_STATES.READY)) {
        overallState = MANAGE_STATES.READY;
    } else if ([assessment, remediation, dbcreation, sandbox].includes(MANAGE_STATES.MISSING_PREREQUISITES)) {
        overallState = MANAGE_STATES.MISSING_PREREQUISITES;
    } else if ([assessment, remediation, dbcreation, sandbox].includes(MANAGE_STATES.MISSING_POWERSHELL)) {
        overallState = MANAGE_STATES.MISSING_POWERSHELL;
    } else {
        overallState = MANAGE_STATES.NOT_READY;
    }

    return overallState;
};

// Merges two manage readiness data objects, combining missing SQL permissions and modules
export const mergeReadinessData = (
    manageReadinessData: ManageReadinessInterface,
    partnerManageReadinessData: ManageReadinessInterface,
    engineType: string
): ManageReadinessInterface => {
    const mergedData: any = {};

    Object.keys(manageReadinessData).forEach(key => {
        if (key !== 'missingSqlCmd') {
            const basePermissions =
                engineType === DBType.ORACLE
                    ? manageReadinessData[key]?.missingPermissions || []
                    : manageReadinessData[key]?.missingSqlPermissions || [];

            const partnerPermissions =
                engineType === DBType.ORACLE
                    ? partnerManageReadinessData[key]?.missingPermissions || []
                    : partnerManageReadinessData[key]?.missingSqlPermissions || [];

            const mergedPermissions = Array.from(new Set([...basePermissions, ...partnerPermissions]));
            const mergedModules = Array.from(
                new Set([...manageReadinessData[key].missingModules, ...partnerManageReadinessData[key].missingModules])
            );

            mergedData[key] = {
                ...(engineType === DBType.ORACLE
                    ? { missingPermissions: mergedPermissions }
                    : { missingSqlPermissions: mergedPermissions }),
                missingModules: mergedModules
            };
        } else {
            mergedData[key] = manageReadinessData[key] || partnerManageReadinessData[key];
        }
    });

    return mergedData;
};

// Gets the bulk detect checks for multiple instances, returning a summary of authentication and FSx registration status
export const getBulkDetectChecks = (selectedMultiDetectInstances: any) => {
    const hostType = selectedMultiDetectInstances?.[0]?.data?.hostType || DBType.MSSQL;
    return getBulkDetectChecksHelper(selectedMultiDetectInstances, hostType);
};

const addCredentialsBasedOnEngineType = (
    instance: BulkDetectedInstance,
    credentials: any[],
    detectManageUserName: string,
    detectManagePassword: string,
    detectWindowsAuthentication: any,
    detectOntapUsername: string,
    detectOntapPassword: string,
    authenticationType: string,
    engineType: string
) => {
    const sqlServerInstance = instance?.data?.sqlServerInstance || instance?.data?.databaseInstanceName || '';

    switch (engineType) {
        case DBType.ORACLE: {
            const { isDefaultAuthentication, oracleServerAuthentication } = instance?.data || {};
            // For Oracle: Only push if isDefaultAuthentication === false && oracleServerAuthentication === false/undefined
            if (
                isDefaultAuthentication === false &&
                !oracleServerAuthentication &&
                detectManageUserName &&
                detectManagePassword
            ) {
                credentials.push({
                    resourceId: sqlServerInstance,
                    resourceType: DETECT_HOST_VAR.ORACLE,
                    username: detectManageUserName,
                    password: detectManagePassword
                });
            }
            break;
        }
        case DBType.MSSQL:
        default: {
            // Add SQL credential if not already registered
            if (
                !instance?.data?.sqlServerAuthentication &&
                !instance?.data?.windowsAuthentication &&
                !instance?.data?.windowsDomainUserAuthentication &&
                detectManageUserName &&
                detectManagePassword &&
                authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
            ) {
                credentials.push({
                    resourceId: sqlServerInstance,
                    resourceType: DETECT_HOST_VAR.MSSQL,
                    username: detectManageUserName,
                    password: detectManagePassword
                });
            }

            // Add Windows credential if not already registered
            else if (
                !instance?.data?.sqlServerAuthentication &&
                !instance?.data?.windowsAuthentication &&
                !instance?.data?.windowsDomainUserAuthentication &&
                detectWindowsAuthentication.username &&
                detectWindowsAuthentication.password &&
                authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
            ) {
                credentials.push({
                    resourceId: sqlServerInstance,
                    resourceType: DETECT_HOST_VAR.WINDOWS,
                    username: detectWindowsAuthentication.username,
                    password: detectWindowsAuthentication.password
                });
            }
            break;
        }
    }

    // Add FSX credential if not already registered
    if (instance?.data?.fsxId && !instance?.data?.isFsxRegistered && detectOntapUsername && detectOntapPassword) {
        credentials.push({
            resourceId: instance?.data?.fsxId,
            resourceType: DETECT_HOST_VAR.FSX,
            username: detectOntapUsername,
            password: detectOntapPassword
        });
    }
};

export const createDetectHostPayloadBulk = (selectedMultiDetectInstances: BulkDetectedInstance[]) => {
    // New logic to combine credentials by ec2InstanceId and skip already registered resources
    const instanceMap: { [key: string]: any } = {};

    const state = store.getState();
    const {
        detectManageUserName,
        detectManagePassword,
        detectWindowsAuthentication,
        detectOntapUsername,
        detectOntapPassword,
        authenticationType
    } = state?.inventoryV2 || {};

    selectedMultiDetectInstances?.forEach((instance: BulkDetectedInstance) => {
        const ec2InstanceId = instance?.data?.ec2InstanceId;
        if (!ec2InstanceId) return;

        // Build credentials array for this instance
        const credentials: any[] = [];
        const checkManageReadiness = false;

        // Add credentials if not already registered
        addCredentialsBasedOnEngineType(
            instance,
            credentials,
            detectManageUserName,
            detectManagePassword,
            detectWindowsAuthentication,
            detectOntapUsername,
            detectOntapPassword,
            authenticationType,
            instance?.data?.hostType
        );

        // If already present, merge credentials arrays
        if (instanceMap[ec2InstanceId]) {
            // Avoid duplicate resourceId/resourceType combos
            const existing = instanceMap[ec2InstanceId].credentials;
            credentials.forEach(cred => {
                if (
                    !existing.some(
                        (e: { resourceId: any; resourceType: any }) =>
                            e.resourceId === cred.resourceId && e.resourceType === cred.resourceType
                    )
                ) {
                    existing.push(cred);
                }
            });
        } else {
            instanceMap[ec2InstanceId] = {
                credentials,
                checkManageReadiness,
                credentialsId: instance?.data?.credentialId,
                region: instance?.data?.regionId,
                ec2InstanceId
            };
            // Logic to add clusterNodesIpAddress for FCI only. This is for resourec-credentials API.
            if (instance?.data?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
                const addresses = instance?.data?.windowsClusterNodes?.map(
                    (obj: { Address: string; Node: string }) => obj?.Address
                );
                instanceMap[ec2InstanceId] = {
                    ...instanceMap[ec2InstanceId],
                    clusterNodesIpAddress: addresses
                };
            }
        }
    });

    // Convert map to array for payload
    const payload = Object.values(instanceMap);
    return payload;
};

export const updateDetectBulkResponse = (
    newSelectedMultiDetectInstances: BulkDetectedInstance[],
    result: { data: { items: RegisterResourceCredBulkResultItem[] } },
    dispatch: AppDispatch,
    engineType: string
) => {
    const updatedInstances = newSelectedMultiDetectInstances?.map((instance: any) => {
        const isAuthRequired = isAuthRequiredForInstance(instance?.data, engineType);
        const isFsxRegisterRequired = instance?.data?.fsxId && !instance?.data?.isFsxRegistered;

        const res = result?.data?.items?.find(
            (r: any) =>
                r.credentialsId === instance?.data?.credentialId &&
                r.region === instance?.data?.regionId &&
                r.ec2InstanceId === instance?.data?.ec2InstanceId
        );

        if (!res) return instance;

        let authSuccess = true;
        let fsxSuccess = true;

        if (isAuthRequired) {
            const sqlDetail = res.registerDetails?.find(
                (d: any) => d.resourceId === instance?.data?.databaseInstanceName
            );
            authSuccess =
                !!sqlDetail && !(sqlDetail.databaseServerError || sqlDetail.fsxnError || sqlDetail.requiredModuleError);
        }

        if (isFsxRegisterRequired) {
            const fsxDetail = res.registerDetails?.find((d: any) => d.resourceId === instance?.data?.fsxId);
            fsxSuccess =
                (fsxDetail &&
                    !(fsxDetail.databaseServerError || fsxDetail.fsxnError || fsxDetail.requiredModuleError)) ??
                false;
        }

        let authorized = false;
        if (isAuthRequired && isFsxRegisterRequired) {
            authorized = authSuccess && fsxSuccess;
        } else if (isAuthRequired) {
            authorized = authSuccess;
        } else if (isFsxRegisterRequired) {
            authorized = fsxSuccess;
        }

        // Optionally update manageReadiness from the first successful detail
        let manageReadiness = null;
        if (authorized) {
            const detail = res.registerDetails?.find(
                (d: any) => isAuthRequired && d.resourceId === instance?.data?.databaseInstanceName
            );
            if (engineType === DBType.MSSQL) {
                manageReadiness = detail?.manageReadiness || null;
            } else if (engineType === DBType.ORACLE) {
                manageReadiness = detail?.manageReadiness.oracle || null;
            }
        }

        // Optionally update FSX registration if successful
        if (authorized && isFsxRegisterRequired && fsxSuccess) {
            saveFsxInCredRegisteredObj(instance?.data?.fsxId, dispatch);
            const updatedInventoryTableData = updateInstanceStatus('detect', instance?.data, instance?.data);
            dispatch(setInventoryTableData(updatedInventoryTableData));
        }

        return {
            ...instance,
            authorized,
            manageReadiness: manageReadiness || instance?.data?.manageReadiness
        };
    });
    return updatedInstances;
};

export const isAlreadyDetectedCheck = (data: any) => {
    if (!data) return false;

    if (data.hostType === DBType.ORACLE) {
        if (data.isDefaultAuthentication === true) {
            // If not default authentication, only check FSx registration
            return !data.fsxId || (data.fsxId && data.isFsxRegistered);
        }
        if (data.isDefaultAuthentication === false) {
            // If default authentication is false, check FSx registration and oracleServerAuthentication must be true
            return (!data.fsxId || (data.fsxId && data.isFsxRegistered)) && data.oracleServerAuthentication === true;
        }
        // If isDefaultAuthentication is undefined/null, treat as not detected
        return false;
    }

    // For MSSQL and others
    return !!(
        (data.sqlServerAuthentication || data.windowsAuthentication || data.windowsDomainUserAuthentication) &&
        (!data.fsxId || (data.fsxId && data.isFsxRegistered))
    );
};
