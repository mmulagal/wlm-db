import {
    DsButton,
    DsFlashingDotsLoader,
    DsPopover,
    DsTypography,
    Popover,
    useDialog
} from '@netapp/design-system';
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
    ASSESSMENT_CONFIG_IDS,
    CONFIG_STATES,
    DBType,
    GETWELL_STATUS,
    GETWELL_VALUES,
    isConfigIdMatch,
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
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    useDismissMssqlAssessmentMutation,
    useLazyGetSubTaskListQuery,
    useOptimizeComputeConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeStorageTierMutation
} from '../../../utils/apiService';
import {
    useOptimizeMutations,
    buildOptimizeApiInput,
    buildOptimizeInfoNotification,
    buildOptimizeFailedMessage
} from '../optimizeApiUtils';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { ReactComponent as TooltipIcon } from '../../../assets/tooltipGrey.svg';
import { ReactComponent as DisabledTooltipIcon } from '../../../assets/tooltipDisabled.svg';
import store from '../../../store/store';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { handleDialog } from './optimizeUtils';
import { backupStartTime } from '../../../utils/utilityFunctions';
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
import {
    hasInnerPage,
    getButtonText as getButtonTextFromRegistry,
    getColumnConfig,
    getOptimizeApiConfig
} from '../../../utils/configRegistry';

