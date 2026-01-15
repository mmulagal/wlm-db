import { DETECT_HOST_VAR } from '../../../../../utils/consts';
import { FsxAuthStatusMap } from '../../../../../utils/types/inventoryV2Types';
import { BulkDetectedInstance } from '../../../../../utils/types/registerTypes';

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

// Extract FSx list from storage array - returns all FSXN type items
export const getAllFsxFromStorage = (storage: StorageItem[] | undefined): FsxItem[] => {
    if (!storage || !Array.isArray(storage)) return [];
    return storage
        .filter(item => item.type === DETECT_HOST_VAR.FSXN && item.id)
        .map(item => ({
            fsxId: item.id,
            fsxName: item.id
        }));
};

/**
 * Get all unique FSx from multiple instances' storage (for bulk mode)
 * Aggregates FSx from all selected instances and deduplicates by fsxId
 * @param selectedInstances - Array of selected instances from bulk flow
 * @returns Array of unique FSx items
 */
export const getAllFsxFromBulkStorage = (selectedInstances: BulkDetectedInstance[] | undefined): FsxItem[] => {
    if (!selectedInstances || !Array.isArray(selectedInstances)) return [];

    const allFsx: FsxItem[] = [];
    const seenIds = new Set<string>();

    selectedInstances.forEach(instance => {
        const storage = instance.data?.storage || instance.storage;
        const instanceFsx = getAllFsxFromStorage(storage);
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
 * @returns Array of unique FSx items that need authentication
 */
export const getFsxNeedingAuthFromBulk = (
    selectedInstances: BulkDetectedInstance[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined
): FsxItem[] => {
    const allFsx = getAllFsxFromBulkStorage(selectedInstances);
    return allFsx.filter(fsx => fsxCredentialStatusObj?.[fsx.fsxId] !== true);
};

/**
 * Extract FSx list from storage array that need authentication
 * Filters out already registered/authenticated FSx
 */
export const getFsxNeedingAuth = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined
): FsxItem[] => {
    if (!storage || !Array.isArray(storage)) return [];
    return storage
        .filter(item => {
            if (item.type !== DETECT_HOST_VAR.FSXN || !item.id) return false;
            // Exclude already registered FSx
            const statusObj = fsxCredentialStatusObj?.[item.id];
            return statusObj !== true;
        })
        .map(item => ({
            fsxId: item.id,
            fsxName: item.id
        }));
};

/**
 * Check if all FSx in storage are authenticated
 * Works for both single and bulk mode
 * @param storage - Storage array (for single mode)
 * @param fsxCredentialStatusObj - Map of FSx IDs to credential status
 * @param isBulkMode - Whether in bulk mode
 * @param selectedInstances - Array of selected instances (for bulk mode)
 */
export const areAllFsxAuthenticated = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined,
    isBulkMode?: boolean,
    selectedInstances?: BulkDetectedInstance[]
): boolean => {
    const allFsx = isBulkMode ? getAllFsxFromBulkStorage(selectedInstances) : getAllFsxFromStorage(storage);

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
 */
export const hasPartialAuthSuccess = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined,
    fsxAuthStatus: FsxAuthStatusMap | undefined,
    isBulkMode?: boolean,
    selectedInstances?: BulkDetectedInstance[]
): boolean => {
    const allFsx = isBulkMode ? getAllFsxFromBulkStorage(selectedInstances) : getAllFsxFromStorage(storage);

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
