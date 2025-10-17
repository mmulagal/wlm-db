import { Button, DsButton, DsFlashingDotsLoader, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import styles from './StorageCardComponent.module.scss';
import { useAppSelector } from '../../../store/storeHooks';

import { GENERAL } from '../../../utils/appConstants';

import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    DBType,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    GETWELL_STATUS,
    GETWELL_VALUES,
    GW_CONFIG_OPTIMIZE_NA,
    WELL_ARCHITECT_FINDINGS,
    WLF_TABS
} from '../../../utils/consts';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    useDismissMssqlAssessmentMutation,
    useLazyGetSubTaskListQuery,
    useOptimizeAwsBackupMutation,
    useOptimizeComputeConfigMutation,
    useOptimizeMTUConfigForBulkMutation,
    useOptimizeMaxdopConfigForBulkMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeStorageTierMutation
} from '../../../utils/apiService';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { ReactComponent as TooltipIcon } from '../../../assets/tooltipGrey.svg';
import { ReactComponent as DisabledTooltipIcon } from '../../../assets/tooltipDisabled.svg';
import store from '../../../store/store';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { handleDialog } from './optimizeUtils';
import { backupStartTime, formatDateAssess } from '../../../utils/utilityFunctions';
import { DismissDialog } from './DismissDialog/DismissDialog';
import {
    getSubConfigurationData,
    handleSingleAction as handleSingleActionHelper,
    addSuccessNotification as addSuccessNotificationHelper,
    handleDismissResponse as handleDismissResponseHelper,
    handleDismissError as handleDismissErrorHelper,
    areSubConfigurationsNotActive,
    areAllSubConfigurationsActivating as areAllSubConfigurationsActivatingHelper
} from './StorageCardComponentHelper';

