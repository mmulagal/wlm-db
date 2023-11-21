import { Button } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import { FORM_TO_WLF_NAVIGATE, PRODUCTION, TIMELINE_PROD_LINK, TIMELINE_STAGE_LINK } from '../../../../utils/consts';
import { setIsLoading } from '../../../../store/mssql/msSqlActionSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDeploySqlTemplateMutation } from '../../../../utils/apiService';
import { navigateToCanvas } from '../../../../utils/appConfig';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { useNavigate } from 'react-router-dom';
import { handleCreateSQLServer } from './createSqlServer';

const MSSqlFooter = () => {
    const state = useAppSelector(state => state);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
    const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;

    const [deploySqlTemplate] = useDeploySqlTemplateMutation();

    const handleCreate = () => {
        const payload = handleCreateSQLServer(state, dispatch);
        if (payload) {
            dispatch(setIsLoading(true));
            deploySqlTemplate({ credentialId: selectedCredId, region: selectedRegionCode, payload: payload })
                .then((data: any) => {
                    dispatch(setIsLoading(false));
                    if (!data?.error) {
                        let stackName = data?.data?.cloudFormationStackId;
                        if(stackName && stackName.includes('/')){
                            stackName = stackName.split('/')[1];
                        }
                        let message;
                        if (isWorkloadFactoryStatus) {
                            message = (
                                <>
                                    {GENERAL.CREATE_INFO_MESSAGE_WLM[0]}
                                    {stackName ? GENERAL.CREATE_INFO_MESSAGE_WLM[1] + stackName: ''}
                                    {GENERAL.CREATE_INFO_MESSAGE_WLM[2]}
                                </>
                            );
                        } else {
                            const timelineUrl = process.env.REACT_APP_ENVIRONMENT === PRODUCTION ? TIMELINE_PROD_LINK : TIMELINE_STAGE_LINK;
                            message = (
                                <>
                                    {GENERAL.CREATE_INFO_MESSAGE[0]}
                                    {stackName ? GENERAL.CREATE_INFO_MESSAGE[1] + stackName: ''}
                                    {GENERAL.CREATE_INFO_MESSAGE[2]}
                                    <Button
                                        Component="button"
                                        variant="text"
                                        onClick={() => window.open(timelineUrl, '_blank', 'noopener')}
                                    >
                                        {GENERAL.CREATE_INFO_MESSAGE[3]}
                                    </Button>
                                    {GENERAL.CREATE_INFO_MESSAGE[4]}
                                </>
                            );
                        }
                        dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.INFO, message: message}));
                        setTimeout(() => {
                            isWorkloadFactoryStatus ? navigate(FORM_TO_WLF_NAVIGATE): navigateToCanvas('/');
                        }, 3000);
                    }
                })
                .catch((error: any) => {
                    dispatch(setIsLoading(false));
                });
        }
    };

    return (
        <>
            <Button variant="secondary" isThin onClick={() => navigateToCanvas('/')}>
                {SELECT_CONFIG.CANCEL}
            </Button>
            <Button isThin onClick={handleCreate}>
                {SELECT_CONFIG.CREATE}
            </Button>
        </>
    );
};

export default MSSqlFooter;
