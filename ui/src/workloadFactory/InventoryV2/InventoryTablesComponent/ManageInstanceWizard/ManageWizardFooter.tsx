import { DsButton, useWizard, WizardFooter } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './ManageInstanceWizard.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { detectFieldsValidation, saveFsxInCredRegisteredObj, updateInstanceStatus } from '../../InventoryUtilsV2';
import { setIsDetectHostLoading } from '../../../../store/mssql/msSqlActionSlice';
import {
    useLazyGetSubTaskListQuery,
    useManageBulkV2MssqlInstanceMutation,
    useRegisterResourceCredentialsBulkMutation,
    useRegisterResourceCredentialsMutation
} from '../../../../utils/apiService';
import { createDetectHostPayload } from '../../../../utils/utilityFunctions';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import {
    setInventoryTableData,
    setManageSingleInstanceReadiness,
    setSelectedMultiDetectInstances
} from '../../../../store/workloadFactory/inventoryV2Slice';

import { getBulkDetectChecks, handleMultiInstanceManage, handleSingleInstanceManage } from './ManageInstanceUtils';
import { useNavigate } from 'react-router-dom';
import { ACTION_TYPE } from '../../../../utils/consts';
import { useMemo } from 'react';
import {
    BulkDetectedInstance,
    RegisterResourceCredResult,
    UseWizardReturn
} from '../../../../utils/types/registerTypes';

type PlanningWizardFooterProps = {
    style?: React.CSSProperties;
    validation?: () => boolean;
    nextButtonProps?: any;
};

