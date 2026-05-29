import { describe, it, expect, vi } from 'vitest';
import { DETECT_HOST_VAR, INSTANCE_API_FIELDS } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { getOracleUnmanagedResourceApiFields, shouldSkipOracleProtectionField } from './InventoryUtilsV2';

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

const makeInventoryRow = (storageType: string, fsxId?: string) =>
    ({
        storageType,
        sqlServerInstances: fsxId ? [{ fsxId }] : [{ databaseInstanceName: 'ORCL' }]
    } as any);

describe('shouldSkipOracleProtectionField', () => {
    it('returns true when host storageType is EBS', () => {
        expect(shouldSkipOracleProtectionField(makeInventoryRow(DETECT_HOST_VAR.EBS))).toBe(true);
    });

    it('returns true for EBS even when an instance has fsxId (host-level EBS is authoritative)', () => {
        expect(shouldSkipOracleProtectionField(makeInventoryRow(DETECT_HOST_VAR.EBS, 'fs-123'))).toBe(true);
    });

    it('returns false for FSx for ONTAP hosts', () => {
        expect(shouldSkipOracleProtectionField(makeInventoryRow(GENERAL.FSX_FOR_ONTAP, 'fs-123'))).toBe(false);
    });

    it('returns false when storageType is unset', () => {
        expect(shouldSkipOracleProtectionField(makeInventoryRow(''))).toBe(false);
    });
});

describe('getOracleUnmanagedResourceApiFields', () => {
    it('returns usageEstimation-only fields for EBS hosts', () => {
        expect(getOracleUnmanagedResourceApiFields(makeInventoryRow(DETECT_HOST_VAR.EBS))).toEqual(
            INSTANCE_API_FIELDS.UNMANAGED_ORACLE_EBS_DEFAULT
        );
        expect(INSTANCE_API_FIELDS.UNMANAGED_ORACLE_EBS_DEFAULT).toEqual(['usageEstimation']);
    });

    it('does not include protection or performance in EBS default fields', () => {
        const fields = getOracleUnmanagedResourceApiFields(makeInventoryRow(DETECT_HOST_VAR.EBS));
        expect(fields).not.toContain('protection');
        expect(fields).not.toContain('performance');
    });

    it('returns full default fields for non-EBS hosts', () => {
        expect(getOracleUnmanagedResourceApiFields(makeInventoryRow(GENERAL.FSX_FOR_ONTAP))).toEqual(
            INSTANCE_API_FIELDS.UNMANAGED_ORACLE_DEFAULT
        );
        expect(INSTANCE_API_FIELDS.UNMANAGED_ORACLE_DEFAULT).toContain('protection');
        expect(INSTANCE_API_FIELDS.UNMANAGED_ORACLE_DEFAULT).toContain('performance');
    });
});
