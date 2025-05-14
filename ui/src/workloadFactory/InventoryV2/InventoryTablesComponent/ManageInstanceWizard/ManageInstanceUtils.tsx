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
                <DsTypography variant="Regular_14" style={{ display: 'flex', flexDirection: 'column' }}>
                    {`Process management for instance ${manageSingleInstanceChecks?.databaseInstanceName} has begun.`}
                    <div>
                        {'For more details, please refer to '}
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
                                    {'Job Monitoring'}
                                </Button>
                            </>
                        }
                    </div>
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
