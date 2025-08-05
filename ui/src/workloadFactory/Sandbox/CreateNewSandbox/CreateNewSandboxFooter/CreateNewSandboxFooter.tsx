import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { handleCreateNewSandbox } from './CreateNewSandboxPayload';
import styles from './CreateNewSandboxFooter.module.scss';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../../store/notificationSlice';
import {
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FORM_TO_WLF_NAVIGATE_SANDBOXES,
    WLF_TABS
} from '../../../../utils/consts';
import { useCreateSandboxMutation } from '../../../../utils/apiService';
import { setIsLoading } from '../../../../store/mssql/msSqlActionSlice';
import { resetSourceAndTarget, setShowError } from '../../../../store/workloadFactory/createSandboxSlice';
import { updateRefreshBlocked } from '../../../../store/authSlice';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';

const CreateNewSandboxFooter = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const state = useAppSelector(state => state);
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;

    const closeHandler = () => {
        dispatch(updateRefreshBlocked(true));
        dispatch(resetSourceAndTarget());
        if (isWorkloadFactoryStatus) {
            navigate(FORM_TO_WLF_NAVIGATE_SANDBOXES);
        } else {
            navigate(FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES);
        }
    };

    const [createNewSandbox] = useCreateSandboxMutation();

    const handleCreate = async () => {
        const payload = handleCreateNewSandbox(state, dispatch);
        dispatch(setShowError(true));
        if (payload) {
            dispatch(setIsLoading(true));
            try {
                const result: any = await createNewSandbox({
                    credentialId: state.createSandbox?.selectedSandboxCredId,
                    region: state.createSandbox?.selectedSandboxRegionId,
                    payload
                });
                dispatch(setIsLoading(false));
                if (result && !result?.error) {
                    const msgData = (
                        <div className={styles.notification}>
                            {GENERAL.DB_CREATE_NOTIFICATION[0]}
                            <span className={styles.bold}>{state?.createSandbox?.target?.selectedDatabase}</span>
                            {GENERAL.DB_CREATE_NOTIFICATION[1]}
                            <span className={styles.bold}>
                                {state?.createSandbox?.target?.selectedDatabaseHost?.label}
                            </span>
                            {GENERAL.DB_CREATE_NOTIFICATION[2]}
                            <Button
                                Component="button"
                                variant="text"
                                onClick={() => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                    dispatch(updateRefreshBlocked(true));
                                    const path = isWorkloadFactoryStatus
                                        ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                                        : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                                    postBlueXPMessage({
                                        type: BlueXPListeners.navigate,
                                        payload: { pathname: path, replace: true }
                                    });
                                    dispatch(clearNotifications());
                                }}
                            >
                                {GENERAL.JOB_MONITORING}.
                            </Button>
                        </div>
                    );
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.INFO,
                            message: msgData
                        })
                    );
                    dispatch(updateRefreshBlocked(true));
                    dispatch(resetSourceAndTarget());
                    if (isWorkloadFactoryStatus) {
                        navigate(FORM_TO_WLF_NAVIGATE_SANDBOXES);
                    } else {
                        navigate(FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES);
                    }
                }
            } catch (error) {
                dispatch(setIsLoading(false));
                dispatch(addNotification({ message: error, notificationType: NOTIFICATION_TYPES.ERROR }));
            }
        }
    };
    return (
        <>
            <Button isThin onClick={handleCreate} id="db-create-button">
                {GENERAL.CREATE}
            </Button>
            <Button isThin variant="secondary" onClick={closeHandler}>
                {GENERAL.CLOSE}
            </Button>
        </>
    );
};

export default CreateNewSandboxFooter;
