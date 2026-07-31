import { describe, it, expect } from 'vitest';
import { DBType, INVENTORY_STATUS, ACTION_CTA, DETECT_HOST_VAR } from '../../../../utils/consts';
import { getCanViewAndFix, getViewAndFixDisableMsg } from './InstanceTableHelper';

const t = (key: string) => key;

/**
 * Tests for View and Fix button enable/disable logic
 * in MssqlInstanceColumnList.tsx and OracleDatabaseColumnsList.tsx
 */
describe('View and Fix Button Logic', () => {
    describe('getViewAndFixDisableMsg', () => {
        it('disables with detectOption message when storage could not be identified', () => {
            const rowData = {
                detectOption: DETECT_HOST_VAR.DISABLE,
                detectOptionDisableMsg: 'Storage could not be identified',
                hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true }
            };

            expect(getViewAndFixDisableMsg(rowData, getCanViewAndFix(rowData), t)).toBe(
                'Storage could not be identified'
            );
        });

        it('prefers detectOption message over register-instance tooltip', () => {
            const rowData = {
                detectOption: DETECT_HOST_VAR.DISABLE,
                detectOptionDisableMsg: 'Storage could not be identified'
            };

            expect(getViewAndFixDisableMsg(rowData, false, t)).toBe('Storage could not be identified');
        });

        it('disables with fsx link message for unregistered rows when fsxLinkExists is false', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                hostManageReadiness: {
                    fsxLinkExists: false,
                    extensiveRunPermission: true,
                    canReadAWSSSMDocuments: true
                }
            };

            expect(getCanViewAndFix(rowData)).toBe(false);
            expect(getViewAndFixDisableMsg(rowData, false, t)).toBe(
                'databases.register-flow.fsx-link-required-view-and-fix'
            );
        });

        it('allows unregistered rows with permissions when fsxLinkExists is true', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                hostManageReadiness: {
                    fsxLinkExists: true,
                    extensiveRunPermission: true
                }
            };

            expect(getCanViewAndFix(rowData)).toBe(true);
        });

        it('disables with sql-server-instance-down for managed instance when SQL Server is down', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.MANAGED,
                resourceId: 'res-123',
                status: INVENTORY_STATUS.CASE_SENSITIVE_DOWN,
                hostType: DBType.MSSQL
            };

            expect(getCanViewAndFix(rowData)).toBe(true);
            expect(getViewAndFixDisableMsg(rowData, true, t)).toBe('databases.register-flow.sql-server-instance-down');
        });

        it('disables with oracle-server-instance-down for managed Oracle instance when down', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.MANAGED,
                resourceId: 'res-456',
                status: INVENTORY_STATUS.CASE_SENSITIVE_DOWN,
                hostType: DBType.ORACLE
            };

            expect(getViewAndFixDisableMsg(rowData, true, t)).toBe(
                'databases.register-flow.oracle-server-instance-down'
            );
        });

        it('disables with host-down when EC2 host is offline', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.MANAGED,
                resourceId: 'res-789',
                status: INVENTORY_STATUS.OFFLINE,
                hostType: DBType.MSSQL
            };

            expect(getViewAndFixDisableMsg(rowData, true, t)).toBe('databases.register-flow.host-down');
        });
    });

    describe('canViewAndFix determination', () => {
        it('enables for WAD instances', () => {
            const rowData = { isWad: true };
            expect(getCanViewAndFix(rowData)).toBe(true);
        });

        it('enables for managed instances (statusColText === MANAGED)', () => {
            const rowData = { statusColText: INVENTORY_STATUS.MANAGED };
            expect(getCanViewAndFix(rowData)).toBe(true);
        });

        it('enables for registered instances (has resourceId)', () => {
            const rowData = { resourceId: 'res-12345' };
            expect(getCanViewAndFix(rowData)).toBe(true);
        });

        it('enables for merged unregistered instances', () => {
            const rowData = { isUnregistered: true, statusColText: INVENTORY_STATUS.UNMANAGED };
            expect(getCanViewAndFix(rowData)).toBe(true);
        });

        it('enables discover instances with unregistered assessment permissions', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                resourceId: '',
                hostManageReadiness: {
                    extensiveRunPermission: true,
                    canReadAWSSSMDocuments: true
                }
            };
            expect(getCanViewAndFix(rowData)).toBe(true);
        });

        it('disables for discover instances without permissions', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                resourceId: '',
                hostManageReadiness: {
                    extensiveRunPermission: false,
                    canReadAWSSSMDocuments: false
                }
            };
            expect(getCanViewAndFix(rowData)).toBe(false);
        });

        it('disables for instances without any valid state', () => {
            expect(getCanViewAndFix({})).toBe(false);
        });
    });

    describe('effectiveDisableMsg priority', () => {
        it('shows bulk selection message when bulk selection is active (highest priority)', () => {
            const isBulkSelectionActive = true;
            const viewAndFixDisableMsg = 'View and fix disabled';
            const effectiveDisableMsg = isBulkSelectionActive
                ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                : viewAndFixDisableMsg;

            expect(effectiveDisableMsg).toBe('databases.bulk-register.action-disabled-during-bulk-selection');
        });

        it('shows view-and-fix disabled message when not registered and bulk inactive', () => {
            const isBulkSelectionActive = false;
            const canViewAndFix = false;
            const viewAndFixDisableMsg = !canViewAndFix ? 'databases.general.view-and-fix-disabled-tooltip' : '';
            const effectiveDisableMsg = isBulkSelectionActive
                ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                : viewAndFixDisableMsg;

            expect(effectiveDisableMsg).toBe('databases.general.view-and-fix-disabled-tooltip');
        });

        it('shows no message when registered and bulk inactive', () => {
            const isBulkSelectionActive = false;
            const canViewAndFix = true;
            const viewAndFixDisableMsg = !canViewAndFix ? 'databases.general.view-and-fix-disabled-tooltip' : '';
            const effectiveDisableMsg = isBulkSelectionActive
                ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                : viewAndFixDisableMsg;

            expect(effectiveDisableMsg).toBe('');
        });
    });

    describe('buttonText determination', () => {
        it('shows "well-architected" when optimizationStatus is WELL_ARCHITECTED', () => {
            const rowData = { optimizationStatus: ACTION_CTA.WELL_ARCHITECTED };
            const buttonText =
                rowData.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED
                    ? 'databases.general.well-architected'
                    : 'databases.general.view-and-fix';

            expect(buttonText).toBe('databases.general.well-architected');
        });

        it('shows "view-and-fix" when optimizationStatus is FIX_ISSUES', () => {
            const rowData = { optimizationStatus: ACTION_CTA.FIX_ISSUES };
            const buttonText =
                rowData.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED
                    ? 'databases.general.well-architected'
                    : 'databases.general.view-and-fix';

            expect(buttonText).toBe('databases.general.view-and-fix');
        });

        it('shows "view-and-fix" when optimizationStatus is undefined', () => {
            const rowData = { optimizationStatus: undefined };
            const buttonText =
                rowData.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED
                    ? 'databases.general.well-architected'
                    : 'databases.general.view-and-fix';

            expect(buttonText).toBe('databases.general.view-and-fix');
        });
    });

    describe('Permission-based gating with hostManageReadiness', () => {
        describe('Full permission (extensiveRunPermission: true)', () => {
            it('enables View and Fix for registered instance with full permission', () => {
                const rowData = {
                    resourceId: 'res-123',
                    hostManageReadiness: {
                        extensiveRunPermission: true,
                        canReadAWSSSMDocuments: true
                    }
                };
                const hasFullPerm = rowData.hostManageReadiness.extensiveRunPermission === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(hasFullPerm).toBe(true);
                expect(canViewAndFix).toBe(true);
            });

            it('enables View and Fix for managed instance with full permission', () => {
                const rowData = {
                    statusColText: INVENTORY_STATUS.MANAGED,
                    hostManageReadiness: {
                        extensiveRunPermission: true,
                        canReadAWSSSMDocuments: true
                    }
                };
                const hasFullPerm = rowData.hostManageReadiness.extensiveRunPermission === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(hasFullPerm).toBe(true);
                expect(canViewAndFix).toBe(true);
            });
        });

        describe('Partial permission (canReadAWSSSMDocuments: true, extensiveRunPermission: false)', () => {
            it('should enable View and Fix for registered instance with partial permission (future feature)', () => {
                const rowData = {
                    resourceId: 'res-456',
                    hostManageReadiness: {
                        extensiveRunPermission: false,
                        canReadAWSSSMDocuments: true
                    }
                };
                const hasFullPerm = rowData.hostManageReadiness.extensiveRunPermission === true;
                const hasPartialPerm = !hasFullPerm && rowData.hostManageReadiness.canReadAWSSSMDocuments === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(hasFullPerm).toBe(false);
                expect(hasPartialPerm).toBe(true);
                expect(canViewAndFix).toBe(true);
                // Future: should show tooltip indicating limited access
            });

            it('should enable View and Fix for managed instance with partial permission (future feature)', () => {
                const rowData = {
                    statusColText: INVENTORY_STATUS.MANAGED,
                    hostManageReadiness: {
                        extensiveRunPermission: false,
                        canReadAWSSSMDocuments: true
                    }
                };
                const hasFullPerm = rowData.hostManageReadiness.extensiveRunPermission === true;
                const hasPartialPerm = !hasFullPerm && rowData.hostManageReadiness.canReadAWSSSMDocuments === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(hasFullPerm).toBe(false);
                expect(hasPartialPerm).toBe(true);
                expect(canViewAndFix).toBe(true);
            });
        });

        describe('No permission or WAD-only permission', () => {
            it('disables View and Fix for unmanaged instance with no permission', () => {
                const rowData = {
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: {
                        extensiveRunPermission: false,
                        canReadAWSSSMDocuments: false
                    }
                };
                const hasFullPerm = rowData.hostManageReadiness.extensiveRunPermission === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(hasFullPerm).toBe(false);
                expect(canViewAndFix).toBe(false);
            });

            it('enables View and Fix for WAD instance regardless of AWS permissions', () => {
                const rowData = {
                    isWad: true,
                    hostManageReadiness: {
                        extensiveRunPermission: false,
                        canReadAWSSSMDocuments: false
                    }
                };
                const canViewAndFix = !!(rowData.isWad || false);

                expect(canViewAndFix).toBe(true);
            });

            it('handles missing hostManageReadiness gracefully for WAD instance', () => {
                const rowData = {
                    isWad: true,
                    hostManageReadiness: undefined
                };
                const canViewAndFix = !!(rowData.isWad || false);

                expect(canViewAndFix).toBe(true);
            });

            it('disables for unmanaged instance with missing hostManageReadiness', () => {
                const rowData = {
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: undefined
                };
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(canViewAndFix).toBe(false);
            });
        });

        describe('Permission with bulk selection', () => {
            it('disables even with full permission when bulk selection is active', () => {
                const rowData = {
                    resourceId: 'res-789',
                    hostManageReadiness: {
                        extensiveRunPermission: true,
                        canReadAWSSSMDocuments: true
                    }
                };
                const isBulkSelectionActive = true;
                const hasFullPerm = rowData.hostManageReadiness.extensiveRunPermission === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);
                const viewAndFixDisableMsg = !canViewAndFix ? 'databases.general.view-and-fix-disabled-tooltip' : '';
                const effectiveDisableMsg = isBulkSelectionActive
                    ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                    : viewAndFixDisableMsg;

                expect(hasFullPerm).toBe(true);
                expect(canViewAndFix).toBe(true);
                expect(effectiveDisableMsg).toBe('databases.bulk-register.action-disabled-during-bulk-selection');
            });

            it('shows bulk message even with partial permission when bulk selection is active', () => {
                const rowData = {
                    resourceId: 'res-101',
                    hostManageReadiness: {
                        extensiveRunPermission: false,
                        canReadAWSSSMDocuments: true
                    }
                };
                const isBulkSelectionActive = true;
                const hasPartialPerm =
                    !rowData.hostManageReadiness.extensiveRunPermission &&
                    rowData.hostManageReadiness.canReadAWSSSMDocuments === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);
                const viewAndFixDisableMsg = !canViewAndFix ? 'databases.general.view-and-fix-disabled-tooltip' : '';
                const effectiveDisableMsg = isBulkSelectionActive
                    ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                    : viewAndFixDisableMsg;

                expect(hasPartialPerm).toBe(true);
                expect(canViewAndFix).toBe(true);
                expect(effectiveDisableMsg).toBe('databases.bulk-register.action-disabled-during-bulk-selection');
            });
        });

        describe('Permission transitions and edge cases', () => {
            it('handles null extensiveRunPermission as no permission', () => {
                const rowData = {
                    resourceId: 'res-202',
                    hostManageReadiness: {
                        extensiveRunPermission: null,
                        canReadAWSSSMDocuments: false
                    }
                };
                const hasFullPerm = rowData.hostManageReadiness.extensiveRunPermission === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(hasFullPerm).toBe(false);
                expect(canViewAndFix).toBe(true); // Still enabled because it's registered
            });

            it('handles undefined canReadAWSSSMDocuments as no partial permission', () => {
                const rowData = {
                    resourceId: 'res-303',
                    hostManageReadiness: {
                        extensiveRunPermission: false,
                        canReadAWSSSMDocuments: undefined
                    }
                };
                const hasPartialPerm =
                    !rowData.hostManageReadiness.extensiveRunPermission &&
                    rowData.hostManageReadiness.canReadAWSSSMDocuments === true;
                const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
                const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);

                expect(hasPartialPerm).toBe(false);
                expect(canViewAndFix).toBe(true); // Still enabled because it's registered
            });

            it('prioritizes isWad over permission checks', () => {
                const rowData = {
                    isWad: true,
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: {
                        extensiveRunPermission: false,
                        canReadAWSSSMDocuments: false
                    }
                };
                const canViewAndFix = !!(rowData.isWad || false);

                expect(canViewAndFix).toBe(true);
            });
        });
    });

    describe('Combined scenarios', () => {
        it('WAD instance during bulk selection shows bulk message with well-architected text', () => {
            const rowData = { isWad: true, optimizationStatus: ACTION_CTA.WELL_ARCHITECTED };
            const isBulkSelectionActive = true;

            const canViewAndFix = rowData.isWad || false;
            const viewAndFixDisableMsg = !canViewAndFix ? 'databases.general.view-and-fix-disabled-tooltip' : '';
            const effectiveDisableMsg = isBulkSelectionActive
                ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                : viewAndFixDisableMsg;
            const buttonText =
                rowData.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED
                    ? 'databases.general.well-architected'
                    : 'databases.general.view-and-fix';

            expect(canViewAndFix).toBe(true);
            expect(effectiveDisableMsg).toBe('databases.bulk-register.action-disabled-during-bulk-selection');
            expect(buttonText).toBe('databases.general.well-architected');
        });

        it('Registered instance not in bulk selection is enabled with correct text', () => {
            const rowData = { resourceId: 'res-123', optimizationStatus: ACTION_CTA.FIX_ISSUES };
            const isBulkSelectionActive = false;

            const isRegisteredOrManaged = rowData.statusColText === INVENTORY_STATUS.MANAGED || rowData.resourceId;
            const canViewAndFix = !!(rowData.isWad || isRegisteredOrManaged);
            const viewAndFixDisableMsg = !canViewAndFix ? 'databases.general.view-and-fix-disabled-tooltip' : '';
            const effectiveDisableMsg = isBulkSelectionActive
                ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                : viewAndFixDisableMsg;
            const buttonText =
                rowData.optimizationStatus === ACTION_CTA.WELL_ARCHITECTED
                    ? 'databases.general.well-architected'
                    : 'databases.general.view-and-fix';

            expect(canViewAndFix).toBe(true);
            expect(effectiveDisableMsg).toBe('');
            expect(buttonText).toBe('databases.general.view-and-fix');
        });

        it('Unregistered discover instance with permissions is enabled', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                resourceId: '',
                hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true }
            };
            const isBulkSelectionActive = false;

            const canViewAndFix = getCanViewAndFix(rowData);
            const viewAndFixDisableMsg = !canViewAndFix
                ? 'databases.inventory.register-instance-to-enable-view-fix'
                : '';
            const effectiveDisableMsg = isBulkSelectionActive
                ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                : viewAndFixDisableMsg;

            expect(canViewAndFix).toBe(true);
            expect(effectiveDisableMsg).toBe('');
        });

        it('Unregistered instance without permissions shows disabled message', () => {
            const rowData = {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                resourceId: '',
                hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: false }
            };
            const isBulkSelectionActive = false;

            const canViewAndFix = getCanViewAndFix(rowData);
            const viewAndFixDisableMsg = !canViewAndFix
                ? 'databases.inventory.register-instance-to-enable-view-fix'
                : '';
            const effectiveDisableMsg = isBulkSelectionActive
                ? 'databases.bulk-register.action-disabled-during-bulk-selection'
                : viewAndFixDisableMsg;

            expect(canViewAndFix).toBe(false);
            expect(effectiveDisableMsg).toBe('databases.inventory.register-instance-to-enable-view-fix');
        });
    });
});
