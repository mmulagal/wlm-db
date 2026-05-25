import i18next from 'i18next';
import { BulkDetectedInstance } from '../../../../../utils/types/registerTypes';
import { InstanceAuthStatus, InstanceAuthStatusMap } from '../../../../../utils/types/inventoryV2Types';
import {
    DBType,
    RESPONSE_STATUS,
    DETECT_HOST_VAR,
    CREDENTIAL_OPTIONS,
    AUTHENTICATION_TYPE,
    isValidSsmArn
} from '../../../../../utils/consts';
import { isAuthRequiredForInstance } from '../DetectInstanceStep/DetectContent/DetectContentHelper';

/**
 * Credential item interface for API payload
 */
export interface BulkCredentialItem {
    resourceId: string;
    resourceType: string;
    username?: string;
    password?: string;
    ssmParameterArn?: string;
}

/**
 * Bulk auth payload item interface for API
 */
export interface BulkAuthPayloadItem {
    credentials: BulkCredentialItem[];
    ec2InstanceId: string;
    region: string;
    credentialsId: string;
    checkManageReadiness: boolean;
}

/**
 * Instance item interface with formatted fields for bulk authentication
 */
export interface BulkInstanceItem {
    instanceId: string;
    instanceName: string;
    hostName: string;
    ec2InstanceId: string;
    region: string;
    credentialsId: string;
    /** Unique identifier combining ec2InstanceId and databaseInstanceName to handle duplicate instance names */
    uniqueKey: string;
}

/**
 * Get all selected instances formatted for bulk registration UI
 * @param selectedMultiDetectInstances - Array of selected instances from Redux state
 * @returns Array of formatted instance items
 */
/**
 * Generate a unique key for an instance by combining ec2InstanceId and databaseInstanceName
 * This handles cases where multiple instances have the same name on different EC2 hosts
 */
export const generateInstanceUniqueKey = (ec2InstanceId: string, databaseInstanceName: string): string =>
    `${ec2InstanceId}::${databaseInstanceName}`;

export const getSelectedInstancesForBulk = (
    selectedMultiDetectInstances: BulkDetectedInstance[] | undefined
): BulkInstanceItem[] => {
    if (!selectedMultiDetectInstances || !Array.isArray(selectedMultiDetectInstances)) return [];

    return selectedMultiDetectInstances.map(instance => {
        const ec2InstanceId = instance.data?.ec2InstanceId || instance.ec2InstanceId || '';
        const databaseInstanceName = instance.data?.databaseInstanceName || instance.databaseInstanceName || '';
        return {
            instanceId: databaseInstanceName,
            instanceName: databaseInstanceName,
            hostName: instance.data?.name || instance.data?.hostRow?.name || instance?.value,
            ec2InstanceId,
            region: instance.data?.regionId || instance.region || '',
            credentialsId: instance.data?.credentialId || instance.credentialsId || '',
            uniqueKey: generateInstanceUniqueKey(ec2InstanceId, databaseInstanceName)
        };
    });
};

/**
 * Check if all selected instances are already authenticated based on their data fields
 * This checks the actual instance authentication status, not wizard auth attempts
 * @param selectedInstances - Array of selected instances
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns true if all instances are already authenticated (no auth required)
 */
export const areAllInstancesAlreadyAuthenticated = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    hostType: string = DBType.MSSQL
): boolean => {
    if (!selectedInstances || selectedInstances.length === 0) return true;

    // Check each instance - if ANY requires auth, return false
    return selectedInstances.every(instance => {
        const instanceData = instance.data || instance;
        return !isAuthRequiredForInstance(instanceData, hostType);
    });
};

/**
 * Check if all selected instances are authenticated (either already authenticated or successfully authenticated in wizard)
 * @param selectedInstances - Array of selected instances
 * @param instanceAuthStatus - Map of instance IDs to auth status from wizard attempts
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns true if all instances are authenticated
 */
export const areAllInstancesAuthenticated = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    hostType: string = DBType.MSSQL
): boolean => {
    if (!selectedInstances || selectedInstances.length === 0) return true;

    return selectedInstances.every(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);

        // First check if instance is already authenticated based on data fields
        if (!isAuthRequiredForInstance(instanceData, hostType)) {
            return true;
        }
        // If auth is required, check if wizard auth attempt was successful
        const status = instanceAuthStatus?.[uniqueKey];
        return status?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();
    });
};

/**
 * Check if we have partial auth success (some success, some failed)
 * Used to disable radio buttons when in partial success state
 * @param selectedInstances - Array of selected instances
 * @param instanceAuthStatus - Map of instance IDs to auth status from wizard attempts
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns true if partial success state (some authenticated, some failed/pending)
 */
