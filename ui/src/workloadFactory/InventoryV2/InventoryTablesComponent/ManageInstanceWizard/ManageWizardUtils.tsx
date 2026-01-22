import { TFunction } from 'i18next';
import store from '../../../../store/store';
import {
    setFsxCredentialStatus,
    setFsxCredentialStatusOracle,
    setFsxCredentialStatusPgsql,
    setSelectedMultiDetectInstances,
    setWizardOperationType,
    setBulkWizardStartAtFsxStep,
    setInstanceAuthStatus,
    setInventoryTableData
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import {
    AUTHENTICATION_TYPE,
    DBType,
    FSX_FOR_ONTAP_CRED_OPTION,
    INVENTORY_STATUS,
    ACTION_TYPE,
    FROM_DIALOG,
    DETECT_HOST_VAR,
    CREDENTIAL_OPTIONS,
    DETECT_PAYLOAD_SIZE,
    RESPONSE_STATUS
} from '../../../../utils/consts';
import { isAuthRequiredForInstance } from './DetectInstanceStep/DetectContent/DetectContentHelper';
import ReplicaInfoDialog from './ReplicaInfoDialog/ReplicaInfoDialog';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { updateInstanceStatus } from '../../InventoryUtilsV2';
import { areAllInstancesAuthenticated, createBulkAuthPayload } from './SelectInstancesStep/AuthenticateBulkUtils';
import { setIsDetectReplicaHostLoading } from '../../../../store/mssql/msSqlActionSlice';
import { InstanceAuthStatusMap } from '../../../../utils/types/inventoryV2Types';

/**
 * Validates database authentication credentials (SQL Server/Windows/Oracle) without FSx registration.
 * @param entryData - Instance with authentication flags
 * @param engineType - Database type ('oracle', 'mssql')
 * @returns True if credentials are valid
 */
export const detectAuthFieldsValidation = (entryData: any, engineType: string) => {
    const state = store.getState();
    const { detectManageUserName, detectManagePassword, detectWindowsAuthentication, authenticationType } =
        state.inventoryV2;

    // Checks if the respective authentication fields are present
    const isAuthValid = () => !!(detectManageUserName && detectManagePassword);
    const isWindowsAuthValid = () => !!(detectWindowsAuthentication?.username && detectWindowsAuthentication?.password);
    switch (engineType) {
        case DBType.ORACLE: {
            const isDefault = entryData?.isDefaultAuthentication;
            const isOracleAuth = entryData?.oracleServerAuthentication;

            // In Oracle if isDefaultAuthentication is true then no need to check for Oracle auth
            if (isDefault === true) {
                return true;
            }
            if (isDefault === false) {
                // Need both Oracle Auth
                if (!isOracleAuth) {
                    return isAuthValid();
                }
                return true;
            }
            return false; // If isDefault is undefined or null, return false
        }
        case DBType.MSSQL:
        default: {
            // Check when neither SQL Server nor Windows Domain User is authenticated
            if (
                !entryData?.sqlServerAuthentication &&
                !entryData?.windowsAuthentication &&
                !entryData?.windowsDomainUserAuthentication
            ) {
                // Based on authentication type is SQL Server or Windows, check if the respective fields are valid
                if (authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION) {
                    return isAuthValid();
                }
                if (authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION) {
                    return isWindowsAuthValid();
                }
                return false;
            }
            return true;
        }
    }
};

/**
 * Validates both database authentication and FSx for ONTAP credentials.
 * @param entryData - Instance with auth flags and FSx info
 * @param engineType - Database type ('oracle', 'mssql')
 * @returns True if all required credentials are valid
 */
export const detectFieldsValidation = (entryData: any, engineType: string) => {
    const state = store.getState();
    const {
        detectManageUserName,
        detectManagePassword,
        detectWindowsAuthentication,
        detectOntapUsername,
        detectOntapPassword,
        authenticationType
    } = state.inventoryV2;

    // Checks if the respective authentication fields are present
    const isAuthValid = () => !!(detectManageUserName && detectManagePassword);
    const isWindowsAuthValid = () => !!(detectWindowsAuthentication?.username && detectWindowsAuthentication?.password);
    const isFsxAuthValid = () => !!(detectOntapUsername && detectOntapPassword);

    switch (engineType) {
        case DBType.ORACLE: {
            const isDefault = entryData?.isDefaultAuthentication;
            const isOracleAuth = entryData?.oracleServerAuthentication;
            const needsFsx = entryData?.fsxId && !entryData?.isFsxRegistered;

            // In Oracle if isDefaultAuthentication is true then no need to check for Oracle auth
            if (isDefault === true) {
                // Only FSx registration matters
                if (needsFsx) {
                    return isFsxAuthValid();
                }
                return true;
            }
            if (isDefault === false) {
                // 1. Need both Oracle Auth and FSx
                if (!isOracleAuth && needsFsx) {
                    return isAuthValid() && isFsxAuthValid();
                }
                // 2. Need Oracle Auth
                if (!isOracleAuth) {
                    return isAuthValid();
                }
                // 3. Need FSx
                if (needsFsx) {
                    return isFsxAuthValid();
                }
                // 4. Oracle Auth is present and no FSx needed
                return true;
            }
            return false; // If isDefault is undefined or null, return false
        }
        case DBType.MSSQL:
        default: {
            // Check when neither SQL Server nor Windows Domain User is authenticated and FsxId is not registered
            if (
                !entryData?.sqlServerAuthentication &&
                !entryData?.windowsAuthentication &&
                !entryData?.windowsDomainUserAuthentication &&
                entryData?.fsxId &&
                !entryData?.isFsxRegistered
            ) {
                // Based on authentication type is SQL Server or Windows, check if the respective fields are valid
                if (authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION) {
                    return isAuthValid() && isFsxAuthValid();
                }
                if (authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION) {
                    return isWindowsAuthValid() && isFsxAuthValid();
                }
                return false;
            }
            // Check if SQL Server fields are valid when SQL Server Authentication is selected
            if (
                !entryData?.sqlServerAuthentication &&
                !entryData?.windowsAuthentication &&
                !entryData?.windowsDomainUserAuthentication &&
                authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
            ) {
                return isAuthValid();
            }
            // Check if Windows fields are valid when Windows Authentication is selected
            if (
                !entryData?.windowsAuthentication &&
                !entryData?.sqlServerAuthentication &&
                !entryData?.windowsDomainUserAuthentication &&
                authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
            ) {
                return isWindowsAuthValid();
            }
            if (entryData?.fsxId && !entryData?.isFsxRegistered) {
                return isFsxAuthValid();
            }
            return true;
        }
    }
};

/**
 * Validates FSx for ONTAP credentials. Supports shared or per-FSx credential modes.
 * @param entryData - Instance with storage array
 * @param engineType - Database type ('oracle', 'mssql', 'pgsql')
 * @returns True if FSx credentials are valid for all unregistered instances
 */
export const detectFsxFieldsValidation = (entryData: any, engineType: string) => {
    const state = store.getState();
    const {
        detectOntapUsername,
        detectOntapPassword,
        detectOntapCredentialsByFsx,
        selectedFSxForOntapCredentials,
        fsxCredentialStatusObj
    } = state.inventoryV2;

    // Get list of unregistered FSx IDs that need credentials
    const getUnregisteredFsxIds = (): string[] => {
        const storage = entryData?.storage;
        if (!storage || !Array.isArray(storage)) return [];

        return storage
            .filter(item => {
                // Only include FSXN type items with valid IDs
                if (item.type !== 'FSXN' || !item.id) return false;
                // Exclude already registered FSx
                const statusObj = fsxCredentialStatusObj?.[item.id];
                return statusObj !== true;
            })
            .map(item => item.id);
    };

    const unregisteredFsxIds = getUnregisteredFsxIds();

    // If no FSx needs authentication, return true
    if (unregisteredFsxIds.length === 0) {
        return true;
    }

    // Validate based on radio selection mode
    if (selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED) {
        // Use single credentials for all FSx
        return !!(detectOntapUsername && detectOntapPassword);
    }

    if (selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY) {
        // Each FSx must have its own credentials
        return unregisteredFsxIds.every(fsxId => {
            const cred = detectOntapCredentialsByFsx[fsxId];
            return !!(cred?.username && cred?.password);
        });
    }

    return false;
};

/**
 * Retrieves replica instances from detection results by matching replicaInfo with inventory table.
 * @param result - Detection result with replicaInfo, credentialsId, region
 * @param manageSingleInstanceData - Current instance data
 * @returns Array of matching replica instances
 */
export const getReplicaInstanceList = (result: any, manageSingleInstanceData: any) => {
    const replicaInfo = result?.replicaInfo;
    const credentialsId = result?.credentialsId;
    const region = result?.region;
    const updatedState = store.getState();
    const { instanceTableRows }: any = updatedState?.inventoryV2;
    const replicaInstanceList: Array<any> = [];

    // Return early if no replica info
    if (!replicaInfo || !Array.isArray(replicaInfo) || replicaInfo.length === 0) {
        return replicaInstanceList;
    }

    // Filter instanceTableRows by matching credentialsId and region
    const filteredInstances = instanceTableRows.filter(
        (row: any) => row?.credentialId === credentialsId && row?.regionId === region
    );

    // Map replicaInfo to matching instances from instanceTableRows
    replicaInfo.forEach((replica: any) => {
        const matchingInstance = filteredInstances.find(
            (instance: any) =>
                instance?.ec2InstanceId === replica?.ec2InstanceId &&
                instance?.databaseInstanceName === replica?.sqlServerName &&
                instance?.statusColText !== INVENTORY_STATUS.MANAGED &&
                instance?.databaseInstanceName !== manageSingleInstanceData?.databaseInstanceName
        );

        if (matchingInstance) {
            replicaInstanceList.push(matchingInstance);
        }
    });

    return replicaInstanceList;
};

/**
 * Retrieves replica instances for authenticated database using aoagClusterNodeDetails.
 * @param manageSingleInstanceData - Instance with aoagClusterNodeDetails, credentialId, regionId
 * @returns Array of unmanaged replica instances in same credentials/region
 */
export const getReplicaInstanceListForAuthenticatedRow = (manageSingleInstanceData: any) => {
    const replicaInfo = manageSingleInstanceData?.aoagClusterNodeDetails;
    const credentialsId = manageSingleInstanceData?.credentialId;
    const region = manageSingleInstanceData?.regionId;
    const updatedState = store.getState();
    const { instanceTableRows }: any = updatedState?.inventoryV2;
    const replicaInstanceList: Array<any> = [];

    // Return early if no replica info
    if (!replicaInfo || !Array.isArray(replicaInfo) || replicaInfo.length === 0) {
        return replicaInstanceList;
    }

    // Filter instanceTableRows by matching credentialsId and region
    const filteredInstances = instanceTableRows.filter(
        (row: any) => row?.credentialId === credentialsId && row?.regionId === region
    );

    // Map replicaInfo to matching instances from instanceTableRows
    replicaInfo.forEach((replica: any) => {
        const matchingInstance = filteredInstances.find(
            (instance: any) =>
                instance?.ec2InstanceId === replica?.ec2InstanceId &&
                instance?.statusColText !== INVENTORY_STATUS.MANAGED &&
                instance?.databaseInstanceName !== manageSingleInstanceData?.databaseInstanceName
        );

        if (matchingInstance) {
            replicaInstanceList.push(matchingInstance);
        }
    });

    return replicaInstanceList;
};

/**
 * Marks FSx as registered in Redux state based on engine type.
 * @param fsxId - FSx for ONTAP ID
 * @param dispatch - Redux dispatch
 * @param engineType - Database type ('mssql', 'oracle', 'pgsql')
 * @returns True if successfully marked as registered
 */
export const saveFsxInCredRegisteredObj = (fsxId: string, dispatch: any, engineType: string = 'mssql') => {
    const state = store.getState();
    const {
        fsxCredentialStatusObj,
        fsxCredentialStatusObjOracle,
        fsxCredentialStatusObjPgsql,
        detectOntapUsername,
        detectOntapPassword
    } = state?.inventoryV2;
    if (detectOntapUsername && detectOntapPassword && fsxId) {
        let currentFsxObj: any;
        let setStatusAction: any;

        switch (engineType) {
            case 'oracle':
                currentFsxObj = fsxCredentialStatusObjOracle || {};
                setStatusAction = setFsxCredentialStatusOracle;
                break;
            case 'pgsql':
                currentFsxObj = fsxCredentialStatusObjPgsql || {};
                setStatusAction = setFsxCredentialStatusPgsql;
                break;
            case 'mssql':
            default:
                currentFsxObj = fsxCredentialStatusObj || {};
                setStatusAction = setFsxCredentialStatus;
                break;
        }

        const updatedFsxObj = {
            ...currentFsxObj,
            [fsxId]: true
        };
        dispatch(setStatusAction(updatedFsxObj));
        return true;
    }
    return false;
};

/**
 * Shows replica authentication dialog for AOAG clusters. Switches to bulk mode on confirmation.
 * @param manageSingleInstanceData - Primary instance with AOAG details
 * @param t - Translation function
 * @param setDialog - Show dialog function
 * @param closeDialog - Close dialog function
 * @param goToNextStep - Next step function
 * @param dispatch - Redux dispatch
 * @param registerHostType - Database type
 * @param styles - CSS module styles
 */
export const handleReplicaAuthenticationDialog = (
    manageSingleInstanceData: any,
    t: TFunction,
    setDialog: any,
    closeDialog: any,
    goToNextStep: any,
    dispatch: any,
    registerHostType: string,
    styles: any
) => {
    const replicaList = getReplicaInstanceListForAuthenticatedRow(manageSingleInstanceData);
    if (replicaList?.length > 0) {
        setDialog(
            <DialogComponent
                header={t('databases.register-flow.authenticate-instances')}
                content={<ReplicaInfoDialog instance={manageSingleInstanceData} replicaList={replicaList} />}
                primaryButton={t('databases.general.continue')}
                callback={() => {
                    // Use Redux state instead of local state to avoid closure issues
                    const currentState = store.getState();
                    const shouldAuthenticateReplicas = currentState.inventoryV2.registerReplicaSelection;

                    if (shouldAuthenticateReplicas) {
                        // Check if all replicas in replicaList are authenticated
                        const hostType = registerHostType || DBType.MSSQL;
                        const updatedState = store.getState();
                        const { replicaSelectedRowsForManage }: any = updatedState?.inventoryV2;
                        if (replicaSelectedRowsForManage && replicaSelectedRowsForManage.length > 0) {
                            const isAllReplicasAuthenticated = replicaSelectedRowsForManage.every((replica: any) => {
                                const replicaData = replica.data || replica;
                                // Check if instance is already authenticated based on data fields
                                return !isAuthRequiredForInstance(replicaData, hostType);
                            });

                            const bulkInstances = [manageSingleInstanceData, ...replicaSelectedRowsForManage];

                            // Update to bulk operation mode and flag to start at FSx authentication step
                            dispatch(setSelectedMultiDetectInstances(bulkInstances));
                            dispatch(setWizardOperationType(ACTION_TYPE.BULK));

                            if (isAllReplicasAuthenticated) {
                                dispatch(setBulkWizardStartAtFsxStep(true));
                                // All replicas are already authenticated, proceed to next step
                            }
                            closeDialog();
                        } else {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: t('databases.register-flow.selection-required-to-proceed')
                                })
                            );
                        }
                    } else {
                        closeDialog();
                        goToNextStep();
                    }
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.dialog}
                testId="wlm-db-authenticate-instances-dialog"
                dialogFrom={FROM_DIALOG.MANAGE_WIZARD}
            />
        );
    } else {
        goToNextStep();
    }
};

