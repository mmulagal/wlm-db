import { useCallback } from 'react';
import i18next from 'i18next';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import store from '../store/store';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../store/notificationSlice';
import { setSelectedHeaderTab } from '../store/workloadFactory/inventoryV2Slice';
import { resetAllPasswords, setPasswordResetLoading } from '../store/workloadFactory/workloadFactoryResourceSlice';
import { GENERAL } from './appConstants';
import {
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    WLF_TABS,
    JOB_MONITORING_STATUS,
    OPTIMIZE_POLLING_INTERVAL,
    DETECT_HOST_VAR,
    CONFIG_STATES
} from './consts';

interface Dispatch {
    (action: any): void;
}

/**
 * Converts a string to sentence case (first character uppercase, rest lowercase).
 * @param str - Input string (e.g. "PHYSICAL STANDBY")
 * @returns Sentence-cased string (e.g. "Physical standby"), or the original value if not a string
 */
export const toSentenceCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    const trimmed = str.trim();
    if (!trimmed) return str;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

/**
 * Fixes casing of known acronyms (EC2, LUN) within a resource type string,
 * regardless of the casing returned by the API (e.g. "ec2 instance" -> "EC2 instance",
 * "Volume/Lun" -> "Volume/LUN").
 * @param resourceType - Raw resource type string (e.g. "ec2 instance")
 * @returns Resource type string with acronyms capitalized
 */
export const normalizeResourceTypeCasing = (resourceType: string): string => {
    if (!resourceType || typeof resourceType !== 'string') return resourceType;
    return resourceType
        .replace(/\bec2\b/gi, 'EC2')
        .replace(/\blun(s)?\b/gi, (_match, plural) => `LUN${plural || ''}`)
        .replace(/\bnfs\b/gi, 'NFS')
        .replace(/\bsql\b/gi, 'SQL')
        .replace(/\bafd\b/gi, 'AFD')
        .replace(/\basmlib\b/gi, 'ASMLib')
        .replace(/\basm\b/gi, 'ASM');
};

export const getUniqueEntries = (arrays: any) => {
    const combinedArray = [].concat(...arrays);
    const seen = new Set();
    return combinedArray.filter(item => {
        const serializedItem = JSON.stringify(item);
        if (seen.has(serializedItem)) {
            return false;
        }
        seen.add(serializedItem);
        return true;
    });
};

export const groupByType = (array: any, returnType: string = 'id') =>
    array.reduce((acc: any, item: any) => {
        const { type, id, value } = item;
        if (!acc[type]) {
            acc[type] = [];
        }
        const retValue = returnType === 'id' ? id : value;
        if (!acc[type].includes(retValue)) {
            acc[type].push(retValue);
        }
        return acc;
    }, {});

export const removeEntry = (input: any, obj: any) => {
    const { id, type } = obj;

    // Create a new object to avoid mutating the original input object
    const updatedInput = { ...input };

    // Check if the type exists in the input object and filter out the id
    if (updatedInput[type]) {
        updatedInput[type] = updatedInput[type].filter((item: any) => item !== id);
    }

    return updatedInput;
};

export const removeObjectFromArray = (array: any, obj: any) =>
    array.filter(
        (item: any) =>
            !(item.id === obj.id && item.label === obj.label && item.value === obj.value && item.type === obj.type)
    );

/**
 * Parses Oracle Data Guard lag string (DD HH:MI:SS or +DD HH:MI:SS) to total seconds.
 * Returns null if input is invalid or not parseable.
 */
