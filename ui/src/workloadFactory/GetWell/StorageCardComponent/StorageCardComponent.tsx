import { Button, DsButton, DsFlashingDotsLoader, DsTypography, Popover } from '@netapp/design-system';
import { useDialog } from '@netapp/design-system';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import styles from './StorageCardComponent.module.scss';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import DialogContent from './DialogContent/DialogContent';
import {
    ASSESSMENT_CONFIG_NAMES,
    GETWELL_STATUS,
    GETWELL_VALUES,
    GW_CONFIG_OPTIMIZE_NA,
    GW_TOOLTIP_KEYS_MAPPING,
    WLF_TABS
} from '../../../utils/consts';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    useLazyGetSubTaskListQuery,
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

const StorageCardComponent = ({ cardData, optimizePrintState, type }: any) => {
    const dispatch = useDispatch();
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { isDemoMode } = useAppSelector(state => state.auth);
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const { isAssessmentAvailable, selectedResourceId, selectedDatabaseInstance, optimizingInstanceData } =
        useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeMaxdopConfigForBulk] = useOptimizeMaxdopConfigForBulkMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

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
        if (cardData?.id === 'log-drive-size' || cardData?.id === 'tempdb-drive-size') {
            return (
                cardData?.block_two?.value !== GETWELL_STATUS.UNDER_PROVISIONED &&
                cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED
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
            cardData?.id === 'log-drive-size' &&
            (cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED ||
                (cardData?.sizingViolations?.overProvisionedDrives?.length &&
                    !cardData?.sizingViolations?.underProvisionedDrives?.length))
        ) {
            return GENERAL.LOG_DRIVE_OVER_PROVISIONED_ERROR;
        } else if (
            cardData?.id === 'tempdb-drive-size' &&
            (cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED ||
                (cardData?.sizingViolations?.overProvisionedDrives?.length &&
                    !cardData?.sizingViolations?.underProvisionedDrives?.length))
        ) {
            return GENERAL.TEMPDB_DRIVE_OVER_PROVISIONED_ERROR;
        } else if (
            (cardData?.id === 'tempdb-drive-size' ||
                cardData?.id === 'log-drive-size' ||
                cardData?.id === 'headroom') &&
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
        } else {
            return (
                <div className={styles.tooltipContainer}>
                    <div className={styles.statusTopSection}>
                        {cardData?.block_two?.value && cardData?.block_two?.value !== GENERAL.UNAVAILABLE ? (
                            <>
                                <div className={styles.svgSection}>
                                    {setImage(cardData?.block_two?.value || GENERAL.UNAVAILABLE)}
                                </div>
                                <DsTypography variant="Semibold_14" isDisabled={disableText}>
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

    const sectionThreeContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        } else if (cardData?.block_three?.list) {
            let listObj: any = [];
            cardData?.block_three?.list?.map((item: any) => {
                const parts = item.split(' ');
                const value = parts.pop() || ''; // Take the last element as value
                const key = parts.join(' '); // Join the rest as key
                listObj.push({ key, value });
            });
            return (
                <div className={styles.tooltipContainer}>
                    {cardData?.block_three?.list?.length > 0 && (
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
                    {cardData?.block_three?.list?.length === 0 && (
                        <div>
                            <DisabledTooltipIcon />
                        </div>
                    )}
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {cardData?.block_three?.list?.length + ' values'}
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
                    {cardData?.block_three?.value > 0 && (
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
                        {cardData?.block_three?.value || GENERAL.NOT_AVAILABLE}
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
                    {cardData?.block_three?.value > 0 && (
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
                        {cardData?.block_three?.value || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            );
        } else if (cardData?.block_one?.value === GENERAL.RSS_CONFIGURATION) {
            let listObj: any = [];
            let secListObj: any = [];
            Object.keys(cardData?.rssOptimizedRows).forEach((key: any) => {
                listObj.push({ key: GW_TOOLTIP_KEYS_MAPPING[key], value: cardData?.rssOptimizedRows?.[key] });
                secListObj.push({ key: GW_TOOLTIP_KEYS_MAPPING[key], value: cardData?.rssOptimizedValues?.[key] });
            });
            let value = '';
            if (cardData?.block_three?.value && cardData?.block_three?.value === 1) {
                value = '1 Finding';
            } else {
                value = (cardData?.block_three?.value || 0) + ' Findings';
            }
            return (
                <div className={styles.tooltipContainer}>
                    {cardData?.block_three?.value > 0 && (
                        <div className={styles.tooltip}>
                            <Popover
                                popoverClass={''}
                                children={tooltipRssListSection(listObj, secListObj)}
                                trigger="hover"
                                isAppendedToBody={false}
                                container={<TooltipIcon />}
                                placement="bottom"
                            />
                        </div>
                    )}
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {value}
                    </DsTypography>
                </div>
            );
        } else if (cardData?.block_three?.smallFont || !cardData?.block_three?.value) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {cardData?.block_three?.value || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        } else {
            return (
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }} isDisabled={disableText}>
                    {cardData?.block_three?.value || GENERAL.NOT_AVAILABLE}
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
                type: [cardData?.id]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            apiCall = optimizeStorageTier;
            payload = null;
        } else if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
            apiCall = optimizeMaxdopConfigForBulk;
            payload = {
                hostsToOptimize: [
                    {
                        type: 'maxdop',
                        databaseHosts: [
                            {
                                id: selectedResourceId,
                                sqlServerInstances: [selectedDatabaseInstance]
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
                credentialId:
                    landingFrom === WLF_TABS.INVENTORY ? headerSelectedCred?.data?.credentialsId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? headerSelectedRegion?.label2 : regionFromJM,
                payload: payload
            };
        } else {
            apiCallObj = {
                credentialId:
                    landingFrom === WLF_TABS.INVENTORY ? headerSelectedCred?.data?.credentialsId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? headerSelectedRegion?.label2 : regionFromJM,
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
                { id: cardData?.id, name: type, hostId: selectedResourceId, instanceId: selectedDatabaseInstance },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                type
            );
        });
    };

    const handleDialog = () => {
        setDialog(
            <DialogComponent
                header={`${type} optimization`}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={cardData?.recommendationOptions}
                        missingPermissions={cardData?.missingPermissions}
                        recommendedSizeInGib={cardData?.recommendedSizeInGib}
                    />
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callOptimizeApi(type);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={type !== ASSESSMENT_CONFIG_NAMES.MAXDOP ? 'innerPage' : ''}
                hidePrimaryButton={
                    (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
                        type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
                        type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) &&
                    cardData?.missingPermissions &&
                    cardData?.missingPermissions.length > 0
                }
            />
        );
    };
    return (
        <div className={styles.storageCardComponent}>
            {/* Section one */}
            <div className={`${styles.commonSection} ${styles.firstSection}`}>
                <DsTypography variant="Semibold_14">{cardData?.block_one?.value}</DsTypography>
                <DsTypography variant="Regular_14">{cardData?.block_one?.type}</DsTypography>
            </div>

            {/* Section Two */}
            <div className={styles.commonSection}>
                {sectionTwoContent(cardData)}

                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_two?.type}
                </DsTypography>
            </div>

            {/* Section three */}
            <div className={styles.thirdSection} style={{ height: cardData?.block_three?.smallFont ? '56px' : '64px' }}>
                {sectionThreeContent(cardData)}

                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_three?.type}
                </DsTypography>
            </div>

            {/* Section 4 */}
            <div className={styles.commonSection}>
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

            {/* 5 Section */}
            {windowSize.width >= 1770 && (
                <div className={styles.fourthSection}>
                    {/* <GetWellChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" /> */}
                </div>
            )}

            {/* <div className={styles.separator} /> */}

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
                                    Optimize
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
                                {GENERAL.OPTIMIZE}
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
                                style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}
                            >
                                <DsButton variant="secondary" isDisabled={true}>
                                    {GENERAL.OPTIMIZE}
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
                            onClick={() => handleDialog()}
                            isDisabled={loading || disableOptimizeButton}
                        >
                            {GENERAL.OPTIMIZE}
                        </DsButton>
                    </div>
                ))}
        </div>
    );
};

export default StorageCardComponent;