const ManageWizardFooter = (props: PlanningWizardFooterProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { nextButtonProps, validation, style } = props; //onClick must be taken out otherwise will override footer onClick when spread to button
    const { onClick, ...rest } = nextButtonProps ?? { onClick: null };

    const { currentStepIndex, currentStep, gotoPreviousStep, goToNextStep, state, setState }: UseWizardReturn =
        useWizard();

    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);
    const detectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);
    const manageSingleInstanceChecks = useAppSelector(state => state.inventoryV2.manageSingleInstanceChecks);
    const { wizardOperationType, selectedMultiDetectInstances, bulkDetectedInstanceList } = useAppSelector(
        state => state.inventoryV2
    );

    const bulkInstanceData = useMemo(() => {
        return getBulkDetectChecks(selectedMultiDetectInstances);
    }, [selectedMultiDetectInstances]);

    const dispatch = useDispatch();

    const [registerResourceCred] = useRegisterResourceCredentialsMutation();
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const [manageBulkV2InstanceApi] = useManageBulkV2MssqlInstanceMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const goBack = () => {
        setState({ hitNext: false });
        gotoPreviousStep();
    };

    const handleMultiRegisterResourceCred = async () => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(setManageSingleInstanceReadiness(null));
        let payload: Array<any> = [];
        selectedMultiDetectInstances?.forEach((instance: BulkDetectedInstance) => {
            const sqlServerInstance = instance?.data?.sqlServerInstance || instance?.data?.databaseInstanceName || '';
            let cred = createDetectHostPayload(sqlServerInstance, instance?.data?.fsxId, instance?.data);
            let perPayload = {
                ...cred,
                credentialsId: instance?.data?.credentialId,
                region: instance?.data?.regionId,
                ec2InstanceId: instance?.data?.ec2InstanceId
            };
            payload.push(perPayload);
        });
        try {
            const result: any = await registerResourceCredBulk({ payload });
            if (result && !result?.error) {
                let newSelectedMultiDetectInstances = selectedMultiDetectInstances;
                result?.data?.forEach((res: any) => {
                    if (res?.sqlServerError || res?.fsxnError) {
                        newSelectedMultiDetectInstances = newSelectedMultiDetectInstances.map((instance: any) => {
                            if (
                                instance?.data?.credentialId === res?.credentialsId &&
                                instance?.data?.regionId === res?.region &&
                                instance?.data?.ec2InstanceId === res?.ec2InstanceId
                            ) {
                                return {
                                    ...instance,
                                    authorized: false
                                };
                            }
                            return instance;
                        });
                    } else {
                        // store fsx cred in register obj if payload has fsx register
                        let filterRow: any = newSelectedMultiDetectInstances.filter((instance: any) => {
                            return (
                                instance?.data?.credentialId === res?.credentialsId &&
                                instance?.data?.regionId === res?.region &&
                                instance?.data?.ec2InstanceId === res?.ec2InstanceId
                            );
                        });
                        let isFsxRegister = saveFsxInCredRegisteredObj(filterRow?.[0]?.data?.fsxId, dispatch);
                        const updatedInventoryTableData = updateInstanceStatus(
                            'detect',
                            filterRow?.[0]?.data,
                            filterRow?.[0]?.data
                        );
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                        newSelectedMultiDetectInstances = newSelectedMultiDetectInstances.map((instance: any) => {
                            if (
                                instance?.data?.credentialId === res?.credentialsId &&
                                instance?.data?.regionId === res?.region &&
                                instance?.data?.ec2InstanceId === res?.ec2InstanceId
                            ) {
                                return {
                                    ...instance,
                                    authorized: true,
                                    manageReadiness: res?.manageReadiness || null
                                };
                            }
                            return instance;
                        });
                    }
                });
                dispatch(setSelectedMultiDetectInstances(newSelectedMultiDetectInstances));
                goToNextStep();
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: t('databases.register-flow.manage-detect-fail-message')
                    })
                );
            }
        } catch (error) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.register-flow.manage-detect-fail-message')
                })
            );
        } finally {
            dispatch(setIsDetectHostLoading(false));
        }
    };

    const handleRegisterResourceCred = async () => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(setManageSingleInstanceReadiness(null));
        const sqlServerInstance =
            manageSingleInstanceData?.sqlServerInstance || manageSingleInstanceData?.databaseInstanceName || '';
        try {
            const result: RegisterResourceCredResult = await registerResourceCred({
                credentialId: manageSingleInstanceData?.credentialId,
                regionId: manageSingleInstanceData?.regionId,
                instanceId: manageSingleInstanceData?.ec2InstanceId,
                payload: createDetectHostPayload(
                    sqlServerInstance,
                    manageSingleInstanceData?.fsxId,
                    manageSingleInstanceData
                )
            });
            if (result && !result?.error) {
                if (result?.data?.sqlServerError || result?.data?.fsxnError) {
                    let error = [];
                    error.push(result?.data?.sqlServerError || '');
                    error.push(result?.data?.fsxnError || '');
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: error.join(' ') || t('databases.register-flow.manage-detect-fail-message')
                        })
                    );
                } else {
                    // store fsx cred in register obj if payload has fsx register
                    let isFsxRegister = saveFsxInCredRegisteredObj(manageSingleInstanceData?.fsxId, dispatch);
                    const updatedInventoryTableData = updateInstanceStatus(
                        'detect',
                        manageSingleInstanceData,
                        manageSingleInstanceData
                    );
                    dispatch(setInventoryTableData(updatedInventoryTableData));
                    if (result?.data?.manageReadiness) {
                        dispatch(setManageSingleInstanceReadiness(result?.data?.manageReadiness));
                    }
                    goToNextStep();
                }
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: result?.error?.data?.message || t('databases.register-flow.manage-detect-fail-message')
                    })
                );
            }
        } catch (error) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.register-flow.manage-detect-fail-message')
                })
            );
        } finally {
            dispatch(setIsDetectHostLoading(false));
        }
    };

    const goForward = () => {
        if (wizardOperationType === ACTION_TYPE.SINGLE) {
            setState({ hitNext: true });
            const fieldsCorrect = detectFieldsValidation(manageSingleInstanceData);
            if (fieldsCorrect) {
                handleRegisterResourceCred();
            }
        }
    };

    const bulkGoForward = (currentStepIndex: number) => {
        if (currentStepIndex === 0) {
            if (selectedMultiDetectInstances.length > 0) {
                goToNextStep();
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: t('databases.register-flow.bulk-instance-select-text')
                    })
                );
            }
        } else if (currentStepIndex === 1) {
            const isAuth = selectedMultiDetectInstances.every((instance: any) => instance?.authorized);
            if (isAuth) {
                goToNextStep();
            } else {
                setState({ hitNext: true });
                const fieldsCorrect = detectFieldsValidation(bulkInstanceData);
                if (fieldsCorrect) {
                    handleMultiRegisterResourceCred();
                }
            }
        }
    };

    const handleManage = () => {
        if (wizardOperationType === ACTION_TYPE.BULK) {
            handleMultiInstanceManage(
                bulkDetectedInstanceList,
                dispatch,
                manageBulkV2InstanceApi,
                getJobDetailApi,
                navigate
            );
        } else {
            handleSingleInstanceManage(
                manageSingleInstanceChecks,
                dispatch,
                manageBulkV2InstanceApi,
                getJobDetailApi,
                navigate
            );
        }
    };

    return (
        <>
            {wizardOperationType !== ACTION_TYPE.BULK && (
                <WizardFooter className={styles['pw-footer']} style={style}>
                    {currentStepIndex !== 0 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-back-${currentStep}`}
                            isThin={true}
                            onClick={goBack}
                            variant={'secondary'}
                        >
                            {t('databases.register-flow.previous')}
                        </DsButton>
                    )}
                    {currentStepIndex < 1 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                            isThin={true}
                            onClick={goForward}
                            variant={'primary'}
                            isLoading={detectHostLoading}
                            {...rest}
                        >
                            {t('databases.register-flow.next')}
                        </DsButton>
                    )}
                    {currentStepIndex === 1 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-manage-${currentStep}`}
                            isThin={true}
                            onClick={handleManage}
                            variant={'primary'}
                            {...rest}
                        >
                            {t('databases.register-flow.register')}
                        </DsButton>
                    )}
                </WizardFooter>
            )}

            {/* This is only for Bulk operation */}
            {wizardOperationType === ACTION_TYPE.BULK && (
                <WizardFooter className={styles['pw-footer']} style={style}>
                    {currentStepIndex !== 0 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-back-${currentStep}`}
                            isThin={true}
                            onClick={goBack}
                            variant={'secondary'}
                        >
                            {t('databases.register-flow.previous')}
                        </DsButton>
                    )}
                    {currentStepIndex < 2 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                            isThin={true}
                            onClick={() => bulkGoForward(currentStepIndex)}
                            isLoading={detectHostLoading && currentStepIndex === 1}
                            variant={'primary'}
                            {...rest}
                        >
                            {t('databases.register-flow.next')}
                        </DsButton>
                    )}
                    {currentStepIndex === 2 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-manage-${currentStep}`}
                            isThin={true}
                            onClick={handleManage}
                            variant={'primary'}
                            {...rest}
                        >
                            {t('databases.register-flow.register')}
                        </DsButton>
                    )}
                </WizardFooter>
            )}
        </>
    );
};

export default ManageWizardFooter;
