import React, { useEffect, useState } from 'react';
import { DsTypography, DsButton, useDialog, Button } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { DsFlashingDotsLoader } from '@tlveng/wlm-ds';
import {
    useDismissOracleAssessmentMutation,
    useOptimizeOracleOperatingSystemMutation,
    useLazyGetSubTaskListQuery
} from '../../../../../utils/apiService';
import styles from './OracleCardComponent.module.scss';
import { useAppSelector, useAppDispatch } from '../../../../../store/storeHooks';
import StatusSection from './StatusSection';
import SectionSix from './SectionSix';
import SectionFive from './SectionFive';
import ViewAndFixButton from './ViewAndFixButton';
import {
    CONFIG_STATES,
    DBType,
    WLF_TABS,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    GETWELL_STATUS,
    GETWELL_VALUES
} from '../../../../../utils/consts';
import { formatOracleWellArchitectedData, callOptimizeOracleApi } from '../OracleWellArchitectedUtils';
import { isNotApplicableStatus } from '../../../../WellArchitectedTab/assessmentFormatUtils';
import { normalizeResourceTypeCasing } from '../../../../../utils/resourceUtils';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../../../store/notificationSlice';
import { setSelectedHeaderTab } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { DismissDialog } from '../../../../GetWell/StorageCardComponent/DismissDialog/DismissDialog';
import TooltipComponent from '../../../../../common/TooltipComponent/TooltipComponent';
import {
    handleSingleAction as handleSingleActionHelper,
    addSuccessNotification as addSuccessNotificationHelper,
    handleDismissResponse as handleDismissResponseHelper,
    handleDismissError as handleDismissErrorHelper
} from '../../../../GetWell/StorageCardComponent/StorageCardComponentHelper';

export const fixingProcessNotification = (type: string, dispatch: any, isWorkloadFactory: boolean, t: any) => {
    dispatch(
        addNotification({
            notificationType: NOTIFICATION_TYPES.INFO,
            message: (
                <div>
                    {`${t('databases.well-architect.fixing-process-initiated-for')} ${type}. ${t(
                        'databases.well-architect.process-can-take-min'
                    )}`}
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
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
                        {t('databases.general.job-monitoring')}.
                    </Button>
                </div>
            )
        })
    );
};

export const createFailedOptimizationMessage = (type: string, dispatch: any, isWorkloadFactory: boolean, t: any) => (
    <div className={styles.notification}>
        {type} {t('databases.well-architect.failed-to-optimize')}
        <Button
            Component="button"
            variant="text"
            onClick={() => {
                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                const path = isWorkloadFactory ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: path, replace: true }
                });
                dispatch(clearNotifications());
            }}
        >
            {t('databases.general.view-job-monitoring')}.
        </Button>
    </div>
);