const parseDataGuardLagToSeconds = (lagValue: string | undefined): number | null => {
    if (lagValue == null || typeof lagValue !== 'string') return null;
    const trimmed = lagValue.trim();
    if (!trimmed) return null;
    // Oracle format: optional +/-, then "DDD HH:MI:SS" or "DDD HH:MI:SS.FF"
    const match = trimmed.match(/^([+-]?)\s*(\d+)\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
    if (!match) return null;
    const sign = match[1] === '-' ? -1 : 1;
    const days = parseInt(match[2], 10);
    const hours = parseInt(match[3], 10);
    const minutes = parseInt(match[4], 10);
    const seconds = parseInt(match[5], 10);
    const totalSeconds = sign * (days * 86400 + hours * 3600 + minutes * 60 + seconds);
    return totalSeconds;
};

/**
 * Formats a positive lag (total seconds) for display: 45s, 12m 10s, 8h 3m, 2d 4h.
 */
const formatPositiveLag = (totalSeconds: number): string => {
    const abs = Math.abs(totalSeconds);
    const d = Math.floor(abs / 86400);
    const h = Math.floor((abs % 86400) / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = Math.floor(abs % 60);
    if (d >= 1) return `${d}d ${h}h`;
    if (h >= 1) return `${h}h ${m}m`;
    if (m >= 1) return `${m}m ${s}s`;
    return `${s}s`;
};

/**
 * Formats Oracle Data Guard transport/apply lag for readable display.
 * - Positive: &lt; 1 min → seconds; &lt; 1 hr → m s; &lt; 1 day → h m; ≥ 1 day → d h.
 * - Negative: -60s &lt; lag &lt; 0 → "0s"; lag ≤ -60s → "Ahead by &lt;formatted&gt;".
 * @param lagValue - Oracle format string (e.g. "+00 00:08:03", "-00 00:12:10")
 * @param aheadByLabel - Translated "Ahead by" string for negative lag display
 * @returns Formatted string or original value if unparseable
 */
export const formatDataGuardLag = (lagValue: string | undefined, aheadByLabel: string): string => {
    const totalSeconds = parseDataGuardLagToSeconds(lagValue);
    if (totalSeconds === null) return lagValue ?? '';
    if (totalSeconds >= 0) return formatPositiveLag(totalSeconds);
    // Negative lag (standby is ahead)
    if (totalSeconds > -60) return '0s';
    return `${aheadByLabel} ${formatPositiveLag(totalSeconds)}`;
};

export const handleSelectForFilter = (
    filters: Array<{ id: string; label: string; value: string }>,
    filterLabel: string,
    filterTags: Array<{ id: string; label: string; value: string; type: string }>,
    dispatch: Dispatch,
    setFilterTags: (tags: Array<{ id: string; label: string; value: string; type: string }>) => void,
    setDefaultFilterOptions: (options: { [key: string]: string[] }) => void
) => {
    let updatedFilters = [...filterTags];

    const selectedIds = new Set(filters.map((filter: any) => filter.id));

    updatedFilters = updatedFilters.filter(
        (filter: any) => !(filter.type === filterLabel && !selectedIds.has(filter.id))
    );

    filters.forEach((filter: any) => {
        const existingFilterIndex = updatedFilters.findIndex(
            (selectedFilter: any) => selectedFilter.value === filter.value && selectedFilter.type === filterLabel
        );

        if (existingFilterIndex === -1) {
            updatedFilters.push({ ...filter, type: filterLabel });
        }
    });

    const uniqueArray = getUniqueEntries([updatedFilters]);
    const reArrange = groupByType(uniqueArray);

    dispatch(setFilterTags(uniqueArray));
    dispatch(setDefaultFilterOptions(reArrange));
};

/** Function to map the dismissed values */
export const mapDismissedValues = (data: any, itemName: string | any) => {
    // Then check arrays and nested structures (for storage configurations)
    for (const key in data) {
        const section = data[key];

        if (Array.isArray(section)) {
            // For sizing and layout
            for (const item of section) {
                if (item?.configurationName === itemName) {
                    // Only return if the configuration is actually dismissed, postponed, or activating
                    if (
                        item?.configState === CONFIG_STATES.DISMISSED ||
                        item?.configState === CONFIG_STATES.POSTPONED ||
                        item?.configState === CONFIG_STATES.ACTIVATING
                    ) {
                        return item;
                    }
                }
            }
        } else if (typeof section === 'object') {
            // For configuration
            for (const subKey in section) {
                const subSection = section[subKey];
                if (Array.isArray(subSection)) {
                    for (const item of subSection) {
                        if (item?.configurationName === itemName) {
                            // Only return if the configuration is actually dismissed, postponed, or activating
                            if (
                                item?.configState === CONFIG_STATES.DISMISSED ||
                                item?.configState === CONFIG_STATES.POSTPONED ||
                                item?.configState === CONFIG_STATES.ACTIVATING
                            ) {
                                return item;
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
};

export const createOraclePayLoad = (selectedDatabaseInstanceName: string) => {
    const state = store.getState();
    const { isGovAccount } = state.auth;
    const { sqlServerPasswords, sqlServerUserName, credentialUpdateSsmArn } = state.workloadFactoryResource;
    const { password } = sqlServerPasswords;

    const credential = isGovAccount
        ? {
              resourceId: selectedDatabaseInstanceName,
              resourceType: DETECT_HOST_VAR.ORACLE,
              ssmParameterArn: credentialUpdateSsmArn
          }
        : {
              resourceId: selectedDatabaseInstanceName,
              resourceType: DETECT_HOST_VAR.ORACLE,
              username: sqlServerUserName,
              password
          };

    return { credentials: [credential] };
};

export const handleOracleServerPasswordApply = async (
    selectedDatabaseInstanceName: string,
    resourceDetails: any,
    innerPageDetails: any,
    selectedResourceCredId: string,
    selectedResourceRegionId: string,
    registerResourceCredBulk: any,
    dispatch: any,
    closeDialog: () => void
) => {
    dispatch(setPasswordResetLoading(true));
    try {
        const credList = createOraclePayLoad(selectedDatabaseInstanceName);
        const payload = {
            items: [
                {
                    ...credList,
                    ec2InstanceId: resourceDetails?.nodeTopology?.ec2Details[0]?.id || innerPageDetails.ec2InstanceId,
                    region: selectedResourceRegionId,
                    credentialsId: selectedResourceCredId
                }
            ]
        };
        const result = await registerResourceCredBulk({ payload });
        if (result && !result?.error && result?.data) {
            if (
                result?.data?.items?.length > 0 &&
                !result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError &&
                !result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError &&
                !result?.data?.items?.[0]?.registerDetails?.[0]?.oracleAsmError
            ) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: i18next.t('databases.update-credentials.oracle-server-password-updated-success')
                    })
                );
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message:
                            result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError ||
                            result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError ||
                            result?.data?.items?.[0]?.registerDetails?.[0]?.oracleAsmError ||
                            i18next.t('databases.update-credentials.oracle-server-password-update-failed')
                    })
                );
            }
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message:
                        // @ts-ignore
                        result?.error?.data?.message ||
                        i18next.t('databases.update-credentials.oracle-server-password-update-failed')
                })
            );
        }
    } catch (error) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: error || i18next.t('databases.update-credentials.oracle-server-password-update-failed')
            })
        );
    } finally {
        dispatch(resetAllPasswords());
        dispatch(setPasswordResetLoading(false));
        closeDialog();
    }
};

