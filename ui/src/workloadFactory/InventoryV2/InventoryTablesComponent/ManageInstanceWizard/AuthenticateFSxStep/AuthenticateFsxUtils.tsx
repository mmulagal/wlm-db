import { useMemo } from 'react';
import { DBType, DETECT_HOST_VAR, ACTION_TYPE, INVENTORY_STATUS, FSX_AUTH_STATUS } from '../../../../../utils/consts';
import {
    DiscoverHostInterface,
    DiscoverOracleHostInterface,
    FsxAuthStatusMap,
    InventorySliceData,
    SQLServerInstancesDiscovered,
    OracleInstancesDiscovered
} from '../../../../../utils/types/inventoryV2Types';
import { BulkDetectedInstance } from '../../../../../utils/types/registerTypes';
import { useAppSelector } from '../../../../../store/storeHooks';

// Storage item interface from discover API
export interface StorageItem {
    type: string;
    id: string;
    svmId?: string;
    protocol?: string;
    name?: string; // FSx name if available (MSSQL / pgsql discover)
    fileSystemName?: string; // FSx name as returned by Oracle discover
}

// FSx item interface with formatted fields
export interface FsxItem {
    fsxId: string;
    fsxName: string;
}

// Discover data context for looking up storage when it's missing
export interface DiscoverDataContext {
    discoveredHostData?: DiscoverHostInterface[] | null;
    discoveredOracleHostData?: DiscoverOracleHostInterface[] | null;
}

// Instance identifiers for looking up in discover data
export interface InstanceIdentifiers {
    ec2InstanceId?: string;
    databaseInstanceName?: string;
    credentialId?: string;
    regionId?: string;
    hostType?: string;
    fsxId?: string; // Direct fsxId from instance data (fallback when storage/discover is missing)
    fileSystemName?: string; // FSx name from instance data (for display)
}

// Return type for the custom hook
export interface FsxDiscoverContextResult {
    discoverContext: DiscoverDataContext;
    instanceIdentifiers: InstanceIdentifiers | undefined;
    isBulkMode: boolean;
    manageSingleInstanceData: any;
    selectedMultiDetectInstances: BulkDetectedInstance[];
}

/**
 * Returns the engine-specific FSx credential status object from inventoryV2 state.
 * Each engine (MSSQL, Oracle, PostgreSQL) maintains its own FSx credential tracking
 * because discovery flows run independently per engine.
 */
export const getFsxCredStatusByEngine = (
    inventoryV2State: Pick<
        InventorySliceData,
        'fsxCredentialStatusObj' | 'fsxCredentialStatusObjOracle' | 'fsxCredentialStatusObjPgsql'
    >,
    engineType?: string
): Record<string, boolean> => {
    switch (engineType) {
        case 'oracle':
        case DBType.ORACLE:
            return (inventoryV2State.fsxCredentialStatusObjOracle as Record<string, boolean>) || {};
        case 'pgsql':
        case DBType.POSTGRESQL:
            return (inventoryV2State.fsxCredentialStatusObjPgsql as Record<string, boolean>) || {};
        case 'mssql':
        case DBType.MSSQL:
        default:
            return (inventoryV2State.fsxCredentialStatusObj as Record<string, boolean>) || {};
    }
};

/**
 * Custom hook to build discover data context and instance identifiers for FSx lookups.
 * Consolidates the common logic used across FSx authentication components.
 * @returns Object containing discoverContext, instanceIdentifiers, isBulkMode, and instance data
 */
