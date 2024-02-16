import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { createUserDbPayload } from './createUserDBPayload';
import { useAppSelector } from '../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { useCreateUserDBMutation } from '../../../utils/apiService';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';

const CreateNewUserFooter = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const createNewUser = useAppSelector(state => state.createNewUser);
    const resourceId = useAppSelector(state => state.auth.resourceId);
    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);

    const closeHandler = () => {
        navigate('../databases');
    };

    const [createNewUserDb] = useCreateUserDBMutation();

    const handleCreate = () => {
        const payload = createUserDbPayload(createNewUser);
        if (payload) {
            dispatch(setIsLoading(true));
            createNewUserDb({
                credentialId: selectedCredId?.data?.credentialsId,
                region: selectedRegionCode?.data?.regionCode,
                id: resourceId,
                payload: payload
            })
                .then((data: any) => {
                    dispatch(setIsLoading(false));
                    if (!data?.error) {
                        let jobId = data?.data?.jobId;
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.INFO,
                                message: (
                                    <>
                                        {`Database ${createNewUser?.newUserDBName} in host ${createNewUser?.dbHostName} is in deployment status.`}
                                        <Button
                                            Component="button"
                                            variant="text"
                                            onClick={() => {
                                                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                                navigate('../databases');
                                                dispatch(clearNotifications());
                                            }}
                                        >
                                            View job monitoring
                                        </Button>
                                    </>
                                )
                            })
                        );
                        navigate('../databases');
                    }
                })
                .catch((error: any) => {
                    dispatch(setIsLoading(false));
                });
        }
    };

    return (
        <>
            <Button isThin onClick={handleCreate}>
                {'Create'}
            </Button>
            <Button isThin variant="secondary" onClick={closeHandler}>
                {'Close'}
            </Button>
        </>
    );
};

export default CreateNewUserFooter;
