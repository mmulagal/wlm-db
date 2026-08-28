import { describe, it, expect, vi, beforeEach } from 'vitest';
import { comparisonData } from './savingsUtil';
import store from '../../../store/store';

vi.mock('../../../store/store', () => ({
    default: { getState: vi.fn() }
}));

// Host has a partial SQL edition discovered (e.g. from a lightweight scan) that would otherwise
// make hasInsufficientSqlLicensePermissions(host) return false, masking a genuine pricing failure.
const hostWithKnownEdition = {
    isDetected: true,
    hostManageReadiness: { extensiveRunPermission: true },
    sqlServerInstances: [{ sqlServerEdition: 'Enterprise Edition: Core-based Licensing' }]
};

const mockState = (overrides: any = {}) => ({
    exploreSavings: {
        recommendedTargetInstance: null,
        selectedHostDetails: hostWithKnownEdition,
        savingsCalculatorFrom: 'Auto_EBS',
        ...overrides
    }
});

describe('comparisonData - SQL license tooltip', () => {
    beforeEach(() => vi.clearAllMocks());

    it('flags insufficient permissions when the API returns an empty license array, even if edition is known', () => {
        vi.mocked(store.getState).mockReturnValue(mockState() as any);
        const rows = comparisonData({ compute: [], license: [] });
        const licenseRow = rows.find(r => r.type === 'SQL license');
        expect(licenseRow?.isPermissionTooltip).toBe(true);
    });

    it('does not flag insufficient permissions when the API returns license data', () => {
        vi.mocked(store.getState).mockReturnValue(mockState() as any);
        const rows = comparisonData({ compute: [{}], license: [{ existing: { licenseMonthlyPrice: 10 } }] });
        const licenseRow = rows.find(r => r.type === 'SQL license');
        expect(licenseRow?.isPermissionTooltip).toBe(false);
    });
});