export const useFsxDiscoverContext = (): FsxDiscoverContextResult => {
    const { manageSingleInstanceData, selectedMultiDetectInstances, wizardOperationType } = useAppSelector(
        state => state.inventoryV2
    );
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const { discoveredOracleHostData } = useAppSelector(state => state.inventoryV2.discoveredOracleHosts);

    const isBulkMode = wizardOperationType === ACTION_TYPE.BULK;

    // Build discover data context for fallback lookup when storage is missing
    const discoverContext: DiscoverDataContext = useMemo(
        () => ({
            discoveredHostData,
            discoveredOracleHostData
        }),
        [discoveredHostData, discoveredOracleHostData]
    );

    // Build instance identifiers for single mode discover data lookup
    const instanceIdentifiers: InstanceIdentifiers | undefined = useMemo(() => {
        if (isBulkMode || !manageSingleInstanceData) return undefined;

        // Normalise: INVENTORY_STATUS.NOT_AVAILABLE ('n/a') is a display-only placeholder set by
        // formatInstanceData when no real FSx name is known. Passing it into instanceIdentifiers
        // would cause getAllFsxFromStorage to use 'n/a' as the FSx card title in the wizard.
        // Coercing it to undefined lets the name fallback chain use either the storage item's
        // own fileSystemName/name field, or the fsxId as a last resort.
        const fileSystemName: string | undefined =
            manageSingleInstanceData.fileSystemName &&
            manageSingleInstanceData.fileSystemName !== INVENTORY_STATUS.NOT_AVAILABLE
                ? manageSingleInstanceData.fileSystemName
                : undefined;

        return {
            ec2InstanceId: manageSingleInstanceData.ec2InstanceId,
            databaseInstanceName: manageSingleInstanceData.databaseInstanceName,
            credentialId: manageSingleInstanceData.credentialId,
            regionId: manageSingleInstanceData.regionId,
            hostType: manageSingleInstanceData.hostType,
            fsxId: manageSingleInstanceData.fsxId,
            fileSystemName
        };
    }, [isBulkMode, manageSingleInstanceData]);

    return {
        discoverContext,
        instanceIdentifiers,
        isBulkMode,
        manageSingleInstanceData,
        selectedMultiDetectInstances: selectedMultiDetectInstances || []
    };
};

/**
 * Look up storage from discover data for a specific instance
 * This is used when storage is missing from the instance data (partial manage case, AOAG, etc.)
 * @param identifiers - Instance identifiers to match
 * @param discoverContext - Discover data from Redux state
 * @returns Storage array from the discovered instance, or undefined if not found
 */
export const getStorageFromDiscoverData = (
    identifiers: InstanceIdentifiers,
    discoverContext: DiscoverDataContext
): StorageItem[] | undefined => {
    const { ec2InstanceId, databaseInstanceName, credentialId, regionId, hostType } = identifiers;

    if (!ec2InstanceId || !databaseInstanceName) return undefined;

    if (hostType === DBType.ORACLE) {
        // Look up in Oracle discover data
        const oracleHost = discoverContext.discoveredOracleHostData?.find(
            (host: DiscoverOracleHostInterface) =>
                host.ec2InstanceId === ec2InstanceId && host.credentialId === credentialId && host.regionId === regionId
        );
        if (oracleHost) {
            const dbInstance = oracleHost.databaseInstanceDetails?.find(
                (inst: OracleInstancesDiscovered) => inst.instanceName === databaseInstanceName
            );
            return dbInstance?.storage as StorageItem[] | undefined;
        }
    } else {
        // Default to MSSQL - look up in MSSQL discover data
        const mssqlHost = discoverContext.discoveredHostData?.find(
            (host: DiscoverHostInterface) =>
                host.ec2InstanceId === ec2InstanceId && host.credentialId === credentialId && host.regionId === regionId
        );
        if (mssqlHost) {
            const sqlInstance = mssqlHost.sqlServerInstances?.find(
                (inst: SQLServerInstancesDiscovered) =>
                    inst.sqlServerInstance === databaseInstanceName || inst.sqlServerName === databaseInstanceName
            );
            return sqlInstance?.storage as StorageItem[] | undefined;
        }
    }

    return undefined;
};