/**
 * Builds a stable key identifying an instance (independent of which slice - MSSQL's getWellOptimize
 * or Oracle's workloadFactoryResource - it was selected from), used to track assessments in progress
 * per-instance so unrelated instances never clobber each other's loader.
 */
export const buildAssessmentInstanceKey = (
    resourceId?: string,
    databaseInstance?: string,
    credentialId?: string,
    regionId?: string
): string => `${resourceId || ''}|${databaseInstance || ''}|${credentialId || ''}|${regionId || ''}`;

/**
 * Whether the currently selected instance (MSSQL via getWellOptimize, Oracle via workloadFactoryResource)
 * still matches the instance an assessment was triggered for. Used to avoid an older, still-polling
 * assessment refreshing the page for a different instance the user has since navigated to.
 */
const isStillViewingTriggeredInstance = (
    triggeredForResourceId: string,
    triggeredForDatabaseInstance: string,
    triggeredForCredentialId: string,
    triggeredForRegionId: string
): boolean => {
    const state = store.getState();

    const wfrMatches =
        state.workloadFactoryResource?.selectedResourceId === triggeredForResourceId &&
        state.workloadFactoryResource?.selectedDatabaseInstance === triggeredForDatabaseInstance &&
        state.workloadFactoryResource?.selectedResourceCredId === triggeredForCredentialId &&
        state.workloadFactoryResource?.selectedResourceRegionId === triggeredForRegionId;

    const gwoMatches =
        state.getWellOptimize?.selectedResourceId === triggeredForResourceId &&
        state.getWellOptimize?.selectedDatabaseInstance === triggeredForDatabaseInstance &&
        state.getWellOptimize?.selectedGwInstanceCredId === triggeredForCredentialId &&
        state.getWellOptimize?.selectedGwInstanceRegionId === triggeredForRegionId;

    return wfrMatches || gwoMatches;
};

