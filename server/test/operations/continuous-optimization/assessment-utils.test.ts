import {
    buildBlockDeviceSpaceManagementEntry,
    buildDismissedConfigurations,
    buildVolumeCombinedEntry,
    isCombinedViolationDetail
} from '../../../src/operations/continuous-optimization/assessment-utils';
import { MSSQL_GOLDEN_CONFIG } from '../../../src/operations/continuous-optimization/mssql/golden-config';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    OptimizeStorageConfigs
} from '../../../src/utils/continous-optimization-consts';
import { DatabaseTypes } from '../../../src/utils/consts';

// ---------------------------------------------------------------------------
// buildVolumeCombinedEntry / buildBlockDeviceSpaceManagementEntry
// ---------------------------------------------------------------------------
describe('buildVolumeCombinedEntry', () => {
    const tieringConfig = MSSQL_GOLDEN_CONFIG.find(c => c.id === OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION)!;

    it('should skip volumes with missing or empty names', () => {
        const entry = buildVolumeCombinedEntry(tieringConfig, [
            { 'tiering-policy': 'auto', 'tiering-min-cooling-days': 30 },
            { name: '', 'tiering-policy': 'auto', 'tiering-min-cooling-days': 30 }
        ]);

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsInViolation: 0
        });
    });

    it('should return a violation row when a named volume violates a component', () => {
        const entry = buildVolumeCombinedEntry(tieringConfig, [
            { name: 'v1', 'tiering-policy': 'auto', 'tiering-min-cooling-days': 7 }
        ]);

        expect(entry.violationDetails).toEqual([
            {
                objectName: 'v1',
                value: '',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                violatedConfigs: [{ name: 'tiering-policy', current: 'auto' }]
            }
        ]);
    });
});

describe('buildBlockDeviceSpaceManagementEntry', () => {
    const blockDeviceConfig = MSSQL_GOLDEN_CONFIG.find(
        c => c.id === OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
    )!;

    it('should skip LUNs with missing or empty names', () => {
        const entry = buildBlockDeviceSpaceManagementEntry(
            blockDeviceConfig,
            [
                { 'space-reservation-enabled': false, 'space-allocation-allocated': false },
                { name: '', 'space-reservation-enabled': false, 'space-allocation-allocated': false }
            ],
            [{ name: 'v1', 'fractional-reserve': 0 }]
        );

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsAssessed: 3,
            totalObjectsInViolation: 0
        });
    });
});

describe('isCombinedViolationDetail', () => {
    it('should reject rows missing objectName or violatedConfigs', () => {
        expect(isCombinedViolationDetail({ objectName: 'v1', value: '' })).toBe(false);
        expect(isCombinedViolationDetail({ objectName: '', violatedConfigs: [{ name: 'x', current: 'y' }] })).toBe(
            false
        );
        expect(
            isCombinedViolationDetail({
                objectName: 'v1',
                violatedConfigs: [{ name: '', current: 'y' }]
            })
        ).toBe(false);
    });

    it('should accept rows with non-empty objectName and violatedConfigs names', () => {
        expect(
            isCombinedViolationDetail({
                objectName: 'v1',
                value: '',
                violatedConfigs: [{ name: 'thin-provision', current: 'false' }]
            })
        ).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// buildDismissedConfigurations
// ---------------------------------------------------------------------------
describe('buildDismissedConfigurations', () => {
    it('returns empty array when dismissed is undefined', () => {
        expect(buildDismissedConfigurations(undefined, DatabaseTypes.MS_SQL_SERVER)).toEqual([]);
    });

    it('flattens storage configuration/sizing/layout entries preserving configurationName and configState', () => {
        const dismissed = {
            storage: {
                configuration: {
                    volumes: [{ configurationName: 'thin-provision', configState: 'dismissed' }],
                    luns: [],
                    os: []
                },
                sizing: [{ configurationName: 'headroom', configState: 'dismissed' }],
                layout: [{ configurationName: 'default-data-files-location', configState: 'dismissed' }]
            }
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        expect(result).toHaveLength(3);
        expect(result.map(r => r.configurationName)).toEqual(
            expect.arrayContaining(['thin-provision', 'headroom', 'default-data-files-location'])
        );
    });

    it('flattens highAvailability entries', () => {
        const dismissed = {
            highAvailability: [
                { configurationName: 'shared-storage', configState: 'dismissed' },
                { configurationName: 'cluster-quorum-configuration', configState: 'dismissed' }
            ]
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        expect(result).toHaveLength(2);
        expect(result[0].configurationName).toBe('shared-storage');
    });

    it('flattens single-object dismissed areas', () => {
        const dismissed = {
            license: { configurationName: 'sql-license', configState: 'dismissed' },
            hostOsPatch: { configurationName: 'host-os-patch', configState: 'dismissed' }
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        expect(result).toHaveLength(2);
        expect(result.map(r => r.configurationName)).toEqual(expect.arrayContaining(['sql-license', 'host-os-patch']));
    });

    it('enriches entries with golden-config fields (id, name, type, subType, recommendation, categories)', () => {
        const dismissed = {
            storage: {
                configuration: {
                    volumes: [{ configurationName: 'thin-provision', configState: 'dismissed' }],
                    luns: [],
                    os: []
                },
                sizing: [],
                layout: []
            },
            license: { configurationName: 'sql-license', configState: 'dismissed' }
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        const thinProvision = result.find(r => r.configurationName === 'thin-provision');
        expect(thinProvision).toMatchObject({
            id: 'thin-provision',
            name: expect.any(String),
            type: 'storage',
            subType: 'configuration',
            recommendation: expect.any(String),
            categories: expect.any(Array)
        });
        const license = result.find(r => r.configurationName === 'sql-license');
        expect(license).toMatchObject({
            id: 'sql-license',
            type: 'application',
            subType: 'application'
        });
    });
});
