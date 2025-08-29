import { useCallback } from 'react';
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
    RESET_PASSWORD_TYPE
} from './consts';

interface Dispatch {
    (action: any): void;
}

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
    for (const key in data) {
        const section = data[key];
        if (Array.isArray(section)) {
            // For sizing and layout
            for (const item of section) {
                if (item?.configurationName === itemName) {
                    return item;
                }
            }
        } else if (typeof section === 'object') {
            // For configuration
            for (const subKey in section) {
                const subSection = section[subKey];
                if (Array.isArray(subSection)) {
                    for (const item of subSection) {
                        if (item?.configurationName === itemName) {
                            return item;
                        }
                    }
                }
            }
        }
    }
    return null;
};

export const createOraclePayLoad = (value: string, selectedDatabaseInstanceName: string) => {
    const state = store.getState();
    const { sqlServerPasswords, sqlServerUserName } = state.workloadFactoryResource;
    const { password } = sqlServerPasswords;
    const credList = [];
    credList.push({
        resourceId: selectedDatabaseInstanceName,
        resourceType: value === RESET_PASSWORD_TYPE.ORACLESERVER ? DETECT_HOST_VAR.ORACLE : DETECT_HOST_VAR.ORACLE_ASM,
        username: sqlServerUserName,
        password
    });

    return { credentials: credList };
};

export const createPayload = (resourceDetails: any, resetDetails: any) => {
    const state = store.getState();
    const { fsxAdminPasswords } = state.workloadFactoryResource;
    const { password } = fsxAdminPasswords;
    const credList = [];
    credList.push({
        resourceId: resourceDetails?.topology?.fileSystemId || resetDetails?.fsxId,
        resourceType: DETECT_HOST_VAR.FSX,
        username: 'fsxadmin',
        password
    });

    return { credentials: credList };
};

export const handleFSXAdminApply = async (
    value: string,
    selectedDatabaseInstanceName: string,
    resourceDetails: any,
    resetDetails: any,
    selectedResourceCredId: string,
    selectedResourceRegionId: string,
    registerResourceCredBulk: any,
    dispatch: any,
    closeDialog: () => void
) => {
    dispatch(setPasswordResetLoading(true));
    try {
        let credList =
            value === RESET_PASSWORD_TYPE.ORACLESERVER
                ? createOraclePayLoad(RESET_PASSWORD_TYPE.ORACLESERVER, selectedDatabaseInstanceName)
                : createOraclePayLoad(RESET_PASSWORD_TYPE.ORACLEASM, selectedDatabaseInstanceName);
        if (value === RESET_PASSWORD_TYPE.FSXADMIN) {
            credList = createPayload(resourceDetails, resetDetails);
        }
        const getPasswordTypeLabel = (type: string) => {
            if (type === RESET_PASSWORD_TYPE.FSXADMIN) return 'fsxadmin';
            if (type === RESET_PASSWORD_TYPE.ORACLESERVER) return 'Oracle Server';
            return 'Oracle ASM';
        };
        const payload = {
            items: [
                {
                    ...credList,
                    ec2InstanceId: resourceDetails?.nodeTopology?.ec2Details[0]?.id || resetDetails.ec2InstanceId,
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
                        message: `${getPasswordTypeLabel(value)} password updated successfully`
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
                            `Failed to update ${getPasswordTypeLabel(value)} password. `
                    })
                );
            }
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message:
                        // @ts-ignore
                        result?.error?.data?.message || `Failed to update ${getPasswordTypeLabel(value)} password. `
                })
            );
        }
    } catch (error) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: error || 'Failed to update fsxadmin password. '
            })
        );
    } finally {
        dispatch(resetAllPasswords());
        dispatch(setPasswordResetLoading(false));
        closeDialog();
    }
};

// Function to handle trigger assessment for both MSSQL and Oracle
export const handleTriggerAssessment = ({
    setTriggerAssessmentInProgress,
    triggerAssessmentApi,
    credentialId,
    regionId,
    selectedResourceId,
    selectedDatabaseInstance,
    dispatch,
    isWorkloadFactory,
    getJobDetailApi,
    refreshGetWellPage,
    setGwAdhocError,
    t,
    createNotificationMessage
}: any) => {
    setTriggerAssessmentInProgress(true);
    triggerAssessmentApi({
        credentialId,
        regionId,
        databaseHostId: selectedResourceId,
        instanceId: selectedDatabaseInstance
    }).then((res: any) => {
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
                    if (status === JOB_MONITORING_STATUS.COMPLETED) {
                        setTriggerAssessmentInProgress(false);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                message: t('databases.well-architect.assessment-completed')
                            })
                        );
                        refreshGetWellPage();
                        clearInterval(jobInterval);
                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                        setTriggerAssessmentInProgress(false);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: t('databases.well-architect.assessment-failed')
                            })
                        );
                        refreshGetWellPage();
                        dispatch(setGwAdhocError(jobRes?.data?.error));
                        clearInterval(jobInterval);
                    } else if (status === JOB_MONITORING_STATUS.WARNING) {
                        setTriggerAssessmentInProgress(false);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.WARNING,
                                message: t('databases.well-architect.assessment-completed-with-warnings')
                            })
                        );
                        refreshGetWellPage();
                        jobRes?.data?.subJobs?.forEach((job: { error?: string }) => {
                            const errorMessage = job?.error;
                            if (errorMessage) {
                                dispatch(setGwAdhocError(errorMessage));
                            }
                        });
                        clearInterval(jobInterval);
                    }
                });
            }, OPTIMIZE_POLLING_INTERVAL);
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.well-architect.error-triggering-assessment')
                })
            );
            setTriggerAssessmentInProgress(false);
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
