import { Button, postBlueXPMessage, BlueXPListeners } from '@netapp/design-system';
// import { useProtectBackupMutation } from '../../../utils/apiService';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { navigateToCanvas } from '../../../utils/appConfig';
import { useDeployPgsqlTemplateMutation } from '../../../utils/apiService';
import {
    setDeployRedirectToCfLink,
    setIsLoading,
    setPermissionData,
    setPermissionWarning
} from '../../../store/mssql/msSqlActionSlice';
import { handleCreatePgsql } from '../PostgreUtils';
import { GENERAL } from '../../../utils/appConstants';
import { setIsRefreshed, setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    FORM_TO_WLF_NAVIGATE_BLUEXP,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    WLF_TABS
} from '../../../utils/consts';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { handleURL } from '../../../utils/utilityFunctions';
import { setMultiDataStatus } from '../../../store/workloadFactory/headersSlice';

function PostgressFooter() {
    const state = useAppSelector(state => state);
    const dispatch = useDispatch();
    const { databaseHostEntryPoint } = useAppSelector(state => state.msSqlAction);
    const selectedCredId = useAppSelector(state => state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId);
    const selectedRegionCode = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode);
    const isWorkloadFactoryStatus = useAppSelector(state => state.auth?.isWorkloadFactory);
    // const [protectBackup] = useProtectBackupMutation();
    const navigate = useNavigate();

    const [deploySqlTemplate] = useDeployPgsqlTemplateMutation();

    const clickCreatePgsql = async () => {
        const payload = handleCreatePgsql(state, dispatch);
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
        if (isWorkloadFactoryStatus) {
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

        message = (
            <>
                {GENERAL.CREATE_PGSQL_INFO_MESSAGE_WLM[0]}
                <Button
                    Component="button"
                    variant="text"
                    onClick={() => {
                        clearTimeout(notificationMsg);
                        dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
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
                    {GENERAL.CREATE_PGSQL_INFO_MESSAGE_WLM[1]}
                </Button>
                {GENERAL.CREATE_PGSQL_INFO_MESSAGE_WLM[2]}
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
            navigate('databases/inventory');
        } else if (databaseHostEntryPoint === 'database') {
            if (isWorkloadFactoryStatus) {
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
        } else if (isWorkloadFactoryStatus) {
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
                Cancel
            </Button>
            <Button isThin onClick={clickCreatePgsql}>
                Create
            </Button>
        </>
    );
}

export default PostgressFooter;
