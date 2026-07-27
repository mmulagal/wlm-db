import { describe, it, expect, vi } from 'vitest';
import { DBType, INVENTORY_STATUS } from '../../utils/consts';
import {
    hasFullPermission,
    getFsxLinkRequiredMessageKey,
    getRegistrationRequiresFullPermissionMessageKey
} from './InventoryUtilsV2';

vi.mock('../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({
            headers: { credentialMapping: {}, regionMapping: {} },
            inventoryV2: { removeSecNodeDiscoveredList: [] }
        }))
    }
}));

vi.mock('../../assets/tooltipGrey.svg', () => ({ ReactComponent: () => null }));
vi.mock('../../assets/ic_copy.svg', () => ({ ReactComponent: () => null }));
vi.mock('../GetWell/GetWellUtils', () => ({
    formatOptimizationBreakDown: vi.fn(),
    getCardsData: vi.fn(),
    cardDataDefault: {}
}));
vi.mock('./InventoryTablesComponent/ManageInstanceWizard/DetectInstanceStep/DetectContent/DetectContentHelper', () => ({
    isAuthRequiredForInstance: vi.fn()
}));

/**
 * Mirrors InstanceTableHelper isInstanceActionDisabled FSx link branch for UNMANAGED/UNDETECTED rows.
 */
const isFsxLinkMissingForRegistration = (rowData: {
    statusColText?: string;
    hostManageReadiness?: { fsxLinkExists?: boolean };
}) =>
    (rowData.statusColText === INVENTORY_STATUS.UNMANAGED || rowData.statusColText === INVENTORY_STATUS.UNDETECTED) &&
    rowData.hostManageReadiness?.fsxLinkExists === false;

/**
 * Mirrors InstancesTable register menu tooltip priority: permission first, then FSx link.
 */
const getRegisterBlockReasonKey = (
    rowData: { hostManageReadiness?: { fsxLinkExists?: boolean; extensiveRunPermission?: boolean } },
    engineType: string
) => {
    const fsxLinkMissing = rowData.hostManageReadiness?.fsxLinkExists === false;
    const lacksPermission = !hasFullPermission(rowData.hostManageReadiness);

    if (lacksPermission) {
        return getRegistrationRequiresFullPermissionMessageKey(engineType);
    }
    if (fsxLinkMissing) {
        return getFsxLinkRequiredMessageKey(engineType);
    }
    return undefined;
};

describe('registration pre-checks (inline InstanceTableHelper / InstancesTable flow)', () => {
    const unmanagedRow = { statusColText: INVENTORY_STATUS.UNMANAGED };

    it('blocks registration when fsxLinkExists is false for UNMANAGED rows', () => {
        expect(
            isFsxLinkMissingForRegistration({
                ...unmanagedRow,
                hostManageReadiness: { fsxLinkExists: false }
            })
        ).toBe(true);
    });

    it('uses oracle FSx link message key when fsxLinkExists is false for Oracle', () => {
        const reasonKey = getRegisterBlockReasonKey(
            { hostManageReadiness: { fsxLinkExists: false, extensiveRunPermission: true } },
            DBType.ORACLE
        );

        expect(reasonKey).toBe(getFsxLinkRequiredMessageKey(DBType.ORACLE));
    });

    it('blocks on FSx link even when extensiveRunPermission is true', () => {
        const reasonKey = getRegisterBlockReasonKey(
            {
                hostManageReadiness: {
                    fsxLinkExists: false,
                    extensiveRunPermission: true,
                    canReadAWSSSMDocuments: true
                }
            },
            DBType.MSSQL
        );

        expect(reasonKey).toBe(getFsxLinkRequiredMessageKey());
    });

    it('does not block on FSx link when fsxLinkExists is true', () => {
        expect(
            isFsxLinkMissingForRegistration({
                ...unmanagedRow,
                hostManageReadiness: { fsxLinkExists: true, extensiveRunPermission: true }
            })
        ).toBe(false);
    });

    it('does not block on FSx link when fsxLinkExists is undefined (EBS-only)', () => {
        expect(
            isFsxLinkMissingForRegistration({
                ...unmanagedRow,
                hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true }
            })
        ).toBe(false);
    });

    it('does not block on FSx link when hostManageReadiness is empty (EBS-only)', () => {
        expect(
            isFsxLinkMissingForRegistration({
                ...unmanagedRow,
                hostManageReadiness: {}
            })
        ).toBe(false);
    });

    it('blocks on missing full permission when hostManageReadiness is undefined', () => {
        expect(hasFullPermission(undefined)).toBe(false);
        expect(getRegisterBlockReasonKey({}, DBType.MSSQL)).toBe(
            getRegistrationRequiresFullPermissionMessageKey(DBType.MSSQL)
        );
    });

    it('blocks on missing full permission when hostManageReadiness is null', () => {
        expect(hasFullPermission(null as any)).toBe(false);
    });

    it('allows register pre-check when fsxLinkExists is true and full permission is granted', () => {
        expect(
            getRegisterBlockReasonKey(
                { hostManageReadiness: { fsxLinkExists: true, extensiveRunPermission: true } },
                DBType.MSSQL
            )
        ).toBeUndefined();
    });
});

describe('getFsxLinkRequiredMessageKey', () => {
    it('returns MSSQL FSx link message key by default', () => {
        expect(getFsxLinkRequiredMessageKey()).toBe('databases.register-flow.fsx-link-required-message');
    });

    it('returns Oracle FSx link message key for Oracle engine', () => {
        expect(getFsxLinkRequiredMessageKey(DBType.ORACLE)).toBe(
            'databases.register-flow.fsx-link-required-message-oracle'
        );
    });
});

describe('getRegistrationRequiresFullPermissionMessageKey', () => {
    it('returns MSSQL registration permission message key by default', () => {
        expect(getRegistrationRequiresFullPermissionMessageKey()).toBe(
            'databases.inventory.registration-requires-full-permission'
        );
    });

    it('returns Oracle registration permission message key for Oracle engine', () => {
        expect(getRegistrationRequiresFullPermissionMessageKey(DBType.ORACLE)).toBe(
            'databases.inventory.registration-requires-full-permission-oracle'
        );
    });
});
