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

export const handleSingleInstanceManage = (
    manageSingleInstanceChecks: any,
    dispatch: any,
    manageBulkV2InstanceApi: any,
    getJobDetailApi: any,
    navigate: any
) => {
    if (
        manageSingleInstanceChecks?.assessment === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.remediation === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.dbCreation === GENERAL.NOT_AVAILABLE &&
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
    } else if (!manageSingleInstanceChecks?.allowManage) {
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
    let installModules: Array<string> = [];
    if (manageSingleInstanceChecks?.installMissingAWS) {
        installModules = manageSingleInstanceChecks?.installMissingAWSList;
    }
    if (manageSingleInstanceChecks?.installMissingPowershell) {
        installModules = [...installModules, MANAGE_STATES.POWERSHELL7];
    }
    let payload = {
        hosts: [
            {
                ec2InstanceId: manageSingleInstanceChecks?.ec2InstanceId,
                region: manageSingleInstanceChecks?.region,
                credentialsId: manageSingleInstanceChecks?.credentialsId,
                instances: [
                    {
                        databaseInstanceName: manageSingleInstanceChecks?.databaseInstanceName
                    }
                ],
                installModules: installModules
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
                    message: 'Manage instance failed'
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
                const updatedInventoryTableData = updateInstanceStatus(
                    'manage',
                    manageSingleInstanceData,
                    [manageSingleInstanceChecks?.databaseInstanceName],
                    [
                        {
                            databaseInstanceName: manageSingleInstanceChecks?.databaseInstanceName,
                            databaseInstanceGuid: '',
                            status: 'success',
                            errorMessage: ''
                        }
                    ],
                    ''
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
    dbCreation: string,
    sandbox: string
) => {
    let overallState = '';

    if ([assessment, remediation, dbCreation, sandbox].includes(MANAGE_STATES.READY)) {
        overallState = MANAGE_STATES.READY;
    } else if ([assessment, remediation, dbCreation, sandbox].includes(MANAGE_STATES.MISSING_PREREQUISITES)) {
        overallState = MANAGE_STATES.MISSING_PREREQUISITES;
    } else if ([assessment, remediation, dbCreation, sandbox].includes(MANAGE_STATES.MISSING_POWERSHELL)) {
        overallState = MANAGE_STATES.MISSING_POWERSHELL;
    }

    return overallState;
};

export const isAllowManage = (manageReadinessData: any) => {
    let anyListEmpty = false;
    const readinessKeys = Object.keys(manageReadinessData);
    for (const key of readinessKeys) {
        const missingSqlPermissions = manageReadinessData[key]?.missingSqlPermissions || [];
        if (missingSqlPermissions.length == 0) {
            anyListEmpty = true;
        }
    }
    return anyListEmpty;
};