const StorageCardComponent = ({
    cardData,
    optimizePrintState,
    type,
    showDismissedConfigurations,
    setShowDismissedConfigurations,
    isAllSubConfigActivating
}: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [dismissAction, setDismissAction] = useState(false);
    const [showDismissButton, setShowDismissButton] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const {
        isAssessmentAvailable,
        selectedResourceId,
        selectedDatabaseInstance,
        optimizingInstanceData,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        cardData: cardDataFromStore,
        driftAssessmentData
    } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);

    // Get the full card data to check dismissed configurations count
    const fullCardData = useAppSelector(state => state.getWellOptimize.cardData);

    // Function to determine if dismissed style should be applied
    const shouldApplyDismissedStyle = () => {
        // For ONTAP, OS, and HA cards: apply dismissed style if all sub-configs are activating
        if (
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY
        ) {
            return showDismissedConfigurations || isAllSubConfigActivating;
        }

        // For other normal cards
        return showDismissedConfigurations || cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    // Function to determine if dismissed style should be applied
    const shouldRemoveActivatingPointer = () => {
        // For ONTAP, OS, and HA cards: apply dismissed style if all sub-configs are activating
        if (
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM ||
            cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY
        ) {
            return isAllSubConfigActivating;
        }

        // For other normal cards
        return cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeMTUConfigForBulk] = useOptimizeMTUConfigForBulkMutation();
    const [optimizeMaxdopConfigForBulk] = useOptimizeMaxdopConfigForBulkMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
    const [optimizeAwsBackup] = useOptimizeAwsBackupMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [dismissMssqlAssessment] = useDismissMssqlAssessmentMutation();

    const [disableText, setDisableText] = useState(false);

    useEffect(() => {
        if (!loading && !isAssessmentAvailable) {
            setDisableText(true);
        } else {
            setDisableText(false);
        }
    }, [isAssessmentAvailable, loading]);

    const { setDialog, closeDialog } = useDialog();

    const disableOptimizeButton = useMemo(() => {
        if (cardData?.id === 'headroom') {
            return (
                cardData?.block_two?.value !== GETWELL_STATUS.UNDER_PROVISIONED &&
                cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED
            );
        }
        if (cardData?.id === 'compute-rightsizing') {
            return (
                cardData?.block_two?.value !== GETWELL_STATUS.UNDER_PROVISIONED &&
                cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED &&
                cardData?.block_two?.value !== GETWELL_STATUS.OVER_PROVISIONED
            );
        }
        if (cardData?.id === 'tempdb-drive-size') {
            return (
                cardData?.block_two?.value !== GETWELL_STATUS.UNDER_PROVISIONED &&
                cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED
            );
        }
        if (cardData?.id === 'log-drive-size') {
            return (
                cardData?.block_two?.value !== GETWELL_STATUS.UNDER_PROVISIONED &&
                cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED &&
                cardData?.block_two?.value !== GETWELL_STATUS.OVER_PROVISIONED
            );
        }
        return cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED;
    }, [cardData]);

    const disableOptimizeButtonTooltip = useMemo(() => {
        if (
            cardData?.id === 'headroom' &&
            (cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED ||
                (cardData?.sizingViolations?.overProvisionedDrives?.length &&
                    !cardData?.sizingViolations?.underProvisionedDrives?.length))
        ) {
            return GENERAL.HEADROOM_OVER_PROVISIONED_ERROR;
        }
        if (
            cardData?.id === 'tempdb-drive-size' &&
            (cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED ||
                (cardData?.sizingViolations?.overProvisionedDrives?.length &&
                    !cardData?.sizingViolations?.underProvisionedDrives?.length))
        ) {
            return GENERAL.TEMPDB_DRIVE_OVER_PROVISIONED_ERROR;
        }
        if (
            (cardData?.id === 'tempdb-drive-size' || cardData?.id === 'headroom') &&
            cardData?.block_two?.value === GETWELL_STATUS.NOT_OPTIMIZED &&
            !cardData?.sizingViolations?.underProvisionedDrives?.length &&
            cardData?.sizingViolations?.ignoredDrives?.length
        ) {
            return GENERAL.NOT_OPTIMIZED_SHARED_DRIVES;
        }
        return '';
    }, [cardData]);

    const setImage = (value: string) => {
        if (value === GETWELL_STATUS.OPTIMIZED) {
            return <Optimized />;
        }
        if (value === GETWELL_STATUS.UNDER_PROVISIONED) {
            return <UnderProvisioned />;
        }
        if (value === GETWELL_STATUS.OVER_PROVISIONED) {
            return (
                <div style={{ transform: 'rotate(180deg)' }}>
                    <UnderProvisioned />
                </div>
            );
        }
        if (value === GETWELL_STATUS.NOT_OPTIMIZED) {
            return <NotActive />;
        }
        if (value === GETWELL_STATUS.OPTIMIZING || value === GETWELL_STATUS.ANALYZING) {
            return <InProgress />;
        }
    };

    const tooltipListSection = (listObj: { key: string; value: string }[], valWidth: string) => (
        <div className={styles.tooltipLevel}>
            {listObj?.map((item: any, index: number) => (
                <div key={index}>
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <DsTypography variant="Semibold_13">{item.key}</DsTypography>
                        </div>

                        <div className={styles.secondPart} style={{ width: valWidth }}>
                            <DsTypography variant="Regular_13">
                                {GETWELL_VALUES?.[item.value || ''] || item?.value}
                            </DsTypography>
                        </div>
                    </div>
                    {index !== listObj.length - 1 && <div className={styles.tooltipSeparator} />}
                </div>
            ))}
        </div>
    );

    const sectionTwoContentNew = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        }
        if (cardData?.dismissedObj?.configState && cardData?.dismissedObj?.configState !== CONFIG_STATES.ACTIVE) {
            // Condition to show n/a if state is not active
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }
        // For ONTAP and OS cards: show N/A if sub-configurations are not active and in Dismissed view
        if (showDismissedConfigurations && areSubConfigurationsNotActive(cardData, driftAssessmentData)) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }

        // Only show N/A when all the subConfiguration are in activating state
        if (!showDismissedConfigurations && areAllSubConfigurationsActivatingHelper(cardData, driftAssessmentData)) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }
        return (
            <DsTypography
                variant="Semibold_14"
                className={
                    cardData?.block_two?.value === 'Over-provisioned'
                        ? `${styles.titleText} ${styles.overProvisioned}`
                        : styles.titleText
                }
                style={{
                    whiteSpace:
                        cardData?.errorMessage ||
                        (cardData?.block_two?.value === GETWELL_STATUS.ANALYZING &&
                            cardData?.block_one?.value === GENERAL.COMPUTE_RIGHTSIZING)
                            ? 'unset'
                            : 'nowrap'
                }}
            >
                {cardData?.block_two?.value && cardData?.block_two?.value !== GENERAL.UNAVAILABLE ? (
                    <>
                        <span
                            className={styles.svgSection}
                            style={{
                                top:
                                    cardData?.block_two?.value === WELL_ARCHITECT_FINDINGS.UNDER_PROVISIONED ||
                                    cardData?.block_two?.value === WELL_ARCHITECT_FINDINGS.OVER_PROVISIONED
                                        ? '2px'
                                        : '8px'
                            }}
                        >
                            {setImage(cardData?.block_two?.value || GENERAL.UNAVAILABLE)}
                        </span>
                        <span className={styles.valueSection} title={cardData?.block_two?.value || GENERAL.UNAVAILABLE}>
                            {cardData?.block_two?.value || GENERAL.UNAVAILABLE}
                        </span>
                    </>
                ) : (
                    <>
                        {cardData?.errorMessage && (
                            <span className={styles.overProvisioned}>
                                <span className={styles.tooltipLevel}>
                                    <Popover
                                        popoverClass=""
                                        children={cardData?.errorMessage}
                                        trigger="hover"
                                        isAppendedToBody={false}
                                        container={<TooltipIcon />}
                                        placement="bottom"
                                    />
                                </span>

                                <span style={{ marginLeft: '8px' }}>
                                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                                        {GENERAL.UNAVAILABLE}
                                    </DsTypography>
                                </span>
                            </span>
                        )}
                        {cardData?.block_two?.value === GETWELL_STATUS.ANALYZING &&
                            cardData?.block_one?.value === GENERAL.COMPUTE_RIGHTSIZING && (
                                <span className={styles.tooltip}>
                                    <Popover
                                        popoverClass=""
                                        children={
                                            <div className={styles.tooltipLevel}>
                                                <DsTypography variant="Regular_13">
                                                    {GENERAL.RIGHTSIZING_TOOLTIP}
                                                </DsTypography>
                                            </div>
                                        }
                                        trigger="hover"
                                        isAppendedToBody={false}
                                        container={<TooltipIcon />}
                                        placement="bottom"
                                    />
                                </span>
                            )}
                    </>
                )}
            </DsTypography>
        );
    };

    const sectionFiveContentNew = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        }
        // For ONTAP and OS cards: show N/A if sub-configurations are not active
        if (showDismissedConfigurations && areSubConfigurationsNotActive(cardData, driftAssessmentData)) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }

        // Only show N/A when all the subConfiguration are in activating state
        if (!showDismissedConfigurations && areAllSubConfigurationsActivatingHelper(cardData, driftAssessmentData)) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }
        if (cardData?.block_five?.count) {
            return (
                <DsTypography
                    variant="Semibold_14"
                    title={`${cardData?.block_five?.count?.totalObjectsInViolation || 0} out of ${
                        cardData?.block_five?.count?.totalObjectsAssessed || 0
                    }`}
                    className={`${styles.titleText} ${styles.centerTextContainer}`}
                >
                    <span>
                        <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                            {cardData?.block_five?.count?.totalObjectsInViolation || 0}
                        </DsTypography>
                    </span>
                    <span>
                        <DsTypography className={styles.centerText} variant="Semibold_14" isDisabled={disableText}>
                            {' out of '}
                        </DsTypography>
                    </span>
                    <span>
                        <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                            {cardData?.block_five?.count?.totalObjectsAssessed || 0}
                        </DsTypography>
                    </span>
                </DsTypography>
            );
        }
        return (
            <DsTypography
                variant="Semibold_14"
                title={cardData?.block_five?.value || t('databases.general.not-available-table-columns')}
                isDisabled={disableText}
                className={styles.titleText}
            >
                {cardData?.block_five?.value || t('databases.general.not-available-table-columns')}
            </DsTypography>
        );
    };

    const sectionSixContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        }
        if (cardData?.dismissedObj?.configState && cardData?.dismissedObj?.configState !== CONFIG_STATES.ACTIVE) {
            // Condition to show n/a if state is not active
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }
        // For HA cards: show N/A if sub-configurations are not active
        if (showDismissedConfigurations && areSubConfigurationsNotActive(cardData, driftAssessmentData)) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }

        // Only show N/A when all the subConfiguration are in activating state
        if (!showDismissedConfigurations && areAllSubConfigurationsActivatingHelper(cardData, driftAssessmentData)) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }

        if (cardData?.block_six?.count) {
            return (
                <div className={styles.warningMsg}>
                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                        {cardData?.block_six?.count?.totalObjectsInViolation || 0}
                    </DsTypography>
                    <DsTypography className={styles.centerText} variant="Semibold_14" isDisabled={disableText}>
                        {' out of '}
                    </DsTypography>
                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                        {cardData?.block_six?.count?.totalObjectsAssessed || 0}
                    </DsTypography>
                </div>
            );
        }
        if (cardData?.block_six?.list) {
            const listObj: any = [];
            cardData?.block_six?.list?.map((item: any) => {
                const parts = item.split(' ');
                const value = parts.pop() || ''; // Take the last element as value
                const key = parts.join(' '); // Join the rest as key
                listObj.push({ key, value });
            });
            return (
                <div className={styles.tooltipContainer}>
                    {cardData?.block_six?.list?.length > 0 && (
                        <div className={styles.tooltip}>
                            <Popover
                                popoverClass=""
                                children={tooltipListSection(listObj, '120px')}
                                trigger="hover"
                                isAppendedToBody={false}
                                container={<TooltipIcon />}
                                placement="bottom"
                            />
                        </div>
                    )}
                    {cardData?.block_six?.list?.length === 0 && (
                        <div>
                            <DisabledTooltipIcon />
                        </div>
                    )}
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {`${cardData?.block_six?.list?.length} values`}
                    </DsTypography>
                </div>
            );
        }
        if (cardData?.isMissingPermissions && cardData?.block_one?.value === GENERAL.COMPUTE_RIGHTSIZING) {
            return (
                <div className={styles.warningMsg}>
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {t('databases.general.not-available-table-columns')}
                    </DsTypography>
                </div>
            );
        }
        if (cardData?.osPatchMissingPatches && cardData?.block_one?.value === GENERAL.OPERATING_SYSTEM_PATCH) {
            const listObj = [
                { key: 'Critical ', value: cardData?.osPatchMissingPatches?.critical },
                { key: 'Security ', value: cardData?.osPatchMissingPatches?.security },
                { key: 'Other ', value: cardData?.osPatchMissingPatches?.other }
            ];
            return (
                <div className={styles.tooltipContainer}>
                    {cardData?.block_six?.value > 0 && (
                        <div className={styles.tooltip}>
                            <Popover
                                popoverClass=""
                                children={tooltipListSection(listObj, '30px')}
                                trigger="hover"
                                isAppendedToBody={false}
                                container={<TooltipIcon />}
                                placement="bottom"
                            />
                        </div>
                    )}
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {cardData?.block_six?.value || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                </div>
            );
        }
        if (cardData?.sqlPatchMissingPatches && cardData?.block_one?.value === GENERAL.MICROSOFT_SQL_PATCH) {
            const listObj = [
                { key: 'Critical ', value: cardData?.sqlPatchMissingPatches?.critical },
                { key: 'Important ', value: cardData?.sqlPatchMissingPatches?.important }
            ];
            return (
                <div className={styles.tooltipContainer}>
                    {cardData?.block_six?.value > 0 && (
                        <div className={styles.tooltip}>
                            <Popover
                                popoverClass=""
                                children={tooltipListSection(listObj, '30px')}
                                trigger="hover"
                                isAppendedToBody={false}
                                container={<TooltipIcon />}
                                placement="bottom"
                            />
                        </div>
                    )}
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {cardData?.block_six?.value || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                </div>
            );
        }
        if (cardData?.block_six?.smallFont || !cardData?.block_six?.value) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {cardData?.block_six?.value || t('databases.general.not-available-table-columns')}
                </DsTypography>
            );
        }
        return (
            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }} isDisabled={disableText}>
                {cardData?.block_six?.value || t('databases.general.not-available-table-columns')}
            </DsTypography>
        );
    };

    // This is the function that will be called when the optimize button is clicked from main cards
    const callOptimizeApi = (type: any) => {
        let payload: null | object = {};
        let apiCall = null;
        const state = store.getState();
        if (type === GENERAL.COMPUTE_RIGHTSIZING) {
            apiCall = optimizeComputeConfig;
            const { selectedRecommendedInstance } = state.getWellOptimize;
            payload = {
                instanceType: selectedRecommendedInstance?.value
            };
        } else if (
            type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
            type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
        ) {
            apiCall = optimizeStorageSizing;
            payload = {
                configurationName: [cardData?.id]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            apiCall = optimizeStorageTier;
            payload = null;
        } else if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
            apiCall = optimizeMaxdopConfigForBulk;
            payload = {
                hostsToOptimize: [
                    {
                        configurationName: 'max-dop',
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
        } else if (type === ASSESSMENT_CONFIG_NAMES.MTU) {
            apiCall = optimizeMTUConfigForBulk;
            payload = {
                hostsToOptimize: [
                    {
                        configurationName: 'mtu-alignment',
                        databaseHosts: [
                            {
                                id: selectedResourceId,
                                sqlServerInstances: [selectedDatabaseInstance],
                                credentialsId: selectedGwInstanceCredId,
                                region: selectedGwInstanceRegionId,
                                interfaceNames: cardData?.objectsInViolation
                            }
                        ]
                    }
                ]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
            apiCall = optimizeAwsBackup;
            const state = store.getState();
            const { selectedAWSBackup, selectedRowFsxId } = state.getWellOptimize;
            payload = {
                hostsToOptimize: [
                    {
                        configurationName: ['aws-backup'],
                        databaseHosts: [
                            {
                                id: selectedResourceId,
                                sqlServerInstances: [selectedDatabaseInstance],
                                fsxFileSystemId: selectedRowFsxId,
                                backupRetentionDays: selectedAWSBackup?.numberOfDays,
                                backupStartTime: backupStartTime(selectedAWSBackup),
                                credentialsId: selectedGwInstanceCredId,
                                region: selectedGwInstanceRegionId
                            }
                        ]
                    }
                ]
            };
        } else {
            // ToDo - More type will come like optimize for sizing and layout here
            apiCall = optimizeStorageConfig;
            payload = {
                assessments: [
                    {
                        configurationName: type,
                        objectsToOptimize: []
                    }
                ]
            };
        }

        // call optimize api
        dispatch(setOptimizingInstanceData(true));
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [cardData?.id]: 'optimizing'
            })
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [type]: [
                    ...(inProgressOptimizationData[type] || []),
                    `${selectedResourceId}_${selectedDatabaseInstance}`
                ]
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [type]: [...(inProgressHostData[type] || []), selectedResourceId]
            })
        );
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Fixing process initiated for ${type}. This process can take upto 2 minutes. Track progress in `}
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
                            {GENERAL.JOB_MONITORING}.
                        </Button>
                    </div>
                )
            })
        );

        let apiCallObj = {};
        if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP || type === ASSESSMENT_CONFIG_NAMES.MTU) {
            apiCallObj = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                payload
            };
        } else {
            apiCallObj = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                payload
            };
        }

        apiCall(apiCallObj).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {type} failed to optimize.
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
                        {GENERAL.VIEW_JOB_MONITORING}.
                    </Button>
                </div>
            );
            if (!res.error) {
                dispatch(
                    setJobToInstanceMap({
                        ...state.getWellOptimize.jobToInstanceMap,
                        [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                    })
                );
            }
            handleOptimizeStorageJob(
                res,
                {
                    id: cardData?.id,
                    name: type,
                    hostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance,
                    credentialId: selectedGwInstanceCredId,
                    regionId: selectedGwInstanceRegionId
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                type
            );
        });
    };

    const handleNavigateToOptimizePage = (type: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_INNER_PAGE));
        // Storing data to identify which config is selected from inner optimize page for MSSQL
        dispatch(setSelectedOptimizeConfig({ type, data: cardData, engineType: DBType.MSSQL }));
    };

    // This is for inner page navigation
    const handleDifferentNavigation = () => {
        if (
            type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER ||
            type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            type === ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF ||
            type === ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF ||
            type === GENERAL.RSS_CONFIGURATION ||
            type === GENERAL.SCHEDULED_LOCAL_SNAPSHOT ||
            type === GENERAL.CRR ||
            type === GENERAL.CLONE_MANAGEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.MTU
        ) {
            handleNavigateToOptimizePage(type);
        } else {
            handleDialog(setDialog, type, callOptimizeApi, closeDialog, cardData);
        }
    };

    // This will be removed
    const handleTemporaryDialog = () => {
        handleDialog(setDialog, type, callOptimizeApi, closeDialog, cardData);
    };

    const setButtonText = () => {
        if (
            type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER ||
            type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            type === GENERAL.RSS_CONFIGURATION ||
            type === GENERAL.SCHEDULED_LOCAL_SNAPSHOT ||
            type === GENERAL.CLONE_MANAGEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS
        ) {
            return GENERAL.VIEW_AND_FIX;
        }
        if (
            type === ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF ||
            type === ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF ||
            type === GENERAL.OPERATING_SYSTEM_PATCH ||
            type === GENERAL.MICROSOFT_SQL_PATCH ||
            type === GENERAL.CRR ||
            type === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
            type === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY
        ) {
            return 'View';
        }
        return GENERAL.VIEW_AND_FIX;
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
            dismissMssqlAssessment,
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
            fullCardData,
            dispatch,
            true, // true for bulk action to show configuration text in notification
            addSuccessNotification,
            t,
            formatGetWellData
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
                    const configName = cardData?.block_one?.value;
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
                    {GENERAL.DISMISS}
                </DsButton>
            </div>
        );
    };

    return (
        <div className={`${styles.card} ${shouldApplyDismissedStyle() ? styles.dismissed : ''}`}>
            <div
                className={styles.cardContent}
                onMouseEnter={handleCardHoverMouseEnter}
                onMouseLeave={handleCardHoverMouseLeave}
                style={{ cursor: shouldRemoveActivatingPointer() ? 'default' : 'pointer' }}
            >
                {/* First Column */}
                <div className={`${styles.column}`}>
                    <DsTypography variant="Semibold_14" className={styles.titleText} title={cardData?.block_one?.value}>
                        {cardData?.block_one?.value}
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={styles.label} title={cardData?.block_one?.type}>
                        {cardData?.block_one?.type}
                    </DsTypography>
                </div>

                {/* Status */}
                <div className={`${styles.column} ${styles.tooltip}`}>
                    {sectionTwoContentNew(cardData)}

                    <DsTypography variant="Regular_14" isDisabled={disableText} className={styles.label}>
                        {cardData?.block_two?.type}
                    </DsTypography>
                </div>

                {/* Severity */}

                <div className={`${styles.column}`}>
                    {loading && (
                        <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                            <DsFlashingDotsLoader />
                        </div>
                    )}
                    {!loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={styles.titleText}
                            isDisabled={disableText}
                            title={cardData?.block_four?.value || t('databases.general.not-available-table-columns')}
                        >
                            {cardData?.block_four?.value || t('databases.general.not-available-table-columns')}
                        </DsTypography>
                    )}
                    <DsTypography variant="Regular_14" className={styles.label} isDisabled={disableText}>
                        {cardData?.block_four?.type}
                    </DsTypography>
                </div>

                {/* Resource type */}
                <div className={`${styles.column} ${styles.tooltip}`}>
                    {sectionFiveContentNew(cardData)}
                    <DsTypography variant="Regular_14" className={styles.label}>
                        {cardData?.block_five?.type}
                    </DsTypography>
                </div>

                {/* Impacted Volumes */}
                {cardData?.block_six && (
                    <div className={`${styles.column} ${styles.tooltip}`}>
                        <DsTypography variant="Semibold_14" className={styles.titleText}>
                            {sectionSixContent(cardData)}
                        </DsTypography>
                        <DsTypography variant="Regular_14" title={cardData?.block_six?.type} className={styles.label}>
                            {cardData?.block_six?.type}
                        </DsTypography>
                    </div>
                )}

                {/* Empty Column for ONTAP and Operating System so that dismiss button is aligned at last column */}
                {(cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
                    cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM) && (
                    <div className={`${styles.column} ${styles.emptyColumn}`} />
                )}

                {/* Buttons - Handling for ONTAP, Operating system, and MSSQL High Availability cards */}
                {(cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
                    cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM ||
                    cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY) &&
                !showDismissedConfigurations &&
                !areAllSubConfigurationsActivatingHelper(cardData, driftAssessmentData) &&
                cardData?.block_two?.value ? (
                    <div className={`${styles.column} ${styles.lastColumnAlignment}`}>
                        {/* Dismiss Button - Show for ONTAP, Operating system, and MSSQL High Availability in last grid column */}
                        {renderDismissButton()}
                    </div>
                ) : null}

                {/* Buttons for regular cards */}
                {!showDismissedConfigurations &&
                    !(
                        cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
                        cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM ||
                        cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY
                    ) &&
                    !optimizePrintState &&
                    (GW_CONFIG_OPTIMIZE_NA.includes(cardData?.block_one?.value ?? '') &&
                    cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZED ? (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            <div
                                className={styles.buttonSection}
                                // style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}
                            >
                                <TooltipComponent
                                    title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                                    placement="bottom"
                                    width="120px"
                                    height="30px"
                                >
                                    <div className={isDarkTheme ? styles.buttonSectionDarkMode : ''}>
                                        <DsButton variant="secondary" isDisabled>
                                            {setButtonText()}
                                        </DsButton>
                                    </div>
                                </TooltipComponent>
                            </div>
                        </div>
                    ) : optimizingInstanceData &&
                      cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZED &&
                      cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZING ? (
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_IN_PROGRESS}
                            placement="bottom"
                            width="310px"
                            height="50px"
                        >
                            <div className={isDarkTheme ? styles.buttonSectionDarkMode : ''}>
                                <DsButton variant="secondary" isDisabled>
                                    {setButtonText()}
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    ) : disableOptimizeButtonTooltip ? (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            <Popover
                                popoverClass={CommonStyles.popover}
                                isAppendedToBody
                                children={
                                    <DsTypography variant="Regular_14">{disableOptimizeButtonTooltip}</DsTypography>
                                }
                                trigger="hover"
                                container={
                                    <div
                                        className={
                                            isDarkTheme
                                                ? `${styles.buttonSection} ${styles.buttonSectionDarkMode}`
                                                : styles.buttonSection
                                        }
                                    >
                                        <DsButton variant="secondary" isDisabled>
                                            {setButtonText()}
                                        </DsButton>
                                    </div>
                                }
                            />
                        </div>
                    ) : (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            {/* View and Fix Action Button */}
                            <div
                                className={
                                    isDarkTheme && (loading || disableOptimizeButton)
                                        ? `${styles.buttonSection} ${styles.buttonSectionDarkMode}`
                                        : styles.buttonSection
                                }
                                id={`${cardData?.id}-optimize`}
                            >
                                <DsButton
                                    variant="secondary"
                                    onClick={() => handleDifferentNavigation()}
                                    isDisabled={loading || disableOptimizeButton || dismissDisableButton()}
                                >
                                    {setButtonText()}
                                </DsButton>
                            </div>
                        </div>
                    ))}

                {/* Reactivate button for dismissed configurations */}
                {showDismissedConfigurations && (
                    <div
                        className={
                            isDarkTheme && (loading || disableOptimizeButton)
                                ? `${styles.buttonSection} ${styles.buttonSectionDarkMode}`
                                : styles.buttonSection
                        }
                        id={`${cardData?.id}-reactivate`}
                    >
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

export default StorageCardComponent;
