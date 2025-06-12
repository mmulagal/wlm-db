import { DsButton, useWizard, WizardFooter } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import styles from './ManageInstanceWizard.module.scss';
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
import {
    createDetectHostPayloadBulk,
    getBulkDetectChecks,
    handleMultiInstanceManage,
    handleSingleInstanceManage,
    updateDetectBulkResponse
} from './ManageInstanceUtils';
import { ACTION_TYPE, DETECT_PAYLOAD_SIZE } from '../../../../utils/consts';
import {
    BulkDetectedInstance,
    RegisterResourceCredBulkResultItem,
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
    const { nextButtonProps, validation, style } = props; // onClick must be taken out otherwise will override footer onClick when spread to button
    const { onClick, ...rest } = nextButtonProps ?? { onClick: null };

    const { currentStepIndex, currentStep, gotoPreviousStep, goToNextStep, state, setState }: UseWizardReturn =
        useWizard();

    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);
    const detectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);
    const manageSingleInstanceChecks = useAppSelector(state => state.inventoryV2.manageSingleInstanceChecks);
    const { wizardOperationType, selectedMultiDetectInstances, bulkDetectedInstanceList } = useAppSelector(
        state => state.inventoryV2
    );

    const bulkInstanceData = useMemo(
        () => getBulkDetectChecks(selectedMultiDetectInstances),
        [selectedMultiDetectInstances]
    );

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

        dispatch(addNotification({ message: t('databases.register-flow.manage-detect-info-message'), notificationType: NOTIFICATION_TYPES.INFO }));

        // Create payload for all selected instances
        const fullPayload = createDetectHostPayloadBulk(selectedMultiDetectInstances);

        // Helper to split array into batches of 10
        const chunkArray = (arr: any[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

        const batches = chunkArray(fullPayload, DETECT_PAYLOAD_SIZE);
        let newSelectedMultiDetectInstances: BulkDetectedInstance[] = selectedMultiDetectInstances;

        try {
            for (let i = 0; i < batches.length; i++) {
                const batchPayload = batches[i];
                const result = await registerResourceCredBulk({ payload: batchPayload });

                if (result && !result?.error) {
                    // Process response for this batch
                    newSelectedMultiDetectInstances = updateDetectBulkResponse(
                        newSelectedMultiDetectInstances,
                        result,
                        dispatch
                    );
                    dispatch(setSelectedMultiDetectInstances([...newSelectedMultiDetectInstances]));
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.manage-detect-fail-message')
                        })
                    );
                    break; // Stop further batches on error
                }
            }
            const anyAuthorized = newSelectedMultiDetectInstances.some(inst => inst?.authorized);
            if (anyAuthorized) {
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
                    const error = [];
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
                    const isFsxRegister = saveFsxInCredRegisteredObj(manageSingleInstanceData?.fsxId, dispatch);
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
                            isThin
                            onClick={goBack}
                            variant="secondary"
                        >
                            {t('databases.register-flow.previous')}
                        </DsButton>
                    )}
                    {currentStepIndex < 1 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                            isThin
                            onClick={goForward}
                            variant="primary"
                            isLoading={detectHostLoading}
                            {...rest}
                        >
                            {t('databases.register-flow.next')}
                        </DsButton>
                    )}
                    {currentStepIndex === 1 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-manage-${currentStep}`}
                            isThin
                            onClick={handleManage}
                            variant="primary"
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
                            isThin
                            onClick={goBack}
                            variant="secondary"
                        >
                            {t('databases.register-flow.previous')}
                        </DsButton>
                    )}
                    {currentStepIndex < 2 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                            isThin
                            onClick={() => bulkGoForward(currentStepIndex)}
                            isLoading={detectHostLoading && currentStepIndex === 1}
                            variant="primary"
                            {...rest}
                        >
                            {t('databases.register-flow.next')}
                        </DsButton>
                    )}
                    {currentStepIndex === 2 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-manage-${currentStep}`}
                            isThin
                            onClick={handleManage}
                            variant="primary"
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
