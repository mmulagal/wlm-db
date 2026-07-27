import { describe, it, expect } from 'vitest';
import { INVENTORY_STATUS, DBType, STORAGE_TYPES } from '../../../../utils/consts';
import { getRegistrationRequiresFullPermissionMessageKey } from '../../InventoryUtilsV2';

/**
 * Tests for Register menu option logic in InstancesTable.tsx side menu
 *
 * The Register option appears for UNMANAGED/UNDETECTED instances (excluding WAD)
 * and uses:
 * 1. manageActionCol for storage and standard checks
 * 2. FSx link existence check
 * 3. Full permission check
 */
describe('Register Menu Option Logic', () => {
    // Mock hasFullPermission function
    const hasFullPermission = (hostManageReadiness: any) => hostManageReadiness?.extensiveRunPermission === true;

    // Mock manageActionCol function (simplified for testing)
    const manageActionCol = (engineType: string, rowData: any) => {
        let disableMsg = '';

        // Check for storage
        if (
            (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
                rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) &&
            rowData?.fileSystemType !== STORAGE_TYPES.FSX_FOR_ONTAP &&
            !rowData?.fsxId
        ) {
            disableMsg =
                engineType === DBType.ORACLE
                    ? 'databases.bulk-register.fsxn-manage-supported-oracle'
                    : 'databases.bulk-register.fsxn-manage-supported';
        }

        // Check for host/SSM status
        if (rowData?.status === 'Offline') {
            disableMsg = 'Host is down';
        }

        if (rowData?.ssmState === 'Offline') {
            disableMsg = 'SSM is down';
        }

        // Check for detectOption
        if (rowData?.detectOption === 'disable' && rowData?.detectOptionDisableMsg) {
            disableMsg = rowData.detectOptionDisableMsg;
        }

        return { disableMsg };
    };

    describe('Register option visibility', () => {
        it('shows Register for UNMANAGED instances', () => {
            const rowData = { statusColText: INVENTORY_STATUS.UNMANAGED };
            const isNotRegistered =
                (rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                    rowData.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                !rowData?.isWad;

            expect(isNotRegistered).toBe(true);
        });

        it('shows Register for UNDETECTED instances', () => {
            const rowData = { statusColText: INVENTORY_STATUS.UNDETECTED };
            const isNotRegistered =
                (rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                    rowData.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                !rowData?.isWad;

            expect(isNotRegistered).toBe(true);
        });

        it('hides Register for MANAGED instances', () => {
            const rowData = { statusColText: INVENTORY_STATUS.MANAGED };
            const isNotRegistered =
                (rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                    rowData.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                !rowData?.isWad;

            expect(isNotRegistered).toBe(false);
        });

        it('hides Register for WAD instances even if UNMANAGED', () => {
            const rowData = { statusColText: INVENTORY_STATUS.UNMANAGED, isWad: true };
            const isNotRegistered =
                (rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                    rowData.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                !rowData?.isWad;

            expect(isNotRegistered).toBe(false);
        });

        it('hides Register for WAD instances even if UNDETECTED', () => {
            const rowData = { statusColText: INVENTORY_STATUS.UNDETECTED, isWad: true };
            const isNotRegistered =
                (rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                    rowData.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                !rowData?.isWad;

            expect(isNotRegistered).toBe(false);
        });
    });

    describe('Register option disabled state - storage checks', () => {
        it('disables Register when storage is missing (empty storage array)', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: '',
                fsxId: null,
                storage: [],
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const isDisabled = !!disableMsg || fsxLinkMissing || lacksPermission;

            expect(isDisabled).toBe(true);
            expect(disableMsg).toBe('databases.bulk-register.fsxn-manage-supported');
        });

        it('disables Register when fileSystemType is not FSx for ONTAP', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: 'EBS',
                fsxId: null,
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const isDisabled = !!disableMsg;

            expect(isDisabled).toBe(true);
            expect(disableMsg).toBe('databases.bulk-register.fsxn-manage-supported');
        });

        it('enables Register when fileSystemType is FSx for ONTAP', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                fsxId: 'fs-12345',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const isDisabled = !!disableMsg || fsxLinkMissing || lacksPermission;

            expect(isDisabled).toBe(false);
        });

        it('enables Register when fsxId is present', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: '',
                fsxId: 'fs-67890',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const isDisabled = !!disableMsg || fsxLinkMissing || lacksPermission;

            expect(isDisabled).toBe(false);
        });
    });

    describe('Register option disabled state - permission checks', () => {
        it('disables Register when lacking full permission', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                fsxId: 'fs-12345',
                hostManageReadiness: {
                    extensiveRunPermission: false,
                    canReadAWSSSMDocuments: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const isDisabled = !!disableMsg || lacksPermission;

            expect(isDisabled).toBe(true);
            expect(lacksPermission).toBe(true);
        });

        it('enables Register with full permission', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                fsxId: 'fs-12345',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    canReadAWSSSMDocuments: true,
                    fsxLinkExists: true
                }
            };

            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);

            expect(lacksPermission).toBe(false);
        });
    });

    describe('Register option disabled state - FSx link checks', () => {
        it('disables Register when FSx link is missing', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                fsxId: 'fs-12345',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: false
                }
            };

            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;

            expect(fsxLinkMissing).toBe(true);
        });

        it('enables Register when FSx link exists', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                fsxId: 'fs-12345',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;

            expect(fsxLinkMissing).toBe(false);
        });
    });

    describe('Register option tooltip messages - priority order', () => {
        it('shows permission message when lacking permission (highest priority)', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                hostManageReadiness: {
                    extensiveRunPermission: false,
                    fsxLinkExists: false
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);

            let tooltipMsg = disableMsg || '';
            if (lacksPermission) {
                tooltipMsg = getRegistrationRequiresFullPermissionMessageKey(DBType.MSSQL);
            } else if (fsxLinkMissing) {
                tooltipMsg = 'databases.register-flow.fsx-link-required-message';
            }

            expect(tooltipMsg).toBe('databases.inventory.registration-requires-full-permission');
        });

        it('shows Oracle permission message when lacking permission for Oracle engine', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                hostManageReadiness: {
                    extensiveRunPermission: false,
                    fsxLinkExists: false
                }
            };

            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const tooltipMsg = lacksPermission ? getRegistrationRequiresFullPermissionMessageKey(DBType.ORACLE) : '';

            expect(tooltipMsg).toBe('databases.inventory.registration-requires-full-permission-oracle');
        });

        it('shows FSx link message when link missing (second priority)', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: false
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);

            let tooltipMsg = disableMsg || '';
            if (lacksPermission) {
                tooltipMsg = getRegistrationRequiresFullPermissionMessageKey(DBType.MSSQL);
            } else if (fsxLinkMissing) {
                tooltipMsg = 'databases.register-flow.fsx-link-required-message';
            }

            expect(tooltipMsg).toBe('databases.register-flow.fsx-link-required-message');
        });

        it('shows storage message from manageActionCol (fallback)', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: '',
                fsxId: null,
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);

            let tooltipMsg = disableMsg || '';
            if (lacksPermission) {
                tooltipMsg = getRegistrationRequiresFullPermissionMessageKey(DBType.MSSQL);
            } else if (fsxLinkMissing) {
                tooltipMsg = 'databases.register-flow.fsx-link-required-message';
            }

            expect(tooltipMsg).toBe('databases.bulk-register.fsxn-manage-supported');
        });

        it('shows Oracle-specific storage message for Oracle engine', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: '',
                fsxId: null,
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.ORACLE, rowData);

            expect(disableMsg).toBe('databases.bulk-register.fsxn-manage-supported-oracle');
        });
    });

    describe('Register option - combined scenarios', () => {
        it('enables Register for valid UNMANAGED MSSQL instance', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                fsxId: 'fs-12345',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    canReadAWSSSMDocuments: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const isDisabled = !!disableMsg || fsxLinkMissing || lacksPermission;

            expect(isDisabled).toBe(false);
        });

        it('enables Register for valid UNDETECTED Oracle instance', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNDETECTED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                fsxId: 'fs-67890',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    canReadAWSSSMDocuments: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.ORACLE, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const isDisabled = !!disableMsg || fsxLinkMissing || lacksPermission;

            expect(isDisabled).toBe(false);
        });

        it('disables Register when all checks fail', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: '',
                fsxId: null,
                storage: [],
                hostManageReadiness: {
                    extensiveRunPermission: false,
                    fsxLinkExists: false
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
            const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);
            const isDisabled = !!disableMsg || fsxLinkMissing || lacksPermission;

            expect(isDisabled).toBe(true);
            expect(disableMsg).toBeTruthy();
            expect(lacksPermission).toBe(true);
            expect(fsxLinkMissing).toBe(true);
        });

        it('disables Register when host is offline (detectOption check)', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fileSystemType: STORAGE_TYPES.FSX_FOR_ONTAP,
                status: 'Offline',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    fsxLinkExists: true
                }
            };

            const { disableMsg } = manageActionCol(DBType.MSSQL, rowData);
            const isDisabled = !!disableMsg;

            expect(isDisabled).toBe(true);
            expect(disableMsg).toBe('Host is down');
        });
    });
});
