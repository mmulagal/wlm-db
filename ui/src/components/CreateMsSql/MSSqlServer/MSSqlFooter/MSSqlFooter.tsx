import { Button, postBlueXPMessage, BlueXPListeners } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import {
    WLF_TABS,
    FORM_TO_WLF_NAVIGATE_BLUEXP,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM
} from '../../../../utils/consts';
import {
    setDeployRedirectToCfLink,
    setIsLoading,
    setPermissionData,
    setPermissionWarning
} from '../../../../store/mssql/msSqlActionSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDeploySqlTemplateMutation } from '../../../../utils/apiService';
import { navigateToCanvas } from '../../../../utils/appConfig';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { handleCreateSQLServer } from './createSqlServer';
import { setIsRefreshed, setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { handleURL } from '../../../../utils/utilityFunctions';
import { setMultiDataStatus } from '../../../../store/workloadFactory/headersSlice';

const MSSqlFooter = () => {
    const state = useAppSelector(state => state);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
    const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;
    const { databaseHostEntryPoint } = useAppSelector(state => state.msSqlAction);
    const { isWorkloadFactory, isGovAccount } = useAppSelector(state => state.auth);

    const [deploySqlTemplate] = useDeploySqlTemplateMutation();

    const handleCreate = () => {
        const payload = handleCreateSQLServer(state, dispatch);
        if (payload) {
            dispatch(setIsLoading(true));
            dispatch(setMultiDataStatus({}));
            dispatch(setDeployRedirectToCfLink(null));
            deploySqlTemplate({ credentialId: selectedCredId, region: selectedRegionCode, payload })
                .then((data: any) => {
                    dispatch(setIsLoading(false));
                    if (!data?.error) {
                        const stackName = data?.data?.cloudFormationStackId;
                        const url = data?.data?.cloudFormationUrl;
                        const warning = data?.data?.warningMessage;
                        if (stackName && !warning) {
                            // If stackname is present than goes to fullPermissionFlow
                            fullPermissionFlow(stackName, url);
                        } else if (url) {
                            // If url comes it means it has view permissions so it will open AWS account accordion
                            dispatch(setPermissionWarning(true));
                            dispatch(setDeployRedirectToCfLink(url));
                            dispatch(setPermissionData(data?.data?.missingPermissions));
                        }
                    }
                })
                .catch((error: any) => {
                    dispatch(setIsLoading(false));
                });
        }
    };

    const handleNavigation = () => {
        if (isWorkloadFactory) {
            navigate(FORM_TO_WLF_NAVIGATE_JOB_MONITORING);
            handleURL('Dashboard', true);
        } else {
            navigate(FORM_TO_WLF_NAVIGATE_BLUEXP);
            handleURL('Dashboard', false);
        }
    };

    const fullPermissionFlow = (stackName: string, stackUrl: string) => {
        let notificationMsg: string | number | NodeJS.Timeout | undefined;
        // Just show notification in case of full permission and redirect to Homepage after 3 sec
        if (stackName && stackName.includes('/')) {
            stackName = stackName.split('/')[1];
        }
        let message;

        message = isGovAccount ? (
            t('databases.register-flow.govcloud-deploy-triggered-mssql')
        ) : (
            <>
                {GENERAL.CREATE_INFO_MESSAGE_WLM[0]}
                <Button
                    Component="button"
                    variant="text"
                    onClick={() => {
                        clearTimeout(notificationMsg);
                        dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                        const path = isWorkloadFactory
                            ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                            : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: { pathname: path, replace: true }
                        });

                        dispatch(clearNotifications());
                    }}
                >
                    {GENERAL.CREATE_INFO_MESSAGE_WLM[1]}
                </Button>
                {GENERAL.CREATE_INFO_MESSAGE_WLM[2]}
            </>
        );

        dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.INFO, message }));
        notificationMsg = setTimeout(() => {
            handleNavigation();
            dispatch(setIsRefreshed(true));
        }, 3000);
    };

    const handleCancel = () => {
        if (databaseHostEntryPoint === 'inventory') {
            if (isWorkloadFactory) {
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: '../../databases/inventory', replace: true }
                });
            } else {
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: '../../fsxdb/inventory', replace: true }
                });
            }
        } else if (databaseHostEntryPoint === 'database') {
            if (isWorkloadFactory) {
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: '../../databases/dashboard', replace: true }
                });
            } else {
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: '../../fsxdb/dashboard', replace: true }
                });
            }
        } else if (isWorkloadFactory) {
            navigateToCanvas('/');
        } else {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: { pathname: '../../../../../fsxhome', replace: true }
            });
        }
    };

    return (
        <>
            <Button variant="secondary" isThin onClick={handleCancel}>
                {SELECT_CONFIG.CANCEL}
            </Button>
            <Button isThin onClick={handleCreate} id="wizard-deploy-btn">
                {SELECT_CONFIG.CREATE}
            </Button>
        </>
    );
};

export default MSSqlFooter;