const StorageCardComponent = ({
    cardData,
    optimizePrintState,
    type,
    showDismissedConfigurations,
    setShowDismissedConfigurations,
    engineType = DBType.MSSQL
}: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [dismissAction, setDismissAction] = useState(false);
    const [showDismissButton, setShowDismissButton] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { isWad: isWadFromStore } = useAppSelector(state => state.getWellOptimize);

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
        // WAD excluded configs should have disabled/dismissed style
        // If the configuration data is not available, show the disabled/dismissed style
        if (
            cardData?.isWadExcluded ||
            cardData?.block_two?.value === GENERAL.UNAVAILABLE ||
            cardData?.errorMessage ||
            !cardData?.block_four?.value
        ) {
            return true;
        }

        // For normal cards
        return showDismissedConfigurations || cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    // Function to determine if pointer should be removed (non-clickable)
    const shouldRemoveActivatingPointer = () => {
        // WAD excluded configs should not be clickable
        if (cardData?.isWadExcluded) {
            return true;
        }

        // For normal cards
        return cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING;
    };

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const registryMutationMap = useOptimizeMutations();
    // Legacy single-instance mutations — only used by the fallback path below
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
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
                cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED &&
                cardData?.block_two?.value !== GETWELL_STATUS.OVER_PROVISIONED
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
                cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED &&
                cardData?.block_two?.value !== GETWELL_STATUS.OVER_PROVISIONED
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
        // WAD excluded configurations show Unavailable with tooltip
        if (cardData?.isWadExcluded) {
            return (
                <span className={styles.overProvisioned}>
                    <span className={styles.tooltipLevel}>
                        <DsPopover title={t('databases.wad.tab-disabled-message')} trigger="hover" placement="bottom">
                            <TooltipIcon />
                        </DsPopover>
                    </span>
                    <span style={{ marginLeft: '8px' }}>
                        <DsTypography variant="Semibold_14" isDisabled>
                            {t('databases.well-architect.unavailable')}
                        </DsTypography>
                    </span>
                </span>
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
                        {(!cardData?.block_two?.value || cardData?.errorMessage) && (
                            <span className={styles.overProvisioned}>
                                <span className={styles.tooltipLevel}>
                                    <Popover
                                        popoverClass=""
                                        children={
                                            cardData?.errorMessage ||
                                            t('databases.general.assessment-unavailable-with-tooltip')
                                        }
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
        // WAD excluded configurations show n/a
        if (cardData?.isWadExcluded) {
            return (
                <DsTypography variant="Semibold_14" isDisabled>
                    {t('databases.general.not-available-table-columns')}
                </DsTypography>
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
        if (
            cardData?.osPatchMissingPatches &&
            (cardData?.block_one?.value === GENERAL.OPERATING_SYSTEM_PATCH ||
                isConfigIdMatch(cardData?.configurationId, ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH))
        ) {
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
        if (
            cardData?.sqlPatchMissingPatches &&
            (cardData?.block_one?.value === GENERAL.MICROSOFT_SQL_PATCH ||
                isConfigIdMatch(cardData?.configurationId, ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH))
        ) {
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

        // Registry-based routing
        const apiConfig = getOptimizeApiConfig(type, engineType);
        if (apiConfig) {
            const mutationFn = registryMutationMap[apiConfig.mutation];
            if (mutationFn) {
                const credId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM;
                const regionId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM;
                const {
                    selectedAWSBackup,
                    selectedRecommendedInstance,
                    selectedSnapshot
                } = state.getWellOptimize;

                const apiData = buildOptimizeApiInput(apiConfig, {
                    configId: type,
                    engineType,
                    credentialId: credId,
                    regionId,
                    databaseHostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance,
                    selectedAWSBackup,
                    selectedRecommendedInstance,
                    selectedSnapshot
                });

                if (apiData) {
                    dispatch(setOptimizingInstanceData(true));
                    dispatch(setOptimizingData({ ...optimizingData, [cardData?.id]: 'optimizing' }));
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
                    dispatch(
                        buildOptimizeInfoNotification({
                            configName: cardData?.name || type,
                            t,
                            dispatch,
                            isWorkloadFactory
                        })
                    );

                    mutationFn(apiData as Record<string, unknown>).then((res: any) => {
                        const failedMsgData = buildOptimizeFailedMessage({
                            configName: cardData?.name || type,
                            t,
                            dispatch,
                            isWorkloadFactory,
                            className: styles.notification
                        });
                        if (!res.error) {
                            dispatch(
                                setJobToInstanceMap({
                                    ...state.getWellOptimize.jobToInstanceMap,
                                    [res?.data?.jobId]: {
                                        hostId: selectedResourceId,
                                        instanceId: selectedDatabaseInstance
                                    }
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
                            type,
                            undefined,
                            undefined,
                            false,
                            engineType
                        );
                    });
                    return;
                }
            }
        }

        // Legacy routing for configs not yet in the registry
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
                configurationName: cardData?.id
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            apiCall = optimizeStorageTier;
            payload = null;
        } else if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
            apiCall = registryMutationMap.optimizeMaxdopConfigForBulk;
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
            apiCall = registryMutationMap.optimizeMTUConfigForBulk;
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
            apiCall = registryMutationMap.optimizeAwsBackup;
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
        } else if (
            type === 'mpio-enabled' ||
            type === 'mpio-iscsi-count' ||
            type === 'mpio-timeout' ||
            type === 'os-type' ||
            type === 'ntfs-allocation-unit-size'
        ) {
            // MSSQL OS configs use bulk storage-operating-system endpoint with hostsToOptimize format
            apiCall = registryMutationMap.optimizeOperatingSystemForBulk;
            payload = {
                hostsToOptimize: [
                    {
                        configurationName: type,
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
        } else {
            apiCall = registryMutationMap.optimizeStorageConfig;
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
        dispatch(
            buildOptimizeInfoNotification({ configName: cardData?.name || type, t, dispatch, isWorkloadFactory })
        );

        let apiCallObj = {};
        if (
            type === ASSESSMENT_CONFIG_NAMES.MAXDOP ||
            type === ASSESSMENT_CONFIG_NAMES.MTU ||
            type === 'mpio-enabled' ||
            type === 'mpio-iscsi-count' ||
            type === 'mpio-timeout' ||
            type === 'os-type' ||
            type === 'ntfs-allocation-unit-size'
        ) {
            // Bulk operations - only pass payload
            apiCallObj = {
                payload
            };
        } else {
            // Single-instance operations - pass IDs + payload
            apiCallObj = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                payload
            };
        }

        apiCall(apiCallObj).then((res: any) => {
            const failedMsgData = buildOptimizeFailedMessage({
                configName: cardData?.name || type,
                t,
                dispatch,
                isWorkloadFactory,
                className: styles.notification
            });
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
                type,
                undefined, // operation (undefined for dialog, not bulk)
                undefined, // bulkRowData (not used for dialog)
                false, // isOptimizeInnerPage (dialogs are NOT inner page)
                engineType // Pass engineType so handlers know MSSQL vs Oracle
            );
        });
    };

    const handleNavigateToOptimizePage = (configId: string) => {
        const hasColumnConfig = getColumnConfig(configId);
        const tab = hasColumnConfig ? WLF_TABS.DYNAMIC_OPTIMIZE_INNER_PAGE : WLF_TABS.OPTIMIZE_INNER_PAGE;
        dispatch(setSelectedHeaderTab(tab));

        // cardData now has both API fields (name, categories) and legacy fields (mapName, tags)
        // No need for fallback logic anymore
        dispatch(setSelectedOptimizeConfig({ type: configId, data: cardData, engineType }));
    };

    // Check if this is a WAD (offline assessment) instance
    // Use Redux store flag which is set when navigating to WAD assessment
    const isWad = isWadFromStore || fullCardData?.isWad || false;

    // Get the config ID from API (flat structure) or fallback to legacy type prop
    const configId = cardData?.id || type;

    // Check if button would call handleDialog (vs navigation to optimize page)
    // Use registry to determine inner page vs dialog
    const wouldCallHandleDialog = () => !hasInnerPage(configId, engineType);

    // This is for inner page navigation
    const handleDifferentNavigation = () => {
        if (!wouldCallHandleDialog()) {
            handleNavigateToOptimizePage(configId);
        } else {
            handleDialog(
                setDialog,
                configId, // Pass config ID instead of legacy type
                callOptimizeApi,
                closeDialog,
                cardData,
                undefined,
                undefined,
                engineType,
                isWad
            );
        }
    };

    const setButtonText = () => {
        // Get config status for special cases (e.g., headroom over-provisioned/under-provisioned)
        const status = cardData?.block_two?.value?.toLowerCase();

        // Use registry to determine button text
        return getButtonTextFromRegistry(configId, engineType, status);
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
            formatGetWellData,
            DBType.MSSQL
        );
    };

    const handleDismissError = (err: any) => {
        handleDismissErrorHelper(err, dispatch, setDismissAction);
    };

    const handleDismissButtonClick = () => {
        const { storageTier } = getSubConfigurationData(cardData);

        setDialog(
            <DismissDialog
                type="single"
                storageTier={storageTier}
                callback={(selectedAction: string) => {
                    const configName = cardData?.block_one?.value;
                    handleSingleAction(selectedAction);
                }}
                closeCallback={closeDialog}
            />
        );
    };

    const dismissDisableButton = () => {
        // Disable dismiss for WAD excluded configurations
        if (cardData?.isWadExcluded) {
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
                            {cardData?.block_six?.count ? `${t('databases.well-architect.impacted')} ${cardData?.block_six?.type}` : cardData?.block_six?.type}
                        </DsTypography>
                    </div>
                )}

                {/* Buttons for regular cards */}
                {!showDismissedConfigurations &&
                    !optimizePrintState &&
                    (GW_CONFIG_OPTIMIZE_NA.includes(cardData?.block_one?.value ?? '') &&
                    cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZED ? (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            <div
                                className={
                                    isDarkTheme
                                        ? `${styles.buttonSection} ${styles.buttonSectionDarkMode}`
                                        : styles.buttonSection
                                }
                            >
                                <TooltipComponent
                                    title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                                    placement="bottom"
                                    width="120px"
                                    height="30px"
                                >
                                    <DsButton variant="secondary" isDisabled>
                                        {setButtonText()}
                                    </DsButton>
                                </TooltipComponent>
                            </div>
                        </div>
                    ) : optimizingInstanceData &&
                      cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZED &&
                      cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZING ? (
                        <div className={styles.buttonGroup}>
                            {/* Dismiss Button - Only show when showDismissButton is true and not in dismissed mode */}
                            {loading || dismissDisableButton() ? '' : renderDismissButton()}
                            <div
                                className={
                                    isDarkTheme
                                        ? `${styles.buttonSection} ${styles.buttonSectionDarkMode}`
                                        : styles.buttonSection
                                }
                            >
                                <TooltipComponent
                                    title={GENERAL.OPTIMIZATION_IN_PROGRESS}
                                    placement="bottom"
                                    width="310px"
                                    height="50px"
                                >
                                    <DsButton variant="secondary" isDisabled>
                                        {setButtonText()}
                                    </DsButton>
                                </TooltipComponent>
                            </div>
                        </div>
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
                            {/* View and Fix Action Button - disabled with Popover for WAD when it would call handleDialog */}
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
