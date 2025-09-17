import { TFunction } from 'i18next';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, CONFIG_STATE_ACTIONS, RESPONSE_STATUS } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import { setDriftAssessmentData } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { formatGetWellData, updateConfigStatePerInstance, updateConfigStateStatus } from '../GetWellUtils';

export const getSubConfigurationData = (cardData: any) => {
    // Check if this is ONTAP or OS configuration with sub-tables
    const configName = cardData?.block_one?.value;

    // If we change the dismiss button to right then it might come in different block
    if (configName === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS || configName === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM) {
        const count = cardData?.block_five?.count?.totalObjectsAssessed;
        return {
            isSubConfiguration: false,
            subConfigurationCount: count,
            storageTier: configName
        };
    }
    if (configName === 'Microsoft SQL Server High Availability') {
        const count = cardData?.block_six?.count?.totalObjectsAssessed;
        return {
            isSubConfiguration: false,
            subConfigurationCount: count,
            storageTier: configName
        };
    }

    return {
        isSubConfiguration: false,
        subConfigurationCount: 0,
        storageTier: configName
    };
};

export const getConfigurationName = (cardData: any) => {
    let configName = '';
    switch (cardData?.mapName) {
        case 'ontap':
            configName = 'ontap-volumes';
            break;
        case 'os':
            configName = 'operating-system';
            break;
        case 'Microsoft SQL Server High Availability':
            configName = 'high-availability';
            break;
        default:
            configName = cardData?.id;
            break;
    }
    return configName;
};

// Helper function to count remaining dismissed configurations
export const countDismissedConfigurations = (cardData: any) => {
    if (!cardData) return 0;

    let count = 0;
    Object.keys(cardData).forEach(key => {
        const configState = cardData[key]?.dismissedObj?.configState;
        if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
            count++;
        }
    });
    return count;
};

// Function For Dismiss
export const handleSingleAction = (
    action: string,
    cardData: any,
    selectedResourceId: string,
    selectedDatabaseInstance: string,
    selectedGwInstanceCredId: string,
    selectedGwInstanceRegionId: string,
    dismissMssqlAssessment: any,
    setDismissAction: (value: boolean) => void,
    handleDismissResponse: (res: any, action: string) => void,
    handleDismissError: (err: any) => void
) => {
    setDismissAction(true);
    const payload = {
        configurationsToDismiss: [
            {
                configurationName: getConfigurationName(cardData),
                configState: action,
                databaseHosts: [
                    {
                        id: selectedResourceId,
                        sqlServerInstances: [selectedDatabaseInstance],
                        credentialsId: selectedGwInstanceCredId,
                        region: selectedGwInstanceRegionId
                    }
                ]
            }
        ]
    };

    dismissMssqlAssessment({ payload })
        .then((res: any) => {
            setDismissAction(false);
            handleDismissResponse(res, action);
        })
        .catch((err: any) => {
            handleDismissError(err);
        });
};

export const addSuccessNotification = (action: string, cardName: string, dispatch: any, t: any) => {
    switch (action) {
        case CONFIG_STATE_ACTIONS.DISMISS:
        case CONFIG_STATE_ACTIONS.POSTPONED:
            const message = (
                <>
                    <span>{t('databases.well-architect.dismiss.dismiss-notification-content1')}</span>
                    <span style={{ fontWeight: 500 }}> {cardName} </span>
                    <span>{t('databases.well-architect.dismiss.dismiss-notification-content2')}</span>
                </>
            );
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message
                })
            );
            break;
        case CONFIG_STATE_ACTIONS.ACTIVE:
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: t('databases.well-architect.dismiss.reactivate-notification-message')
                })
            );
            break;
        default:
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: GENERAL.ANALYSIS_STATE_CHANGE_SUCCESS
                })
            );
            break;
    }
};

export const handleDismissResponse = (
    res: any,
    action: string,
    cardData: any,
    selectedGwInstanceCredId: string,
    selectedResourceId: string,
    selectedDatabaseInstance: string,
    selectedGwInstanceRegionId: string,
    showDismissedConfigurations: boolean,
    setShowDismissedConfigurations: ((value: boolean) => void) | null,
    fullCardData: any,
    dispatch: any,
    addSuccessNotification: (action: string, cardName: string, dispatch: any, t: any) => void,
    t: TFunction
) => {
    const dismissedConfigs = res?.data?.dismissedConfigurations;
    const databaseHosts = dismissedConfigs?.[0]?.databaseHosts;
    const status = databaseHosts?.[0].status;

    if (
        !res.error &&
        dismissedConfigs?.length > 0 &&
        databaseHosts?.length > 0 &&
        status.toUpperCase() === RESPONSE_STATUS.SUCCESS
    ) {
        let updatedState = '';
        if (
            action === CONFIG_STATE_ACTIONS.ACTIVE &&
            res?.data?.dismissedConfigurations?.[0]?.configState === CONFIG_STATE_ACTIONS.ACTIVE
        ) {
            updatedState = CONFIG_STATES.ACTIVATING;
        } else {
            updatedState = res?.data?.dismissedConfigurations?.[0]?.configState;
            updatedState = updatedState?.toUpperCase();
        }

        const targetId = cardData?.id || cardData?.block_one?.value;

        if (!targetId || !updatedState) return;

        const newData =
            updateConfigStatePerInstance(updatedState, targetId, res?.data?.dismissedConfigurations?.[0]?.endTime) ||
            {};
        dispatch(setDriftAssessmentData(newData));
        // @ts-ignore
        formatGetWellData(dispatch, newData);

        // Below code is to reset dashboard level assessment value also
        const perObj = {
            credentialId: selectedGwInstanceCredId,
            hostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            regionId: selectedGwInstanceRegionId,
            state: updatedState,
            id: targetId,
            name: cardData?.mapName
        };
        updateConfigStateStatus([perObj], dispatch, updatedState);

        // Check if we're reactivating and this is the last dismissed configuration
        if (action === CONFIG_STATE_ACTIONS.ACTIVE && showDismissedConfigurations && setShowDismissedConfigurations) {
            // Count remaining dismissed configurations after this reactivation
            const remainingDismissedCount = countDismissedConfigurations(fullCardData);

            // If this was the last dismissed configuration, hide the dismissed view
            if (remainingDismissedCount <= 1) {
                // <= 1 because current config is still counted but will be reactivated
                setShowDismissedConfigurations(false);
            }
        }

        addSuccessNotification(action, cardData?.mapName || cardData?.name, dispatch, t);
    } else {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: GENERAL.ANALYSIS_STATE_CHANGE_FAILED
            })
        );
    }
};

export const handleDismissError = (err: any, dispatch: any, setDismissAction: (value: boolean) => void) => {
    dispatch(
        addNotification({
            notificationType: NOTIFICATION_TYPES.ERROR,
            message: err
        })
    );
    setDismissAction(false);
};
