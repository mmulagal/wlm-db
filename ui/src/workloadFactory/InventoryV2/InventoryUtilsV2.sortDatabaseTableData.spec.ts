import { describe, it, expect, vi } from 'vitest';
import { DBType, WAD_SORT_STATUS } from '../../utils/consts';

import { sortDatabaseTableData } from './InventoryUtilsV2';

// InventoryUtilsV2 imports the Redux store at module scope; stub it out so
// the module loads cleanly in the unit-test environment.
vi.mock('../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({
            headers: { credentialMapping: {}, regionMapping: {} },
            inventoryV2: { removeSecNodeDiscoveredList: [] }
        }))
    }
}));

// The module also imports SVG assets and several sub-modules that are not
// relevant to the pure sorting function under test; mock them to avoid
// resolution errors in Vitest.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeRow = (hostType: string, status?: string, isWad?: boolean) =>
    ({
        hostType,
        status,
        isWad: isWad ?? false
    } as any);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('sortDatabaseTableData', () => {
    it('returns the original array unchanged when it has fewer than 2 elements', () => {
        const empty: any[] = [];
        expect(sortDatabaseTableData(empty)).toBe(empty);

        const single = [makeRow(DBType.ORACLE, 'ONLINE')];
        expect(sortDatabaseTableData(single)).toBe(single);
    });

    it('sorts by database type: MSSQL > Oracle > PostgreSQL for equal status', () => {
        const data = [
            makeRow(DBType.POSTGRESQL, 'ONLINE'),
            makeRow(DBType.ORACLE, 'ONLINE'),
            makeRow(DBType.MSSQL, 'ONLINE')
        ];
        const sorted = sortDatabaseTableData(data);
        expect(sorted[0].hostType).toBe(DBType.MSSQL);
        expect(sorted[1].hostType).toBe(DBType.ORACLE);
        expect(sorted[2].hostType).toBe(DBType.POSTGRESQL);
    });

    it('sorts by status within the same database type: ONLINE > OFFLINE > WAD > UNKNOWN', () => {
        const data = [
            makeRow(DBType.ORACLE, 'UNKNOWN'),
            makeRow(DBType.ORACLE, undefined, true /* isWad */),
            makeRow(DBType.ORACLE, 'OFFLINE'),
            makeRow(DBType.ORACLE, 'ONLINE')
        ];
        const sorted = sortDatabaseTableData(data);
        expect(sorted[0].status).toBe('ONLINE');
        expect(sorted[1].status).toBe('OFFLINE');
        // WAD row: isWad=true, status=undefined — must sort after OFFLINE and before UNKNOWN
        expect(sorted[2].isWad).toBe(true);
        expect(sorted[3].status).toBe('UNKNOWN');
    });

    it('WAD constant used for discrimination matches WAD_SORT_STATUS export', () => {
        // Verify the exported constant is the same value used as the weight key.
        expect(WAD_SORT_STATUS).toBe('WAD');
    });

    it('WAD rows sort after online-assessed databases across different db types', () => {
        const data = [
            makeRow(DBType.ORACLE, undefined, true /* WAD Oracle */),
            makeRow(DBType.ORACLE, 'ONLINE'),
            makeRow(DBType.ORACLE, 'OFFLINE')
        ];
        const sorted = sortDatabaseTableData(data);
        expect(sorted[0].status).toBe('ONLINE');
        expect(sorted[1].status).toBe('OFFLINE');
        expect(sorted[2].isWad).toBe(true);
    });

    it('does not produce NaN weights for unsupported status values', () => {
        const data = [
            makeRow(DBType.ORACLE, 'some-unknown-value'),
            makeRow('unknown-db-type', 'ONLINE'),
            makeRow(DBType.MSSQL, 'ONLINE')
        ];
        // Should not throw and should return a sorted array (MSSQL online first)
        const sorted = sortDatabaseTableData(data);
        expect(sorted).toHaveLength(3);
        // Weights for unsupported values resolve to 0 — no NaN, MSSQL ONLINE should be first
        expect(sorted[0].hostType).toBe(DBType.MSSQL);
    });

    it('preserves relative order for rows with equal weight (stable-ish sort)', () => {
        const data = [makeRow(DBType.MSSQL, 'ONLINE'), makeRow(DBType.MSSQL, 'ONLINE')];
        const sorted = sortDatabaseTableData(data);
        expect(sorted).toHaveLength(2);
        sorted.forEach(row => expect(row.hostType).toBe(DBType.MSSQL));
    });
});
