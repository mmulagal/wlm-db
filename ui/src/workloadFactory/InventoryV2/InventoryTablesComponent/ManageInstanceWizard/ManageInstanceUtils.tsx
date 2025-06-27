import { useNavigate } from 'react-router-dom';
import { BlueXPListeners, Button, DsTypography, postBlueXPMessage } from '@netapp/design-system';
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
    DETECT_HOST_VAR,
    FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY,
    FORM_TO_WLF_NAVIGATE_INVENTORY,
    JOB_MONITORING_STATUS,
    MANAGE_POLLING_INTERVAL,
    MANAGE_STATES,
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

// Checks if the manage readiness data allows for management actions based on missing permissions and modules
export const isAllowManage = (manageReadinessData: ManageReadinessInterface) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell } = state.inventoryV2.manageInstanceInstallAction;

    let anyListEmpty = false;
    const readinessKeys = Object.keys(manageReadinessData);
    readinessKeys.forEach(key => {
        if (key === 'missingSqlCmd') {
            // Skip the missingSqlCmd key
            return;
        }
        const missingSqlPermissions = manageReadinessData[key]?.missingSqlPermissions || [];
        const missingModules = manageReadinessData[key]?.missingModules || [];
        const otherMissingModules = missingModules.filter((module: string) => module !== MANAGE_STATES.POWERSHELL7);
        if (missingSqlPermissions.length === 0 && missingModules.length === 0) {
            anyListEmpty = true;
        } else if (missingSqlPermissions.length === 0 || missingModules.length > 0) {
            let notMissingPowershellCheck = false;
            if (
                (missingModules.includes(MANAGE_STATES.POWERSHELL7) && installMissingPowershell) ||
                !missingModules.includes(MANAGE_STATES.POWERSHELL7)
            ) {
                notMissingPowershellCheck = true;
            }
            let notMissingModulesCheck = false;
            if (otherMissingModules.length === 0 || (otherMissingModules.length > 0 && installMissingAWS)) {
                notMissingModulesCheck = true;
            }

            if (notMissingPowershellCheck && notMissingModulesCheck) {
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
    const { installMissingAWS, installMissingPowershell } = state.inventoryV2.manageInstanceInstallAction;
    let installModules: Array<string> = [];
    if (manageSingleInstanceChecks?.installMissingAWS && installMissingAWS) {
        installModules = [...installModules, ...(manageSingleInstanceChecks?.installMissingAWSList || [])];
    }
    if (manageSingleInstanceChecks?.installMissingPowershell && installMissingPowershell) {
        installModules = [...installModules, MANAGE_STATES.POWERSHELL7];
    }
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

// Handles manage action for a single instance, including permission checks and API call
export const handleSingleInstanceManage = (
    manageSingleInstanceChecks: ManageStates,
    dispatch: AppDispatch,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: ReturnType<typeof useNavigate>
) => {
    const allowManage = isAllowManage(manageSingleInstanceChecks?.manageReadinessData || {});
    if (
        manageSingleInstanceChecks?.assessment === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.remediation === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.dbcreation === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.sandbox === GENERAL.NOT_AVAILABLE
    ) {
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
    } else if (!allowManage) {
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
    navigate: ReturnType<typeof useNavigate>
) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell } = state.inventoryV2.manageInstanceInstallAction;

    // Build payload for each instance, grouping by ec2InstanceId, region, credentialsId
    const instanceMap = new Map<string, ManageApiPayloadItem>();
    bulkDetectedInstanceList
        ?.filter(
            (instance: BulkDetectedInstance) =>
                instance.authorized && isAllowManage(instance?.manageReadiness || instance?.data?.manageReadiness || {})
        )
        .forEach((instance: BulkDetectedInstance) => {
            let installModules: Array<string> = [];
            if (instance?.manageStates?.installMissingAWS && installMissingAWS) {
                installModules = [...installModules, ...(instance?.manageStates?.installMissingAWSList || [])];
            }
            if (instance?.manageStates?.installMissingPowershell && installMissingPowershell) {
                installModules = [...installModules, MANAGE_STATES.POWERSHELL7];
            }

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
    navigate: ReturnType<typeof useNavigate>
) => {
    // Check if any instance is fully ready
    const anyInstanceReady =
        Array.isArray(bulkDetectedInstanceList) &&
        bulkDetectedInstanceList.some(
            (instance: any) =>
                (instance.authorized && instance?.manageReadiness && isAllowManage(instance.manageReadiness || {})) ||
                (instance?.data?.manageReadiness && isAllowManage(instance?.data?.manageReadiness || {}))
        );

    if (anyInstanceReady) {
        callManageMultiInstanceApi(
            bulkDetectedInstanceList,
            dispatch,
            manageBulkV2InstanceApi,
            getJobDetailApi,
            navigate
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

// Filters and returns a list of unique missing modules from the manage readiness data, excluding PowerShell 7
export const missingModules = (manageReadinessData: ManageReadinessInterface) => {
    if (!manageReadinessData) return [];

    const readinessKeys = Object.keys(manageReadinessData);
    const filteredModulesSet: Set<string> = new Set();

    readinessKeys.forEach(key => {
        const missingModulesList = manageReadinessData[key]?.missingModules || [];
        missingModulesList
            .filter((module: string) => module !== MANAGE_STATES.POWERSHELL7)
            .forEach((module: string) => filteredModulesSet.add(module));
    });

    const filteredModules = Array.from(filteredModulesSet);

    return filteredModules;
};

// Returns the permission state based on the type and manage readiness data
export const getPermissionState = (type: string, manageReadinessData: ManageReadinessInterface) => {
    const readinessData = manageReadinessData?.[type];

    if (!readinessData) return GENERAL.NOT_AVAILABLE;

    const missingModulesList = readinessData?.missingModules || [];
    const hasPowershell7 = missingModulesList.includes(MANAGE_STATES.POWERSHELL7);
    const otherModules = missingModulesList.filter((module: string) => module !== MANAGE_STATES.POWERSHELL7);

    const permissions = readinessData?.missingSqlPermissions;

    if (otherModules.length > 0 || permissions.length > 0) {
        return MANAGE_STATES.MISSING_PREREQUISITES;
    }

    if (hasPowershell7) {
        return MANAGE_STATES.MISSING_POWERSHELL;
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
    partnerManageReadinessData: ManageReadinessInterface
): ManageReadinessInterface => {
    const mergedData: any = {};

    Object.keys(manageReadinessData).forEach(key => {
        if (key !== 'missingSqlCmd') {
            mergedData[key] = {
                missingSqlPermissions: Array.from(
                    new Set([
                        ...manageReadinessData[key].missingSqlPermissions,
                        ...partnerManageReadinessData[key].missingSqlPermissions
                    ])
                ),
                missingModules: Array.from(
                    new Set([
                        ...manageReadinessData[key].missingModules,
                        ...partnerManageReadinessData[key].missingModules
                    ])
                )
            };
        } else {
            mergedData[key] = manageReadinessData[key] || partnerManageReadinessData[key];
        }
    });

    return mergedData;
};

// Gets the bulk detect checks for multiple instances, returning a summary of authentication and FSx registration status
export const getBulkDetectChecks = (selectedMultiDetectInstances: any) => {
    const result = {
        sqlServerAuthentication: true,
        windowsAuthentication: true,
        windowsDomainUserAuthentication: true,
        fsxId: false,
        isFsxRegistered: true
    };
    if (selectedMultiDetectInstances?.length) {
        selectedMultiDetectInstances?.forEach((item: any) => {
            if (!item?.data?.sqlServerAuthentication && !item?.data?.windowsAuthentication) {
                result.sqlServerAuthentication = false;
                result.windowsAuthentication = false;
            }
            if (!item?.data?.windowsDomainUserAuthentication) {
                result.windowsDomainUserAuthentication = false;
            }
            if (item?.data?.fsxId && !item?.data?.isFsxRegistered) {
                result.fsxId = true;
                result.isFsxRegistered = false;
            }
        });
    }
    return result;
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
        const sqlServerInstance = instance?.data?.sqlServerInstance || instance?.data?.databaseInstanceName || '';
        const ec2InstanceId = instance?.data?.ec2InstanceId;
        if (!ec2InstanceId) return;

        // Build credentials array for this instance
        const credentials: any[] = [];
        let checkManageReadiness = false;

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
            checkManageReadiness = true;
        }

        if (
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
            checkManageReadiness = true;
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
    dispatch: AppDispatch
) => {
    const updatedInstances = newSelectedMultiDetectInstances?.map((instance: any) => {
        const isSqlAuthRequired =
            !instance?.data?.sqlServerAuthentication &&
            !instance?.data?.windowsAuthentication &&
            !instance?.data?.windowsDomainUserAuthentication;
        const isFsxRegisterRequired = instance?.data?.fsxId && !instance?.data?.isFsxRegistered;

        const res = result?.data?.items?.find(
            (r: any) =>
                r.credentialsId === instance?.data?.credentialId &&
                r.region === instance?.data?.regionId &&
                r.ec2InstanceId === instance?.data?.ec2InstanceId
        );

        if (!res) return instance;

        let sqlAuthSuccess = true;
        let fsxSuccess = true;

        if (isSqlAuthRequired) {
            const sqlDetail = res.registerDetails?.find(
                (d: any) => d.resourceId === instance?.data?.databaseInstanceName
            );
            sqlAuthSuccess =
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
        if (isSqlAuthRequired && isFsxRegisterRequired) {
            authorized = sqlAuthSuccess && fsxSuccess;
        } else if (isSqlAuthRequired) {
            authorized = sqlAuthSuccess;
        } else if (isFsxRegisterRequired) {
            authorized = fsxSuccess;
        }

        // Optionally update manageReadiness from the first successful detail
        let manageReadiness = null;
        if (authorized) {
            const detail = res.registerDetails?.find(
                (d: any) =>
                    (isSqlAuthRequired && d.resourceId === instance?.data?.databaseInstanceName) ||
                    (isFsxRegisterRequired && d.resourceId === instance?.data?.fsxId)
            );
            manageReadiness = detail?.manageReadiness || null;
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

export const isAlreadyDetectedCheck = (data: InventoryTableInstanceDatInterface) =>
    !!(
        data &&
        (data?.sqlServerAuthentication || data?.windowsAuthentication || data?.windowsDomainUserAuthentication) &&
        (!data?.fsxId || (data?.fsxId && data?.isFsxRegistered))
    );
