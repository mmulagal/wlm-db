import { Button, useDialog } from '@netapp/design-system';
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
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import RedirectToCF from '../../RedirectToCF/RedirectToCF';

const MSSqlFooter = () => {
    const { setDialog } = useDialog();
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
                        const url = data?.data?.cloudFormationUrl;
                        const warning = data?.data?.warningMessage;
                        if (stackName) {
                            // If stackname is present than goes to fullPermissionFlow
                            fullPermissionFlow(stackName);
                        } else if (url) {
                            // If URL comes it means it has view permissions so it will openDialog and goes to viewPermissionFlow
                            openDialog(url, warning);
                        }
                    }
                })
                .catch((error: any) => {
                    dispatch(setIsLoading(false));
                });
        }
    };

    const fullPermissionFlow = (stackName: string) => {
        // Just show notification in case of full permission and redirect to Homepage after 3 sec
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
    };

    const openDialog = (url: string, warning: string) => {
        // Both possible content options added in code
        setDialog(
            <DialogComponent
                header={GENERAL.SAVE_FORM_AS_CLOUD}
                // content={<Typography variant="Regular_14">{GENERAL.REDIRECT_TO_CF_DESC}</Typography>}
                content={<RedirectToCF/>}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {viewPermissionFlow(url, warning)}}
                closeCallback={() => {}}
            />
        );
    };

    const viewPermissionFlow = (url: string, warning: string | undefined) => {
        // Show notification based on URL and warning. AFter 3 sec redirect to AWS page.
        if (warning) {
            // This code will not be required if warning message is not going to come
            sfNotification(warning, url);
        } else if (url) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: (
                        <>
                            {GENERAL.CLOUDFORMATION_TEMPLATE_URL[0]}
                            <Button
                                Component="button"
                                variant="link"
                                className={CommonStyles.buttonClass}
                                onClick={() => window.open(url, '_blank', 'noopener')}
                            >
                                {GENERAL.CLOUDFORMATION_TEMPLATE_URL[1]}
                            </Button>
                        </>
                    )
                })
            );
            setTimeout(() => {
                window.open(url, '_blank', 'noopener');
            }, 3000);
        }
    };

    const sfNotification = (warning: string, url: string) => {
        let message: string | JSX.Element = '';
        if (warning && !url) {
            message = warning;
        } else if (warning && url) {
            message = (
                <>
                    {warning}. {GENERAL.CLOUDFORMATION_TEMPLATE_URL[0]}
                    <Button
                        Component="button"
                        variant="link"
                        className={CommonStyles.buttonClass}
                        onClick={() => window.open(url, '_blank', 'noopener')}
                    >
                        {GENERAL.CLOUDFORMATION_TEMPLATE_URL[1]}
                    </Button>
                </>
            );
        }
        if (warning && warning.length > 250) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.WARNING,
                    message: GENERAL.PERMISSION_REQUIRED,
                    additionalText: message
                })
            );
        } else {
            dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.WARNING, message: message }));
        }
        if (url) {
            setTimeout(() => {
                window.open(url, '_blank', 'noopener');
            }, 3000);
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