export const hasPartialInstanceAuthSuccess = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    hostType: string = DBType.MSSQL
): boolean => {
    if (!selectedInstances || selectedInstances.length === 0) return false;

    // Get instances that require authentication
    const instancesNeedingAuth = selectedInstances.filter(instance => {
        const instanceData = instance.data || instance;
        return isAuthRequiredForInstance(instanceData, hostType);
    });

    // If no instances need auth, no partial state
    if (instancesNeedingAuth.length === 0) return false;
    if (!instanceAuthStatus || Object.keys(instanceAuthStatus).length === 0) return false;

    const successCount = instancesNeedingAuth.filter(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);
        return instanceAuthStatus[uniqueKey]?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();
    }).length;

    const failedCount = instancesNeedingAuth.filter(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);
        return instanceAuthStatus[uniqueKey]?.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase();
    }).length;

    // First landing - no attempts yet, enable radio buttons
    if (successCount === 0 && failedCount === 0) return false;

    // ALL instances succeeded or ALL failed - enable radio buttons
    if (successCount === instancesNeedingAuth.length || failedCount === instancesNeedingAuth.length) return false;

    // Partial success - some succeeded, some failed - disable radio buttons
    return successCount > 0 && failedCount > 0;
};

/**
 * Get instances that need authentication (not already authenticated and not successfully authenticated in wizard)
 * @param selectedInstances - Array of selected instances
 * @param instanceAuthStatus - Map of instance IDs to auth status from wizard attempts
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns Array of instances that need authentication
 */
export const getInstancesNeedingAuth = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    hostType: string = DBType.MSSQL
): BulkInstanceItem[] => {
    if (!selectedInstances || !Array.isArray(selectedInstances)) return [];

    // Filter to instances that require authentication
    const instancesRequiringAuth = selectedInstances.filter(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);

        // If already authenticated based on data fields, skip
        if (!isAuthRequiredForInstance(instanceData, hostType)) {
            return false;
        }
        // If wizard auth attempt was successful, skip
        const status = instanceAuthStatus?.[uniqueKey];
        if (status?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase()) {
            return false;
        }

        return true;
    });

    return getSelectedInstancesForBulk(instancesRequiringAuth as BulkDetectedInstance[]);
};

/**
 * Check if all authentication attempts have failed
 * @param selectedInstances - Array of selected instances
 * @param instanceAuthStatus - Map of instance IDs to auth status from wizard attempts
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns true if all attempts failed
 */
export const haveAllInstancesFailed = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    hostType: string = DBType.MSSQL
): boolean => {
    if (!selectedInstances || selectedInstances.length === 0) return false;
    if (!instanceAuthStatus || Object.keys(instanceAuthStatus).length === 0) return false;

    // Get instances that require authentication
    const instancesNeedingAuth = selectedInstances.filter(instance => {
        const instanceData = instance.data || instance;
        return isAuthRequiredForInstance(instanceData, hostType);
    });

    // If no instances need auth, return false
    if (instancesNeedingAuth.length === 0) return false;

    // Check if we have any auth attempts for instances that need auth
    const attemptedInstances = instancesNeedingAuth.filter(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);
        return instanceAuthStatus[uniqueKey];
    });

    if (attemptedInstances.length === 0) return false;

    // Check if all attempted instances have failed
    return attemptedInstances.every(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);
        return instanceAuthStatus[uniqueKey]?.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase();
    });
};

/**
 * Get auth status for a specific instance
 * @param uniqueKey - The unique key (ec2InstanceId::databaseInstanceName) to check
 * @param instanceAuthStatus - Map of unique keys to auth status
 * @returns The auth status or undefined
 */
export const getInstanceAuthStatus = (
    uniqueKey: string,
    instanceAuthStatus: InstanceAuthStatusMap | undefined
): InstanceAuthStatus | undefined => {
    if (!instanceAuthStatus) return undefined;
    return instanceAuthStatus[uniqueKey] as InstanceAuthStatus;
};

/**
 * Check if a specific instance is authenticated (either already authenticated or wizard auth success)
 * @param uniqueKey - The unique key (ec2InstanceId::databaseInstanceName) to check
 * @param instanceData - The instance data object
 * @param instanceAuthStatus - Map of unique keys to auth status from wizard attempts
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns true if authenticated
 */