// Function to handle trigger assessment for both MSSQL and Oracle
export const handleTriggerAssessment = ({
    setAssessmentInProgressForKey,
    triggerAssessmentApi,
    triggerUnregisteredAssessmentApi,
    credentialId,
    regionId,
    selectedResourceId,
    selectedDatabaseInstance,
    instanceName,
    accountId,
    isUnregistered = false,
    dispatch,
    isWorkloadFactory,
    getJobDetailApi,
    refreshGetWellPage,
    setGwAdhocError,
    t,
    createNotificationMessage
}: any) => {
    // Capture the instance IDs at the time the assessment is triggered
    const triggeredForResourceId = selectedResourceId;
    const triggeredForDatabaseInstance = selectedDatabaseInstance;
    const triggeredForCredentialId = credentialId;
    const triggeredForRegionId = regionId;
    const assessmentInstanceKey = buildAssessmentInstanceKey(
        triggeredForResourceId,
        triggeredForDatabaseInstance,
        triggeredForCredentialId,
        triggeredForRegionId
    );
    setAssessmentInProgressForKey(assessmentInstanceKey, true);

    const assessmentRequest = isUnregistered
        ? triggerUnregisteredAssessmentApi({
              accountId,
              credentialId,
              region: regionId,
              ec2InstanceId: selectedResourceId,
              instanceName: instanceName || selectedDatabaseInstance
          })
        : triggerAssessmentApi({
              credentialId,
              regionId,
              databaseHostId: selectedResourceId,
              instanceId: selectedDatabaseInstance
          });

    assessmentRequest.then((res: any) => {
        const jobId = res?.data?.jobId;
        if (jobId) {
            const handleJobMonitoringClick = () => {
                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                const path = isWorkloadFactory ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: path, replace: true }
                });
                dispatch(clearNotifications());
            };

            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: createNotificationMessage(handleJobMonitoringClick, GENERAL)
                })
            );
            const jobInterval = setInterval(() => {
                getJobDetailApi({
                    id: jobId
                }).then((jobRes: any) => {
                    const status = jobRes?.data?.status;
                    // Only refresh the rendered page if the user is still viewing the instance that
                    // triggered this assessment - an older, still-polling assessment for a different
                    // instance must not refresh/repaint a page the user has since navigated to.
                    // The per-instance loader itself is always cleared below, keyed by instance, so
                    // navigating back to this instance later still reflects the real completed state.
                    const isViewingTriggeredInstance = isStillViewingTriggeredInstance(
                        triggeredForResourceId,
                        triggeredForDatabaseInstance,
                        triggeredForCredentialId,
                        triggeredForRegionId
                    );

                    if (status === JOB_MONITORING_STATUS.COMPLETED) {
                        setAssessmentInProgressForKey(assessmentInstanceKey, false);
                        if (isViewingTriggeredInstance) {
                            refreshGetWellPage();
                        }
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                message: t('databases.well-architect.assessment-completed')
                            })
                        );
                        clearInterval(jobInterval);
                    } else if (status === JOB_MONITORING_STATUS.FAILED || status === JOB_MONITORING_STATUS.WARNING) {
                        setAssessmentInProgressForKey(assessmentInstanceKey, false);
                        if (status === JOB_MONITORING_STATUS.FAILED) {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: t('databases.well-architect.assessment-failed')
                                })
                            );
                        } else {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.WARNING,
                                    message: t('databases.well-architect.assessment-completed-with-warnings')
                                })
                            );
                        }

                        if (isViewingTriggeredInstance) {
                            refreshGetWellPage();
                        }
                        let gwErrMsg = jobRes?.data?.error;
                        if (jobRes?.data?.subJobs && jobRes?.data?.subJobs.length > 0) {
                            if (jobRes?.data?.subJobs?.[0]?.subJobs && jobRes?.data?.subJobs?.[0]?.subJobs.length > 0) {
                                gwErrMsg = jobRes?.data?.subJobs[0]?.subJobs[0]?.error;
                            } else {
                                gwErrMsg = jobRes?.data?.subJobs[0]?.error;
                            }
                        }
                        if (gwErrMsg) {
                            dispatch(setGwAdhocError(gwErrMsg));
                        }
                        clearInterval(jobInterval);
                    }
                });
            }, OPTIMIZE_POLLING_INTERVAL);
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.well-architect.error-in-triggering-assessment')
                })
            );
            setAssessmentInProgressForKey(assessmentInstanceKey, false);
            dispatch(setGwAdhocError(res?.error?.data?.message));
        }
    });
};

// Common refresh function for well architect pages (MSSQL and Oracle)
export const handleWellArchitectRefresh = (
    dispatch: Dispatch,
    resetGwValuesOnRefresh: (dispatchFn: Dispatch) => void,
    setGwRefreshPage: (value: boolean) => unknown,
    handleFilterClearAll?: () => void
) => {
    if (handleFilterClearAll) {
        handleFilterClearAll();
    }
    resetGwValuesOnRefresh(dispatch);
    dispatch(setGwRefreshPage(true));
};

/** Common hook to create refresh function for well architect pages (MSSQL and Oracle) */
export const useWellArchitectRefresh = (props: {
    dispatch: Dispatch;
    resetGwValuesOnRefresh: (dispatchFn: Dispatch) => void;
    setGwRefreshPage: (value: boolean) => unknown;
    handleFilterClearAll?: () => void;
}) => {
    const { dispatch, resetGwValuesOnRefresh, setGwRefreshPage, handleFilterClearAll } = props;

    const refreshPage = useCallback(() => {
        handleWellArchitectRefresh(dispatch, resetGwValuesOnRefresh, setGwRefreshPage, handleFilterClearAll);
    }, [dispatch, resetGwValuesOnRefresh, setGwRefreshPage, handleFilterClearAll]);

    return refreshPage;
};
