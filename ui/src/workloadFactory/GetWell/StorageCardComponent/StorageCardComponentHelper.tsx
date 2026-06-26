import { TFunction } from 'i18next';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, CONFIG_STATE_ACTIONS, RESPONSE_STATUS } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import { setDriftAssessmentData } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { formatGetWellDataFlat, updateConfigStatePerInstance, updateConfigStateStatus } from '../GetWellUtils';
import { FlatAssessmentResponse } from '../../../utils/types/getWellTypes';

export const getConfigurationName = (cardData: any) => {
    // For flat API, use configurationId if available (e.g., storage_tier, compute_rightsizing)
    if (cardData?.configurationId) {
        return cardData.configurationId;
    }

    // Legacy nested API handling
    let configName = '';
    switch (cardData?.mapName) {
        case ASSESSMENT_CONFIG_NAMES.ONTAP:
            configName = 'ontap-volumes';
            break;
        case ASSESSMENT_CONFIG_NAMES.OS:
            configName = 'operating-system';
            break;
        case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
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
    dismissAssessment: any,
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

    dismissAssessment({ payload })
        .then((res: any) => {
            setDismissAction(false);
            handleDismissResponse(res, action);
        })
        .catch((err: any) => {
            handleDismissError(err);
        });
};

export const addSuccessNotification = (
    action: string,
    cardName: string,
    dispatch: any,
    t: any,
    isBulkAction: boolean = true
) => {
    switch (action) {
        case CONFIG_STATE_ACTIONS.DISMISS:
        case CONFIG_STATE_ACTIONS.POSTPONED:
            const dismissMessage = (
                <>
                    <span>{t('databases.well-architect.dismiss.dismiss-notification-content1')}</span>
                    <span style={{ fontWeight: 500 }}> {cardName} </span>
                    <span>
                        {isBulkAction
                            ? t('databases.well-architect.dismiss.dismiss-notification-content2')
                            : t('databases.well-architect.dismiss.dismiss-notification-content2-subconfig')}
                    </span>
                </>
            );
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: dismissMessage
                })
            );
            break;
        case CONFIG_STATE_ACTIONS.ACTIVE:
            const reactivateMessage = (
                <>
                    <span>{t('databases.well-architect.dismiss.reactivate-notification-content1')}</span>
                    <span style={{ fontWeight: 500 }}> {cardName} </span>
                    <span>
                        {isBulkAction
                            ? t('databases.well-architect.dismiss.dismiss-notification-content2')
                            : t('databases.well-architect.dismiss.dismiss-notification-content2-subconfig')}
                    </span>
                </>
            );
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: reactivateMessage
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
    isBulkAction: boolean,
    addSuccessNotification: (action: string, cardName: string, dispatch: any, t: any, isBulkAction: boolean) => void,
    t: TFunction,
    formatDataFunction?: (dispatch: any, data?: any, showDismissedView?: boolean) => void,
    engineType?: string
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

        const targetId = cardData?.configurationId || cardData?.id || cardData?.block_one?.value;

        if (!targetId || !updatedState) return;

        // Update configuration state for the instance using the unified function
        const newData =
            updateConfigStatePerInstance(
                updatedState,
                targetId,
                res?.data?.dismissedConfigurations?.[0]?.endTime,
                res?.data?.dismissedConfigurations?.[0]?.startTime,
                engineType
            ) || {};

        // Set drift assessment data (used by both MSSQL and Oracle)
        dispatch(setDriftAssessmentData(newData));

        // Use the provided format function if available
        // If not provided, detect structure and use appropriate formatter
        if (formatDataFunction) {
            formatDataFunction(dispatch, newData, showDismissedConfigurations);
        } else {
            // All APIs return flat structure now
            formatGetWellDataFlat(
                dispatch,
                newData as FlatAssessmentResponse,
                showDismissedConfigurations,
                false,
                false,
                t
            );
        }

        // Below code is to reset dashboard level assessment value also
        const perObj = {
            credentialId: selectedGwInstanceCredId,
            hostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            regionId: selectedGwInstanceRegionId,
            state: updatedState,
            id: targetId,
            name: cardData?.mapName,
            startTime: res?.data?.dismissedConfigurations?.[0]?.startTime,
            endTime: res?.data?.dismissedConfigurations?.[0]?.endTime
        };
        updateConfigStateStatus([perObj], dispatch, updatedState, engineType);

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
        const notificationCardname = cardData?.mapName || cardData?.name;

        addSuccessNotification(action, notificationCardname, dispatch, t, isBulkAction);
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
