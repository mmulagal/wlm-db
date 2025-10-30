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
    useManageBulkV2OracleInstanceMutation,
    useRegisterResourceCredentialsBulkMutation
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
import { ACTION_TYPE, DBType, DETECT_PAYLOAD_SIZE } from '../../../../utils/consts';
import { BulkDetectedInstance, UseWizardReturn } from '../../../../utils/types/registerTypes';

type PlanningWizardFooterProps = {
    style?: React.CSSProperties;
    validation?: () => boolean;
    nextButtonProps?: any;
};

const ManageWizardFooter = (props: PlanningWizardFooterProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { nextButtonProps, style } = props; // onClick must be taken out otherwise will override footer onClick when spread to button
    const { onClick, ...rest } = nextButtonProps ?? { onClick: null };

    const { currentStepIndex, currentStep, gotoPreviousStep, goToNextStep, setState }: UseWizardReturn = useWizard();

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

    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const [manageBulkV2InstanceApi] = useManageBulkV2MssqlInstanceMutation();
    const [manageBulkV2OracleInstanceApi] = useManageBulkV2OracleInstanceMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const engineType = useAppSelector(state => state.inventoryV2.manageSingleInstanceData?.hostType);

    const goBack = () => {
        setState({ hitNext: false });
        gotoPreviousStep();
    };

    const handleMultiRegisterResourceCred = async () => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(setManageSingleInstanceReadiness(null));

        dispatch(
            addNotification({
                message: t('databases.register-flow.manage-detect-info-message'),
                notificationType: NOTIFICATION_TYPES.INFO
            })
        );

        // Create payload for all selected instances
        const fullPayload = createDetectHostPayloadBulk(selectedMultiDetectInstances);

        // Helper to split array into batches of 10
        const chunkArray = (arr: any[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

        const batches = chunkArray(fullPayload, DETECT_PAYLOAD_SIZE);
        let newSelectedMultiDetectInstances: BulkDetectedInstance[] = selectedMultiDetectInstances;
        // @ts-ignore
        const engineType = selectedMultiDetectInstances[0]?.data?.hostType;

        // Check if any batch has credentials before processing
        const hasCredentials = batches.some(batch =>
            batch.some(item => item.credentials && item.credentials.length > 0)
        );

        if (!hasCredentials) {
            goToNextStep();
            return;
        }

        try {
            for (let i = 0; i < batches.length; i++) {
                const batchPayload = { items: batches[i] };

                // Check if this batch has any items with credentials
                const batchHasCredentials = batchPayload.items.some(
                    item => item.credentials && item.credentials.length > 0
                );

                if (!batchHasCredentials) {
                    continue; // Skip this batch if no credentials
                }

                const result = await registerResourceCredBulk({ payload: batchPayload });

                if (result && !result?.error) {
                    // Process response for this batch
                    newSelectedMultiDetectInstances = updateDetectBulkResponse(
                        newSelectedMultiDetectInstances,
                        result,
                        dispatch,
                        engineType
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

    const handleRegisterResourceCred = async (engineType: any) => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(setManageSingleInstanceReadiness(null));
        const sqlServerInstance =
            manageSingleInstanceData?.sqlServerInstance || manageSingleInstanceData?.databaseInstanceName || '';
        try {
            const credList = createDetectHostPayload(
                sqlServerInstance,
                manageSingleInstanceData?.fsxId,
                manageSingleInstanceData
            );
            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId: manageSingleInstanceData?.ec2InstanceId,
                        region: manageSingleInstanceData?.regionId,
                        credentialsId: manageSingleInstanceData?.credentialId
                    }
                ]
            };
            if (payload?.items?.some(item => item?.credentials?.length > 0)) {
                const result = await registerResourceCredBulk({ payload });
                if (result && !result?.error && result?.data) {
                    const registerDetails = result?.data?.items?.[0]?.registerDetails || [];
                    const errors: string[] = [];
                    let hasErrors = false;

                    // If we are giving multiple credentials like msql/oracle cred and also fsx credentials then the error can be present at any position
                    registerDetails.forEach((detail: any) => {
                        if (detail?.databaseServerError) {
                            errors.push(detail.databaseServerError);
                            hasErrors = true;
                        }
                        if (detail?.fsxnError) {
                            errors.push(detail.fsxnError);
                            hasErrors = true;
                        }
                        if (detail?.oracleAsmError) {
                            errors.push(detail.oracleAsmError);
                            hasErrors = true;
                        }
                    });

                    if (hasErrors) {
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: errors.join(' ') || t('databases.register-flow.manage-detect-fail-message')
                            })
                        );
                    } else {
                        // store fsx cred in register obj if payload has fsx register
                        saveFsxInCredRegisteredObj(manageSingleInstanceData?.fsxId, dispatch);
                        const updatedInventoryTableData = updateInstanceStatus(
                            'detect',
                            manageSingleInstanceData,
                            manageSingleInstanceData
                        );
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                        if (result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness) {
                            dispatch(
                                setManageSingleInstanceReadiness(
                                    result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness
                                )
                            );
                        }
                        goToNextStep();
                    }
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.manage-detect-fail-message')
                        })
                    );
                }
            } else {
                goToNextStep();
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
            const fieldsCorrect = detectFieldsValidation(manageSingleInstanceData, engineType);
            if (fieldsCorrect) {
                handleRegisterResourceCred(engineType);
            }
        }
    };

    const bulkGoForward = (currentStepIndexVal: number) => {
        if (currentStepIndexVal === 0) {
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
        } else if (currentStepIndexVal === 1) {
            const isAuth = selectedMultiDetectInstances.every((instance: any) => instance?.authorized);
            if (isAuth) {
                goToNextStep();
            } else {
                setState({ hitNext: true });
                // @ts-ignore
                const engineType = selectedMultiDetectInstances[0]?.data?.hostType || DBType.MSSQL;
                const fieldsCorrect = detectFieldsValidation(bulkInstanceData, engineType);
                if (fieldsCorrect) {
                    handleMultiRegisterResourceCred();
                }
            }
        }
    };

    const handleManage = () => {
        if (wizardOperationType === ACTION_TYPE.BULK) {
            // @ts-ignore
            const engineType = selectedMultiDetectInstances[0]?.data?.hostType || DBType.MSSQL;
            const manageApi = engineType === DBType.ORACLE ? manageBulkV2OracleInstanceApi : manageBulkV2InstanceApi;
            handleMultiInstanceManage(
                bulkDetectedInstanceList,
                dispatch,
                manageApi,
                getJobDetailApi,
                navigate,
                engineType
            );
        } else {
            const manageApi = engineType === DBType.ORACLE ? manageBulkV2OracleInstanceApi : manageBulkV2InstanceApi;
            handleSingleInstanceManage(
                manageSingleInstanceChecks,
                dispatch,
                manageApi,
                getJobDetailApi,
                navigate,
                engineType,
                t
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
