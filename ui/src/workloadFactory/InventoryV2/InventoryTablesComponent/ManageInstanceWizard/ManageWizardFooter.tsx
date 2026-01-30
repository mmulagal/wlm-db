import { DsButton, useDialog, useWizard, WizardFooter } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styles from './ManageInstanceWizard.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { updateInstanceStatus } from '../../InventoryUtilsV2';
import { setIsDetectHostLoading } from '../../../../store/mssql/msSqlActionSlice';
import {
    useLazyGetSubTaskListQuery,
    useManageBulkV2MssqlInstanceMutation,
    useManageBulkV2OracleInstanceMutation,
    useRegisterResourceCredentialsBulkMutation
} from '../../../../utils/apiService';
import {
    createAuthOnlyPayload,
    createDetectHostPayload,
    createFsxOnlyPayload
} from '../../../../utils/utilityFunctions';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import {
    setInventoryTableData,
    setManageSingleInstanceReadiness,
    setSelectedFSxForOntapCredentials,
    setSelectedMultiDetectInstances,
    setFsxAuthStatus,
    setInstanceAuthStatus,
    setDetectCredentialErrors,
    clearDetectCredentialErrors
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { handleMultiInstanceManage, handleSingleInstanceManage } from './ManageInstanceUtils';
import {
    areAllInstancesAuthenticated,
    createBulkAuthPayload,
    validateBulkInstanceCredentials,
    createOracleBulkAuthPayload,
    validateOracleBulkInstanceCredentials
} from './SelectInstancesStep/AuthenticateBulkUtils';
import {
    areAllFsxAuthenticated,
    getFsxNeedingAuthFromBulk,
    DiscoverDataContext
} from './AuthenticateFSxStep/AuthenticateFsxUtils';
import {
    ACTION_TYPE,
    DBType,
    DETECT_HOST_VAR,
    DETECT_PAYLOAD_SIZE,
    FSX_FOR_ONTAP_CRED_OPTION,
    RESPONSE_STATUS,
    SQL_DEPLOYMENT_MODE
} from '../../../../utils/consts';
import { BulkDetectedInstance, UseWizardReturn } from '../../../../utils/types/registerTypes';
import { FsxAuthStatusMap, InstanceAuthStatusMap } from '../../../../utils/types/inventoryV2Types';
import {
    detectAuthFieldsValidation,
    detectFieldsValidation,
    detectFsxFieldsValidation,
    saveFsxInCredRegisteredObj,
    handleReplicaAuthenticationDialog,
    handleReplicaAuthenticationAndDialog
} from './ManageWizardUtils';
import { isAuthRequiredForInstance } from './DetectInstanceStep/DetectContent/DetectContentHelper';

type PlanningWizardFooterProps = {
    style?: React.CSSProperties;
    validation?: () => boolean;
    nextButtonProps?: any;
};

const ManageWizardFooter = (props: PlanningWizardFooterProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setDialog, closeDialog } = useDialog();
    const { nextButtonProps, style } = props; // onClick must be taken out otherwise will override footer onClick when spread to button
    const { onClick, ...rest } = nextButtonProps ?? { onClick: null };

    const { currentStepIndex, currentStep, gotoPreviousStep, goToNextStep, setState }: UseWizardReturn = useWizard();

    const detectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);

    // Consolidated inventoryV2 state selectors
    const {
        manageSingleInstanceData,
        fsxCredentialStatusObj,
        manageSingleInstanceChecks,
        wizardOperationType,
        selectedMultiDetectInstances,
        bulkDetectedInstanceList,
        credentialOption,
        bulkInstanceCredentials,
        oracleBulkDatabaseCredentials,
        instanceCredentials,
        instanceAuthStatus,
        registerHostType
    } = useAppSelector(state => state.inventoryV2);
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const { discoveredOracleHostData } = useAppSelector(state => state.inventoryV2.discoveredOracleHosts);

    // Build discover data context for fallback lookup when storage is missing
    const discoverContext: DiscoverDataContext = {
        discoveredHostData,
        discoveredOracleHostData
    };

    const dispatch = useDispatch();

    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const [manageBulkV2InstanceApi] = useManageBulkV2MssqlInstanceMutation();
    const [manageBulkV2OracleInstanceApi] = useManageBulkV2OracleInstanceMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const engineType = manageSingleInstanceData?.hostType;

    const goBack = () => {
        setState({ hitNext: false });
        gotoPreviousStep();
    };

    /**
     * Handles bulk FSx for ONTAP authentication for the new bulk register flow.
     * Authenticates FSx credentials for all selected instances.
     * Similar to handleRegisterFsxCredentials but for bulk mode.
     */
    const handleBulkFsxAuthenticate = async () => {
        // Get all unique FSx needing authentication from all selected instances
        const fsxNeedingAuth = getFsxNeedingAuthFromBulk(
            selectedMultiDetectInstances,
            fsxCredentialStatusObj,
            discoverContext
        );

        // If no FSx needs authentication, skip to next step
        if (fsxNeedingAuth.length === 0) {
            goToNextStep();
            return;
        }

        dispatch(setIsDetectHostLoading(true));

        // Notify user that FSx authentication is in progress
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.register-flow.bulk-auth-in-progress')
            })
        );

        const fsxIds = fsxNeedingAuth.map(fsx => fsx.fsxId);

        // Group FSx by the first instance that contains them (for credential/region info)
        // We need ec2InstanceId, region, and credentialsId from one of the instances
        // Check both storage array AND direct fsxId field since FSx can come from either source
        const getInstanceForFsx = (fsxId: string): BulkDetectedInstance | undefined =>
            selectedMultiDetectInstances.find((instance: BulkDetectedInstance) => {
                const storage = instance.data?.storage || instance.storage;
                // Check if FSx is in storage array
                const inStorage = storage?.some((item: any) => item.id === fsxId && item.type === DETECT_HOST_VAR.FSXN);
                // Also check direct fsxId field on instance
                const directFsxId = instance.data?.fsxId || (instance as any).fsxId;
                return inStorage || directFsxId === fsxId;
            }) as BulkDetectedInstance | undefined;

        // Group FSx credentials by ec2InstanceId for efficient API calls
        const payloadMap: Record<string, any> = {};
        const processedFsxIds = new Set<string>();

        fsxIds.forEach(fsxId => {
            if (processedFsxIds.has(fsxId)) return;

            const instance = getInstanceForFsx(fsxId);
            if (!instance) return;

            const instanceData = instance.data || instance;
            const ec2InstanceId = instanceData?.ec2InstanceId || '';

            if (!ec2InstanceId) return;

            const credList = createFsxOnlyPayload([fsxId], instanceData);

            if (credList.credentials && credList.credentials.length > 0) {
                if (payloadMap[ec2InstanceId]) {
                    // Merge FSx credentials into existing payload item
                    const existingCreds = payloadMap[ec2InstanceId].credentials;
                    credList.credentials.forEach((cred: any) => {
                        // Avoid duplicate resourceId/resourceType combos
                        if (
                            !existingCreds.some(
                                (e: any) => e.resourceId === cred.resourceId && e.resourceType === cred.resourceType
                            )
                        ) {
                            existingCreds.push(cred);
                        }
                    });
                } else {
                    // Create new payload item for this ec2InstanceId
                    payloadMap[ec2InstanceId] = {
                        ...credList,
                        ec2InstanceId,
                        region: instanceData?.regionId || '',
                        credentialsId: instanceData?.credentialId || ''
                    };
                }
                processedFsxIds.add(fsxId);
            }
        });

        const payloadItems = Object.values(payloadMap);

        // If no credentials to send, proceed to next step
        if (payloadItems.length === 0) {
            dispatch(setIsDetectHostLoading(false));
            goToNextStep();
            return;
        }

        // Helper to split array into batches
        const chunkArray = (arr: any[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

        const batches = chunkArray(payloadItems, DETECT_PAYLOAD_SIZE);
        const authStatusUpdates: FsxAuthStatusMap = {};
        const successFsxIds: string[] = [];
        const failedFsxIds: string[] = [];

        try {
            for (let i = 0; i < batches.length; i++) {
                const batchPayload = { items: batches[i] };

                const result = await registerResourceCredBulk({ payload: batchPayload });

                if (result && !result?.error && result?.data) {
                    // Process response for this batch
                    const resultItems = result?.data?.items || [];

                    resultItems.forEach((resultItem: any) => {
                        const registerDetails = resultItem?.registerDetails || [];

                        registerDetails.forEach((detail: any) => {
                            const resourceId = detail?.resourceId;
                            if (!resourceId) return;

                            if (detail?.fsxnError) {
                                failedFsxIds.push(resourceId);
                                authStatusUpdates[resourceId] = RESPONSE_STATUS.FAILED.toLowerCase() as 'failed';
                            } else if (detail?.resourceType === 'FSX') {
                                successFsxIds.push(resourceId);
                                authStatusUpdates[resourceId] = RESPONSE_STATUS.SUCCESS.toLowerCase() as 'success';
                            }
                        });
                    });
                } else {
                    // API call failed - mark all FSx in batch as failed
                    batchPayload.items.forEach(item => {
                        item.credentials.forEach((cred: { resourceId: string }) => {
                            failedFsxIds.push(cred.resourceId);
                            authStatusUpdates[cred.resourceId] = RESPONSE_STATUS.FAILED.toLowerCase() as 'failed';
                        });
                    });
                }
            }

            // Update Redux state with FSx auth status updates
            dispatch(setFsxAuthStatus(authStatusUpdates));

            // Mark successful FSx as registered
            successFsxIds.forEach(fsxId => {
                saveFsxInCredRegisteredObj(fsxId, dispatch);
            });

            // Check results and proceed accordingly
            if (failedFsxIds.length === 0) {
                // All FSx authenticated successfully
                goToNextStep();
            } else if (successFsxIds.length > 0 && failedFsxIds.length > 0) {
                // Partial success - switch to manual mode for failed ones
                dispatch(setSelectedFSxForOntapCredentials(FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY));
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.WARNING,
                        message: t('databases.register-flow.fsx-partial-auth-fail-message', {
                            failedCount: failedFsxIds.length
                        })
                    })
                );
            } else {
                // All failed
                if (fsxIds.length === 1) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.fsx-partial-auth-fail-message', {
                                failedCount: fsxIds.length
                            })
                        })
                    );
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.fsx-all-auth-fail-message', {
                                count: fsxIds.length
                            })
                        })
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
            dispatch(setIsDetectHostLoading(false));
        }
    };

    const handleRegisterResourceCred = async (engineType: any) => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(setManageSingleInstanceReadiness(null));
        dispatch(clearDetectCredentialErrors()); // Clear previous errors
        const sqlServerInstance =
            manageSingleInstanceData?.sqlServerInstance || manageSingleInstanceData?.databaseInstanceName || '';
        try {
            const credList = createDetectHostPayload(
                sqlServerInstance,
                manageSingleInstanceData?.fsxId,
                manageSingleInstanceData
            );
            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId: manageSingleInstanceData?.ec2InstanceId,
                        region: manageSingleInstanceData?.regionId,
                        credentialsId: manageSingleInstanceData?.credentialId
                    }
                ]
            };
            if (payload?.items?.some(item => item?.credentials?.length > 0)) {
                const result = await registerResourceCredBulk({ payload });
                if (result && !result?.error && result?.data) {
                    const registerDetails = result?.data?.items?.[0]?.registerDetails || [];
                    const errors: string[] = [];
                    let hasErrors = false;

                    // If we are giving multiple credentials like msql/oracle cred and also fsx credentials then the error can be present at any position
                    registerDetails.forEach((detail: any) => {
                        if (detail?.databaseServerError) {
                            errors.push(detail.databaseServerError);
                            hasErrors = true;
                            dispatch(setDetectCredentialErrors({ databaseServerError: detail.databaseServerError }));
                        }
                        if (detail?.fsxnError) {
                            errors.push(detail.fsxnError);
                            hasErrors = true;
                            dispatch(setDetectCredentialErrors({ fsxnError: detail.fsxnError }));
                        }
                        if (detail?.oracleAsmError) {
                            errors.push(detail.oracleAsmError);
                            hasErrors = true;
                            dispatch(setDetectCredentialErrors({ oracleAsmError: detail.oracleAsmError }));
                        }
                    });

                    if (hasErrors) {
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: errors.join(' ') || t('databases.register-flow.manage-detect-fail-message')
                            })
                        );
                    } else {
                        // Clear errors on success
                        dispatch(clearDetectCredentialErrors());
                        // store fsx cred in register obj if payload has fsx register
                        saveFsxInCredRegisteredObj(manageSingleInstanceData?.fsxId, dispatch);
                        const updatedInventoryTableData = updateInstanceStatus(
                            'detect',
                            manageSingleInstanceData,
                            manageSingleInstanceData
                        );
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                        if (result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness) {
                            dispatch(
                                setManageSingleInstanceReadiness(
                                    result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness
                                )
                            );
                        }
                        goToNextStep();
                    }
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.manage-detect-fail-message')
                        })
                    );
                }
            } else {
                goToNextStep();
            }
        } catch (error) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.register-flow.manage-detect-fail-message')
                })
            );
        } finally {
            dispatch(setIsDetectHostLoading(false));
        }
    };

    /**
     * Handles the registration of authentication credentials (SQL Server/Oracle) for a single instance.
     * Validates and submits authentication credentials via the bulk registration API.
     * Updates inventory state and advances wizard on success, shows error notification on failure.
     */
    const handleRegisterAuthCredentials = async () => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(clearDetectCredentialErrors()); // Clear previous errors
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.register-flow.bulk-auth-in-progress')
            })
        );
        dispatch(setManageSingleInstanceReadiness(null));
        const sqlServerInstance =
            manageSingleInstanceData?.sqlServerInstance || manageSingleInstanceData?.databaseInstanceName || '';
        try {
            const credList = createAuthOnlyPayload(sqlServerInstance, manageSingleInstanceData);
            const isReplicaInfoRequired =
                manageSingleInstanceData?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG;
            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId: manageSingleInstanceData?.ec2InstanceId,
                        region: manageSingleInstanceData?.regionId,
                        credentialsId: manageSingleInstanceData?.credentialId,
                        isReplicaInfoRequired
                    }
                ]
            };
            if (payload?.items?.some(item => item?.credentials?.length > 0)) {
                const result = await registerResourceCredBulk({ payload });
                if (result && !result?.error && result?.data) {
                    const registerDetails = result?.data?.items?.[0]?.registerDetails || [];
                    const errors: string[] = [];
                    let hasErrors = false;

                    registerDetails.forEach((detail: any) => {
                        if (detail?.databaseServerError) {
                            errors.push(detail.databaseServerError);
                            hasErrors = true;
                            dispatch(setDetectCredentialErrors({ databaseServerError: detail.databaseServerError }));
                        }
                        if (detail?.oracleAsmError) {
                            errors.push(detail.oracleAsmError);
                            hasErrors = true;
                            dispatch(setDetectCredentialErrors({ oracleAsmError: detail.oracleAsmError }));
                        }
                    });

                    if (hasErrors) {
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: errors.join(' ') || t('databases.register-flow.manage-detect-fail-message')
                            })
                        );
                    } else {
                        // Clear errors on success
                        dispatch(clearDetectCredentialErrors());
                        // Update inventory table data
                        const updatedInventoryTableData = updateInstanceStatus(
                            'detect',
                            manageSingleInstanceData,
                            manageSingleInstanceData
                        );
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                        if (result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness) {
                            dispatch(
                                setManageSingleInstanceReadiness(
                                    result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness
                                )
                            );
                        }
                        if (result?.data?.items?.[0]?.replicaInfo) {
                            handleReplicaAuthenticationAndDialog(
                                result?.data?.items?.[0],
                                manageSingleInstanceData,
                                credList,
                                t,
                                setDialog,
                                closeDialog,
                                goToNextStep,
                                dispatch,
                                registerResourceCredBulk,
                                instanceAuthStatus,
                                registerHostType,
                                styles
                            );
                        } else {
                            goToNextStep();
                        }
                    }
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.manage-detect-fail-message')
                        })
                    );
                }
            } else {
                // No auth credentials needed, skip to next step
                goToNextStep();
            }
        } catch (error) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.register-flow.manage-detect-fail-message')
                })
            );
        } finally {
            dispatch(setIsDetectHostLoading(false));
        }
    };

    /**
     * Handles the registration of FSx for ONTAP credentials for a single instance.
     * Identifies unregistered FSx file systems from storage array and submits their credentials via the bulk registration API.
     * Handles partial failures by switching to manual credential mode. Updates inventory state and advances wizard on success.
     */
    const handleRegisterFsxCredentials = async () => {
        dispatch(setIsDetectHostLoading(true));
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.register-flow.bulk-auth-in-progress')
            })
        );
        dispatch(setManageSingleInstanceReadiness(null));

        // Get FSx IDs from storage array that need authentication
        const getUnregisteredFsxIds = (): string[] => {
            const storage = manageSingleInstanceData?.storage;
            if (!storage || !Array.isArray(storage)) return [];

            return storage
                .filter(item => {
                    if (item.type !== DETECT_HOST_VAR.FSXN || !item.id) return false;
                    // Exclude already registered FSx
                    const statusObj = fsxCredentialStatusObj?.[item.id];
                    return statusObj !== true;
                })
                .map(item => item.id);
        };

        const fsxIds = getUnregisteredFsxIds();

        // If no FSx needs authentication, skip to next step
        if (fsxIds.length === 0) {
            goToNextStep();
            dispatch(setIsDetectHostLoading(false));
            return;
        }

        try {
            const credList = createFsxOnlyPayload(fsxIds, manageSingleInstanceData);
            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId: manageSingleInstanceData?.ec2InstanceId,
                        region: manageSingleInstanceData?.regionId,
                        credentialsId: manageSingleInstanceData?.credentialId
                    }
                ]
            };

            if (payload?.items?.some(item => item?.credentials?.length > 0)) {
                const result = await registerResourceCredBulk({ payload });
                if (result && !result?.error && result?.data) {
                    const registerDetails = result?.data?.items?.[0]?.registerDetails || [];
                    const failedFsxIds: string[] = [];
                    const successFsxIds: string[] = [];

                    registerDetails.forEach((detail: any) => {
                        if (detail?.fsxnError) {
                            failedFsxIds.push(detail.resourceId);
                        } else if (detail?.resourceType === 'FSX') {
                            successFsxIds.push(detail.resourceId);
                        }
                    });

                    // Update FSx auth status in state
                    const authStatusUpdate: FsxAuthStatusMap = {};
                    failedFsxIds.forEach(fsxId => {
                        authStatusUpdate[fsxId] = RESPONSE_STATUS.FAILED.toLowerCase() as 'failed';
                    });
                    successFsxIds.forEach(fsxId => {
                        authStatusUpdate[fsxId] = RESPONSE_STATUS.SUCCESS.toLowerCase() as 'success';
                    });
                    dispatch(setFsxAuthStatus(authStatusUpdate));

                    if (failedFsxIds.length > 0) {
                        if (failedFsxIds.length < fsxIds.length) {
                            // Partial failure - switch to manual mode and show which ones failed
                            // Mark successful FSx as registered so they won't be re-sent
                            successFsxIds.forEach(fsxId => {
                                saveFsxInCredRegisteredObj(fsxId, dispatch);
                            });
                            dispatch(setSelectedFSxForOntapCredentials(FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY));
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: t('databases.register-flow.fsx-partial-auth-fail-message', {
                                        failedCount: failedFsxIds.length
                                    })
                                })
                            );
                        } else {
                            // All failed - stay on USE_THE_SAME_CRED mode with error
                            setState({ fsxAllAuthFailed: true });
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: t('databases.register-flow.fsx-all-auth-fail-message', {
                                        count: fsxIds.length
                                    })
                                })
                            );
                        }
                    } else {
                        // All FSx authenticated successfully
                        fsxIds.forEach(fsxId => {
                            saveFsxInCredRegisteredObj(fsxId, dispatch);
                        });
                        const updatedInventoryTableData = updateInstanceStatus(
                            'detect',
                            manageSingleInstanceData,
                            manageSingleInstanceData
                        );
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                        if (result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness) {
                            dispatch(
                                setManageSingleInstanceReadiness(
                                    result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness
                                )
                            );
                        }
                        goToNextStep();
                    }
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.manage-detect-fail-message')
                        })
                    );
                }
            } else {
                goToNextStep();
            }
        } catch (error) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.register-flow.manage-detect-fail-message')
                })
            );
        } finally {
            dispatch(setIsDetectHostLoading(false));
        }
    };

    /**
     * Handles bulk instance authentication for the new bulk register flow.
     * Authenticates multiple instances with either same credentials or per-instance credentials.
     * Updates instanceAuthStatus for each instance based on API response.
     */
    const handleBulkInstanceAuthenticate = async () => {
        const hostType = registerHostType || DBType.MSSQL;

        // Check if all instances are already authenticated - skip API call
        if (areAllInstancesAuthenticated(selectedMultiDetectInstances, instanceAuthStatus, hostType)) {
            goToNextStep();
            return;
        }

        // Validate credentials before making API call
        const validationResult = validateBulkInstanceCredentials(
            selectedMultiDetectInstances,
            credentialOption,
            bulkInstanceCredentials,
            instanceCredentials,
            instanceAuthStatus,
            hostType
        );

        if (!validationResult.isValid) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: validationResult.errorMessage || t('databases.register-flow.manage-detect-fail-message')
                })
            );
            return;
        }

        dispatch(setIsDetectHostLoading(true));

        // Notify user that authentication may take time
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.register-flow.bulk-auth-in-progress')
            })
        );

        // Create payload using bulk auth utility
        const payloadItems = createBulkAuthPayload(
            selectedMultiDetectInstances,
            credentialOption,
            bulkInstanceCredentials,
            instanceCredentials,
            instanceAuthStatus,
            hostType
        );

        // If no credentials to send (all already authenticated), proceed to next step
        if (payloadItems.length === 0) {
            dispatch(setIsDetectHostLoading(false));
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

            // Update inventoryTableData and selectedMultiDetectInstances for successful instances
            if (Object.keys(manageReadinessUpdates).length > 0) {
                // Update inventoryTableData for each successful instance
                // Each dispatch updates the store, so subsequent updateInstanceStatus calls see updated state
                selectedMultiDetectInstances.forEach((instance: any) => {
                    const instanceData = instance.data || instance;
                    const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName;

                    if (instanceId && manageReadinessUpdates[instanceId]) {
                        // Also save FSx credential status for successful instances with FSx storage
                        const fsxId = instanceData?.fsxId;
                        if (fsxId) {
                            saveFsxInCredRegisteredObj(fsxId, dispatch);
                        }

                        // Update inventory table data for this instance
                        const updatedInventoryTableData = updateInstanceStatus('detect', instanceData, instanceData);
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                    }
                });

                // Update selectedMultiDetectInstances with manageReadiness
                const updatedInstances = selectedMultiDetectInstances.map((instance: any) => {
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
            if (areAllInstancesAuthenticated(selectedMultiDetectInstances, updatedAuthStatus, hostType)) {
                goToNextStep();
            } else {
                // Show notification about partial success
                const successCount = Object.values(authStatusUpdates).filter(
                    s => s === RESPONSE_STATUS.SUCCESS.toLowerCase()
                ).length;
                const failedCount = Object.values(authStatusUpdates).filter(
                    s => s === RESPONSE_STATUS.FAILED.toLowerCase()
                ).length;

                if (successCount > 0 && failedCount > 0) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.WARNING,
                            message: t('databases.register-flow.bulk-auth-partial-success', {
                                failedCount
                            })
                        })
                    );
                } else if (failedCount === 1) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.WARNING,
                            message: t('databases.register-flow.bulk-auth-partial-success', {
                                failedCount
                            })
                        })
                    );
                } else if (failedCount > 1) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.bulk-auth-all-failed', {
                                failedCount
                            })
                        })
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
            dispatch(setIsDetectHostLoading(false));
        }
    };

    /**
     * Handles bulk Oracle database authentication for the new bulk register flow.
     * Similar to handleBulkInstanceAuthenticate but uses Oracle-specific credentials and payload.
     * Updates instanceAuthStatus for each database based on API response.
     */
    const handleBulkOracleInstanceAuthenticate = async () => {
        const hostType = DBType.ORACLE;

        // Check if all databases are already authenticated - skip API call
        if (areAllInstancesAuthenticated(selectedMultiDetectInstances, instanceAuthStatus, hostType)) {
            goToNextStep();
            return;
        }

        // Validate Oracle credentials before making API call
        const validationResult = validateOracleBulkInstanceCredentials(
            selectedMultiDetectInstances,
            credentialOption,
            oracleBulkDatabaseCredentials,
            instanceCredentials,
            instanceAuthStatus
        );

        if (!validationResult.isValid) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: validationResult.errorMessage || t('databases.register-flow.manage-detect-fail-message')
                })
            );
            return;
        }

        dispatch(setIsDetectHostLoading(true));

        // Notify user that authentication may take time
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.register-flow.bulk-auth-in-progress')
            })
        );

        // Create payload using Oracle bulk auth utility
        const payloadItems = createOracleBulkAuthPayload(
            selectedMultiDetectInstances,
            credentialOption,
            oracleBulkDatabaseCredentials,
            instanceCredentials,
            instanceAuthStatus
        );

        // If no credentials to send (all already authenticated), proceed to next step
        if (payloadItems.length === 0) {
            dispatch(setIsDetectHostLoading(false));
            goToNextStep();
            return;
        }

        // Helper to split array into batches
        const chunkArray = (arr: any[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

        const batches = chunkArray(payloadItems, DETECT_PAYLOAD_SIZE);
        const authStatusUpdates: InstanceAuthStatusMap = {};
        // Track manageReadiness updates for successful databases
        const manageReadinessUpdates: Record<string, any> = {};

        try {
            for (let i = 0; i < batches.length; i++) {
                const batchPayload = { items: batches[i] };

                const result = await registerResourceCredBulk({ payload: batchPayload });

                if (result && !result?.error && result?.data) {
                    // Process response for this batch - update auth status per database
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

                            // Track manageReadiness for successful databases
                            if (!hasError && detail?.manageReadiness) {
                                manageReadinessUpdates[resourceId] = detail.manageReadiness;
                            }
                        });
                    });
                } else {
                    // API call failed - mark all databases in batch as failed
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

            // Update inventoryTableData and selectedMultiDetectInstances for successful databases
            if (Object.keys(manageReadinessUpdates).length > 0) {
                selectedMultiDetectInstances.forEach((instance: any) => {
                    const instanceData = instance.data || instance;
                    const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName;

                    if (instanceId && manageReadinessUpdates[instanceId]) {
                        // Also save FSx credential status for successful databases with FSx storage
                        const fsxId = instanceData?.fsxId;
                        if (fsxId) {
                            saveFsxInCredRegisteredObj(fsxId, dispatch);
                        }

                        // Update inventory table data for this database
                        const updatedInventoryTableData = updateInstanceStatus('detect', instanceData, instanceData);
                        dispatch(setInventoryTableData(updatedInventoryTableData));
                    }
                });

                // Update selectedMultiDetectInstances with manageReadiness
                const updatedInstances = selectedMultiDetectInstances.map((instance: any) => {
                    const instanceData = instance.data || instance;
                    const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName;

                    if (instanceId && manageReadinessUpdates[instanceId]) {
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

            // Check if all databases are now authenticated
            const updatedAuthStatus = { ...instanceAuthStatus, ...authStatusUpdates };
            if (areAllInstancesAuthenticated(selectedMultiDetectInstances, updatedAuthStatus, hostType)) {
                goToNextStep();
            } else {
                // Show notification about partial success
                const successCount = Object.values(authStatusUpdates).filter(
                    s => s === RESPONSE_STATUS.SUCCESS.toLowerCase()
                ).length;
                const failedCount = Object.values(authStatusUpdates).filter(
                    s => s === RESPONSE_STATUS.FAILED.toLowerCase()
                ).length;

                if (successCount > 0 && failedCount > 0) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.WARNING,
                            message: t('databases.register-flow.bulk-auth-partial-success', {
                                failedCount
                            })
                        })
                    );
                } else if (failedCount > 0) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.register-flow.bulk-auth-all-failed', {
                                failedCount
                            })
                        })
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
            dispatch(setIsDetectHostLoading(false));
        }
    };

    const goForward = () => {
        if (wizardOperationType === ACTION_TYPE.SINGLE) {
            setState({ hitNext: true });
            const fieldsCorrect = detectFieldsValidation(manageSingleInstanceData, engineType);
            if (fieldsCorrect) {
                handleRegisterResourceCred(engineType);
            }
        }
    };

    const goAuthForwardForSingleRegister = () => {
        if (wizardOperationType === ACTION_TYPE.SINGLE) {
            // Check if instance is already authenticated
            const isAlreadyAuthenticated = !isAuthRequiredForInstance(manageSingleInstanceData, engineType);

            // If already authenticated, skip API call and go to next step
            if (isAlreadyAuthenticated) {
                // AOAG replica dialog is MSSQL-specific
                if (
                    engineType === DBType.MSSQL &&
                    manageSingleInstanceData?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG &&
                    manageSingleInstanceData?.aoagClusterNodeDetails?.length > 0
                ) {
                    // Handle replica authentication dialog if AOAG with replicas
                    handleReplicaAuthenticationDialog(
                        manageSingleInstanceData,
                        t,
                        setDialog,
                        closeDialog,
                        goToNextStep,
                        dispatch,
                        registerHostType,
                        styles
                    );
                    return;
                }
                goToNextStep();
                return;
            }

            setState({ hitNext: true });
            const fieldsCorrect = detectAuthFieldsValidation(manageSingleInstanceData, engineType);
            if (fieldsCorrect) {
                handleRegisterAuthCredentials();
            }
        }
    };

    const goFsxForwardForSingleRegister = () => {
        // Check if all FSx are already authenticated using storage array and fsxCredentialStatusObj
        const storage = manageSingleInstanceData?.storage;
        const fsxnItems = storage?.filter((item: any) => item.type === DETECT_HOST_VAR.FSXN && item.id) || [];

        const isFsxAlreadyAuthenticated =
            fsxnItems.length === 0 || fsxnItems.every((item: any) => fsxCredentialStatusObj?.[item.id] === true);

        // If already authenticated, skip API call and go to next step
        if (isFsxAlreadyAuthenticated) {
            goToNextStep();
            return;
        }

        setState({ hitNextForStep2: true });
        const fieldsCorrect = detectFsxFieldsValidation(manageSingleInstanceData, engineType);
        if (fieldsCorrect) {
            handleRegisterFsxCredentials();
        }
    };

    // Handles bulk registration flow for both MSSQL and Oracle
    const bulkGoForward = (currentStepIndexVal: number) => {
        if (currentStepIndexVal === 0) {
            // @ts-ignore
            const engineType = selectedMultiDetectInstances[0]?.data?.hostType || DBType.MSSQL;
            // Pass bulk mode flag and selected instances for proper FSx validation
            const fieldsCorrect = detectAuthFieldsValidation(null, engineType, true, selectedMultiDetectInstances);
            if (fieldsCorrect) {
                // New flow: Step 0 is authentication - call appropriate bulk auth handler
                if (registerHostType === DBType.ORACLE) {
                    handleBulkOracleInstanceAuthenticate();
                } else {
                    handleBulkInstanceAuthenticate();
                }
            }
        } else if (currentStepIndexVal === 1) {
            // Check if all FSx from all selected instances are authenticated
            const isFsxAlreadyAuthenticated = areAllFsxAuthenticated(
                undefined,
                fsxCredentialStatusObj,
                true,
                selectedMultiDetectInstances,
                undefined,
                discoverContext
            );

            if (isFsxAlreadyAuthenticated) {
                goToNextStep();
            } else {
                setState({ hitNextForStep2: true });
                // @ts-ignore
                const engineType = selectedMultiDetectInstances[0]?.data?.hostType || DBType.MSSQL;
                // Pass bulk mode flag and selected instances for proper FSx validation
                const fieldsCorrect = detectFsxFieldsValidation(null, engineType, true, selectedMultiDetectInstances);
                if (fieldsCorrect) {
                    // Use handleBulkFsxAuthenticate for FSx-only authentication (similar to single flow)
                    handleBulkFsxAuthenticate();
                }
            }
        }
    };

    const handleManage = () => {
        if (wizardOperationType === ACTION_TYPE.BULK) {
            // @ts-ignore
            const engineType = selectedMultiDetectInstances[0]?.data?.hostType || DBType.MSSQL;
            const manageApi = engineType === DBType.ORACLE ? manageBulkV2OracleInstanceApi : manageBulkV2InstanceApi;
            handleMultiInstanceManage(
                bulkDetectedInstanceList,
                dispatch,
                manageApi,
                getJobDetailApi,
                navigate,
                engineType
            );
        } else {
            const manageApi = engineType === DBType.ORACLE ? manageBulkV2OracleInstanceApi : manageBulkV2InstanceApi;
            handleSingleInstanceManage(
                manageSingleInstanceChecks,
                dispatch,
                manageApi,
                getJobDetailApi,
                navigate,
                engineType,
                t
            );
        }
    };

    return (
        <>
            {wizardOperationType !== ACTION_TYPE.BULK && (
                <WizardFooter className={styles['pw-footer']} style={style}>
                    {currentStepIndex !== 0 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-back-${currentStep}`}
                            isThin
                            onClick={goBack}
                            variant="secondary"
                        >
                            {t('databases.register-flow.previous')}
                        </DsButton>
                    )}
                    {currentStepIndex === 0 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                            isThin
                            onClick={goAuthForwardForSingleRegister}
                            variant="primary"
                            isLoading={detectHostLoading}
                            {...rest}
                        >
                            {t('databases.register-flow.next')}
                        </DsButton>
                    )}
                    {currentStepIndex === 1 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                            isThin
                            onClick={goFsxForwardForSingleRegister}
                            variant="primary"
                            isLoading={detectHostLoading}
                            {...rest}
                        >
                            {t('databases.register-flow.next')}
                        </DsButton>
                    )}
                    {currentStepIndex === 2 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-manage-${currentStep}`}
                            isThin
                            onClick={handleManage}
                            variant="primary"
                            {...rest}
                        >
                            {t('databases.register-flow.register')}
                        </DsButton>
                    )}
                </WizardFooter>
            )}

            {/* This is only for Bulk operation */}
            {wizardOperationType === ACTION_TYPE.BULK && (
                <WizardFooter className={styles['pw-footer']} style={style}>
                    {currentStepIndex !== 0 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-back-${currentStep}`}
                            isThin
                            onClick={goBack}
                            variant="secondary"
                        >
                            {t('databases.register-flow.previous')}
                        </DsButton>
                    )}
                    {currentStepIndex < 2 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                            isThin
                            onClick={() => bulkGoForward(currentStepIndex)}
                            isLoading={detectHostLoading}
                            variant="primary"
                            {...rest}
                        >
                            {t('databases.register-flow.next')}
                        </DsButton>
                    )}
                    {currentStepIndex === 2 && (
                        <DsButton
                            data-testid={`wlm-db-manage-wizard-manage-${currentStep}`}
                            isThin
                            onClick={handleManage}
                            variant="primary"
                            {...rest}
                        >
                            {t('databases.register-flow.register')}
                        </DsButton>
                    )}
                </WizardFooter>
            )}
        </>
    );
};

export default ManageWizardFooter;