export const isInstanceAuthenticated = (
    uniqueKey: string,
    instanceData: any,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    hostType: string = DBType.MSSQL
): boolean => {
    const data = instanceData?.data || instanceData;

    // First check if instance is already authenticated based on data fields
    if (!isAuthRequiredForInstance(data, hostType)) {
        return true;
    }

    const status = getInstanceAuthStatus(uniqueKey, instanceAuthStatus);
    return status?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();
};

/**
 * Check if a specific instance authentication has failed
 * @param uniqueKey - The unique key (ec2InstanceId::databaseInstanceName) to check
 * @param instanceAuthStatus - Map of unique keys to auth status
 * @returns true if failed
 */
export const hasInstanceFailed = (
    uniqueKey: string,
    instanceAuthStatus: InstanceAuthStatusMap | undefined
): boolean => {
    const status = getInstanceAuthStatus(uniqueKey, instanceAuthStatus);
    return status?.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase();
};

/**
 * Create bulk authentication payload for selected instances
 * Groups credentials by ec2InstanceId for efficient API calls
 * @param selectedInstances - Array of selected instances
 * @param credentialOption - SAME_FOR_ALL or MANUAL
 * @param bulkInstanceCredentials - Credentials for SAME_FOR_ALL mode
 * @param instanceCredentials - Per-instance credentials for MANUAL mode
 * @param instanceAuthStatus - Current auth status to skip already authenticated instances
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns Array of payload items for the bulk registration API
 */
export const createBulkAuthPayload = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    credentialOption: string,
    bulkInstanceCredentials: {
        authMode: { value: string };
        username: string;
        password: string;
        ssmParameterArn?: string;
    },
    instanceCredentials: Record<
        string,
        { authMode: { value: string }; username: string; password: string; ssmParameterArn?: string }
    >,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    hostType: string = DBType.MSSQL,
    isGovAccount: boolean = false
): BulkAuthPayloadItem[] => {
    if (!selectedInstances || !Array.isArray(selectedInstances)) return [];

    // Group instances by ec2InstanceId for efficient API calls
    const instanceMap: Record<string, BulkAuthPayloadItem> = {};

    selectedInstances.forEach(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';

        if (!ec2InstanceId || !instanceId) return;

        // Generate unique key for credential lookup
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);

        // Skip instances that don't need authentication
        if (!isAuthRequiredForInstance(instanceData, hostType)) return;

        if (instanceAuthStatus?.[uniqueKey]?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase()) return;

        // Get credentials based on credential option
        let authMode: string;
        let username: string;
        let password: string;
        let ssmParameterArn: string;

        if (credentialOption === CREDENTIAL_OPTIONS.SAME_FOR_ALL) {
            authMode = bulkInstanceCredentials.authMode?.value || '';
            username = bulkInstanceCredentials.username || '';
            password = bulkInstanceCredentials.password || '';
            ssmParameterArn = bulkInstanceCredentials.ssmParameterArn || '';
        } else {
            // MANUAL mode - get per-instance credentials using uniqueKey
            const creds = instanceCredentials[uniqueKey];
            authMode = creds?.authMode?.value || '';
            username = creds?.username || '';
            password = creds?.password || '';
            ssmParameterArn = creds?.ssmParameterArn || '';
        }

        // Determine resource type based on auth mode
        const isSqlAuth = authMode === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION;
        const resourceType = isSqlAuth ? DETECT_HOST_VAR.MSSQL : DETECT_HOST_VAR.WINDOWS;

        let credential: BulkCredentialItem;

        if (isGovAccount) {
            if (!ssmParameterArn) return;
            credential = {
                resourceId: instanceId,
                resourceType,
                ssmParameterArn
            };
        } else {
            if (!username || !password) return;
            credential = {
                resourceId: instanceId,
                resourceType,
                username,
                password
            };
        }

        // If already present, merge credentials arrays
        if (instanceMap[ec2InstanceId]) {
            // Avoid duplicate resourceId/resourceType combos
            const existing = instanceMap[ec2InstanceId].credentials;
            if (
                !existing.some(
                    e => e.resourceId === credential.resourceId && e.resourceType === credential.resourceType
                )
            ) {
                existing.push(credential);
            }
        } else {
            instanceMap[ec2InstanceId] = {
                credentials: [credential],
                ec2InstanceId,
                region: instanceData?.regionId || instance.region || '',
                credentialsId: instanceData?.credentialId || instance.credentialsId || '',
                checkManageReadiness: true
            };
        }
    });

    return Object.values(instanceMap);
};