/**
 * Handles replica authentication dialog display and subsequent authentication.
 * Shows dialog with replica list, then authenticates selected replicas in bulk batches.
 * @param result - API response containing replica info
 * @param manageSingleInstanceData - Primary instance
 * @param credList - Credentials for authentication
 * @param t - Translation function
 * @param setDialog - Show dialog function
 * @param closeDialog - Close dialog function
 * @param goToNextStep - Next step function
 * @param dispatch - Redux dispatch
 * @param registerResourceCredBulk - RTK Query mutation for bulk registration
 * @param instanceAuthStatus - Current authentication status map
 * @param registerHostType - Database type
 * @param styles - CSS module styles
 */
export const handleReplicaAuthenticationAndDialog = async (
    result: any,
    manageSingleInstanceData: any,
    credList: any,
    t: TFunction,
    setDialog: any,
    closeDialog: any,
    goToNextStep: any,
    dispatch: any,
    registerResourceCredBulk: any,
    instanceAuthStatus: any,
    registerHostType: string,
    styles: any
) => {
    const replicaList = getReplicaInstanceList(result, manageSingleInstanceData);

    /**
     * Handles authentication of replica instances using provided credentials.
     * Authenticates selected replica instances in bulk batches,
     * updates authentication status, and manages the registration readiness state.
     */
    const handleReplicaAuthCredentials = async (credList: any) => {
        const updatedState = store.getState();
        const { replicaSelectedRowsForManage, instanceCredentials }: any = updatedState?.inventoryV2;
        if (replicaSelectedRowsForManage && replicaSelectedRowsForManage.length > 0) {
            const hostType = registerHostType || DBType.MSSQL;

            // Check if all instances are already authenticated - skip API call
            if (areAllInstancesAuthenticated(replicaSelectedRowsForManage, instanceAuthStatus, hostType)) {
                goToNextStep();
                return;
            }

            dispatch(setIsDetectReplicaHostLoading(true));
            // Notify user that authentication may take time
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: t('databases.register-flow.bulk-auth-in-progress')
                })
            );

            const bulkInstanceCredentials = {
                authMode: {
                    value:
                        credList?.credentials?.[0]?.resourceType === DETECT_HOST_VAR.MSSQL
                            ? AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                            : AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
                },
                username: credList?.credentials?.[0]?.username,
                password: credList?.credentials?.[0]?.password
            };
            // Create payload using bulk auth utility
            const payloadItems = createBulkAuthPayload(
                replicaSelectedRowsForManage,
                CREDENTIAL_OPTIONS.SAME_FOR_ALL,
                bulkInstanceCredentials,
                instanceCredentials,
                instanceAuthStatus,
                hostType
            );

            // If no credentials to send (all already authenticated), proceed to next step
            if (payloadItems.length === 0) {
                goToNextStep();
                return;
            }

            // Helper to split array into batches
            const chunkArray = (arr: any[], size: number) =>
                Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

            const batches = chunkArray(payloadItems, DETECT_PAYLOAD_SIZE);
            const authStatusUpdates: InstanceAuthStatusMap = {};
            // Track manageReadiness updates for successful instances
            const manageReadinessUpdates: Record<string, any> = {};

            try {
                for (let i = 0; i < batches.length; i++) {
                    const batchPayload = { items: batches[i] };

                    const result = await registerResourceCredBulk({ payload: batchPayload });

                    if (result && !result?.error && result?.data) {
                        // Process response for this batch - update auth status per instance
                        const resultItems = result?.data?.items || [];

                        resultItems.forEach((resultItem: any) => {
                            const registerDetails = resultItem?.registerDetails || [];

                            registerDetails.forEach((detail: any) => {
                                const resourceId = detail?.resourceId;
                                if (!resourceId) return;

                                // Check for errors to determine success/failure
                                const hasError = !!(
                                    detail?.databaseServerError ||
                                    detail?.oracleAsmError ||
                                    detail?.requiredModuleError
                                );

                                authStatusUpdates[resourceId] = hasError
                                    ? (RESPONSE_STATUS.FAILED.toLowerCase() as 'failed')
                                    : (RESPONSE_STATUS.SUCCESS.toLowerCase() as 'success');

                                // Track manageReadiness for successful instances
                                if (!hasError && detail?.manageReadiness) {
                                    manageReadinessUpdates[resourceId] = detail.manageReadiness;
                                }
                            });
                        });
                    } else {
                        // API call failed - mark all instances in batch as failed
                        batchPayload.items.forEach(item => {
                            item.credentials.forEach((cred: { resourceId: string }) => {
                                authStatusUpdates[cred.resourceId] = RESPONSE_STATUS.FAILED.toLowerCase() as 'failed';
                            });
                        });

                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: t('databases.register-flow.manage-detect-fail-message')
                            })
                        );
                    }
                }

                // Update Redux state with auth status updates
                Object.entries(authStatusUpdates).forEach(([instanceId, status]) => {
                    dispatch(setInstanceAuthStatus({ instanceId, status }));
                });

                // Update inventoryTableData and replicaSelectedRowsForManage for successful instances
                if (Object.keys(manageReadinessUpdates).length > 0) {
                    // Update inventoryTableData for each successful instance
                    // Each dispatch updates the store, so subsequent updateInstanceStatus calls see updated state
                    replicaSelectedRowsForManage.forEach((instance: any) => {
                        const instanceData = instance.data || instance;
                        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName;

                        if (instanceId && manageReadinessUpdates[instanceId]) {
                            // Update inventory table data for this instance
                            const updatedInventoryTableData = updateInstanceStatus(
                                'detect',
                                instanceData,
                                instanceData
                            );
                            dispatch(setInventoryTableData(updatedInventoryTableData));
                        }
                    });

                    // Update selectedMultiDetectInstances with manageReadiness
                    const updatedInstances = replicaSelectedRowsForManage.map((instance: any) => {
                        const instanceData = instance.data || instance;
                        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName;

                        if (instanceId && manageReadinessUpdates[instanceId]) {
                            // Update the instance with new manageReadiness
                            if (instance.data) {
                                return {
                                    ...instance,
                                    data: {
                                        ...instance.data,
                                        manageReadiness: manageReadinessUpdates[instanceId]
                                    }
                                };
                            }
                            return {
                                ...instance,
                                manageReadiness: manageReadinessUpdates[instanceId]
                            };
                        }
                        return instance;
                    });
                    dispatch(setSelectedMultiDetectInstances(updatedInstances));
                }

                // Check if all instances are now authenticated
                const updatedAuthStatus = { ...instanceAuthStatus, ...authStatusUpdates };
                if (areAllInstancesAuthenticated(replicaSelectedRowsForManage, updatedAuthStatus, hostType)) {
                    // All authenticated successfully. Store data in multi select and switch to bulk flow
                    // Combine original instance + authenticated replicas
                    const newStore = store.getState();
                    const { selectedMultiDetectInstances: latestSelectedMultiDetectInstances }: any =
                        newStore?.inventoryV2;
                    const bulkInstances = [manageSingleInstanceData, ...latestSelectedMultiDetectInstances];

                    // Update to bulk operation mode and flag to start at FSx authentication step
                    dispatch(setSelectedMultiDetectInstances(bulkInstances));
                    dispatch(setWizardOperationType(ACTION_TYPE.BULK));
                    dispatch(setBulkWizardStartAtFsxStep(true));

                    closeDialog();
                    // Don't call goToNextStep here - the wizard will be re-mounted with bulk flow
                    // and will start at FSx step based on the flag
                } else {
                    const successCount = Object.values(authStatusUpdates).filter(
                        s => s === RESPONSE_STATUS.SUCCESS.toLowerCase()
                    ).length;
                    const failedCount = Object.values(authStatusUpdates).filter(
                        s => s === RESPONSE_STATUS.FAILED.toLowerCase()
                    ).length;

                    if (failedCount > 0) {
                        // Show dialog with failed state
                        setDialog(
                            <DialogComponent
                                header={t('databases.register-flow.authenticate-instances')}
                                content={
                                    <ReplicaInfoDialog
                                        instance={manageSingleInstanceData}
                                        replicaList={replicaSelectedRowsForManage}
                                        authStatusMap={updatedAuthStatus}
                                        showFailedState
                                    />
                                }
                                primaryButton={t('databases.general.continue')}
                                callback={() => {
                                    // Use Redux state for decision
                                    const currentState = store.getState();
                                    const shouldRetryAuth = currentState.inventoryV2.replicaSelectionForAuth;

                                    if (shouldRetryAuth) {
                                        // User wants to retry with different credentials
                                        // Switch to bulk mode and let user authenticate manually
                                        const newStore = store.getState();
                                        const {
                                            selectedMultiDetectInstances: latestSelectedMultiDetectInstances
                                        }: any = newStore?.inventoryV2;
                                        const bulkInstances = [
                                            manageSingleInstanceData,
                                            ...latestSelectedMultiDetectInstances
                                        ];
                                        dispatch(setSelectedMultiDetectInstances(bulkInstances));
                                        dispatch(setWizardOperationType(ACTION_TYPE.BULK));
                                        closeDialog();
                                    } else {
                                        // User wants to proceed without authenticating failed instances
                                        // Include only successfully authenticated instances
                                        const newStore = store.getState();
                                        const {
                                            selectedMultiDetectInstances: latestSelectedMultiDetectInstances
                                        }: any = newStore?.inventoryV2;

                                        // Filter to include only successful instances
                                        const successfulInstances = latestSelectedMultiDetectInstances.filter(
                                            (inst: any) => {
                                                const instanceData = inst.data || inst;
                                                const instanceId =
                                                    instanceData?.databaseInstanceName || inst.databaseInstanceName;
                                                return (
                                                    instanceId &&
                                                    updatedAuthStatus[instanceId]?.toLowerCase() ===
                                                        RESPONSE_STATUS.SUCCESS.toLowerCase()
                                                );
                                            }
                                        );

                                        const bulkInstances = [manageSingleInstanceData, ...successfulInstances];
                                        dispatch(setSelectedMultiDetectInstances(bulkInstances));
                                        dispatch(setWizardOperationType(ACTION_TYPE.BULK));
                                        dispatch(setBulkWizardStartAtFsxStep(true));
                                        closeDialog();
                                    }
                                }}
                                closeCallback={() => {
                                    closeDialog();
                                }}
                                customClass={styles.dialog}
                                testId="wlm-db-authenticate-instances-failed-dialog"
                                dialogFrom={FROM_DIALOG.MANAGE_WIZARD}
                            />
                        );
                    }
                }
            } catch (error) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: t('databases.register-flow.manage-detect-fail-message')
                    })
                );
            } finally {
                dispatch(setIsDetectReplicaHostLoading(false));
            }
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.register-flow.selection-required-to-proceed')
                })
            );
        }
    };

    // Show initial dialog
    setDialog(
        <DialogComponent
            header={t('databases.register-flow.authenticate-instances')}
            content={<ReplicaInfoDialog instance={manageSingleInstanceData} replicaList={replicaList} />}
            primaryButton={t('databases.general.continue')}
            callback={() => {
                const currentState = store.getState();
                const shouldAuthenticateReplicas = currentState.inventoryV2.registerReplicaSelection;

                if (shouldAuthenticateReplicas) {
                    handleReplicaAuthCredentials(credList);
                } else {
                    closeDialog();
                    goToNextStep();
                }
            }}
            closeCallback={() => {
                closeDialog();
            }}
            customClass={styles.dialog}
            testId="wlm-db-authenticate-instances-dialog"
            dialogFrom={FROM_DIALOG.MANAGE_WIZARD}
        />
    );
};
