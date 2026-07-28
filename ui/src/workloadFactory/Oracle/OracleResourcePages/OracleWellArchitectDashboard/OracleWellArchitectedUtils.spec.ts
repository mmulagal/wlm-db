/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
    groupOracleConfigurationsByCategory,
    hasOracleCategoryConfigs,
    getOracleCardsData,
    formatOracleOptimizationBreakDown,
    formatOracleWellArchitectedData,
    oracleApplyFilter,
    generateOracleDynamicFilterOptions,
    updateConfigStateStatusOracle,
    checkAllOracleConfigurationsDismissed,
    callOptimizeOracleApi
} from './OracleWellArchitectedUtils';

// ─── i18next ──────────────────────────────────────────────────────────────────
vi.mock('i18next', () => ({
    default: { t: (k: string) => k }
}));

// ─── Controllable store state ─────────────────────────────────────────────────
const mockGetState = vi.fn();
vi.mock('../../../../store/store', () => ({
    default: { getState: () => mockGetState() }
}));

// ─── Slice action creators — return Redux-style action objects ─────────────────
const mockSetCardData = vi.fn((v: any) => ({ type: 'setCardData', payload: v }));
const mockSetOptimizationBreakDown = vi.fn((v: any) => ({ type: 'setOptimizationBreakDown', payload: v }));
const mockSetGwTimestamp = vi.fn((v: any) => ({ type: 'setGwTimestamp', payload: v }));
const mockSetGwRefreshTimestamp = vi.fn((v: any) => ({ type: 'setGwRefreshTimestamp', payload: v }));
const mockSetDriftAssessmentData = vi.fn((v: any) => ({ type: 'setDriftAssessmentData', payload: v }));
const mockSetOptimizingData = vi.fn((v: any) => ({ type: 'setOptimizingData', payload: v }));
const mockSetOptimizingInstanceData = vi.fn((v: any) => ({ type: 'setOptimizingInstanceData', payload: v }));
const mockSetInProgressOptimizationData = vi.fn((v: any) => ({ type: 'setInProgressOptimizationData', payload: v }));
const mockSetInProgressHostData = vi.fn((v: any) => ({ type: 'setInProgressHostData', payload: v }));
const mockSetJobToInstanceMap = vi.fn((v: any) => ({ type: 'setJobToInstanceMap', payload: v }));

vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setCardData: (v: any) => mockSetCardData(v),
    setDriftAssessmentData: (v: any) => mockSetDriftAssessmentData(v),
    setGwRefreshTimestamp: (v: any) => mockSetGwRefreshTimestamp(v),
    setGwTimestamp: (v: any) => mockSetGwTimestamp(v),
    setInProgressHostData: (v: any) => mockSetInProgressHostData(v),
    setInProgressOptimizationData: (v: any) => mockSetInProgressOptimizationData(v),
    setJobToInstanceMap: (v: any) => mockSetJobToInstanceMap(v),
    setOptimizationBreakDown: (v: any) => mockSetOptimizationBreakDown(v),
    setOptimizingData: (v: any) => mockSetOptimizingData(v),
    setOptimizingInstanceData: (v: any) => mockSetOptimizingInstanceData(v)
}));

const mockAddAllOracleHostAssessmentData = vi.fn((v: any) => ({
    type: 'addAllOracleHostAssessmentData',
    payload: v
}));
vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    addAllOracleHostAssessmentData: (v: any) => mockAddAllOracleHostAssessmentData(v)
}));

// ─── Recommendations ──────────────────────────────────────────────────────────
const mockGetRecommendation: Mock = vi.fn();
vi.mock('../../../../utils/recommendations', () => ({
    getRecommendation: (...args: any[]) => (mockGetRecommendation as any)(...args)
}));

// ─── Config registry ──────────────────────────────────────────────────────────
const mockGetOptimizeApiConfig: Mock = vi.fn();
vi.mock('../../../../utils/configRegistry', () => ({
    getOptimizeApiConfig: (...args: any[]) => (mockGetOptimizeApiConfig as any)(...args),
    sortConfigsByPriority: vi.fn()
}));

// ─── Resource utils — match actual groupByType signature ──────────────────────
vi.mock('../../../../utils/resourceUtils', () => ({
    groupByType: vi.fn((items: any[], returnType: string = 'id') => {
        const result: Record<string, any[]> = {};
        items?.forEach((item: any) => {
            const { type, id, value } = item;
            if (!result[type]) result[type] = [];
            const retValue = returnType === 'id' ? id : value;
            if (!result[type].includes(retValue)) result[type].push(retValue);
        });
        return result;
    }),
    mapDismissedValues: vi.fn(() => ({}))
}));

// ─── Utility functions ────────────────────────────────────────────────────────
const mockFormatNumberWithCustomComma = vi.fn((n: number) => n);
const mockBackupStartTime = vi.fn(() => '00:00');
vi.mock('../../../../utils/utilityFunctions', () => ({
    backupStartTime: (...args: any[]) => (mockBackupStartTime as any)(...args),
    formatDateWithTime: vi.fn((v: any) => v),
    formatNumberWithCustomComma: (n: number) => mockFormatNumberWithCustomComma(n),
    getCurrentDateTime: vi.fn(() => '2024-01-01')
}));

// ─── GetWell utils ────────────────────────────────────────────────────────────
const mockHandleOptimizeStorageJob = vi.fn();
vi.mock('../../../GetWell/GetWellUtils', () => ({
    handleOptimizeStorageJob: (...args: any[]) => mockHandleOptimizeStorageJob(...args)
}));

// ─── Oracle card component ────────────────────────────────────────────────────
const mockFixingProcessNotification = vi.fn();
const mockCreateFailedOptimizationMessage: Mock = vi.fn();
vi.mock('./OracleCardComponent/OracleCardComponent', () => ({
    createFailedOptimizationMessage: (...args: any[]) => (mockCreateFailedOptimizationMessage as any)(...args),
    fixingProcessNotification: (...args: any[]) => (mockFixingProcessNotification as any)(...args)
}));

