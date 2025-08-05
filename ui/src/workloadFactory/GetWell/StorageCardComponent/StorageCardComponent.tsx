import {
    Button,
    ButtonWithDropdown,
    DsButton,
    DsFlashingDotsLoader,
    DsTypography,
    Popover,
    TooltipInfo,
    useDialog
} from '@netapp/design-system';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as ActionMenu } from '../../../assets/ic_actions_menu_circle.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { ReactComponent as InfoIcon } from '../../../assets/info.svg';
import styles from './StorageCardComponent.module.scss';
import { useAppSelector } from '../../../store/storeHooks';

import { GENERAL } from '../../../utils/appConstants';

import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    CONFIG_STATE_ACTIONS,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    GETWELL_STATUS,
    GETWELL_VALUES,
    GW_CONFIG_OPTIMIZE_NA,
    RESPONSE_STATUS,
    WELL_ARCHITECT_FINDINGS,
    WLF_TABS
} from '../../../utils/consts';
import {
    setDriftAssessmentData,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import {
    formatGetWellData,
    handleOptimizeStorageJob,
    updateConfigStatePerInstance,
    updateConfigStateStatus
} from '../GetWellUtils';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    useDismissMssqlAssessmentMutation,
    useLazyGetSubTaskListQuery,
    useOptimizeAwsBackupMutation,
    useOptimizeComputeConfigMutation,
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

const StorageCardComponent = ({ cardData, optimizePrintState, type }: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [dismissAction, setDismissAction] = useState(false);
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
        cardData: cardDataFromStore
    } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
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
                    {GENERAL.NOT_AVAILABLE}
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

    const sectionSevenContentNew = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        }
        return (
            <div
                className={`${styles.column} ${styles.warningColumn}`}
                style={{ borderRight: 'none', flex: '1 1 191px', minWidth: '193px' }}
            >
                <DsTypography variant="Semibold_14" className={styles.titleText} style={{ display: 'flex' }}>
                    <span>
                        {cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING && (
                            <div style={{ marginTop: '5px' }}>
                                <InfoIcon />
                            </div>
                        )}
                        {cardData?.dismissedObj?.configState !== CONFIG_STATES.ACTIVATING && <Warning />}
                    </span>
                    <span style={{ marginLeft: '8px' }}>
                        {cardData?.dismissedObj?.configState === CONFIG_STATES.DISMISSED && (
                            <DsTypography title={GENERAL.DISMISSED_MESSAGE} variant="Regular_14">
                                {GENERAL.DISMISSED_MESSAGE}
                            </DsTypography>
                        )}{' '}
                        {cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <DsTypography
                                    variant="Regular_14"
                                    style={{ whiteSpace: 'nowrap', position: 'relative', top: '2px' }}
                                >
                                    Active
                                </DsTypography>
                                <TooltipInfo>{GENERAL.ACTIVATING_MESSAGE_TWO}</TooltipInfo>
                            </div>
                        )}
                        {cardData?.dismissedObj?.configState === CONFIG_STATES.POSTPONED && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <DsTypography
                                    variant="Regular_14"
                                    style={{ whiteSpace: 'nowrap', position: 'relative', top: '2px' }}
                                    title="Analysis is postponed"
                                >
                                    Analysis is postponed
                                </DsTypography>
                                <TooltipInfo>
                                    {`until ${formatDateAssess(cardData?.dismissedObj?.endTime)}`}
                                </TooltipInfo>
                            </div>
                        )}
                    </span>
                </DsTypography>
            </div>
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
                title={cardData?.block_five?.value || GENERAL.NOT_AVAILABLE}
                isDisabled={disableText}
                className={styles.titleText}
            >
                {cardData?.block_five?.value || GENERAL.NOT_AVAILABLE}
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
                    {GENERAL.NOT_AVAILABLE}
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
                        {GENERAL.NOT_AVAILABLE}
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
                        {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
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
                        {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            );
        }
        if (cardData?.block_six?.smallFont || !cardData?.block_six?.value) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        }
        return (
            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }} isDisabled={disableText}>
                {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
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
        if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
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
        dispatch(setSelectedOptimizeConfig({ type, data: cardData }));
    };

    // This is for inner page navigation
    const handleDifferentNavigation = () => {
        if (
            type === 'Storage tier' ||
            type === 'Log drive size' ||
            type === 'Data files' ||
            type === 'Log files' ||
            type === GENERAL.RSS_CONFIGURATION ||
            type === GENERAL.SCHEDULED_LOCAL_SNAPSHOT ||
            type === GENERAL.CRR ||
            type === GENERAL.CLONE_MANAGEMENT
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
            type === 'Storage tier' ||
            type === 'Log drive size' ||
            type === GENERAL.RSS_CONFIGURATION ||
            type === GENERAL.SCHEDULED_LOCAL_SNAPSHOT ||
            type === GENERAL.CLONE_MANAGEMENT
        ) {
            return GENERAL.VIEW_AND_FIX;
        }
        if (
            type === 'Data files' ||
            type === 'Log files' ||
            type === GENERAL.OPERATING_SYSTEM_PATCH ||
            type === GENERAL.MICROSOFT_SQL_PATCH ||
            type === GENERAL.CRR
        ) {
            return 'View';
        }
        return GENERAL.VIEW_AND_FIX;
    };

    // Function For Dismiss
    const handleSingleAction = (action: string) => {
        setDismissAction(true);
        const payload = {
            configurationsToDismiss: [
                {
                    configurationName: cardData?.id,
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

                    const targetId = cardData?.id;

                    if (!targetId || !updatedState) return;

                    const newData =
                        updateConfigStatePerInstance(
                            updatedState,
                            targetId,
                            res?.data?.dismissedConfigurations?.[0]?.endTime
                        ) || {};
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

                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: GENERAL.ANALYSIS_STATE_CHANGE_SUCCESS
                        })
                    );
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: GENERAL.ANALYSIS_STATE_CHANGE_FAILED
                        })
                    );
                }
            })
            .catch(err => {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: err
                    })
                );

                setDismissAction(false);
            });
    };

    const dismissDisableButton = () => {
        if (
            cardData?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            cardData?.dismissedObj?.configState === CONFIG_STATES.POSTPONED ||
            cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING
        ) {
            return true;
        }
        return false;
    };

    return (
        <div className={styles.card}>
            <div className={styles.cardContent}>
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
                            title={cardData?.block_four?.value || GENERAL.NOT_AVAILABLE}
                        >
                            {cardData?.block_four?.value || GENERAL.NOT_AVAILABLE}
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

                {(cardData?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
                    cardData?.dismissedObj?.configState === CONFIG_STATES.POSTPONED ||
                    cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING) && (
                    <>{sectionSevenContentNew(cardData)}</>
                )}

                {/* Buttons */}
                {!optimizePrintState &&
                    cardData?.block_one?.value !== 'ONTAP' &&
                    cardData?.block_one?.value !== 'Operating system' &&
                    cardData?.block_one?.value !== t('databases.general.mssql-high-availability') &&
                    (GW_CONFIG_OPTIMIZE_NA.includes(cardData?.block_one?.value ?? '') &&
                    cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZED ? (
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
                        <Popover
                            popoverClass={CommonStyles.popover}
                            isAppendedToBody
                            children={<DsTypography variant="Regular_14">{disableOptimizeButtonTooltip}</DsTypography>}
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
                    ) : (
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
                    ))}

                {/* Section 7 */}
                {cardData?.block_one?.value !== 'ONTAP' &&
                    cardData?.block_one?.value !== 'Operating system' &&
                    cardData?.block_one?.value !== t('databases.general.mssql-high-availability') && (
                        <ButtonWithDropdown
                            variant="icon"
                            isDisabled={loading || dismissAction}
                            items={[
                                {
                                    id: 'activate',
                                    children: GENERAL.REACTIVATE,
                                    isDisabled:
                                        cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVE ||
                                        cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING ||
                                        !cardData?.dismissedObj?.configState,
                                    onClick: () => {
                                        handleSingleAction(CONFIG_STATE_ACTIONS.ACTIVE);
                                    },
                                    title: GENERAL.REACTIVATE_TOOLTIP,
                                    titleProps: {
                                        placement: 'left'
                                    }
                                },
                                {
                                    id: 'postponeFor30Days',
                                    children: GENERAL.POSTPONE_FOR_30_DAYS,
                                    isDisabled: cardData?.dismissedObj?.configState === CONFIG_STATES.POSTPONED,
                                    onClick: () => {
                                        handleSingleAction(CONFIG_STATE_ACTIONS.POSTPONED);
                                    },
                                    title: GENERAL.POSTPONED_TOOLTIP,
                                    titleProps: {
                                        placement: 'left'
                                    }
                                },
                                {
                                    id: 'dismiss',
                                    children: GENERAL.DISMISS,
                                    isDisabled: cardData?.dismissedObj?.configState === CONFIG_STATES.DISMISSED,
                                    onClick: () => {
                                        handleSingleAction(CONFIG_STATE_ACTIONS.DISMISS);
                                    },
                                    title: GENERAL.DISMISS_TOOLTIP,
                                    titleProps: {
                                        placement: 'left'
                                    }
                                }
                            ]}
                        >
                            <div className={loading || dismissAction ? styles.actionMenu : ''}>
                                <ActionMenu />
                            </div>
                        </ButtonWithDropdown>
                    )}
            </div>
        </div>
    );
};

export default StorageCardComponent;