/**
 * Validate bulk instance credentials before API call
 * @param selectedInstances - Array of selected instances
 * @param credentialOption - SAME_FOR_ALL or MANUAL
 * @param bulkInstanceCredentials - Credentials for SAME_FOR_ALL mode
 * @param instanceCredentials - Per-instance credentials for MANUAL mode
 * @param instanceAuthStatus - Current auth status
 * @param hostType - The host type (MSSQL, ORACLE, etc.)
 * @returns Validation result with isValid flag and error message
 */
export const validateBulkInstanceCredentials = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    credentialOption: string,
    bulkInstanceCredentials: {
        authMode: { value: string };
        username: string;
        password: string;
        ssmParameterArn?: string;
    },
    instanceCredentials: Record<
        string,
        { authMode: { value: string }; username: string; password: string; ssmParameterArn?: string }
    >,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    hostType: string = DBType.MSSQL,
    isGovAccount: boolean = false
): { isValid: boolean; errorMessage: string } => {
    if (!selectedInstances || selectedInstances.length === 0) {
        return { isValid: false, errorMessage: 'No instances selected' };
    }

    const instancesNeedingAuth = selectedInstances.filter(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);

        if (!isAuthRequiredForInstance(instanceData, hostType)) return false;
        if (instanceAuthStatus?.[uniqueKey]?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase()) return false;

        return true;
    });

    if (instancesNeedingAuth.length === 0) {
        return { isValid: true, errorMessage: '' };
    }

    if (credentialOption === CREDENTIAL_OPTIONS.SAME_FOR_ALL) {
        if (isGovAccount) {
            if (!isValidSsmArn(bulkInstanceCredentials.ssmParameterArn || '')) {
                return {
                    isValid: false,
                    errorMessage: i18next.t('databases.register-flow.ssm-parameter-arn-required')
                };
            }
        } else if (!bulkInstanceCredentials.username || !bulkInstanceCredentials.password) {
            return { isValid: false, errorMessage: 'Please enter username and password' };
        }
    } else {
        for (const instance of instancesNeedingAuth) {
            const instanceData = instance.data || instance;
            const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
            const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
            const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);
            const creds = instanceCredentials[uniqueKey];

            if (isGovAccount) {
                if (!isValidSsmArn(creds?.ssmParameterArn || '')) {
                    return {
                        isValid: false,
                        errorMessage: i18next.t('databases.register-flow.ssm-parameter-arn-required-for', {
                            instanceId
                        })
                    };
                }
            } else if (!creds?.username || !creds?.password) {
                return { isValid: false, errorMessage: `Please enter credentials for ${instanceId}` };
            }
        }
    }

    return { isValid: true, errorMessage: '' };
};

/**
 * Oracle bulk credentials interface
 */
export interface OracleBulkCredentials {
    oracleUsername: string;
    oraclePassword: string;
    ssmParameterArn?: string;
}

/**
 * Oracle instance credentials interface for manual mode
 */
export interface OracleInstanceCredentials {
    username: string;
    password: string;
    ssmParameterArn?: string;
}

/**
 * Create bulk authentication payload for Oracle databases
 * Groups credentials by ec2InstanceId for efficient API calls
 * @param selectedInstances - Array of selected instances
 * @param credentialOption - SAME_FOR_ALL or MANUAL
 * @param oracleBulkDatabaseCredentials - Credentials for SAME_FOR_ALL mode
 * @param instanceCredentials - Per-instance credentials for MANUAL mode
 * @param instanceAuthStatus - Current auth status to skip already authenticated instances
 * @returns Array of payload items for the bulk registration API
 */
