import { describe, it, expect, vi } from 'vitest';
import { canRegisterWithFsxLink } from './InventoryUtilsV2';

// Mock dependencies that InventoryUtilsV2 imports
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

describe('canRegisterWithFsxLink', () => {
    it('returns false with i18n key when hostManageReadiness is undefined', () => {
        const result = canRegisterWithFsxLink(undefined);
        expect(result.canRegister).toBe(false);
        expect(result.reason).toBe('databases.inventory.no-permission-data-available');
    });

    it('returns false with i18n key when hostManageReadiness is null', () => {
        const result = canRegisterWithFsxLink(null as any);
        expect(result.canRegister).toBe(false);
        expect(result.reason).toBe('databases.inventory.no-permission-data-available');
    });

    it('returns false with i18n key when fsxLinkExists is false', () => {
        const result = canRegisterWithFsxLink({ fsxLinkExists: false });
        expect(result.canRegister).toBe(false);
        expect(result.reason).toBe('databases.register-flow.fsx-link-required-message');
    });

    it('returns false with i18n key when fsxLinkExists is false even with other permissions', () => {
        const result = canRegisterWithFsxLink({
            fsxLinkExists: false,
            extensiveRunPermission: true,
            canReadAWSSSMDocuments: true
        });
        expect(result.canRegister).toBe(false);
        expect(result.reason).toBe('databases.register-flow.fsx-link-required-message');
    });

    it('returns true when fsxLinkExists is true', () => {
        const result = canRegisterWithFsxLink({
            fsxLinkExists: true,
            extensiveRunPermission: true
        });
        expect(result.canRegister).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('returns true when fsxLinkExists is undefined (EBS-only scenario)', () => {
        const result = canRegisterWithFsxLink({
            extensiveRunPermission: true,
            canReadAWSSSMDocuments: true
        });
        expect(result.canRegister).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('returns true when fsxLinkExists is true with minimal other permissions', () => {
        const result = canRegisterWithFsxLink({
            fsxLinkExists: true
        });
        expect(result.canRegister).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('returns true for empty object with no fsxLinkExists field (EBS-only)', () => {
        const result = canRegisterWithFsxLink({});
        expect(result.canRegister).toBe(true);
        expect(result.reason).toBeUndefined();
    });
});
