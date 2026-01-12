import { DETECT_HOST_VAR } from '../../../../../utils/consts';
import { FsxAuthStatusMap } from '../../../../../utils/types/inventoryV2Types';

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

// Check if all FSx in storage are authenticated
export const areAllFsxAuthenticated = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined
): boolean => {
    const allFsx = getAllFsxFromStorage(storage);

    // If no FSx in storage, consider it as authenticated
    if (allFsx.length === 0) return true;

    // Check if all FSx IDs are registered in fsxCredentialStatusObj
    return allFsx.every(fsx => {
        const statusObj = fsxCredentialStatusObj?.[fsx.fsxId];
        return statusObj === true;
    });
};

/**
 * Check if we have partial success to disable radio buttons
 * Partial success means: some FSx authenticated and some FSx failed
 */
export const hasPartialAuthSuccess = (
    storage: StorageItem[] | undefined,
    fsxCredentialStatusObj: Record<string, boolean> | undefined,
    fsxAuthStatus: FsxAuthStatusMap | undefined
): boolean => {
    const allFsx = getAllFsxFromStorage(storage);
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
