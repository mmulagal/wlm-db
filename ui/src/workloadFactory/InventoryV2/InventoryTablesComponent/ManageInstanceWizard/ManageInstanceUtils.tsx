import { useNavigate } from 'react-router-dom';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../../store/notificationSlice';
import {
    setInProgressInstances,
    setInventoryTableData,
    setLandingFromWizard,
    setSelectedHeaderTab
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../../../utils/appConstants';
import { JOB_MONITORING_STATUS, MANAGE_POLLING_INTERVAL, MANAGE_STATES, WLF_TABS } from '../../../../utils/consts';
import { Button, DsTypography } from '@netapp/design-system';
import store from '../../../../store/store';
import { uniqueHostRow, updateInstanceStatus } from '../../InventoryUtilsV2';
import { ManageReadinessInterface } from '../../../../utils/types/inventoryV2Types';

export const handleSingleInstanceManage = (
    manageSingleInstanceChecks: any,
    dispatch: any,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: any
) => {
    let allowManage = isAllowManage(manageSingleInstanceChecks?.manageReadinessData);
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
    let payload = {
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
                    {
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
                    }
                </DsTypography>
            );
            setTimeout(() => {
                dispatch(setLandingFromWizard(true));
                navigate('../databases/inventory');
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
                const updatedState = store.getState();
                const { manageSingleInstanceData } = updatedState.inventoryV2;
                // ToDo: parametes will update once manage Jobs data will be available
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
                const updatedState = store.getState();
                const { inProgressInstances } = updatedState.inventoryV2;
                const updatedInstances = new Set(Array.from(inProgressInstances).filter(id => id !== inProgressId));
                dispatch(setInProgressInstances(updatedInstances));
                clearInterval(jobInterval);
            }
        });
    }, MANAGE_POLLING_INTERVAL);
};

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

export const missingModules = (manageReadinessData: any) => {
    if (!manageReadinessData) return [];

    const readinessKeys = Object.keys(manageReadinessData);
    let filteredModulesSet: Set<string> = new Set();

    readinessKeys.forEach(key => {
        const missingModules = manageReadinessData[key]?.missingModules || [];
        missingModules
            .filter((module: string) => module !== MANAGE_STATES.POWERSHELL7)
            .forEach((module: string) => filteredModulesSet.add(module));
    });

    const filteredModules = Array.from(filteredModulesSet);

    return filteredModules;
};

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
