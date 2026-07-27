/** Shared InventoryUtilsV2 mock exports for vitest partial mocks. */
export const mockHasFullPermission = (hostManageReadiness?: { extensiveRunPermission?: boolean }) =>
    hostManageReadiness?.extensiveRunPermission === true;
