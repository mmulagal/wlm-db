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
import { JOB_MONITORING_STATUS, MANAGE_POLLING_INTERVAL, MANAGE_STATES, WLF_TABS } from '../../../../utils/consts';
import store from '../../../../store/store';
import { uniqueHostRow, updateInstanceStatus } from '../../InventoryUtilsV2';
import { ManageReadinessInterface } from '../../../../utils/types/inventoryV2Types';

// Handles manage action for a single instance, including permission checks and API call
export const handleSingleInstanceManage = (
    manageSingleInstanceChecks: any,
    dispatch: any,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: any
) => {
    const allowManage = isAllowManage(manageSingleInstanceChecks?.manageReadinessData);
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

// Handles manage action for multiple instances, checks readiness and triggers bulk API call
export const handleMultiInstanceManage = (
    bulkDetectedInstanceList: any,
    dispatch: any,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: any
) => {
    // Check if any instance is fully ready
    const anyInstanceReady =
        Array.isArray(bulkDetectedInstanceList) &&
        bulkDetectedInstanceList.some(
            (instance: any) => instance?.data?.manageReadiness && isAllowManage(instance.data.manageReadiness)
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

// Calls the manage API for a single instance, handles installation of missing modules, and manages job status
export const callManageSingleInstanceApi = async (
    manageSingleInstanceChecks: any,
    dispatch: any,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: any
) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell } = state.inventoryV2.manageInstanceInstallAction;
    let installModules: Array<string> = [];
    if (manageSingleInstanceChecks?.installMissingAWS && installMissingAWS) {
        installModules = [...installModules, ...manageSingleInstanceChecks?.installMissingAWSList];
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
            const inProgressId = uniqueHostRow(
                `${manageSingleInstanceChecks?.ec2InstanceId}_${manageSingleInstanceChecks?.databaseInstanceName}`,
                manageSingleInstanceChecks?.credentialsId,
                manageSingleInstanceChecks?.region
            );
            dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), inProgressId])));
            const manageInstanceMsg = (
                <DsTypography variant="Regular_14">
                    {`${GENERAL.INSTANCE_MANAGE_REQUEST[0]} ${manageSingleInstanceChecks?.databaseInstanceName} ${GENERAL.INSTANCE_MANAGE_REQUEST[1]}`}
                    <>
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
                    </>
                </DsTypography>
            );
            setTimeout(() => {
                dispatch(setLandingFromWizard(true));
                navigate('../databases/inventory');
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

// Calls the manage API for multiple instances, groups them by unique identifiers, and manages job status
export const callManageMultiInstanceApi = async (
    bulkDetectedInstanceList: any,
    dispatch: any,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: any
) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell } = state.inventoryV2.manageInstanceInstallAction;

    // Build payload for each instance, grouping by ec2InstanceId, region, credentialsId
    const instanceMap = new Map<string, any>();
    bulkDetectedInstanceList
        ?.filter((instance: any) => isAllowManage(instance?.data?.manageReadiness))
        .forEach((instance: any) => {
            let installModules: Array<string> = [];
            if (instance?.manageStates?.installMissingAWS && installMissingAWS) {
                installModules = [...installModules, ...(instance?.manageStates?.installMissingAWSList || [])];
            }
            if (instance?.manageStates?.installMissingPowershell && installMissingPowershell) {
                installModules = [...installModules, MANAGE_STATES.POWERSHELL7];
            }

            const ec2InstanceId = instance?.ec2InstanceId || instance?.data?.ec2InstanceId;
            const region = instance?.region || instance?.data?.regionId;
            const credentialsId = instance?.credentialsId || instance?.data?.credentialId;
            const databaseInstanceName = instance?.databaseInstanceName || instance?.data?.databaseInstanceName;

            const key = `${ec2InstanceId}__${region}__${credentialsId}`;

            if (instanceMap.has(key)) {
                const existing = instanceMap.get(key);
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

    const items = Array.from(instanceMap.values());
    const payload = { items };

    // Call the manage API with the constructed payload
    manageBulkV2InstanceApi({
        payload
    }).then((result: any) => {
        if (result.data.jobId) {
            const updatedState = store.getState();
            const { inProgressInstances } = updatedState.inventoryV2;
            // Use payload.items to create inProgressIDList, covering all databaseInstanceNames
            const inProgressIDList = payload.items.flatMap((item: any) =>
                (item.databaseInstanceNames || [])?.map((dbInstanceName: string) =>
                    uniqueHostRow(`${item.ec2InstanceId}_${dbInstanceName}`, item.credentialsId, item.region)
                )
            );

            dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), ...inProgressIDList])));

            const manageInstanceMsg = (
                <DsTypography variant="Regular_14">
                    {`${GENERAL.INSTANCE_MANAGE_REQUEST[0]} ${GENERAL.INSTANCE_MANAGE_REQUEST[1]}`}
                    <>
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
                    </>
                </DsTypography>
            );
            setTimeout(() => {
                dispatch(setLandingFromWizard(true));
                navigate('../databases/inventory');
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

// Manages the job status for a single instance, updating the inventory table data and in-progress instances
export const manageJobStatus = (
    jobId: string,
    getJobDetailApi: any,
    manageSingleInstanceChecks: any,
    inProgressId: string,
    dispatch: any
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

// Updates the inventory data for completed instances, checking for completed subJobs and updating the in-progress instances
export const updateInventoryDataforCompletedInstance = (jobRes: any, bulkDetectedInstanceList: any, dispatch: any) => {
    const updatedState = store.getState();
    const { inProgressInstances } = updatedState.inventoryV2;

    // Loop through first-level subJobs
    const subJobs = jobRes?.data?.subJobs || [];
    subJobs.forEach((subJob: any) => {
        // Only process if subJob is COMPLETED and WARNING
        if (subJob.status === JOB_MONITORING_STATUS.COMPLETED || subJob.status === JOB_MONITORING_STATUS.WARNING) {
            const metadata = subJob.metadata;
            const resourceId = subJob.resourceName || subJob.metadata?.resourceId;
            const credentialsId = subJob.credentialsId || subJob.metadata?.credentialsId;
            const regionCode = subJob.region?.code || subJob.metadata?.region;
            // Find the matching row in bulkDetectedInstanceList
            const matchedRow = bulkDetectedInstanceList.find((row: any) => {
                const rowCredId = row?.credentialsId || row?.data?.credentialId;
                const rowRegion = row?.region || row?.data?.regionId;
                const rowInstanceId = row?.ec2InstanceId || row?.data?.ec2InstanceId;
                return rowCredId === credentialsId && rowRegion === regionCode && rowInstanceId === resourceId;
            });
            // Get only databaseInstanceNames that are COMPLETED under instanceManagementStatus
            const completedDbNames = (metadata?.instanceManagementStatus || [])
                .filter((item: any) => item.status === JOB_MONITORING_STATUS.COMPLETED)
                .map((item: any) => item.databaseInstanceName);

            // Check if the unique row is present in inProgressInstances before updating
            if (matchedRow) {
                (completedDbNames || []).forEach((dbInstanceName: string) => {
                    const uniqueId = uniqueHostRow(`${resourceId}_${dbInstanceName}`, credentialsId, regionCode);
                    if (inProgressInstances.has(uniqueId)) {
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
        const ec2InstanceId = metadata.ec2InstanceId;
        const credentialsId = subJob.credentialsId || metadata.credentialsId;
        const region = subJob.region?.code || metadata.region;
        // Only include COMPLETED databaseInstanceNames
        const completedDbNames = (metadata.instanceManagementStatus || [])
            .filter((item: any) => item.status === JOB_MONITORING_STATUS.COMPLETED)
            .map((item: any) => item.databaseInstanceName);

        return completedDbNames.map((dbInstanceName: string) =>
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
    bulkDetectedInstanceList: any,
    dispatch: any
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

// Checks if the manage readiness data has missing PowerShell 7 modules
export const hasMissingPowershell7 = (manageReadinessData: any) => {
    if (!manageReadinessData) return false;
    const readinessKeys = Object.keys(manageReadinessData);
    for (const key of readinessKeys) {
        const missingModules = manageReadinessData[key]?.missingModules || [];
        if (missingModules.includes(MANAGE_STATES.POWERSHELL7)) {
            return true;
        }
    }
    return false;
};

// Filters and returns a list of unique missing modules from the manage readiness data, excluding PowerShell 7
export const missingModules = (manageReadinessData: any) => {
    if (!manageReadinessData) return [];

    const readinessKeys = Object.keys(manageReadinessData);
    const filteredModulesSet: Set<string> = new Set();

    readinessKeys.forEach(key => {
        const missingModules = manageReadinessData[key]?.missingModules || [];
        missingModules
            .filter((module: string) => module !== MANAGE_STATES.POWERSHELL7)
            .forEach((module: string) => filteredModulesSet.add(module));
    });

    const filteredModules = Array.from(filteredModulesSet);

    return filteredModules;
};

// Returns the permission state based on the type and manage readiness data
export const getPermissionState = (type: string, manageReadinessData: any) => {
    const readinessData = manageReadinessData?.[type];

    if (!readinessData) return GENERAL.NOT_AVAILABLE;

    const missingModules = readinessData?.missingModules || [];
    const hasPowershell7 = missingModules.includes(MANAGE_STATES.POWERSHELL7);
    const otherModules = missingModules.filter((module: string) => module !== MANAGE_STATES.POWERSHELL7);

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
    }

    return overallState;
};

// Checks if the manage readiness data allows for management actions based on missing permissions and modules
export const isAllowManage = (manageReadinessData: any) => {
    const state = store.getState();
    const { installMissingAWS, installMissingPowershell } = state.inventoryV2.manageInstanceInstallAction;

    let anyListEmpty = false;
    const readinessKeys = Object.keys(manageReadinessData);
    for (const key of readinessKeys) {
        if (key === 'missingSqlCmd') continue; // Skip the missingSqlCmd key
        const missingSqlPermissions = manageReadinessData[key]?.missingSqlPermissions || [];
        const missingModules = manageReadinessData[key]?.missingModules || [];
        const otherMissingModules = missingModules.filter((module: string) => module !== MANAGE_STATES.POWERSHELL7);
        if (missingSqlPermissions.length == 0 && missingModules.length == 0) {
            anyListEmpty = true;
        } else if (missingSqlPermissions.length == 0 || missingModules.length > 0) {
            let notMissingPowershellCheck = false;
            if (
                (missingModules.includes(MANAGE_STATES.POWERSHELL7) && installMissingPowershell) ||
                !missingModules.includes(MANAGE_STATES.POWERSHELL7)
            ) {
                notMissingPowershellCheck = true;
            }
            let notMissingModulesCheck = false;
            if (otherMissingModules.length == 0 || (otherMissingModules.length > 0 && installMissingAWS)) {
                notMissingModulesCheck = true;
            }

            if (notMissingPowershellCheck && notMissingModulesCheck) {
                anyListEmpty = true;
            }
        }
    }
    return anyListEmpty;
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
        fsxId: false,
        isFsxRegistered: true
    };
    if (selectedMultiDetectInstances?.length) {
        selectedMultiDetectInstances?.forEach((item: any) => {
            if (!item?.data?.sqlServerAuthentication && !item?.data?.windowsAuthentication) {
                result.sqlServerAuthentication = false;
                result.windowsAuthentication = false;
            }
            if (item?.data?.fsxId && !item?.data?.isFsxRegistered) {
                result.fsxId = true;
                result.isFsxRegistered = false;
            }
        });
    }
    return result;
};
