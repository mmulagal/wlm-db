import { Button } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import styles from './CloudFormation.module.scss';
import { handleCreateSQLServer } from '../MSSqlServer/MSSqlFooter/createSqlServer';
import { useCreateSqlTemplateMutation } from '../../../utils/apiService';
import { useDispatch } from 'react-redux';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { JSX } from 'react/jsx-runtime';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const CloudFormation = () => {
    const dispatch = useDispatch();
    const state = useAppSelector(state => state);

    const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
    const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;
    const isDemoMode = state.auth.isDemoMode;

    const [createSqlTemplate] = useCreateSqlTemplateMutation();

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

    const handleTemplateView = () => {
        const payload = handleCreateSQLServer(state, dispatch);
        if (payload) {
            dispatch(setIsLoading(true));
            createSqlTemplate({ credentialId: selectedCredId, region: selectedRegionCode, payload: payload })
                .then((data: any) => {
                    console.log(data);
                    const url = data?.data?.cloudFormationUrl;
                    const warning = data?.data?.warningMessage;
                    if (warning) {
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
                    dispatch(setIsLoading(false));
                })
                .catch((error: any) => {
                    dispatch(setIsLoading(false));
                });
        }
    };

    return (
        <div className={`${styles['cloud-formation']}`}>
            <div className={styles.inner}>
                <Button
                    Component="button"
                    variant="link"
                    onClick={handleTemplateView}
                    className={CommonStyles.buttonClass}
                >
                    {GENERAL.SAVE_FORM_AS_CLOUD}
                </Button>
            </div>
        </div>
    );
};

export default CloudFormation;
