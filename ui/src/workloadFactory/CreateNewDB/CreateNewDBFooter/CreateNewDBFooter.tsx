import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { handleCreateUserDb } from './createUserDBPayload';
import { useAppSelector } from '../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { useCreateUserDBMutation } from '../../../utils/apiService';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { GENERAL } from '../../../utils/appConstants';
import styles from './CreateNewUserFooter.module.scss';

const CreateNewUserFooter = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const state = useAppSelector(state => state);
    const resourceId = useAppSelector(state => state.auth.resourceId);
    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);

    const closeHandler = () => {
        navigate('../databases');
    };

    const [createNewUserDb] = useCreateUserDBMutation();

    const handleCreate = async () => {
        const payload = handleCreateUserDb(state, dispatch);
        if (payload) {
            dispatch(setIsLoading(true));
            try {
                const result: any = await createNewUserDb({
                    credentialId: selectedCredId?.data?.credentialsId,
                    region: selectedRegionCode?.data?.regionCode,
                    id: resourceId,
                    payload: payload
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
                                    navigate('../databases');
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
                    navigate('../databases');
                }
            } catch (error) {
                dispatch(setIsLoading(false));
                dispatch(addNotification({ message: error, notificationType: NOTIFICATION_TYPES.ERROR }));
            }
        }
    };

    return (
        <>
            <Button isThin onClick={handleCreate}>
                {GENERAL.CREATE}
            </Button>
            <Button isThin variant="secondary" onClick={closeHandler}>
                {GENERAL.CLOSE}
            </Button>
        </>
    );
};

export default CreateNewUserFooter;