// Extract FSx list from storage array - returns all FSXN type items
// Also includes direct fsxId from instance data to get all related FSx
export const getAllFsxFromStorage = (
    storage: StorageItem[] | undefined,
    instanceIdentifiers?: InstanceIdentifiers,
    discoverContext?: DiscoverDataContext
): FsxItem[] => {
    let effectiveStorage = storage;

    // If storage is missing, empty, or not in StorageItem[] array format (e.g. {fsxn:{...}} summary format
    // from databaseInstancesSummary), try to get it from discover data
    if (
        (!effectiveStorage || !Array.isArray(effectiveStorage) || effectiveStorage.length === 0) &&
        instanceIdentifiers &&
        discoverContext
    ) {
        effectiveStorage = getStorageFromDiscoverData(instanceIdentifiers, discoverContext);
    }

    // Use a Set to track unique FSx IDs
    const seenFsxIds = new Set<string>();
    const fsxFromStorage: FsxItem[] = [];

    // Extract FSx from storage if available
    if (effectiveStorage && Array.isArray(effectiveStorage)) {
        const fsxnItems = effectiveStorage.filter(item => item.type === DETECT_HOST_VAR.FSXN && item.id);
        fsxnItems.forEach(item => {
            if (!seenFsxIds.has(item.id)) {
                seenFsxIds.add(item.id);
                // Try to get name from storage item first (both 'name' and Oracle's 'fileSystemName'),
                // then fall back to instanceIdentifiers when there is only one FSx.
                let fsxName = item.fileSystemName || item.name;
                if (!fsxName && fsxnItems.length === 1 && instanceIdentifiers?.fileSystemName) {
                    fsxName = instanceIdentifiers.fileSystemName;
                }
                fsxFromStorage.push({
                    fsxId: item.id,
                    fsxName: fsxName || item.id // Fall back to id if name not available
                });
            }
        });
    }

    // Also add direct fsxId from instance data
    if (instanceIdentifiers?.fsxId && !seenFsxIds.has(instanceIdentifiers.fsxId)) {
        fsxFromStorage.push({
            fsxId: instanceIdentifiers.fsxId,
            fsxName: instanceIdentifiers.fileSystemName || instanceIdentifiers.fsxId
        });
    }

    return fsxFromStorage;
};

/**
 * Get all unique FSx from multiple instances' storage (for bulk mode)
 * Aggregates FSx from all selected instances and deduplicates by fsxId
 * Falls back to discover data when storage is missing (partial manage case, AOAG, etc.)
 * @param selectedInstances - Array of selected instances from bulk flow
 * @param discoverContext - Optional discover data for fallback lookup
 * @returns Array of unique FSx items
 */
export const getAllFsxFromBulkStorage = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    discoverContext?: DiscoverDataContext
): FsxItem[] => {
    if (!selectedInstances || !Array.isArray(selectedInstances)) return [];

    const allFsx: FsxItem[] = [];
    const seenIds = new Set<string>();

    selectedInstances.forEach(instance => {
        const storage = instance.data?.storage || instance.storage;

        // Build instance identifiers for discover data lookup (including fsxId and fileSystemName fallback)
        const rawFileSystemName = instance.data?.fileSystemName || instance.fileSystemName;
        const instanceIdentifiers: InstanceIdentifiers = {
            ec2InstanceId: instance.data?.ec2InstanceId || instance.ec2InstanceId,
            databaseInstanceName: instance.data?.databaseInstanceName || instance.databaseInstanceName,
            credentialId: instance.data?.credentialId || instance.credentialsId,
            regionId: instance.data?.regionId || instance.region,
            hostType: instance.data?.hostType,
            fsxId: instance.data?.fsxId || instance.fsxId,
            // Same normalisation as in useFsxDiscoverContext: strip the 'n/a' placeholder
            // so the wizard FSx card falls back to the storage item's name or the fsxId
            fileSystemName:
                rawFileSystemName && rawFileSystemName !== INVENTORY_STATUS.NOT_AVAILABLE
                    ? rawFileSystemName
                    : undefined
        };

        const instanceFsx = getAllFsxFromStorage(storage, instanceIdentifiers, discoverContext);
        instanceFsx.forEach(fsx => {
            if (!seenIds.has(fsx.fsxId)) {
                seenIds.add(fsx.fsxId);
                allFsx.push(fsx);
            }
        });
    });

    return allFsx;
};

/**
 * Get FSx needing auth from multiple instances' storage (for bulk mode)
 * @param selectedInstances - Array of selected instances from bulk flow
 * @param fsxCredentialStatusObj - Map of FSx IDs to credential status
 * @param discoverContext - Optional discover data for fallback lookup
 * @returns Array of unique FSx items that need authentication
 */
export const getFsxNeedingAuthFromBulk = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined,
    discoverContext?: DiscoverDataContext
): FsxItem[] => {
    const allFsx = getAllFsxFromBulkStorage(selectedInstances, discoverContext);
    return allFsx.filter(fsx => fsxCredentialStatusObj?.[fsx.fsxId] !== true);
};

