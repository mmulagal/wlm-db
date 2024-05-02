import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { GENERAL } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { handleCreateNewSandbox } from './CreateNewSandboxPayload';
import styles from './CreateNewSandboxFooter.module.scss';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventorySlice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../../store/notificationSlice';
import { WLF_TABS } from '../../../../utils/consts';
import { useCreateSandboxMutation } from '../../../../utils/apiService';
import { setIsLoading } from '../../../../store/mssql/msSqlActionSlice';
import { setShowError } from '../../../../store/workloadFactory/createSandboxSlice';

const CreateNewSandboxFooter = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const state = useAppSelector(state => state);

    const closeHandler = () => {
        navigate('../databases');
    };

    const [createNewSandbox] = useCreateSandboxMutation();

    const handleCreate = async () => {
        const payload = handleCreateNewSandbox(state, dispatch);
        dispatch(setShowError(true));
        if (payload) {
            dispatch(setIsLoading(true));
            try {
                const result: any = await createNewSandbox({
                    credentialId: state?.headers?.headerSelectedCred?.data?.credentialsId,
                    region: state?.headers?.headerSelectedRegion?.data?.regionCode,
                    payload: payload
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
                                    navigate('../databases');
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
            <>
                <Button isThin onClick={handleCreate} id={'db-create-button'}>
                    {GENERAL.CREATE}
                </Button>
                <Button isThin variant="secondary" onClick={closeHandler}>
                    {GENERAL.CLOSE}
                </Button>
            </>
        </>
    );
};

export default CreateNewSandboxFooter;
