import { DsButton, useWizard, WizardFooter } from '@netapp/design-system';
import styles from './ManageInstanceWizard.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { detectFieldsValidation, saveFsxInCredRegisteredObj, updateInstanceStatus } from '../../InventoryUtilsV2';
import { setIsDetectHostLoading } from '../../../../store/mssql/msSqlActionSlice';
import {
    useLazyGetSubTaskListQuery,
    useManageBulkV2MssqlInstanceMutation,
    useRegisterResourceCredentialsMutation
} from '../../../../utils/apiService';
import { createDetectHostPayload } from '../../../../utils/utilityFunctions';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    setInventoryTableData,
    setManageSingleInstanceReadiness
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { MANAGE_STATES } from '../../../../utils/consts';
import { handleSingleInstanceManage } from './ManageInstanceUtils';
import { useNavigate } from 'react-router-dom';

type PlanningWizardFooterProps = {
    style?: React.CSSProperties;
    validation?: () => boolean;
    nextButtonProps?: any;
};

const ManageWizardFooter = (props: PlanningWizardFooterProps) => {
    const navigate = useNavigate();
    const { nextButtonProps, validation, style } = props; //onClick must be taken out otherwise will override footer onClick when spread to button
    const { onClick, ...rest } = nextButtonProps ?? { onClick: null };

    const { currentStepIndex, currentStep, gotoPreviousStep, goToNextStep, state, setState }: any = useWizard();

    const { ontapUserNameFromWizard, ontapPasswordFromWizard, mssqlUserNameFromWizard, mssqlPasswordFromWizard } =
        state;
    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);
    const detectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);
    const manageSingleInstanceChecks = useAppSelector(state => state.inventoryV2.manageSingleInstanceChecks);

    const dispatch = useDispatch();

    const [registerResourceCred] = useRegisterResourceCredentialsMutation();
    const [manageBulkV2InstanceApi] = useManageBulkV2MssqlInstanceMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const goBack = () => {
        gotoPreviousStep();
    };

    const handleRegisterResourceCred = async () => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(setManageSingleInstanceReadiness(null));
        const sqlServerInstance =
            manageSingleInstanceData?.sqlServerInstance || manageSingleInstanceData?.databaseInstanceName || '';
        try {
            const result: any = await registerResourceCred({
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
                            message: error.join(' ') || GENERAL.MANAGE_DETECT_FAIL_MESSAGE
                        })
                    );
                    dispatch(setIsDetectHostLoading(false));
                    if (result?.data?.manageReadiness) {
                        dispatch(setManageSingleInstanceReadiness(result?.data?.manageReadiness));
                    }
                } else {
                    dispatch(setIsDetectHostLoading(false));
                    // store fsx cred in register obj if payload has fsx register
                    let isFsxRegister = saveFsxInCredRegisteredObj(manageSingleInstanceData?.fsxId, dispatch);
                    const updatedInventoryTableData = updateInstanceStatus(
                        'detect',
                        manageSingleInstanceData,
                        manageSingleInstanceData
                    );
                    dispatch(setInventoryTableData(updatedInventoryTableData));
                    goToNextStep();
                }
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: result?.error?.data?.message || GENERAL.MANAGE_DETECT_FAIL_MESSAGE
                    })
                );
                dispatch(setIsDetectHostLoading(false));
            }
        } catch (error) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: GENERAL.MANAGE_DETECT_FAIL_MESSAGE
                })
            );
            dispatch(setIsDetectHostLoading(false));
        }
    };

    const goForward = () => {
        setState({ hitNext: true });
        const fieldsCorrect = detectFieldsValidation(manageSingleInstanceData);
        if (fieldsCorrect) {
            handleRegisterResourceCred();
        }
    };

    const handleManage = () => {
        handleSingleInstanceManage(
            manageSingleInstanceChecks,
            dispatch,
            manageBulkV2InstanceApi,
            getJobDetailApi,
            navigate
        );
    };

    return (
        <WizardFooter className={styles['pw-footer']} style={style}>
            {currentStepIndex !== 0 && (
                <DsButton
                    data-testid={`wlm-db-manage-wizard-back-${currentStep}`}
                    isThin={true}
                    onClick={goBack}
                    variant={'secondary'}
                >
                    Previous
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
                    Next
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
                    Manage
                </DsButton>
            )}
        </WizardFooter>
    );
};

export default ManageWizardFooter;
