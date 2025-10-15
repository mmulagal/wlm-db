import { DsTypography, DsButton, useDialog } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { DsFlashingDotsLoader } from '@tlveng/wlm-ds';
import styles from './OracleCardComponent.module.scss';
import { useAppSelector, useAppDispatch } from '../../../../../store/storeHooks';
import StatusSection from './StatusSection';
import SectionSix from './SectionSix';
import SectionFive from './SectionFive';
import ViewAndFixButton from './ViewAndFixButton';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES } from '../../../../../utils/consts';
import { useDismissOracleAssessmentMutation } from '../../../../../utils/apiService';
import { DismissDialog } from '../../../../GetWell/StorageCardComponent/DismissDialog/DismissDialog';
import {
    getSubConfigurationData,
    handleSingleAction as handleSingleActionHelper,
    addSuccessNotification as addSuccessNotificationHelper,
    handleDismissResponse as handleDismissResponseHelper,
    handleDismissError as handleDismissErrorHelper,
    areSubConfigurationsNotActive,
    areAllSubConfigurationsActivating as areAllSubConfigurationsActivatingHelper
} from '../../../../GetWell/StorageCardComponent/StorageCardComponentHelper';
import { formatOracleWellArchitectedData } from '../OracleWellArchitectedUtils';

const OracleCardComponent = ({
    cardData,
    showDismissedConfigurations,
    setShowDismissedConfigurations,
    isAllSubConfigActivating
}: any) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const [dismissAction, setDismissAction] = useState(false);
    const [showDismissButton, setShowDismissButton] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const {
        isAssessmentAvailable,
        optimizePageLoading: loading,
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        cardData: cardDataFromStore,
        driftAssessmentData
    } = useAppSelector(state => state.getWellOptimize);

    const [dismissOracleAssessment] = useDismissOracleAssessmentMutation();
    const { setDialog, closeDialog } = useDialog();

    const [disableText, setDisableText] = useState(false);

    useEffect(() => {
        if (!loading && !isAssessmentAvailable) {
            setDisableText(true);
        } else {
            setDisableText(false);
        }
    }, [isAssessmentAvailable, loading]);

    // Function to determine if dismissed style should be applied
    const shouldApplyDismissedStyle = () => {
        // For ONTAP and OS cards: apply dismissed style if all sub-configs are activating
        if (
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
        ) {
            return showDismissedConfigurations || isAllSubConfigActivating;
        }

        // For other normal cards: keep the existing logic
        return showDismissedConfigurations || cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    // Function to determine if dismissed style should be applied
    const shouldRemoveActivatingPointer = () => {
        // For ONTAP, OS, and HA cards: apply dismissed style if all sub-configs are activating
        if (
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
        ) {
            return isAllSubConfigActivating;
        }

        // For other normal cards
        return cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    // Function to render section two content with N/A conditions for ONTAP and OS cards
    const sectionTwoContent = (cardData: any) => {
        // Apply these conditions only for ONTAP and OS cards
        if (
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
        ) {
            // For ONTAP and OS cards: show N/A if sub-configurations are not active and in Dismissed view
            if (showDismissedConfigurations && areSubConfigurationsNotActive(cardData, driftAssessmentData)) {
                return (
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }

            // Only show N/A when all the subConfiguration are in activating state
            if (
                !showDismissedConfigurations &&
                areAllSubConfigurationsActivatingHelper(cardData, driftAssessmentData)
            ) {
                return (
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        }

        // Normal case - show StatusSection
        return <StatusSection cardData={cardData} loading={loading} disableText={disableText} />;
    };

    // Function to render section five content with N/A conditions for ONTAP and OS cards
    const sectionFiveContent = (cardData: any) => {
        // Apply these conditions only for ONTAP and OS cards
        if (
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
        ) {
            // For ONTAP and OS cards: show N/A if sub-configurations are not active and in Dismissed view
            if (showDismissedConfigurations && areSubConfigurationsNotActive(cardData, driftAssessmentData)) {
                return (
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }

            // Only show N/A when all the subConfiguration are in activating state
            if (
                !showDismissedConfigurations &&
                areAllSubConfigurationsActivatingHelper(cardData, driftAssessmentData)
            ) {
                return (
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        }

        // Normal case - show SectionFive
        return <SectionFive cardData={cardData} loading={loading} disableText={disableText} />;
    };

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
        addSuccessNotificationHelper(action, cardName || '', dispatch, t);
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
            addSuccessNotification,
            t,
            formatOracleWellArchitectedData
        );
    };

    const handleDismissError = (err: any) => {
        handleDismissErrorHelper(err, dispatch, setDismissAction);
    };

    const handleDismissButtonClick = () => {
        const { isSubConfiguration, subConfigurationCount, storageTier } = getSubConfigurationData(cardData);

        setDialog(
            <DismissDialog
                type="single"
                storageTier={storageTier}
                isSubConfiguration={isSubConfiguration}
                subConfigurationCount={subConfigurationCount}
                callback={(selectedAction: string) => {
                    handleSingleAction(selectedAction);
                }}
                closeCallback={closeDialog}
            />
        );
    };

    const dismissDisableButton = () => {
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
        if (!showDismissButton || !cardData?.block_two?.value) return null;

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
                                <DsTypography variant="Semibold_14" className={styles.labelText}>
                                    {cardData?.block_four?.value || '-'}
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
                {cardData?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS &&
                    cardData?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM && (
                        <div className={styles.itemContainer}>
                            <div className={styles.item}>
                                <div className={styles.summaryValue}>
                                    <SectionSix cardData={cardData} loading={loading} disableText={disableText} />
                                </div>
                                <DsTypography variant="Regular_14" className={styles.descriptionText}>
                                    {cardData?.block_six?.type}
                                </DsTypography>
                            </div>
                        </div>
                    )}

                {/* Empty Column for ONTAP and Operating System so that dismiss button is aligned at last column */}
                {(cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
                    cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM) && (
                    <div className={`${styles.column} ${styles.emptyColumn}`} />
                )}

                {/* Buttons - Handling for ONTAP and Operating system cards */}
                {(cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
                    cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM) &&
                !showDismissedConfigurations &&
                !areAllSubConfigurationsActivatingHelper(cardData, driftAssessmentData) &&
                cardData?.block_two?.value ? (
                    <div className={`${styles.column} ${styles.lastColumnAlignment}`}>
                        {/* Dismiss Button - Show for ONTAP and Operating system in last grid column */}
                        {renderDismissButton()}
                    </div>
                ) : null}
                {/* Buttons for regular cards */}
                {!showDismissedConfigurations &&
                    !(
                        cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
                        cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM
                    ) && (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            {/* View and Fix Action Button */}
                            <ViewAndFixButton cardData={cardData} loading={loading ?? undefined} />
                        </div>
                    )}
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
