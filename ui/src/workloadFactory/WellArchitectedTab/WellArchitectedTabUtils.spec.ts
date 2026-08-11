import { describe, it, expect, vi } from 'vitest';

import { getLunFilterOptions, getUniqueLunNames } from './WellArchitectedTabUtils';

vi.mock('../../store/store', () => ({ default: { getState: () => ({}) } }));
vi.mock('../../store/workloadFactory/databaseHomeSlice', () => ({ selectedTabSelection: vi.fn() }));
vi.mock('../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setFSXId: vi.fn(),
    setGwPageLoadInstanceData: vi.fn(),
    setLandingFrom: vi.fn(),
    setSelectedWellArchitectTab: vi.fn()
}));
vi.mock('../../store/workloadFactory/inventoryV2Slice', () => ({
    setBreadCrumbSelectedFrom: vi.fn(),
    setSelectedHeaderTab: vi.fn()
}));
vi.mock('../../store/workloadFactory/oracleSlice', () => ({ setSelectedOracleInnerPageTab: vi.fn() }));
vi.mock('../../store/workloadFactory/workloadFactoryResourceSlice', () => ({
    setSelectedHostname: vi.fn(),
    setSelectedResourcePageHostData: vi.fn()
}));
vi.mock('../../utils/consts', () => ({
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' },
    WELL_ARCHITECTED_TABS: {},
    WLF_TABS: {}
}));
vi.mock('../../utils/utilityFunctions', () => ({
    dashboardRedirection: vi.fn(),
    dashboardRedirectionToWellArchitected: vi.fn(),
    sortListOfDict: vi.fn()
}));
vi.mock('../DatabaseHomePage/DatabaseHomeUtils', () => ({
    mapHostStatusToAssessmentData: vi.fn(),
    shouldSkipDatabaseHost: vi.fn()
}));
vi.mock('../GetWell/GetWellUtils', () => ({
    formatOptimizationBreakDown: vi.fn(),
    getCardsData: vi.fn()
}));
vi.mock('../InventoryV2/InventoryUtilsV2', () => ({
    sortAnalyzedResourceData: vi.fn(),
    shouldSkipWellArchAssessmentItem: vi.fn(() => false),
    isEligibleUnregisteredForWellArch: vi.fn(() => false),
    buildInventoryRowFromHostInstance: vi.fn(),
    resolveInventoryRowForAssessmentInstance: vi.fn(),
    resolveWellArchAssessmentFlow: vi.fn(() => 'registered')
}));
vi.mock('../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils', () => ({
    formatOracleOptimizationBreakDown: vi.fn(),
    getOracleCardsData: vi.fn()
}));

describe('getUniqueLunNames', () => {
    it('returns an empty array when luns is undefined', () => {
        expect(getUniqueLunNames(undefined)).toEqual([]);
    });

    it('returns an empty array when luns is null', () => {
        expect(getUniqueLunNames(null)).toEqual([]);
    });

    it('returns an empty array when both dataFiles and logFiles are missing', () => {
        expect(getUniqueLunNames({})).toEqual([]);
    });

    it('returns an empty array when both dataFiles and logFiles are empty', () => {
        expect(getUniqueLunNames({ dataFiles: [], logFiles: [] })).toEqual([]);
    });

    it('returns unique names from dataFiles only', () => {
        expect(getUniqueLunNames({ dataFiles: [{ name: '/vol/a' }, { name: '/vol/b' }] })).toEqual([
            '/vol/a',
            '/vol/b'
        ]);
    });

    it('returns unique names from logFiles only', () => {
        expect(getUniqueLunNames({ logFiles: [{ name: '/vol/log1' }] })).toEqual(['/vol/log1']);
    });

    it('dedupes names that appear in both dataFiles and logFiles', () => {
        const result = getUniqueLunNames({
            dataFiles: [{ name: '/vol/a' }, { name: '/vol/b' }],
            logFiles: [{ name: '/vol/a' }, { name: '/vol/c' }]
        });
        expect(result).toEqual(['/vol/a', '/vol/b', '/vol/c']);
    });

    it('dedupes duplicates within the same list', () => {
        const result = getUniqueLunNames({
            dataFiles: [{ name: '/vol/a' }, { name: '/vol/a' }, { name: '/vol/b' }]
        });
        expect(result).toEqual(['/vol/a', '/vol/b']);
    });

    it('preserves dataFiles-first ordering over logFiles', () => {
        const result = getUniqueLunNames({
            dataFiles: [{ name: '/vol/data1' }, { name: '/vol/data2' }],
            logFiles: [{ name: '/vol/log1' }, { name: '/vol/log2' }]
        });
        expect(result).toEqual(['/vol/data1', '/vol/data2', '/vol/log1', '/vol/log2']);
    });

    it('filters out entries with empty names', () => {
        const result = getUniqueLunNames({
            dataFiles: [{ name: '' }, { name: '/vol/a' }],
            logFiles: [{ name: '/vol/b' }, { name: '' }]
        });
        expect(result).toEqual(['/vol/a', '/vol/b']);
    });

    it('filters out entries with missing/undefined names', () => {
        const result = getUniqueLunNames({
            dataFiles: [{}, { name: '/vol/a' }],
            logFiles: [{ name: undefined }, { name: '/vol/b' }]
        });
        expect(result).toEqual(['/vol/a', '/vol/b']);
    });

    it('tolerates null/undefined entries inside the arrays', () => {
        const result = getUniqueLunNames({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dataFiles: [null as any, { name: '/vol/a' }, undefined as any],
            logFiles: [{ name: '/vol/b' }]
        });
        expect(result).toEqual(['/vol/a', '/vol/b']);
    });
});

describe('getLunFilterOptions', () => {
    it('returns an empty array when rows is undefined', () => {
        expect(getLunFilterOptions(undefined)).toEqual([]);
    });

    it('returns an empty array when rows is empty', () => {
        expect(getLunFilterOptions([])).toEqual([]);
    });

    it('returns an empty array when rows have no lunPaths', () => {
        expect(getLunFilterOptions([{}, { lunPaths: [] }, { lunPaths: null }])).toEqual([]);
    });

    it('dedupes and alphabetically sorts lunPaths across rows', () => {
        const rows = [{ lunPaths: ['/vol/b', '/vol/a'] }, { lunPaths: ['/vol/a', '/vol/c'] }, { lunPaths: ['/vol/b'] }];
        expect(getLunFilterOptions(rows)).toEqual([
            { value: '/vol/a', label: '/vol/a' },
            { value: '/vol/b', label: '/vol/b' },
            { value: '/vol/c', label: '/vol/c' }
        ]);
    });

    it('tolerates rows with missing or null lunPaths mixed with valid ones', () => {
        const rows = [{ lunPaths: ['/vol/a'] }, { lunPaths: null }, {}, { lunPaths: ['/vol/b', '/vol/a'] }];
        expect(getLunFilterOptions(rows)).toEqual([
            { value: '/vol/a', label: '/vol/a' },
            { value: '/vol/b', label: '/vol/b' }
        ]);
    });
});