const OracleCardComponent = ({
    cardData,
    showDismissedConfigurations,
    setShowDismissedConfigurations,
    showMissingLinkBanner = false,
    isAllSubConfigActivating
}: any) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const [dismissAction, setDismissAction] = useState(false);
    const [showDismissButton, setShowDismissButton] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    const {
        isAssessmentAvailable,
        optimizePageLoading: loading,
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        cardData: cardDataFromStore,
        driftAssessmentData,
        isWad: isWadFromStore,
        optimizingInstanceData
    } = useAppSelector(state => state.getWellOptimize);

    // Check if this is a WAD (offline assessment) instance
    // Use Redux store flag which is set when navigating to WAD assessment
    const isWad = isWadFromStore || cardDataFromStore?.isWad || false;

    const [dismissOracleAssessment] = useDismissOracleAssessmentMutation();
    const [optimizeOracleOs] = useOptimizeOracleOperatingSystemMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const { setDialog, closeDialog } = useDialog();

    const [disableText, setDisableText] = useState(false);

    useEffect(() => {
        if (showMissingLinkBanner || (!loading && !isAssessmentAvailable)) {
            setDisableText(true);
        } else {
            setDisableText(false);
        }
    }, [isAssessmentAvailable, loading, showMissingLinkBanner]);

    // Function to determine if dismissed style should be applied
    const shouldApplyDismissedStyle = () => {
        if (showMissingLinkBanner) {
            return true;
        }

        // Not applicable configs should have disabled/dismissed style
        // If the configuration data is not available, show the disabled/dismissed style
        if (
            isNotApplicableStatus(cardData?.block_two?.value) ||
            cardData?.errorMessage ||
            !cardData?.block_four?.value
        ) {
            return true;
        }
        return showDismissedConfigurations || cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    // Function to determine if dismissed style should be applied
    const shouldRemoveActivatingPointer = () => {
        // Not applicable configs should not be clickable
        if (isNotApplicableStatus(cardData?.block_two?.value)) {
            return true;
        }
        return cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    // Function to render section two content
    const sectionTwoContent = (cardData: any) => (
        // Normal case - show StatusSection
        <StatusSection cardData={cardData} loading={loading} disableText={disableText} />
    );
    // Function to render section five content
    const sectionFiveContent = (cardData: any) => (
        // Normal case - show SectionFive
        <SectionFive cardData={cardData} loading={loading} disableText={disableText} />
    );
    // This is the function that will be called when the optimize button is clicked from oracle cards
    const callOracleOptimizeApi = (configId: string) =>
        callOptimizeOracleApi({
            configId,
            cardData,
            optimizeOracleOs,
            getJobDetailApi,
            dispatch,
            isWorkloadFactory,
            t
        });

    // Function For Dismiss
    const handleSingleAction = (action: string) => {
        handleSingleActionHelper(
            action,
            cardData,
            selectedResourceId,
            selectedDatabaseInstance,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId,
            dismissOracleAssessment,
            setDismissAction,
            handleDismissResponse,
            handleDismissError
        );
    };

    const addSuccessNotification = (action: string, cardName?: string) => {
        addSuccessNotificationHelper(action, cardName || '', dispatch, t, true);
    };

    const handleDismissResponse = (res: any, action: string) => {
        handleDismissResponseHelper(
            res,
            action,
            cardData,
            selectedGwInstanceCredId,
            selectedResourceId,
            selectedDatabaseInstance,
            selectedGwInstanceRegionId,
            showDismissedConfigurations,
            setShowDismissedConfigurations,
            cardDataFromStore,
            dispatch,
            true, // true for bulk action to show configuration text in notification
            addSuccessNotification,
            t,
            formatOracleWellArchitectedData,
            DBType.ORACLE
        );
    };

    const handleDismissError = (err: any) => {
        handleDismissErrorHelper(err, dispatch, setDismissAction);
    };

    const handleDismissButtonClick = () => {
        setDialog(
            <DismissDialog
                type="single"
                storageTier={cardData?.block_one?.value}
                callback={(selectedAction: string) => {
                    handleSingleAction(selectedAction);
                }}
                closeCallback={closeDialog}
            />
        );
    };

    const dismissDisableButton = () => {
        if (showMissingLinkBanner) {
            return true;
        }

        if (
            cardData?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            cardData?.dismissedObj?.configState === CONFIG_STATES.POSTPONED ||
            cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING ||
            !cardData?.block_two?.value // Disable dismiss when there's no valid assessment data
        ) {
            return true;
        }
        return false;
    };

    const handleCardHoverMouseLeave = () => {
        // Hide dismiss button when mouse leaves the card
        if (!showDismissedConfigurations) {
            setShowDismissButton(false);
        }
    };

    const handleCardHoverMouseEnter = () => {
        // Show dismiss button when mouse enters the card
        if (!showDismissedConfigurations) {
            setShowDismissButton(true);
        }
    };

    // Dismiss button component
    const renderDismissButton = () => {
        if (isWad || !showDismissButton || !cardData?.block_two?.value) return null;

        return (
            <div className={styles.buttonSection}>
                <DsButton
                    type="text"
                    onClick={handleDismissButtonClick}
                    isDisabled={loading || dismissAction || dismissDisableButton()}
                >
                    {t('databases.well-architect.dismiss-text')}
                </DsButton>
            </div>
        );
    };

    return (
        <div className={`${styles['oracle-card']} ${shouldApplyDismissedStyle() ? styles.dismissed : ''}`}>
            <div
                className={styles.cardContainer}
                onMouseEnter={handleCardHoverMouseEnter}
                onMouseLeave={handleCardHoverMouseLeave}
                style={{ cursor: shouldRemoveActivatingPointer() ? 'default' : 'pointer' }}
            >
                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <DsTypography
                                variant="Semibold_14"
                                className={styles.labelText}
                                title={cardData?.block_one?.value || '-'}
                            >
                                {cardData?.block_one?.value || '-'}
                            </DsTypography>
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_one?.type}
                        </DsTypography>
                    </div>
                </div>
                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>{sectionTwoContent(cardData)}</div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_two?.type}
                        </DsTypography>
                    </div>
                </div>
                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            {loading && (
                                <div className={styles.loadingSection}>
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            {!loading && (
                                <DsTypography
                                    variant="Semibold_14"
                                    className={styles.labelText}
                                    isDisabled={disableText}
                                    title={
                                        cardData?.block_four?.value ||
                                        t('databases.general.not-available-table-columns')
                                    }
                                >
                                    {cardData?.block_four?.value || t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            )}
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_four?.type}
                        </DsTypography>
                    </div>
                </div>
                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>{sectionFiveContent(cardData)}</div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_five?.type}
                        </DsTypography>
                    </div>
                </div>
                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <SectionSix cardData={cardData} loading={loading} disableText={disableText} />
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_six?.count
                                ? `${t('databases.well-architect.impacted')} ${normalizeResourceTypeCasing(
                                      cardData?.block_six?.type?.toLowerCase() || ''
                                  )}`
                                : cardData?.block_six?.type}
                        </DsTypography>
                    </div>
                </div>
                {!showDismissedConfigurations &&
                    (optimizingInstanceData &&
                    cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZED &&
                    cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZING ? (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            <div className={styles.buttonSection}>
                                <TooltipComponent
                                    title={t('databases.well-architected-tab.fix-after-operation-ends')}
                                    placement="bottom"
                                    width="310px"
                                    height="50px"
                                >
                                    <DsButton variant="secondary" isDisabled>
                                        {cardData?.block_two?.value === GETWELL_STATUS.NOT_OPTIMIZED
                                            ? t('databases.oracle-inner-page.view-and-fix')
                                            : t('databases.oracle-inner-page.view')}
                                    </DsButton>
                                </TooltipComponent>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            {/* View and Fix Action Button */}
                            <ViewAndFixButton
                                cardData={cardData}
                                loading={loading ?? undefined}
                                callOptimizeApi={callOracleOptimizeApi}
                                isWad={isWad}
                                showMissingLinkBanner={showMissingLinkBanner}
                            />
                        </div>
                    ))}
                {/* Reactivate button for dismissed configurations */}
                {showDismissedConfigurations && (
                    <div className={styles.buttonSection} id={`${cardData?.id}-reactivate`}>
                        <DsButton
                            variant="secondary"
                            onClick={() => handleSingleAction(CONFIG_STATES.ACTIVE)}
                            isDisabled={loading || false}
                        >
                            {t('databases.well-architect.dismiss.reactivate')}
                        </DsButton>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OracleCardComponent;
