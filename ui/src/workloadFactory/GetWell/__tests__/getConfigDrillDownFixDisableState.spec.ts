import { describe, it, expect, vi } from 'vitest';

import { getConfigDrillDownFixDisableState } from '../GetWellUtils';
import { DBType } from '../../../utils/consts';

const { mockGetState, mockDispatch } = vi.hoisted(() => ({
    mockGetState: vi.fn(() => ({ inventoryV2: {} })),
    mockDispatch: vi.fn()
}));

vi.mock('../../../store/store', () => ({
    default: { getState: mockGetState, dispatch: mockDispatch }
}));

const translation = ((key: string) => key) as any;

describe('getConfigDrillDownFixDisableState', () => {
    it('disables the Fix button with the fsxLink message for a registered row missing its FSx link', () => {
        const result = getConfigDrillDownFixDisableState(
            { hostManageReadiness: { fsxLinkExists: false } },
            DBType.MSSQL,
            translation
        );
        expect(result).toEqual({
            isDisabled: true,
            errorMessage: 'databases.wad.registered-missing-fs-link-disabled-message'
        });
    });

    it('leaves the Fix button enabled for a registered row that still has its FSx link', () => {
        const result = getConfigDrillDownFixDisableState(
            { hostManageReadiness: { fsxLinkExists: true } },
            DBType.MSSQL,
            translation
        );
        expect(result).toEqual({ isDisabled: false, errorMessage: '' });
    });

    it('disables the Fix button using the row-level fsxLinkExists for a managed host with no discover-based hostManageReadiness', () => {
        // A fully-managed host never goes through the discover flow, so hostManageReadiness is
        // undefined; the row-level fsxLinkExists (from databaseInstanceTopology) is the real source.
        const result = getConfigDrillDownFixDisableState({ fsxLinkExists: false }, DBType.MSSQL, translation);
        expect(result).toEqual({
            isDisabled: true,
            errorMessage: 'databases.wad.registered-missing-fs-link-disabled-message'
        });
    });

    it('disables the Fix button using databaseInstanceTopology.fsxLinkExists when present', () => {
        const result = getConfigDrillDownFixDisableState(
            { databaseInstanceTopology: { fsxLinkExists: false } },
            DBType.MSSQL,
            translation
        );
        expect(result.isDisabled).toBe(true);
    });

    it('leaves the Fix button enabled when no fsx link data is known at all (unrelated resource)', () => {
        const result = getConfigDrillDownFixDisableState({}, DBType.MSSQL, translation);
        expect(result).toEqual({ isDisabled: false, errorMessage: '' });
    });

    it('prioritizes the WAD message over a missing FSx link', () => {
        const result = getConfigDrillDownFixDisableState(
            { isWad: true, hostManageReadiness: { fsxLinkExists: false } },
            DBType.MSSQL,
            translation
        );
        expect(result.errorMessage).toBe('databases.wad.tab-disabled-message');
    });
});