// ─── Shared store state ───────────────────────────────────────────────────────
const baseStoreState = {
    getWellOptimize: {
        driftAssessmentData: null,
        optimizingData: {},
        cardData: {},
        selectedResourceId: 'r1',
        selectedDatabaseInstance: 'inst1',
        selectedGwInstanceCredId: 'cred1',
        selectedGwInstanceRegionId: 'reg1',
        inProgressOptimizationData: {},
        inProgressHostData: {},
        jobToInstanceMap: {},
        selectedAWSBackup: null,
        selectedRowFsxId: null
    },
    inventoryV2: { allOracleHostAssessmentData: [] }
};

// ─── Shared data helpers ──────────────────────────────────────────────────────
/**
 * Build a minimal flat-API response object.
 * Status values must use WELL_ARCHITECTED_STATUS constants (e.g. 'not-optimized', 'optimized').
 */
const makeData = (assessments: any[] = [], dismissed: any[] = [], meta: any = {}) => ({
    assessments,
    dismissedConfigurations: dismissed,
    metadata: meta
});

/** Minimal assessment using API-format (lowercase) status values */
const makeAssessment = (overrides: any = {}) => ({
    id: 'some-config',
    name: 'Some Config',
    status: 'not-optimized',
    type: 'storage',
    severity: 'high',
    current: '',
    totalObjectsInViolation: 1,
    totalObjectsAssessed: 2,
    objectsInViolation: [],
    violationDetails: [],
    categories: [],
    ...overrides
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('OracleWellArchitectedUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetState.mockReturnValue(baseStoreState);
        mockFormatNumberWithCustomComma.mockImplementation((n: number) => n);
        mockGetRecommendation.mockReturnValue(null);
        mockGetOptimizeApiConfig.mockReturnValue(null);
        mockCreateFailedOptimizationMessage.mockReturnValue({ type: 'failed' });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // groupOracleConfigurationsByCategory
    // ═══════════════════════════════════════════════════════════════════════════
    describe('groupOracleConfigurationsByCategory', () => {
        it('returns empty grouped object when cardData is null', () => {
            const result = groupOracleConfigurationsByCategory(null);
            expect(result).toEqual({ storage: [], compute: [], application: [], resiliency: [], cloning: [] });
        });

        it('groups configs by their category field', () => {
            const cardData = {
                'config-a': { category: 'storage' },
                'config-b': { category: 'compute' },
                'config-c': { category: 'storage' }
            };
            const result = groupOracleConfigurationsByCategory(cardData);
            expect(result.storage).toHaveLength(2);
            expect(result.compute).toHaveLength(1);
        });

        it('skips WA_FLAG_SKIP keys (isWad, isUnregistered, storageProtocol, deploymentType, baseDeploymentType)', () => {
            const cardData = {
                isWad: true,
                isUnregistered: true,
                storageProtocol: 'iSCSI',
                deploymentType: 'single',
                baseDeploymentType: 'single',
                'config-a': { category: 'storage' }
            };
            const result = groupOracleConfigurationsByCategory(cardData);
            expect(result.storage).toHaveLength(1);
        });

        it('ignores configs with unknown/unmapped category', () => {
            const cardData = { 'config-a': { category: 'unknown-category' } };
            const result = groupOracleConfigurationsByCategory(cardData);
            expect(result.storage).toHaveLength(0);
            expect(result.compute).toHaveLength(0);
        });

        it('skips configs without a category', () => {
            const cardData = { 'config-a': { name: 'No Category' } };
            const result = groupOracleConfigurationsByCategory(cardData);
            Object.values(result).forEach(arr => expect(arr).toHaveLength(0));
        });

        it('includes key and config in each grouped entry', () => {
            const cardData = { 'my-key': { category: 'compute' } };
            const result = groupOracleConfigurationsByCategory(cardData);
            expect(result.compute[0]).toEqual({ key: 'my-key', config: { category: 'compute' } });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // hasOracleCategoryConfigs
    // ═══════════════════════════════════════════════════════════════════════════
    describe('hasOracleCategoryConfigs', () => {
        it('returns true when category has items', () => {
            expect(hasOracleCategoryConfigs({ storage: [{ key: 'a' }] }, 'storage')).toBe(true);
        });

        it('returns false when category is empty array', () => {
            expect(hasOracleCategoryConfigs({ storage: [] }, 'storage')).toBe(false);
        });

        it('returns falsy when category does not exist in grouped object', () => {
            expect(hasOracleCategoryConfigs({}, 'storage')).toBeFalsy();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // getOracleCardsData — card building via formatOracleFlatAssessmentToCard
    // ═══════════════════════════════════════════════════════════════════════════
    describe('getOracleCardsData', () => {
        it('returns empty cardsData (only metadata keys) for empty assessments', () => {
            const { cardsData } = getOracleCardsData(makeData() as any, {});
            const nonMeta = Object.keys(cardsData).filter(
                k => !['storageProtocol', 'isWad', 'isUnregistered', 'deploymentType', 'baseDeploymentType'].includes(k)
            );
            expect(nonMeta).toHaveLength(0);
        });

        it('returns formatOntapConfigList and formatOsConfigList as empty arrays', () => {
            const result = getOracleCardsData(makeData() as any, {});
            expect(result.formatOntapConfigList).toEqual([]);
            expect(result.formatOsConfigList).toEqual([]);
        });

        it('skips assessments without an id', () => {
            const { cardsData } = getOracleCardsData(
                makeData([{ name: 'No ID', status: 'not-optimized', type: 'storage' }]) as any,
                {}
            );
            // No card key should be created for undefined id
            expect(cardsData.undefined).toBeUndefined();
        });

        // ── status mapping (API lowercase → display value) ──────────────────
        it('maps "optimized" status to display "Optimized"', () => {
            const { cardsData } = getOracleCardsData(makeData([makeAssessment({ status: 'optimized' })]) as any, {});
            expect(cardsData['some-config'].block_two.value).toBe('Optimized');
        });

        it('maps "not-optimized" status to display "Not optimized"', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ status: 'not-optimized' })]) as any,
                {}
            );
            expect(cardsData['some-config'].block_two.value).toBe('Not optimized');
        });

        it('maps "under-provisioned" status to display "Under-provisioned"', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ status: 'under-provisioned' })]) as any,
                {}
            );
            expect(cardsData['some-config'].block_two.value).toBe('Under-provisioned');
        });

        it('maps "over-provisioned" status to display "Over-provisioned"', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ status: 'over-provisioned' })]) as any,
                {}
            );
            expect(cardsData['some-config'].block_two.value).toBe('Over-provisioned');
        });

        it('maps unknown status to "Not applicable"', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ status: 'something-else' })]) as any,
                {}
            );
            expect(cardsData['some-config'].block_two.value).toBe('Not applicable');
        });

        // ── severity capitalization ─────────────────────────────────────────
        it('capitalizes severity from lowercase input', () => {
            const { cardsData } = getOracleCardsData(makeData([makeAssessment({ severity: 'critical' })]) as any, {});
            expect(cardsData['some-config'].block_four.value).toBe('Critical');
        });

        it('produces empty severity when severity is undefined', () => {
            const { cardsData } = getOracleCardsData(makeData([makeAssessment({ severity: undefined })]) as any, {});
            expect(cardsData['some-config'].block_four.value).toBe('');
        });

        // ── displayType: count (placement configs) ──────────────────────────
        it('uses count format for placement config — sets block_six value and count object', () => {
            const { cardsData } = getOracleCardsData(
                makeData([
                    makeAssessment({
                        id: 'redo-logs-placement',
                        name: 'Redo Logs',
                        totalObjectsInViolation: 3,
                        totalObjectsAssessed: 5
                    })
                ]) as any,
                {}
            );
            expect(cardsData['redo-logs-placement'].block_six.value).toBe('3 out of 5');
            expect(cardsData['redo-logs-placement'].block_six.count).toBeDefined();
        });

        // ── displayType: value (storage sizing) ────────────────────────────
        it('uses value format for swap-space — block_six.value = assessment.current', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ id: 'swap-space', name: 'Swap Space', current: '8 GB' })]) as any,
                {}
            );
            expect(cardsData['swap-space'].block_six.value).toBe('8 GB');
            expect(cardsData['swap-space'].block_six.count).toBeUndefined();
        });

        it('uses value format for headroom (FILE_SYSTEM_HEADROOM)', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ id: 'headroom', name: 'Headroom', current: '72%' })]) as any,
                {}
            );
            expect(cardsData.headroom.block_six.value).toBe('72%');
        });

        // ── displayType: patch ──────────────────────────────────────────────
        it('uses patch format for host-os-patch — sums ec2InstancesToPatch violations', () => {
            const { cardsData } = getOracleCardsData(
                makeData([
                    makeAssessment({
                        id: 'host-os-patch',
                        name: 'OS Patch',
                        ec2InstancesToPatch: [
                            { criticalNonCompliantCount: 2, securityNonCompliantCount: 1, otherNonCompliantCount: 0 }
                        ]
                    })
                ]) as any,
                {}
            );
            expect(cardsData['host-os-patch'].block_six.value).toBe('3'); // 2+1+0
            expect(cardsData['host-os-patch'].osPatchMissingPatches).toEqual({ critical: 2, security: 1, other: 0 });
        });

        it('uses patch format for oracle-security-patch with missingPatchesCount', () => {
            const { cardsData } = getOracleCardsData(
                makeData([
                    makeAssessment({ id: 'oracle-security-patch', name: 'Oracle Patch', missingPatchesCount: 5 })
                ]) as any,
                {}
            );
            expect(cardsData['oracle-security-patch'].block_six.value).toBe('5');
            expect(cardsData['oracle-security-patch'].oracleSecurityPatchMissingPatches).toEqual({ critical: 5 });
        });

        // ── blockSixType branches ───────────────────────────────────────────
        it('blockSixType = "Swap space" for swap-space (ASSESSMENT_CONFIG_IDS.SWAP_SPACE)', () => {
            const { cardsData } = getOracleCardsData(makeData([makeAssessment({ id: 'swap-space' })]) as any, {});
            expect(cardsData['swap-space'].block_six.type).toBe('Swap space');
        });

        it('blockSixType = "Missing patches" for host-os-patch', () => {
            const { cardsData } = getOracleCardsData(makeData([makeAssessment({ id: 'host-os-patch' })]) as any, {});
            expect(cardsData['host-os-patch'].block_six.type).toBe('Missing patches');
        });

        it('blockSixType = "Missing patches" for oracle-security-patch', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ id: 'oracle-security-patch', missingPatchesCount: 2 })]) as any,
                {}
            );
            expect(cardsData['oracle-security-patch'].block_six.type).toBe('Missing patches');
        });

        it('blockSixType = "File system headroom" for headroom (ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM)', () => {
            const { cardsData } = getOracleCardsData(makeData([makeAssessment({ id: 'headroom' })]) as any, {});
            expect(cardsData.headroom.block_six.type).toBe('File system headroom');
        });

        it('blockSixType falls back to resourceType + "s"', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ id: 'some-config', resourceType: 'Volume' })]) as any,
                {}
            );
            expect(cardsData['some-config'].block_six.type).toBe('Volumes');
        });

        it('blockSixType falls back to displayName when no resourceType', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ id: 'my-config', name: 'My Config Name' })]) as any,
                {}
            );
            expect(cardsData['my-config'].block_six.type).toBe('My Config Name');
        });

        // ── recommendation (static vs API fallback) ─────────────────────────
        it('uses static recommendation from getRecommendation when available', () => {
            mockGetRecommendation.mockReturnValue({
                title: 'Static Title',
                description: 'Static Description'
            });
            const { cardsData } = getOracleCardsData(makeData([makeAssessment()]) as any, {});
            expect(cardsData['some-config'].recommendation.title).toBe('Static Title');
            expect(cardsData['some-config'].recommendation.description).toBe('Static Description');
        });

        it('falls back to API recommendation string when no static recommendation', () => {
            mockGetRecommendation.mockReturnValue(null);
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ recommendation: 'API recommendation text' })]) as any,
                {}
            );
            expect(cardsData['some-config'].recommendation.description).toBe('API recommendation text');
        });

        it('recommendation is undefined when neither static nor API recommendation exists', () => {
            mockGetRecommendation.mockReturnValue(null);
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ recommendation: undefined })]) as any,
                {}
            );
            expect(cardsData['some-config'].recommendation).toBeUndefined();
        });

        // ── name fallback to configId ───────────────────────────────────────
        it('uses configId as displayName when name is absent', () => {
            const { cardsData } = getOracleCardsData(
                makeData([
                    {
                        id: 'my-id',
                        status: 'not-optimized',
                        type: 'storage',
                        totalObjectsInViolation: 0,
                        totalObjectsAssessed: 0,
                        objectsInViolation: [],
                        violationDetails: [],
                        categories: []
                    }
                ]) as any,
                {}
            );
            expect(cardsData['my-id'].name).toBe('my-id');
        });

        // ── optimizingData status override ──────────────────────────────────
        it('overrides card status from optimizingData when present', () => {
            const { cardsData } = getOracleCardsData(makeData([makeAssessment()]) as any, {
                'some-config': 'optimizing'
            });
            expect(cardsData['some-config'].status).toBe('optimizing');
        });

        // ── dismissedConfigurations ─────────────────────────────────────────
        it('attaches dismissedObj to matching card by id', () => {
            const { cardsData } = getOracleCardsData(
                makeData(
                    [makeAssessment({ id: 'some-config' })],
                    [{ id: 'some-config', configState: 'DISMISSED', startTime: '2024-01-01', endTime: '2024-06-01' }]
                ) as any,
                {}
            );
            expect(cardsData['some-config'].dismissedObj.configState).toBe('DISMISSED');
        });

        it('creates a synthetic card for a dismissed config with no matching assessment', () => {
            const { cardsData } = getOracleCardsData(
                makeData(
                    [],
                    [
                        {
                            id: 'dismissed-only-config',
                            name: 'Dismissed Config',
                            type: 'storage',
                            configState: 'POSTPONED'
                        }
                    ]
                ) as any,
                {}
            );
            expect(cardsData['dismissed-only-config']).toBeDefined();
            expect(cardsData['dismissed-only-config'].dismissedObj.configState).toBe('POSTPONED');
        });

        // ── metadata fields ─────────────────────────────────────────────────
        it('attaches metadata fields (storageProtocol, isWad, deploymentType, baseDeploymentType)', () => {
            const { cardsData } = getOracleCardsData(
                makeData([], [], {
                    storageProtocol: 'NFS',
                    isWad: true,
                    deploymentType: 'rac',
                    baseDeploymentType: 'single'
                }) as any,
                {}
            );
            expect(cardsData.storageProtocol).toBe('NFS');
            expect(cardsData.isWad).toBe(true);
            expect(cardsData.deploymentType).toBe('rac');
            expect(cardsData.baseDeploymentType).toBe('single');
        });

        it('sets isUnregistered when metadata.source is unregistered', () => {
            const { cardsData } = getOracleCardsData(
                makeData([], [], { source: 'unregistered', isWad: false }) as any,
                {}
            );
            expect(cardsData.isUnregistered).toBe(true);
            expect(cardsData.isWad).toBe(false);
        });

        // ── optional spread fields ──────────────────────────────────────────
        it('includes cloneDetails when present in assessment', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ cloneDetails: [{ db: 'clone1' }] })]) as any,
                {}
            );
            expect(cardsData['some-config'].cloneDetails).toEqual([{ db: 'clone1' }]);
        });

        it('includes recommendedSizeInGib when present', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ recommendedSizeInGib: 512 })]) as any,
                {}
            );
            expect(cardsData['some-config'].recommendedSizeInGib).toBe(512);
        });

        it('includes missingPermissions when present', () => {
            const { cardsData } = getOracleCardsData(
                makeData([makeAssessment({ missingPermissions: ['iam:PutPolicy'] })]) as any,
                {}
            );
            expect(cardsData['some-config'].missingPermissions).toEqual(['iam:PutPolicy']);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // formatOracleOptimizationBreakDown
    // ═══════════════════════════════════════════════════════════════════════════
    describe('formatOracleOptimizationBreakDown', () => {
        it('returns all-zero counts for empty cardsData', () => {
            const result = formatOracleOptimizationBreakDown({});
            expect(result.storage.total).toBe(0);
            expect(result.total.total).toBe(0);
        });

        it('counts optimized storage card', () => {
            const cardsData = {
                a: { category: 'storage', block_two: { value: 'Optimized' }, block_four: { value: 'High' }, id: 'a' }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.storage.optimized).toBe(1);
            expect(result.storage.notOptimized).toBe(0);
        });

        it('counts not-optimized storage card with critical severity', () => {
            const cardsData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Not optimized' },
                    block_four: { value: 'Critical' },
                    id: 'a'
                }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.storage.notOptimized).toBe(1);
            expect(result.storage.critical).toBe(1);
        });

        it('counts not-optimized storage card with warning severity', () => {
            const cardsData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Not optimized' },
                    block_four: { value: 'Warning' },
                    id: 'a'
                }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.storage.warning).toBe(1);
        });

        it('counts dismissed storage card in dismissedOrPostponed and not in total', () => {
            const cardsData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Not optimized' },
                    block_four: { value: 'High' },
                    id: 'a',
                    dismissedObj: { configState: 'DISMISSED' }
                }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.storage.dismissedOrPostponed).toBe(1);
            expect(result.storage.hasDismissedOrPostponed).toBe(true);
            expect(result.storage.dismissedIds).toContain('a');
            // dismissed not counted in total
            expect(result.storage.total).toBe(0);
        });

        it('counts ACTIVATING state as optimized and sets hasDismissedOrPostponed', () => {
            const cardsData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Not optimized' },
                    block_four: { value: 'High' },
                    id: 'a',
                    dismissedObj: { configState: 'ACTIVATING' }
                }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.storage.optimized).toBe(1);
            expect(result.storage.hasDismissedOrPostponed).toBe(true);
        });

        it('counts compute card with no block_two.value as notOptimized', () => {
            const cardsData = {
                a: { category: 'compute', block_two: { value: '' }, block_four: { value: '' }, id: 'a' }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.compute.notOptimized).toBe(1);
        });

        it('excludes not-applicable and unavailable cards from notOptimized counts', () => {
            const cardsData = {
                isWad: true,
                na: {
                    category: 'storage',
                    block_two: { value: 'Not applicable' },
                    block_four: { value: 'Critical' },
                    id: 'thin-provisioning',
                    configurationId: 'thin-provisioning'
                },
                unavail: {
                    category: 'compute',
                    block_two: { value: 'Unavailable' },
                    block_four: { value: 'Warning' },
                    id: 'compute-rightsizing',
                    configurationId: 'compute-rightsizing',
                    errorMessage: 'WAD excluded'
                },
                real: {
                    category: 'storage',
                    block_two: { value: 'Not optimized' },
                    block_four: { value: 'Critical' },
                    id: 'autosize'
                }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.total.notOptimized).toBe(1);
            expect(result.total.total).toBe(1);
        });

        it('counts all five categories independently', () => {
            const make = (category: string, optimized: boolean) => ({
                category,
                block_two: { value: optimized ? 'Optimized' : 'Not optimized' },
                block_four: { value: 'High' },
                id: category
            });
            const cardsData = {
                s: make('storage', true),
                c: make('compute', false),
                a: make('application', true),
                r: make('resiliency', false),
                cl: make('cloning', true)
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.storage.optimized).toBe(1);
            expect(result.compute.notOptimized).toBe(1);
            expect(result.application.optimized).toBe(1);
            expect(result.resiliency.notOptimized).toBe(1);
            expect(result.cloning.optimized).toBe(1);
        });

        it('calculates total.percent via Math.round', () => {
            const cardsData = {
                s1: { category: 'storage', block_two: { value: 'Optimized' }, block_four: { value: '' }, id: 's1' },
                s2: { category: 'storage', block_two: { value: 'Not optimized' }, block_four: { value: '' }, id: 's2' }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.total.percent).toBe(50);
        });

        it('non-card primitive values (metadata) do not cause category count errors', () => {
            const cardsData: any = {
                isWad: true,
                deploymentType: 'single',
                'real-card': {
                    category: 'storage',
                    block_two: { value: 'Optimized' },
                    block_four: { value: '' },
                    id: 'real-card'
                }
            };
            const result = formatOracleOptimizationBreakDown(cardsData);
            expect(result.storage.total).toBe(1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // formatOracleWellArchitectedData
    // ═══════════════════════════════════════════════════════════════════════════
    describe('formatOracleWellArchitectedData', () => {
        const mockDispatch = vi.fn((action: any) => action);

        beforeEach(() => {
            mockDispatch.mockClear();
        });

        it('returns early when no data argument and no driftAssessmentData in store', () => {
            mockGetState.mockReturnValue({
                ...baseStoreState,
                getWellOptimize: { ...baseStoreState.getWellOptimize, driftAssessmentData: null }
            });
            formatOracleWellArchitectedData(mockDispatch, undefined);
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('dispatches setCardData and setOptimizationBreakDown when data is provided', () => {
            const data = makeData([makeAssessment()], [], { lastAssessmentTimestamp: '2024-01-01T00:00:00Z' });
            formatOracleWellArchitectedData(mockDispatch, data as any);
            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setCardData' }));
            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setOptimizationBreakDown' }));
        });

        it('dispatches all five actions when data is provided', () => {
            const data = makeData([], [], { lastAssessmentTimestamp: '2024-01-01' });
            formatOracleWellArchitectedData(mockDispatch, data as any);
            const dispatchedTypes = mockDispatch.mock.calls.map((c: any[]) => c[0].type);
            expect(dispatchedTypes).toContain('setCardData');
            expect(dispatchedTypes).toContain('setOptimizationBreakDown');
            expect(dispatchedTypes).toContain('setGwTimestamp');
            expect(dispatchedTypes).toContain('setGwRefreshTimestamp');
            expect(dispatchedTypes).toContain('setDriftAssessmentData');
        });

        it('dispatches setGwTimestamp with "0" when timestamp is 0', () => {
            const data = makeData([], [], { lastAssessmentTimestamp: 0 });
            formatOracleWellArchitectedData(mockDispatch, data as any);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setGwTimestamp', payload: '0' })
            );
        });

        it('dispatches setGwTimestamp with "0" when timestamp is undefined', () => {
            const data = makeData([], [], {}); // no lastAssessmentTimestamp
            formatOracleWellArchitectedData(mockDispatch, data as any);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setGwTimestamp', payload: '0' })
            );
        });

        it('dispatches setOptimizingData({}) when isRefresh=true', () => {
            const data = makeData([makeAssessment()]);
            formatOracleWellArchitectedData(mockDispatch, data as any, false, true);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setOptimizingData', payload: {} })
            );
        });

        it('does not dispatch setOptimizingData when isRefresh=false', () => {
            const data = makeData([makeAssessment()]);
            formatOracleWellArchitectedData(mockDispatch, data as any, false, false);
            const types = mockDispatch.mock.calls.map((c: any[]) => c[0].type);
            expect(types).not.toContain('setOptimizingData');
        });

        it('uses store driftAssessmentData when data argument is undefined', () => {
            const storeData = makeData([makeAssessment()], [], { lastAssessmentTimestamp: '2024-01-01' });
            mockGetState.mockReturnValue({
                ...baseStoreState,
                getWellOptimize: {
                    ...baseStoreState.getWellOptimize,
                    driftAssessmentData: storeData
                }
            });
            formatOracleWellArchitectedData(mockDispatch, undefined);
            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setCardData' }));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // oracleApplyFilter
    // ═══════════════════════════════════════════════════════════════════════════
    describe('oracleApplyFilter', () => {
        /** Card with all required fields for oracleApplyFilter */
        const makeCard = (overrides: any = {}) => ({
            category: 'storage',
            block_two: { value: 'Not optimized' },
            block_four: { value: 'Critical' },
            block_five: { value: 'Volume' },
            tags: ['tag1'],
            ...overrides
        });

        it('returns all cards when no filter tags', () => {
            const cardData = { a: makeCard() };
            const { data, configCount } = oracleApplyFilter(cardData, []);
            expect(Object.keys(data)).toHaveLength(1);
            expect(configCount).toBe(1);
        });

        it('skips WA_FLAG_SKIP keys from results', () => {
            const cardData = { isWad: true, isUnregistered: true, a: makeCard() } as any;
            const { data } = oracleApplyFilter(cardData, []);
            expect((data as any).isWad).toBeUndefined();
            expect((data as any).isUnregistered).toBeUndefined();
        });

        it('skips null/undefined card values', () => {
            const cardData = { a: null } as any;
            const { data } = oracleApplyFilter(cardData, []);
            expect(Object.keys(data)).toHaveLength(0);
        });

        it('filters by category — keeps matching, removes others', () => {
            const cardData = {
                a: makeCard({ category: 'storage' }),
                b: makeCard({ category: 'compute' })
            };
            // filter tag: type='all-catagories', value='storage'
            const { data } = oracleApplyFilter(cardData, [{ type: 'all-catagories', id: 'storage', value: 'storage' }]);
            expect(data.a).toBeDefined();
            expect(data.b).toBeUndefined();
        });

        it('filters by status — keeps only optimized cards when filter is Optimized', () => {
            const cardData = {
                a: makeCard({ block_two: { value: 'Optimized' } }),
                b: makeCard({ block_two: { value: 'Not optimized' } })
            };
            const { data } = oracleApplyFilter(cardData, [{ type: 'status', id: 'Optimized', value: 'Optimized' }]);
            expect(data.a).toBeDefined();
            expect(data.b).toBeUndefined();
        });

        it('filters by severity', () => {
            const cardData = {
                a: makeCard({ block_four: { value: 'Critical' } }),
                b: makeCard({ block_four: { value: 'Warning' } })
            };
            const { data } = oracleApplyFilter(cardData, [{ type: 'severity', id: 'Critical', value: 'Critical' }]);
            expect(data.a).toBeDefined();
            expect(data.b).toBeUndefined();
        });

        it('filters by tags', () => {
            const cardData = {
                a: makeCard({ tags: ['tag1'] }),
                b: makeCard({ tags: ['tag2'] })
            };
            const { data } = oracleApplyFilter(cardData, [{ type: 'tags', id: 'tag1', value: 'tag1' }]);
            expect(data.a).toBeDefined();
            expect(data.b).toBeUndefined();
        });

        it('filters by resourceType', () => {
            const cardData = {
                a: makeCard({ block_five: { value: 'Volume' } }),
                b: makeCard({ block_five: { value: 'Disk' } })
            };
            const { data } = oracleApplyFilter(cardData, [{ type: 'resourceType', id: 'Volume', value: 'Volume' }]);
            expect(data.a).toBeDefined();
            expect(data.b).toBeUndefined();
        });

        it('showDismissedConfigurations=true — shows only dismissed and postponed', () => {
            const cardData = {
                a: makeCard({ dismissedObj: { configState: 'DISMISSED' } }),
                b: makeCard() // no dismissedObj
            };
            const { data } = oracleApplyFilter(cardData, [], true);
            expect(data.a).toBeDefined();
            expect(data.b).toBeUndefined();
        });

        it('showDismissedConfigurations=false — hides dismissed and postponed', () => {
            const cardData = {
                a: makeCard({ dismissedObj: { configState: 'DISMISSED' } }),
                b: makeCard() // no dismissedObj
            };
            const { data } = oracleApplyFilter(cardData, [], false);
            expect(data.a).toBeUndefined();
            expect(data.b).toBeDefined();
        });

        it('showDismissedConfigurations=false — includes ACTIVATING state cards', () => {
            const cardData = {
                a: makeCard({ dismissedObj: { configState: 'ACTIVATING' } })
            };
            const { data } = oracleApplyFilter(cardData, [], false);
            expect(data.a).toBeDefined();
        });

        it('configCount excludes cards without block_two.value', () => {
            const cardData = { a: makeCard({ block_two: { value: '' } }) };
            const { configCount } = oracleApplyFilter(cardData, []);
            expect(configCount).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // generateOracleDynamicFilterOptions
    // ═══════════════════════════════════════════════════════════════════════════
    describe('generateOracleDynamicFilterOptions', () => {
        it('returns empty arrays for empty cardData', () => {
            const result = generateOracleDynamicFilterOptions({});
            expect(result.categories).toHaveLength(0);
            expect(result.severities).toHaveLength(0);
            expect(result.tags).toHaveLength(0);
            expect(result.resourceTypes).toHaveLength(0);
            expect(result.statuses).toHaveLength(0);
        });

        it('skips WA_FLAG_SKIP keys', () => {
            const result = generateOracleDynamicFilterOptions({ isWad: true });
            expect(result.categories).toHaveLength(0);
        });

        it('skips null/undefined config entries', () => {
            const result = generateOracleDynamicFilterOptions({ a: null });
            expect(result.categories).toHaveLength(0);
        });

        it('adds category even when block_two.value is empty', () => {
            const result = generateOracleDynamicFilterOptions({
                a: {
                    category: 'storage',
                    block_two: { value: '' },
                    block_four: { value: 'Critical' },
                    block_five: { value: 'Volume' },
                    tags: ['t1']
                }
            });
            expect(result.categories).toHaveLength(1);
            // severity/tags/resourceType/status are skipped when block_two.value is empty
            expect(result.severities).toHaveLength(0);
        });

        it('collects categories, severities, tags, resourceTypes, and statuses', () => {
            const cardData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Not optimized' },
                    block_four: { value: 'Critical' },
                    block_five: { value: 'Volume' },
                    tags: ['oracle', 'rac']
                }
            };
            const result = generateOracleDynamicFilterOptions(cardData);
            expect(result.categories.map((c: any) => c.value)).toContain('storage');
            expect(result.severities.map((s: any) => s.value)).toContain('Critical');
            expect(result.tags.map((t: any) => t.value)).toContain('oracle');
            expect(result.tags.map((t: any) => t.value)).toContain('rac');
            expect(result.resourceTypes.map((r: any) => r.value)).toContain('Volume');
        });

        it('adds Optimized to statuses for an optimized card', () => {
            const cardData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Optimized' },
                    block_four: { value: '' },
                    block_five: { value: '' },
                    tags: []
                }
            };
            const result = generateOracleDynamicFilterOptions(cardData);
            expect(result.statuses.map((s: any) => s.value)).toContain('Optimized');
        });

        it('deduplicates values (same category in two cards)', () => {
            const cardData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Optimized' },
                    block_four: { value: 'High' },
                    block_five: { value: 'Volume' },
                    tags: []
                },
                b: {
                    category: 'storage',
                    block_two: { value: 'Not optimized' },
                    block_four: { value: 'High' },
                    block_five: { value: 'Volume' },
                    tags: []
                }
            };
            const result = generateOracleDynamicFilterOptions(cardData);
            expect(result.categories.filter((c: any) => c.value === 'storage')).toHaveLength(1);
        });

        it('result objects have id, label, and value fields', () => {
            const cardData = {
                a: {
                    category: 'storage',
                    block_two: { value: 'Optimized' },
                    block_four: { value: 'Critical' },
                    block_five: { value: 'Volume' },
                    tags: ['tag1']
                }
            };
            const result = generateOracleDynamicFilterOptions(cardData);
            result.categories.forEach((c: any) => {
                expect(c).toHaveProperty('id');
                expect(c).toHaveProperty('label');
                expect(c).toHaveProperty('value');
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // updateConfigStateStatusOracle
    // ═══════════════════════════════════════════════════════════════════════════
    describe('updateConfigStateStatusOracle', () => {
        const mockDispatch = vi.fn();

        const hostData = {
            databaseHostId: 'r1',
            credentialId: 'cred1',
            regionId: 'reg1',
            instancesAssessment: [
                {
                    databaseInstanceId: 'inst1',
                    assessments: { dismissedConfigurations: [] }
                }
            ]
        };

        beforeEach(() => {
            mockDispatch.mockClear();
            mockGetState.mockReturnValue({
                ...baseStoreState,
                inventoryV2: { allOracleHostAssessmentData: [{ ...hostData }] }
            });
        });

        /** Extract dismissedConfigurations from the first dispatched payload */
        const getDismissed = () => {
            const { payload } = mockDispatch.mock.calls[0][0];
            return payload[0].instancesAssessment[0].assessments.dismissedConfigurations;
        };

        it('sets configState to DISMISSED when action is "DISMISSED" (CONFIG_STATE_ACTIONS.DISMISS)', () => {
            updateConfigStateStatusOracle(
                [{ hostId: 'r1', credentialId: 'cred1', regionId: 'reg1', instanceId: 'inst1', id: 'cfg1' }],
                mockDispatch,
                'DISMISSED'
            );
            expect(getDismissed().find((d: any) => d.id === 'cfg1').configState).toBe('DISMISSED');
        });

        it('sets configState to POSTPONED when action is "POSTPONED"', () => {
            updateConfigStateStatusOracle(
                [{ hostId: 'r1', credentialId: 'cred1', regionId: 'reg1', instanceId: 'inst1', id: 'cfg2' }],
                mockDispatch,
                'POSTPONED'
            );
            expect(getDismissed().find((d: any) => d.id === 'cfg2').configState).toBe('POSTPONED');
        });

        it('sets configState to ACTIVATING when action is "ACTIVE"', () => {
            updateConfigStateStatusOracle(
                [{ hostId: 'r1', credentialId: 'cred1', regionId: 'reg1', instanceId: 'inst1', id: 'cfg3' }],
                mockDispatch,
                'ACTIVE'
            );
            expect(getDismissed().find((d: any) => d.id === 'cfg3').configState).toBe('ACTIVATING');
        });

        it('updates (not duplicates) an existing dismissed entry', () => {
            mockGetState.mockReturnValue({
                ...baseStoreState,
                inventoryV2: {
                    allOracleHostAssessmentData: [
                        {
                            ...hostData,
                            instancesAssessment: [
                                {
                                    databaseInstanceId: 'inst1',
                                    assessments: {
                                        dismissedConfigurations: [{ id: 'existing', configState: 'DISMISSED' }]
                                    }
                                }
                            ]
                        }
                    ]
                }
            });
            updateConfigStateStatusOracle(
                [{ hostId: 'r1', credentialId: 'cred1', regionId: 'reg1', instanceId: 'inst1', id: 'existing' }],
                mockDispatch,
                'ACTIVE'
            );
            const dismissed = getDismissed();
            expect(dismissed).toHaveLength(1); // updated, not pushed
            expect(dismissed[0].configState).toBe('ACTIVATING');
        });

        it('always calls dispatch with addAllOracleHostAssessmentData', () => {
            updateConfigStateStatusOracle(
                [{ hostId: 'r1', credentialId: 'cred1', regionId: 'reg1', instanceId: 'inst1', id: 'cfg' }],
                mockDispatch,
                'DISMISSED'
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'addAllOracleHostAssessmentData' })
            );
        });

        it('leaves host unchanged when no host matches the rowData ids', () => {
            updateConfigStateStatusOracle(
                [{ hostId: 'other-host', credentialId: 'cred1', regionId: 'reg1', instanceId: 'inst1', id: 'cfg' }],
                mockDispatch,
                'DISMISSED'
            );
            const { payload } = mockDispatch.mock.calls[0][0];
            expect(payload[0].instancesAssessment[0].assessments.dismissedConfigurations).toHaveLength(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // checkAllOracleConfigurationsDismissed
    // ═══════════════════════════════════════════════════════════════════════════
    describe('checkAllOracleConfigurationsDismissed', () => {
        it('returns false for null cardData', () => {
            expect(checkAllOracleConfigurationsDismissed(null)).toBe(false);
        });

        it('returns false when no configs have block_two.value (totalConfigs = 0)', () => {
            expect(checkAllOracleConfigurationsDismissed({ a: { block_two: { value: '' } } })).toBe(false);
        });

        it('returns false when at least one config is not dismissed', () => {
            const cardData = {
                a: { block_two: { value: 'Not optimized' }, dismissedObj: { configState: 'DISMISSED' } },
                b: { block_two: { value: 'Not optimized' } } // no dismissedObj
            };
            expect(checkAllOracleConfigurationsDismissed(cardData)).toBe(false);
        });

        it('returns true when all configs with block_two.value are dismissed or postponed', () => {
            const cardData = {
                a: { block_two: { value: 'Not optimized' }, dismissedObj: { configState: 'DISMISSED' } },
                b: { block_two: { value: 'Not optimized' }, dismissedObj: { configState: 'POSTPONED' } }
            };
            expect(checkAllOracleConfigurationsDismissed(cardData)).toBe(true);
        });

        it('skips WA_FLAG_SKIP keys', () => {
            const cardData = {
                isWad: true,
                a: { block_two: { value: 'Not optimized' }, dismissedObj: { configState: 'DISMISSED' } }
            };
            expect(checkAllOracleConfigurationsDismissed(cardData)).toBe(true);
        });

        it('skips null config entries', () => {
            const cardData = { a: null };
            expect(checkAllOracleConfigurationsDismissed(cardData)).toBe(false);
        });

        it('returns false for ACTIVATING configState (not dismissed/postponed)', () => {
            const cardData = {
                a: { block_two: { value: 'Not optimized' }, dismissedObj: { configState: 'ACTIVATING' } }
            };
            expect(checkAllOracleConfigurationsDismissed(cardData)).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // callOptimizeOracleApi
    // ═══════════════════════════════════════════════════════════════════════════
    describe('callOptimizeOracleApi', () => {
        const mockOptimizeOracleOs: Mock = vi.fn();
        const mockGetJobDetailApi = vi.fn();
        const mockDispatch = vi.fn();
        const mockT = vi.fn((k: string) => k);

        const baseCall = {
            configId: 'some-config',
            cardData: { id: 'some-config' },
            optimizeOracleOs: mockOptimizeOracleOs,
            getJobDetailApi: mockGetJobDetailApi,
            dispatch: mockDispatch,
            isWorkloadFactory: false,
            t: mockT
        };

        beforeEach(() => {
            mockOptimizeOracleOs.mockResolvedValue({ data: { jobId: 'job1' } } as any);
            mockDispatch.mockClear();
            mockGetOptimizeApiConfig.mockReturnValue({
                mutation: 'optimizeOracleOperatingSystem',
                oracleOsType: 'compute-host-os'
            });
        });

        it('dispatches setOptimizingInstanceData(true) synchronously', () => {
            callOptimizeOracleApi(baseCall);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setOptimizingInstanceData', payload: true })
            );
        });

        it('dispatches setOptimizingData with card id marked as "optimizing"', () => {
            callOptimizeOracleApi(baseCall);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setOptimizingData',
                    payload: { 'some-config': 'optimizing' }
                })
            );
        });

        it('dispatches setInProgressOptimizationData and setInProgressHostData', () => {
            callOptimizeOracleApi(baseCall);
            const types = mockDispatch.mock.calls.map((c: any[]) => c[0].type);
            expect(types).toContain('setInProgressOptimizationData');
            expect(types).toContain('setInProgressHostData');
        });

        it('calls fixingProcessNotification', () => {
            callOptimizeOracleApi(baseCall);
            expect(mockFixingProcessNotification).toHaveBeenCalledWith('some-config', mockDispatch, false, mockT);
        });

        it('dispatches setCardData with optimistic status when card exists in store', () => {
            mockGetState.mockReturnValue({
                ...baseStoreState,
                getWellOptimize: {
                    ...baseStoreState.getWellOptimize,
                    cardData: { 'some-config': { block_two: { value: 'Not optimized' } } }
                }
            });
            callOptimizeOracleApi(baseCall);
            const cardDataCall = mockDispatch.mock.calls.find((c: any[]) => c[0].type === 'setCardData');
            expect(cardDataCall).toBeDefined();
            expect(cardDataCall![0].payload['some-config'].block_two.value).toBe('Optimizing');
        });

        it('does NOT dispatch setCardData when card is not in store cardData', () => {
            mockGetState.mockReturnValue(baseStoreState); // cardData: {}
            callOptimizeOracleApi(baseCall);
            const cardDataCall = mockDispatch.mock.calls.find((c: any[]) => c[0].type === 'setCardData');
            expect(cardDataCall).toBeUndefined();
        });

        it('builds STORAGE_SIZING payload with apiCallObj including databaseHostId and instanceId', async () => {
            mockGetOptimizeApiConfig.mockReturnValue({
                mutation: 'optimizeOracleOperatingSystem',
                oracleOsType: 'storage-sizing'
            } as any);
            callOptimizeOracleApi({ ...baseCall, configId: 'headroom', cardData: { id: 'headroom' } });
            await Promise.resolve(); // flush microtask queue
            const apiCallObj = (mockOptimizeOracleOs.mock.calls as any)[0][0];
            expect(apiCallObj.payload.type).toBe('storage-sizing');
            expect(apiCallObj.databaseHostId).toBe('r1');
            expect(apiCallObj.instanceId).toBe('inst1');
        });

        it('builds AWS_BACKUP payload with fsxFileSystemId and backupRetentionDays', async () => {
            mockGetOptimizeApiConfig.mockReturnValue({
                mutation: 'optimizeOracleOperatingSystem',
                oracleOsType: 'aws-backup'
            } as any);
            mockGetState.mockReturnValue({
                ...baseStoreState,
                getWellOptimize: {
                    ...baseStoreState.getWellOptimize,
                    selectedAWSBackup: { numberOfDays: 7 },
                    selectedRowFsxId: 'fsx-1',
                    driftAssessmentData: null
                }
            });
            callOptimizeOracleApi(baseCall);
            await Promise.resolve();
            const apiCallObj = (mockOptimizeOracleOs.mock.calls as any)[0][0];
            expect(apiCallObj.payload.type).toBe('aws-backup');
            const dbHost = apiCallObj.payload.hostsToOptimize[0].databaseHosts[0];
            expect(dbHost.fsxFileSystemId).toBe('fsx-1');
            expect(dbHost.backupRetentionDays).toBe(7);
        });

        it('builds default payload with just { payload } object (no databaseHostId)', async () => {
            callOptimizeOracleApi(baseCall);
            await Promise.resolve();
            const apiCallObj = (mockOptimizeOracleOs.mock.calls as any)[0][0];
            expect(apiCallObj.payload.type).toBe('compute-host-os');
            expect(apiCallObj.databaseHostId).toBeUndefined();
            expect(apiCallObj.payload.hostsToOptimize[0].configurationName).toBe('some-config');
        });

        it('dispatches setJobToInstanceMap after successful API response', async () => {
            callOptimizeOracleApi(baseCall);
            await Promise.resolve();
            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setJobToInstanceMap' }));
        });

        it('does NOT dispatch setJobToInstanceMap when API returns an error', async () => {
            mockOptimizeOracleOs.mockResolvedValueOnce({ error: 'API failed' } as any);
            callOptimizeOracleApi(baseCall);
            await Promise.resolve();
            const jobMapCall = mockDispatch.mock.calls.find((c: any[]) => c[0].type === 'setJobToInstanceMap');
            expect(jobMapCall).toBeUndefined();
        });

        it('calls handleOptimizeStorageJob with response after API resolves', async () => {
            callOptimizeOracleApi(baseCall);
            await Promise.resolve();
            expect(mockHandleOptimizeStorageJob).toHaveBeenCalled();
            const callArgs = mockHandleOptimizeStorageJob.mock.calls[0];
            expect(callArgs[0]).toEqual({ data: { jobId: 'job1' } });
        });
    });
});
