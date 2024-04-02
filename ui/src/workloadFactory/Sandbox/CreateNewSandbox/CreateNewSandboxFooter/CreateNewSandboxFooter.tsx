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

const CreateNewSandboxFooter = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const state = useAppSelector(state => state);
    const closeHandler = () => {
        navigate('../databases');
    };

    const handleCreate = () => {
        const payload = handleCreateNewSandbox(state, dispatch);
        if (payload) {
            const msgData = (
                <div className={styles.notification}>
                    {GENERAL.DB_CREATE_NOTIFICATION[0]} Sandbox&nbsp;
                    <span className={styles.bold}>{'<Sandbox name>'}</span>
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