export const createOracleBulkAuthPayload = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    credentialOption: string,
    oracleBulkDatabaseCredentials: OracleBulkCredentials,
    instanceCredentials: Record<string, OracleInstanceCredentials>,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    isGovAccount: boolean = false
): BulkAuthPayloadItem[] => {
    if (!selectedInstances || !Array.isArray(selectedInstances)) return [];

    // Group instances by ec2InstanceId for efficient API calls
    const instanceMap: Record<string, BulkAuthPayloadItem> = {};

    selectedInstances.forEach(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';

        if (!ec2InstanceId || !instanceId) return;

        // Generate unique key for credential lookup
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);

        // Skip instances that don't need authentication
        if (!isAuthRequiredForInstance(instanceData, DBType.ORACLE)) return;

        // Skip instances that are already successfully authenticated in wizard
        if (instanceAuthStatus?.[uniqueKey]?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase()) return;

        // Get credentials based on credential option
        let username: string;
        let password: string;
        let ssmParameterArn: string;

        if (credentialOption === CREDENTIAL_OPTIONS.SAME_FOR_ALL) {
            username = oracleBulkDatabaseCredentials.oracleUsername || '';
            password = oracleBulkDatabaseCredentials.oraclePassword || '';
            ssmParameterArn = oracleBulkDatabaseCredentials.ssmParameterArn || '';
        } else {
            // MANUAL mode - get per-instance credentials using uniqueKey
            const creds = instanceCredentials[uniqueKey];
            username = creds?.username || '';
            password = creds?.password || '';
            ssmParameterArn = creds?.ssmParameterArn || '';
        }

        let oracleCredential: BulkCredentialItem;

        if (isGovAccount) {
            if (!ssmParameterArn) return;
            oracleCredential = {
                resourceId: instanceId,
                resourceType: DETECT_HOST_VAR.ORACLE,
                ssmParameterArn
            };
        } else {
            if (!username || !password) return;
            oracleCredential = {
                resourceId: instanceId,
                resourceType: DETECT_HOST_VAR.ORACLE,
                username,
                password
            };
        }

        const credentials: BulkCredentialItem[] = [oracleCredential];

        // If already present, merge credentials arrays
        if (instanceMap[ec2InstanceId]) {
            const existing = instanceMap[ec2InstanceId].credentials;
            credentials.forEach(cred => {
                // Avoid duplicate resourceId/resourceType combos
                if (!existing.some(e => e.resourceId === cred.resourceId && e.resourceType === cred.resourceType)) {
                    existing.push(cred);
                }
            });
        } else {
            instanceMap[ec2InstanceId] = {
                credentials,
                ec2InstanceId,
                region: instanceData?.regionId || instance.region || '',
                credentialsId: instanceData?.credentialId || instance.credentialsId || '',
                checkManageReadiness: true
            };
        }
    });

    return Object.values(instanceMap);
};

/**
 * Validate Oracle bulk instance credentials before API call
 * @param selectedInstances - Array of selected instances
 * @param credentialOption - SAME_FOR_ALL or MANUAL
 * @param oracleBulkDatabaseCredentials - Credentials for SAME_FOR_ALL mode
 * @param instanceCredentials - Per-instance credentials for MANUAL mode
 * @param instanceAuthStatus - Current auth status
 * @returns Validation result with isValid flag and error message
 */
export const validateOracleBulkInstanceCredentials = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    credentialOption: string,
    oracleBulkDatabaseCredentials: OracleBulkCredentials,
    instanceCredentials: Record<string, OracleInstanceCredentials>,
    instanceAuthStatus: InstanceAuthStatusMap | undefined,
    isGovAccount: boolean = false
): { isValid: boolean; errorMessage: string } => {
    if (!selectedInstances || selectedInstances.length === 0) {
        return { isValid: false, errorMessage: 'No databases selected' };
    }

    const instancesNeedingAuth = selectedInstances.filter(instance => {
        const instanceData = instance.data || instance;
        const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
        const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
        const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);

        if (!isAuthRequiredForInstance(instanceData, DBType.ORACLE)) return false;
        if (instanceAuthStatus?.[uniqueKey]?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase()) return false;

        return true;
    });

    if (instancesNeedingAuth.length === 0) {
        return { isValid: true, errorMessage: '' };
    }

    if (credentialOption === CREDENTIAL_OPTIONS.SAME_FOR_ALL) {
        if (isGovAccount) {
            if (!isValidSsmArn(oracleBulkDatabaseCredentials.ssmParameterArn || '')) {
                return {
                    isValid: false,
                    errorMessage: i18next.t('databases.register-flow.ssm-parameter-arn-required')
                };
            }
        } else if (!oracleBulkDatabaseCredentials.oracleUsername || !oracleBulkDatabaseCredentials.oraclePassword) {
            return { isValid: false, errorMessage: 'Please enter Oracle username and password' };
        }
    } else {
        for (const instance of instancesNeedingAuth) {
            const instanceData = instance.data || instance;
            const instanceId = instanceData?.databaseInstanceName || instance.databaseInstanceName || '';
            const ec2InstanceId = instanceData?.ec2InstanceId || instance.ec2InstanceId || '';
            const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);
            const creds = instanceCredentials[uniqueKey];

            if (isGovAccount) {
                if (!isValidSsmArn(creds?.ssmParameterArn || '')) {
                    return {
                        isValid: false,
                        errorMessage: i18next.t('databases.register-flow.ssm-parameter-arn-required-for', {
                            instanceId
                        })
                    };
                }
            } else if (!creds?.username || !creds?.password) {
                return { isValid: false, errorMessage: `Please enter Oracle credentials for ${instanceId}` };
            }
        }
    }

    return { isValid: true, errorMessage: '' };
};
