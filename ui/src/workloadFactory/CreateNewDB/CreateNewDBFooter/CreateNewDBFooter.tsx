import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { handleCreateUserDb } from './createUserDBPayload';
import { useAppSelector } from '../../../store/storeHooks';
import { useCreateUserDBMutation } from '../../../utils/apiService';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import {
    FORM_TO_WLF_NAVIGATE_BLUEXP,
    FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_INVENTORY,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    WLF_TABS
} from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import styles from './CreateNewUserFooter.module.scss';
import { updateRefreshBlocked } from '../../../store/authSlice';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';

const CreateNewUserFooter = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const state = useAppSelector(state => state);
    const resourceId = useAppSelector(state => state.auth.resourceId);
    const { cdbCredId, cdbRegionId } = useAppSelector(state => state.createNewUser);
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;

    const closeHandler = () => {
        dispatch(updateRefreshBlocked(true));
        if (isWorkloadFactoryStatus) {
            navigate(FORM_TO_WLF_NAVIGATE_INVENTORY);
        } else {
            navigate(FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY);
        }
    };

    const [createNewUserDb] = useCreateUserDBMutation();

    const handleCreate = async () => {
        const payload = handleCreateUserDb(state, dispatch);
        if (payload) {
            dispatch(setIsLoading(true));
            try {
                const result: any = await createNewUserDb({
                    credentialId: cdbCredId,
                    region: cdbRegionId,
                    id: resourceId,
                    payload
                });
                dispatch(setIsLoading(false));
                if (result && !result?.error) {
                    const msgData = (
                        <div className={styles.notification}>
                            {GENERAL.DB_CREATE_NOTIFICATION[0]}
                            <span className={styles.bold}>{state?.createNewUser?.newUserDBName}</span>
                            {GENERAL.DB_CREATE_NOTIFICATION[1]}
                            <span className={styles.bold}>{state?.createNewUser?.dbHostName}</span>
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
                    if (state?.createNewUser?.newUserDBName && state?.createNewUser?.newUserDBName.length > 100) {
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.INFO,
                                message: GENERAL.DB_CREATE_SUCCESS_MSG,
                                additionalText: msgData
                            })
                        );
                    } else {
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.INFO,
                                message: msgData
                            })
                        );
                    }
                    dispatch(updateRefreshBlocked(true));
                    if (isWorkloadFactoryStatus) {
                        navigate(FORM_TO_WLF_NAVIGATE_INVENTORY);
                    } else {
                        navigate(FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY);
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

export default CreateNewUserFooter;
