import {
    Button,
    ButtonWithDropdown,
    DsButton,
    DsFlashingDotsLoader,
    DsTypography,
    Popover
} from '@netapp/design-system';
import { useDialog } from '@netapp/design-system';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as ActionMenu } from '../../../assets/ic_actions_menu_circle.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { ReactComponent as InfoIcon } from '../../../assets/info.svg';
import styles from './StorageCardComponent.module.scss';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';

import { GENERAL } from '../../../utils/appConstants';

import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    GETWELL_STATUS,
    GETWELL_VALUES,
    GW_CONFIG_OPTIMIZE_NA,
    GW_TOOLTIP_KEYS_MAPPING,
    WLF_TABS
} from '../../../utils/consts';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
    setCardData,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizationBreakDown,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { formatGetWellData, formatOptimizationBreakDown, handleOptimizeStorageJob } from '../GetWellUtils';
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
import { backupStartTime } from '../../../utils/utilityFunctions';

const StorageCardComponent = ({ cardData, optimizePrintState, type }: any) => {
    const dispatch = useDispatch();
    const [dismissAction, setDismissAction] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { isDemoMode } = useAppSelector(state => state.auth);
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
        } else if (
            cardData?.id === 'tempdb-drive-size' &&
            (cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED ||
                (cardData?.sizingViolations?.overProvisionedDrives?.length &&
                    !cardData?.sizingViolations?.underProvisionedDrives?.length))
        ) {
            return GENERAL.TEMPDB_DRIVE_OVER_PROVISIONED_ERROR;
        } else if (
            (cardData?.id === 'tempdb-drive-size' || cardData?.id === 'headroom') &&
            cardData?.block_two?.value === GETWELL_STATUS.NOT_OPTIMIZED &&
            !cardData?.sizingViolations?.underProvisionedDrives?.length &&
            cardData?.sizingViolations?.ignoredDrives?.length
        ) {
            return GENERAL.NOT_OPTIMIZED_SHARED_DRIVES;
        } else {
            return '';
        }
    }, [cardData]);

    const setImage = (value: string) => {
        if (value === GETWELL_STATUS.OPTIMIZED) {
            return <Optimized />;
        } else if (value === GETWELL_STATUS.UNDER_PROVISIONED) {
            return <UnderProvisioned />;
        } else if (value === GETWELL_STATUS.OVER_PROVISIONED) {
            return (
                <div style={{ transform: 'rotate(180deg)' }}>
                    <UnderProvisioned />
                </div>
            );
        } else if (value === GETWELL_STATUS.NOT_OPTIMIZED) {
            return <NotActive />;
        } else if (value === GETWELL_STATUS.OPTIMIZING || value === GETWELL_STATUS.ANALYZING) {
            return <InProgress />;
        } else {
            return;
        }
    };

    const tooltipRssListSection = (
        listObj: { key: string; value: string }[],
        secListObj: { key: string; value: string }[]
    ) => {
        return (
            <div className={styles.tooltipLevel}>
                {listObj?.map((item: any, index: number) => {
                    return (
                        <div key={index}>
                            <div className={styles.rowrss}>
                                <div className={styles.firstPart}>
                                    <DsTypography variant="Semibold_13">{item.key}</DsTypography>
                                </div>

                                <div className={styles.secondPart}>
                                    <div className={styles.secSubPart}>
                                        <DsTypography variant="Regular_13">
                                            {GETWELL_VALUES?.[item.value || ''] || item?.value}
                                        </DsTypography>
                                    </div>

                                    {secListObj && (
                                        <>
                                            <div className={styles.seperator} />
                                            <div className={styles.secSubPart}>
                                                <DsTypography variant="Regular_13">
                                                    {`${secListObj[index]?.value}` || ' '}
                                                </DsTypography>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {index !== listObj.length - 1 && <div className={styles.tooltipSeparator} />}
                        </div>
                    );
                })}
            </div>
        );
    };

    const tooltipListSection = (listObj: { key: string; value: string }[], valWidth: string) => {
        return (
            <div className={styles.tooltipLevel}>
                {listObj?.map((item: any, index: number) => {
                    return (
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
                    );
                })}
            </div>
        );
    };

    const sectionTwoContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        } else if (cardData?.dismissedObj?.state && cardData?.dismissedObj?.state !== CONFIG_STATES.ACTIVE) {
            //Condition to show n/a if state is not active
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        } else {
            return (
                <div className={styles.tooltipContainer}>
                    <div className={styles.statusTopSection}>
                        {cardData?.block_two?.value && cardData?.block_two?.value !== GENERAL.UNAVAILABLE ? (
                            <>
                                <div className={styles.svgSection}>
                                    {setImage(cardData?.block_two?.value || GENERAL.UNAVAILABLE)}
                                </div>
                                <DsTypography
                                    style={{ whiteSpace: 'nowrap' }}
                                    variant="Semibold_14"
                                    isDisabled={disableText}
                                >
                                    {cardData?.block_two?.value || GENERAL.UNAVAILABLE}
                                </DsTypography>
                            </>
                        ) : (
                            <div className={styles.tooltipContainer}>
                                <div className={styles.tooltip}>
                                    {cardData?.errorMessage && (
                                        <Popover
                                            popoverClass={''}
                                            children={cardData?.errorMessage}
                                            trigger="hover"
                                            isAppendedToBody={false}
                                            container={<TooltipIcon />}
                                            placement="bottom"
                                        />
                                    )}
                                </div>
                                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                                    {GENERAL.UNAVAILABLE}
                                </DsTypography>
                            </div>
                        )}
                    </div>
                    {cardData?.block_two?.value === GETWELL_STATUS.ANALYZING &&
                        cardData?.block_one?.value === GENERAL.COMPUTE_RIGHTSIZING && (
                            <div className={styles.tooltip}>
                                <Popover
                                    popoverClass={''}
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
                            </div>
                        )}
                </div>
            );
        }
    };

    const calculateDays = (time: string | any) => {
        const endTime = time;
        const now = Date.now();

        const millisecondsPerDay = 1000 * 60 * 60 * 24;
        const diffInDays = Math.ceil((endTime - now) / millisecondsPerDay);

        return diffInDays;
    };

    //Dismiss section content
    const sectionSevenContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        } else {
            return (
                <div className={styles.dismissContainer}>
                    <div>
                        {cardData?.dismissedObj?.state === CONFIG_STATES.ACTIVATING && (
                            <div style={{ position: 'relative', top: '2px' }}>
                                <InfoIcon />
                            </div>
                        )}
                        {cardData?.dismissedObj?.state !== CONFIG_STATES.ACTIVATING && <Warning />}
                    </div>

                    <DsTypography variant="Regular_14" style={{ minWidth: '160px' }}>
                        {cardData?.dismissedObj?.state === CONFIG_STATES.DISMISSED && GENERAL.DISMISSED_MESSAGE}{' '}
                        {cardData?.dismissedObj?.state === CONFIG_STATES.ACTIVATING && GENERAL.ACTIVATING_MESSAGE}{' '}
                        {cardData?.dismissedObj?.state === CONFIG_STATES.POSTPONED &&
                            `This issue is postponed until the next ${calculateDays(
                                cardData?.dismissedObj?.endTime
                            )} days. `}{' '}
                    </DsTypography>
                </div>
            );
        }
    };

    const sectionFiveContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        } else if (cardData?.block_five?.count) {
            return (
                <div className={styles.warningMsg}>
                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                        {cardData?.block_five?.count?.totalObjectsInViolation || 0}
                    </DsTypography>
                    <DsTypography className={styles.centerText} variant="Semibold_14" isDisabled={disableText}>
                        {' out of '}
                    </DsTypography>
                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                        {cardData?.block_five?.count?.totalObjectsAssessed || 0}
                    </DsTypography>
                </div>
            );
        } else {
            return (
                <div className={styles.warningMsg}>
                    <DsTypography
                        style={{ minWidth: '200px', width: 'fit-content' }}
                        variant="Semibold_14"
                        isDisabled={disableText}
                    >
                        {cardData?.block_five?.value || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            );
        }
    };

    const sectionSixContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        } else if (cardData?.dismissedObj?.state && cardData?.dismissedObj?.state !== CONFIG_STATES.ACTIVE) {
            //Condition to show n/a if state is not active
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        } else if (cardData?.block_six?.count) {
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
        } else if (cardData?.block_six?.list) {
            let listObj: any = [];
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
                                popoverClass={''}
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
                        {cardData?.block_six?.list?.length + ' values'}
                    </DsTypography>
                </div>
            );
        } else if (cardData?.isMissingPermissions && cardData?.block_one?.value === GENERAL.COMPUTE_RIGHTSIZING) {
            return (
                <div className={styles.warningMsg}>
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            );
        } else if (cardData?.osPatchMissingPatches && cardData?.block_one?.value === GENERAL.OPERATING_SYSTEM_PATCH) {
            let listObj = [
                { key: 'Critical ', value: cardData?.osPatchMissingPatches?.critical },
                { key: 'Security ', value: cardData?.osPatchMissingPatches?.security },
                { key: 'Other ', value: cardData?.osPatchMissingPatches?.other }
            ];
            return (
                <div className={styles.tooltipContainer}>
                    {cardData?.block_six?.value > 0 && (
                        <div className={styles.tooltip}>
                            <Popover
                                popoverClass={''}
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
        } else if (cardData?.sqlPatchMissingPatches && cardData?.block_one?.value === GENERAL.MICROSOFT_SQL_PATCH) {
            let listObj = [
                { key: 'Critical ', value: cardData?.sqlPatchMissingPatches?.critical },
                { key: 'Important ', value: cardData?.sqlPatchMissingPatches?.important }
            ];
            return (
                <div className={styles.tooltipContainer}>
                    {cardData?.block_six?.value > 0 && (
                        <div className={styles.tooltip}>
                            <Popover
                                popoverClass={''}
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
        } else if (cardData?.block_six?.smallFont || !cardData?.block_six?.value) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        } else {
            return (
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }} isDisabled={disableText}>
                    {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        }
    };

    const windowSize = useResize();

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
                    selectedResourceId + '_' + selectedDatabaseInstance
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
                        {`Optimization process initiated for ${type}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
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
                payload: payload
            };
        } else {
            apiCallObj = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                payload: payload
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
        dispatch(setSelectedOptimizeConfig({ type: type, data: cardData }));
    };

    //This is for inner page navigation
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

    //This will be removed
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
            return 'View & optimize';
        } else if (
            type === 'Data files' ||
            type === 'Log files' ||
            type === GENERAL.OPERATING_SYSTEM_PATCH ||
            type === GENERAL.MICROSOFT_SQL_PATCH ||
            type === GENERAL.CRR
        ) {
            return 'View';
        } else {
            return GENERAL.OPTIMIZE;
        }
    };

    //Function For Dismiss
    const handleSingleAction = (action: string) => {
        setDismissAction(true);
        const payload = {
            configurationsToDismiss: [
                {
                    name: cardData?.dismissedObj?.name,
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
        dismissMssqlAssessment({ payload: payload })
            .then((res: any) => {
                setDismissAction(false);
                let updatedState = '';
                if (action === 'active' && res?.data?.configurationsDismissed[0]?.configState === 'active') {
                    updatedState = CONFIG_STATES.ACTIVATING;
                } else {
                    updatedState = res?.data?.configurationsDismissed[0]?.configState;
                    updatedState = updatedState?.toUpperCase();
                }

                const targetId = cardData?.id;

                if (!targetId || !updatedState) return;

                const updatedCardData = { ...cardDataFromStore };

                for (const [key, value] of Object.entries(updatedCardData)) {
                    //@ts-ignore
                    if (value && value?.id === targetId) {
                        updatedCardData[key] = {
                            ...value,
                            dismissedObj: {
                                //@ts-ignore
                                ...value.dismissedObj,
                                state: updatedState,
                                endTime: res?.data?.configurationsDismissed[0]?.endTime
                            }
                        };
                        break;
                    }
                }

                dispatch(setCardData(updatedCardData));

                //To setup optimization var values
                let optBreakDown = formatOptimizationBreakDown(updatedCardData);
                dispatch(setOptimizationBreakDown(optBreakDown));
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: `Configuration successfully ${action}`
                    })
                );
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
            cardData?.dismissedObj?.state === CONFIG_STATES.DISMISSED ||
            cardData?.dismissedObj?.state === CONFIG_STATES.POSTPONED ||
            cardData?.dismissedObj?.state === CONFIG_STATES.ACTIVATING
        ) {
            return true;
        }
        return false;
    };

    return (
        <div className={styles.storageCardComponent}>
            {/* Section one */}
            <div className={`${styles.commonSection} ${styles.firstSection}`}>
                <DsTypography variant="Semibold_14">{cardData?.block_one?.value}</DsTypography>
                <DsTypography variant="Regular_14">{cardData?.block_one?.type}</DsTypography>
            </div>

            {/* Section Two */}
            <div className={styles.commonSection} style={{ minWidth: '160px' }}>
                {sectionTwoContent(cardData)}

                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_two?.type}
                </DsTypography>
            </div>

            {/* Section 3 */}
            <div className={styles.commonSection} style={{ minWidth: '80px' }}>
                {loading && (
                    <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                {!loading && (
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {cardData?.block_four?.value || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                )}
                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_four?.type}
                </DsTypography>
            </div>

            {/* Section Resource Type - 4 */}
            <div
                className={styles.thirdSection}
                style={{
                    height: cardData?.block_three?.smallFont ? '56px' : '64px',
                    minWidth: cardData?.block_five?.minWidth ? cardData?.block_five?.minWidth : '165px',
                    width: 'fit-content',
                    position: 'relative',
                    top: '3px'
                }}
            >
                {sectionFiveContent(cardData)}

                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_five?.type}
                </DsTypography>
            </div>

            {/* impacted volume section - 5 */}
            {cardData?.block_six && (
                <div
                    className={styles.thirdSection}
                    style={{ height: cardData?.block_three?.smallFont ? '56px' : '64px', minWidth: '143px' }}
                >
                    {sectionSixContent(cardData)}

                    <DsTypography variant="Regular_14" isDisabled={disableText}>
                        {cardData?.block_six?.type}
                    </DsTypography>
                </div>
            )}

            {/* Dismiss section code */}
            {(cardData?.dismissedObj?.state === CONFIG_STATES.DISMISSED ||
                cardData?.dismissedObj?.state === CONFIG_STATES.POSTPONED ||
                cardData?.dismissedObj?.state === CONFIG_STATES.ACTIVATING) && (
                <div className={styles.dismissSection}>{sectionSevenContent(cardData)}</div>
            )}

            {/* <div className={styles.separator} /> */}

            {/* extra Section */}
            {windowSize.width >= 1770 &&
                (cardData?.dismissedObj?.state === CONFIG_STATES.ACTIVE ||
                    cardData?.dismissedObj?.state === undefined) && <div className={styles.fourthSection}></div>}

            {/* 6 section */}
            {!optimizePrintState &&
                cardData?.block_one?.value !== 'ONTAP' &&
                cardData?.block_one?.value !== 'Operating system' &&
                (GW_CONFIG_OPTIMIZE_NA.includes(cardData?.block_one?.value ?? '') &&
                cardData?.block_two?.value !== GETWELL_STATUS.OPTIMIZED ? (
                    <div className={styles.buttonSection} style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div className={isDarkTheme ? styles.buttonSectionDarkMode : ''}>
                                <DsButton variant="secondary" isDisabled={true}>
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
                            <DsButton variant="secondary" isDisabled={true}>
                                {setButtonText()}
                            </DsButton>
                        </div>
                    </TooltipComponent>
                ) : disableOptimizeButtonTooltip ? (
                    <Popover
                        popoverClass={CommonStyles['popover']}
                        isAppendedToBody={true}
                        children={<DsTypography variant="Regular_14">{disableOptimizeButtonTooltip}</DsTypography>}
                        trigger="hover"
                        container={
                            <div
                                className={
                                    isDarkTheme
                                        ? `${styles.buttonSection} ${styles.buttonSectionDarkMode}`
                                        : styles.buttonSection
                                }
                                style={{
                                    width: windowSize.width >= 1770 ? '170px' : '20%',
                                    position: 'relative',
                                    left: windowSize.width >= 1770 ? '0px' : '112px'
                                }}
                            >
                                <DsButton variant="secondary" isDisabled={true}>
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
                        style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}
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
            {cardData?.block_one?.value !== 'ONTAP' && cardData?.block_one?.value !== 'Operating system' && (
                <>
                    <ButtonWithDropdown
                        variant="icon"
                        isDisabled={loading || dismissAction}
                        items={[
                            {
                                id: 'activate',
                                children: 'Activate',
                                isDisabled:
                                    cardData?.dismissedObj?.state === CONFIG_STATES.ACTIVE ||
                                    !cardData?.dismissedObj?.state,
                                onClick: () => {
                                    handleSingleAction('active');
                                }
                            },
                            {
                                id: 'postponeFor30Days',
                                children: 'Postpone for 30 days',
                                isDisabled: cardData?.dismissedObj?.state === CONFIG_STATES.POSTPONED,
                                onClick: () => {
                                    handleSingleAction('postponed');
                                }
                            },
                            {
                                id: 'dismiss',
                                children: 'Dismiss',
                                isDisabled: cardData?.dismissedObj?.state === CONFIG_STATES.DISMISSED,
                                onClick: () => {
                                    handleSingleAction('dismiss');
                                }
                            }
                        ]}
                    >
                        <div className={loading || dismissAction ? styles.actionMenu : ''}>
                            <ActionMenu />
                        </div>
                    </ButtonWithDropdown>
                </>
            )}
        </div>
    );
};

export default StorageCardComponent;