/**
 * Extract FSx list from storage array that need authentication
 * Filters out already registered/authenticated FSx
 * @param storage - Storage array
 * @param fsxCredentialStatusObj - Map of FSx IDs to credential status
 * @param instanceIdentifiers - Optional instance identifiers for discover data lookup
 * @param discoverContext - Optional discover data for fallback lookup
 */
export const getFsxNeedingAuth = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined,
    instanceIdentifiers?: InstanceIdentifiers,
    discoverContext?: DiscoverDataContext
): FsxItem[] => {
    const allFsx = getAllFsxFromStorage(storage, instanceIdentifiers, discoverContext);
    return allFsx.filter(fsx => fsxCredentialStatusObj?.[fsx.fsxId] !== true);
};

/**
 * Check if all FSx in storage are authenticated
 * Works for both single and bulk mode
 * @param storage - Storage array (for single mode)
 * @param fsxCredentialStatusObj - Map of FSx IDs to credential status
 * @param isBulkMode - Whether in bulk mode
 * @param selectedInstances - Array of selected instances (for bulk mode)
 * @param instanceIdentifiers - Optional instance identifiers for discover data lookup (single mode)
 * @param discoverContext - Optional discover data for fallback lookup
 */
export const areAllFsxAuthenticated = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined,
    isBulkMode?: boolean,
    selectedInstances?: BulkDetectedInstance[],
    instanceIdentifiers?: InstanceIdentifiers,
    discoverContext?: DiscoverDataContext
): boolean => {
    const allFsx = isBulkMode
        ? getAllFsxFromBulkStorage(selectedInstances, discoverContext)
        : getAllFsxFromStorage(storage, instanceIdentifiers, discoverContext);

    // If no FSx in storage, consider it as authenticated
    if (allFsx.length === 0) return true;

    // Check if all FSx IDs are registered in fsxCredentialStatusObj
    return allFsx.every(fsx => fsxCredentialStatusObj?.[fsx.fsxId] === true);
};

/**
 * Check if we have partial success to disable radio buttons
 * Works for both single and bulk mode
 * Partial success means: some FSx authenticated and some FSx failed
 * @param storage - Storage array (for single mode)
 * @param fsxCredentialStatusObj - Map of FSx IDs to credential status
 * @param fsxAuthStatus - Map of FSx IDs to auth status
 * @param isBulkMode - Whether in bulk mode
 * @param selectedInstances - Array of selected instances (for bulk mode)
 * @param instanceIdentifiers - Optional instance identifiers for discover data lookup (single mode)
 * @param discoverContext - Optional discover data for fallback lookup
 */
export const hasPartialAuthSuccess = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined,
    fsxAuthStatus: FsxAuthStatusMap | undefined,
    isBulkMode?: boolean,
    selectedInstances?: BulkDetectedInstance[],
    instanceIdentifiers?: InstanceIdentifiers,
    discoverContext?: DiscoverDataContext
): boolean => {
    const allFsx = isBulkMode
        ? getAllFsxFromBulkStorage(selectedInstances, discoverContext)
        : getAllFsxFromStorage(storage, instanceIdentifiers, discoverContext);

    if (allFsx.length === 0) return false;

    const allFsxIds = allFsx.map(fsx => fsx.fsxId);
    const needAuthFsxIds = allFsxIds.filter(id => fsxCredentialStatusObj?.[id] !== true);

    if (needAuthFsxIds.length === 0) return false;

    const failedCount = needAuthFsxIds.filter(id => fsxAuthStatus?.[id] === FSX_AUTH_STATUS.FAILED).length;

    // First landing - no attempts yet (no failures), Enable radio buttons
    if (failedCount === 0) return false;

    // Count successful authentications in this session
    const successCount = allFsxIds.filter(id => fsxAuthStatus?.[id] === FSX_AUTH_STATUS.SUCCESS).length;

    // Partial success - some FSx authenticated and some FSx failed
    // This is the case where we disable radio buttons
    if (successCount > 0 && failedCount > 0) return true;

    // ALL FSx that need authentication have failed (and none succeeded in this session)
    // Enable radio buttons so user can retry with different credentials
    if (failedCount === needAuthFsxIds.length) return false;

    return false;
};
