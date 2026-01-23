import { useMemo } from 'react';
import { DBType, DETECT_HOST_VAR, ACTION_TYPE } from '../../../../../utils/consts';
import {
    DiscoverHostInterface,
    DiscoverOracleHostInterface,
    FsxAuthStatusMap,
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

    // Build instance identifiers for single mode discover data lookup (including fsxId fallback)
    const instanceIdentifiers: InstanceIdentifiers | undefined = useMemo(() => {
        if (isBulkMode || !manageSingleInstanceData) return undefined;
        return {
            ec2InstanceId: manageSingleInstanceData.ec2InstanceId,
            databaseInstanceName: manageSingleInstanceData.databaseInstanceName,
            credentialId: manageSingleInstanceData.credentialId,
            regionId: manageSingleInstanceData.regionId,
            hostType: manageSingleInstanceData.hostType,
            fsxId: manageSingleInstanceData.fsxId // Direct fsxId fallback
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
// Falls back to discover data, then to direct fsxId from instance data
export const getAllFsxFromStorage = (
    storage: StorageItem[] | undefined,
    instanceIdentifiers?: InstanceIdentifiers,
    discoverContext?: DiscoverDataContext
): FsxItem[] => {
    let effectiveStorage = storage;

    // If storage is missing or empty, try to get it from discover data
    if ((!effectiveStorage || effectiveStorage.length === 0) && instanceIdentifiers && discoverContext) {
        effectiveStorage = getStorageFromDiscoverData(instanceIdentifiers, discoverContext);
    }

    // Extract FSx from storage if available
    const fsxFromStorage: FsxItem[] = [];
    if (effectiveStorage && Array.isArray(effectiveStorage)) {
        effectiveStorage
            .filter(item => item.type === DETECT_HOST_VAR.FSXN && item.id)
            .forEach(item => {
                fsxFromStorage.push({
                    fsxId: item.id,
                    fsxName: item.id
                });
            });
    }

    // If no FSx found from storage/discover, use direct fsxId from instance data as fallback
    if (fsxFromStorage.length === 0 && instanceIdentifiers?.fsxId) {
        return [
            {
                fsxId: instanceIdentifiers.fsxId,
                fsxName: instanceIdentifiers.fsxId
            }
        ];
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

        // Build instance identifiers for discover data lookup (including fsxId fallback)
        const instanceIdentifiers: InstanceIdentifiers = {
            ec2InstanceId: instance.data?.ec2InstanceId || instance.ec2InstanceId,
            databaseInstanceName: instance.data?.databaseInstanceName || instance.databaseInstanceName,
            credentialId: instance.data?.credentialId || instance.credentialsId,
            regionId: instance.data?.regionId || instance.region,
            hostType: instance.data?.hostType,
            fsxId: instance.data?.fsxId || instance.fsxId // Direct fsxId fallback
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

    const failedCount = needAuthFsxIds.filter(id => fsxAuthStatus?.[id] === 'failed').length;

    // First landing - no attempts yet (no failures), Enable radio buttons
    if (failedCount === 0) return false;

    // ALL FSx that need authentication have failed, Enable radio buttons
    if (failedCount === needAuthFsxIds.length) return false;

    // Partial success - some FSx authenticated (needAuth < total), some still need auth and have failed
    // This is the ONLY case where we disable radio buttons
    const authenticatedCount = allFsxIds.length - needAuthFsxIds.length;
    return authenticatedCount > 0 && failedCount > 0;
};
