import { describe, it, expect, vi } from 'vitest';
import { calculateStorageDrift } from '../../../../src/operations/continuous-optimization/mssql/storage-assessment-operations';
import { expandCombinedTargets } from '../../../../src/operations/continuous-optimization/assessment-utils';
import { MSSQL_GOLDEN_CONFIG } from '../../../../src/operations/continuous-optimization/mssql/golden-config';
import {
    AssessmentStatus,
    ASSESSMENT_RESOURCE_TYPE,
    OptimizeStorageConfigs
} from '../../../../src/utils/continous-optimization-consts';
import type { StorageAssessment } from '../../../../src/utils/common-types';

type RawVolume = {
    name?: string;
    'tiering-policy'?: string;
    'tiering-min-cooling-days'?: number;
    'fractional-reserve'?: number;
    [key: string]: string | number | undefined;
};

type RawLun = {
    name?: string;
    'space-reservation-enabled'?: boolean;
    'space-allocation-allocated'?: boolean;
    [key: string]: string | boolean | undefined;
};

type StorageAssessmentFixture = {
    volumes?: RawVolume[];
    luns?: RawLun[];
    os?: Partial<StorageAssessment['os']>;
    layout?: StorageAssessment['layout'];
    sizing?: StorageAssessment['sizing'];
    filesystemId?: string;
    errors?: Partial<StorageAssessment['errors']>;
};

const defaultAssessmentErrors: StorageAssessment['errors'] = {
    volumes: '',
    luns: '',
    'volumes-footprint': '',
    layout: '',
    sizing: '',
    'mpio-policy': '',
    'iscsi-sessions': '',
    'ntfs-allocation': '',
    'tempdb-files-location': '',
    'default-log-files-location': '',
    'default-data-files-location': '',
    'data-tempdb-drive-details': ''
};

const { getHeadroomDriftMock } = vi.hoisted(() => ({
    getHeadroomDriftMock: vi.fn().mockResolvedValue({
        status: 'OPTIMIZED',
        headroomPercent: 20,
        missingPermissions: [],
        newFsxStorageCapacityGiB: 0
    })
}));

vi.mock('../../../../src/operations/continuous-optimization/headroom-assessment', () => ({
    getHeadroomDrift: getHeadroomDriftMock
}));

const lunPath = (volumeName: string, lunName: string) => `/vol/${volumeName}/${lunName}`;

const optimizedLun = (volumeName: string, lunName: string): RawLun => ({
    name: lunPath(volumeName, lunName),
    'space-reservation-enabled': true,
    'space-allocation-allocated': true
});

const optimizedVolume = (volumeName: string): RawVolume => ({
    name: volumeName,
    'fractional-reserve': 0
});

const optimizedTieringVolume = (volumeName: string): RawVolume => ({
    name: volumeName,
    'tiering-policy': 'snapshot_only',
    'tiering-min-cooling-days': 7
});

const optimizedEfficiencyVolume = (volumeName: string, deduplication = 'inline'): RawVolume => ({
    name: volumeName,
    compressionType: 'adaptive',
    deduplication,
    compaction: 'inline'
});

const minimalStorageAssessment = (overrides: StorageAssessmentFixture = {}): StorageAssessment => {
    const { errors: errorOverrides, ...rest } = overrides;
    return {
        volumes: [],
        luns: [],
        os: {},
        layout: {},
        sizing: {},
        filesystemId: 'fs-1',
        errors: { ...defaultAssessmentErrors, ...errorOverrides },
        ...rest
    } as unknown as StorageAssessment;
};

const runStorageDrift = (storageAssessmentData: StorageAssessment) =>
    calculateStorageDrift('account-1', 'cred-1', 'us-east-1', 'host-1', 'instance-1', storageAssessmentData);

describe('MSSQL golden config combined storage entries', () => {
    it('should expose combined configs and not legacy standalone sub-parameter ids', () => {
        const ids = MSSQL_GOLDEN_CONFIG.map(entry => entry.id);
        expect(ids).toContain('tiering-tco-optimization');
        expect(ids).toContain('block-device-space-management');
        expect(ids).toContain('storage-efficiencies');
        expect(ids).not.toContain('tiering-policy');
        expect(ids).not.toContain('tiering-min-cooling-days');
        expect(ids).not.toContain('fractional-reserve');
        expect(ids).not.toContain('space-reservation-enabled');
        expect(ids).not.toContain('space-allocation-allocated');
        expect(ids).not.toContain('compression');
        expect(ids).not.toContain('deduplication');
        expect(ids).not.toContain('compaction');
    });
});

describe('calculateStorageDrift combined entries', () => {
    it('should report tiering-tco-optimization OPTIMIZED when every volume passes both sub-parameters', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [optimizedTieringVolume('v1'), optimizedTieringVolume('v2')]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION);

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsAssessed: 2,
            totalObjectsInViolation: 0,
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            configDetails: [
                { id: 'tiering-policy', recommended: 'snapshot_only', objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME },
                { id: 'tiering-min-cooling-days', recommended: '7', objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME }
            ]
        });
    });

    it('should emit violatedConfigs per volume for tiering-tco-optimization when sub-parameters miss', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [
                    optimizedTieringVolume('v1'),
                    { name: 'v2', 'tiering-policy': 'auto', 'tiering-min-cooling-days': 7 },
                    { name: 'v3', 'tiering-policy': 'snapshot_only', 'tiering-min-cooling-days': 30 }
                ]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION);

        expect(entry).toMatchObject({
            status: AssessmentStatus.NOT_OPTIMIZED,
            totalObjectsAssessed: 3,
            totalObjectsInViolation: 2,
            objectsInViolation: ['v2', 'v3'],
            violationDetails: [
                {
                    objectName: 'v2',
                    value: '',
                    objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    violatedConfigs: [{ id: 'tiering-policy', current: 'auto' }]
                },
                {
                    objectName: 'v3',
                    value: '',
                    objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    violatedConfigs: [{ id: 'tiering-min-cooling-days', current: '30' }]
                }
            ]
        });
    });

    it('should report block-device-space-management OPTIMIZED when all LUN and volume sub-parameters pass', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                luns: [optimizedLun('v1', 'l1')],
                volumes: [optimizedVolume('v1')]
            })
        );
        const entry = drift.find(
            item => 'id' in item && item.id === OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
        );

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsAssessed: 2,
            totalObjectsInViolation: 0,
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME_OR_LUN
        });
    });

    it('should emit separate LUN and volume violation rows for block-device-space-management', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                luns: [
                    {
                        name: lunPath('v1', 'l1'),
                        'space-reservation-enabled': false,
                        'space-allocation-allocated': false
                    }
                ],
                volumes: [{ name: 'v1', 'fractional-reserve': 5 }]
            })
        );
        const entry = drift.find(
            item => 'id' in item && item.id === OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
        );

        expect(entry).toMatchObject({
            status: AssessmentStatus.NOT_OPTIMIZED,
            totalObjectsAssessed: 2,
            totalObjectsInViolation: 2,
            objectsInViolation: expect.arrayContaining([lunPath('v1', 'l1'), 'v1'])
        });
        expect(entry && 'violationDetails' in entry && entry.violationDetails).toEqual(
            expect.arrayContaining([
                {
                    objectName: lunPath('v1', 'l1'),
                    value: '',
                    objectType: ASSESSMENT_RESOURCE_TYPE.LUN,
                    violatedConfigs: [
                        { id: 'space-reservation-enabled', current: 'false' },
                        { id: 'space-allocation-allocated', current: 'false' }
                    ]
                },
                {
                    objectName: 'v1',
                    value: '',
                    objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    violatedConfigs: [{ id: 'fractional-reserve', current: '5' }]
                }
            ])
        );
    });

    it('should skip block-device-space-management when volume collection errored', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [{ name: 'v1', 'fractional-reserve': 5 }],
                luns: [optimizedLun('v1', 'l1')],
                errors: { volumes: 'Volume assessment data unavailable' }
            })
        );

        expect(
            drift.some(item => 'id' in item && item.id === OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT)
        ).toBe(false);
    });

    it('should treat string-equivalent numeric and boolean values as matching for tiering-tco-optimization', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [
                    {
                        name: 'v1',
                        'tiering-policy': 'snapshot_only',
                        'tiering-min-cooling-days': '7' as unknown as number
                    }
                ]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION);

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsInViolation: 0
        });
    });

    it('should skip unnamed volumes for tiering-tco-optimization even when sub-parameters violate', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [
                    { 'tiering-policy': 'auto', 'tiering-min-cooling-days': 30 },
                    { name: '', 'tiering-policy': 'auto', 'tiering-min-cooling-days': 30 }
                ]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION);

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsInViolation: 0
        });
    });

    it('should treat string-equivalent boolean values as matching for block-device-space-management', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                luns: [
                    {
                        name: lunPath('v1', 'l1'),
                        'space-reservation-enabled': 'true' as unknown as boolean,
                        'space-allocation-allocated': 'true' as unknown as boolean
                    }
                ],
                volumes: [optimizedVolume('v1')]
            })
        );
        const entry = drift.find(
            item => 'id' in item && item.id === OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
        );

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsInViolation: 0
        });
    });

    it('should skip unnamed LUNs for block-device-space-management even when sub-parameters violate', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                luns: [
                    {
                        'space-reservation-enabled': false,
                        'space-allocation-allocated': false
                    },
                    {
                        name: '',
                        'space-reservation-enabled': false,
                        'space-allocation-allocated': false
                    }
                ],
                volumes: [optimizedVolume('v1')]
            })
        );
        const entry = drift.find(
            item => 'id' in item && item.id === OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
        );

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsInViolation: 0
        });
    });
});

describe('calculateStorageDrift storage-efficiencies', () => {
    it('should report storage-efficiencies OPTIMIZED when every volume has efficiencies enabled (inline or both)', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [optimizedEfficiencyVolume('v1'), optimizedEfficiencyVolume('v2', 'both')]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.STORAGE_EFFICIENCIES);

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsAssessed: 2,
            totalObjectsInViolation: 0,
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            configDetails: [
                { id: 'compression', recommended: 'adaptive', objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME },
                { id: 'deduplication', recommended: 'inline', objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME },
                { id: 'compaction', recommended: 'enabled', objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME }
            ]
        });
    });

    it('should flag only the failing sub-parameters per volume with their current values', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [
                    optimizedEfficiencyVolume('v1'),
                    { name: 'v2', compressionType: 'none', deduplication: 'inline', compaction: 'inline' },
                    { name: 'v3', compressionType: 'adaptive', deduplication: 'background', compaction: 'none' }
                ]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.STORAGE_EFFICIENCIES);

        expect(entry).toMatchObject({
            status: AssessmentStatus.NOT_OPTIMIZED,
            totalObjectsAssessed: 3,
            totalObjectsInViolation: 2,
            objectsInViolation: ['v2', 'v3'],
            violationDetails: [
                {
                    objectName: 'v2',
                    value: '',
                    objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    violatedConfigs: [{ id: 'compression', current: 'none' }]
                },
                {
                    objectName: 'v3',
                    value: '',
                    objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    violatedConfigs: [
                        { id: 'deduplication', current: 'background' },
                        { id: 'compaction', current: 'none' }
                    ]
                }
            ]
        });
    });

    it('should flag a volume whose compaction data is missing as a violation', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [
                    optimizedEfficiencyVolume('v1'),
                    { name: 'v2', compressionType: 'adaptive', deduplication: 'inline' }
                ]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.STORAGE_EFFICIENCIES);

        expect(entry).toMatchObject({
            status: AssessmentStatus.NOT_OPTIMIZED,
            objectsInViolation: ['v2'],
            violationDetails: [
                {
                    objectName: 'v2',
                    violatedConfigs: [{ id: 'compaction', current: '' }]
                }
            ]
        });
    });

    it('should report storage-efficiencies not available when no volume has any efficiency data collected', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [{ name: 'v1' }, { name: 'v2' }]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.STORAGE_EFFICIENCIES);

        expect(entry).toMatchObject({
            id: OptimizeStorageConfigs.STORAGE_EFFICIENCIES,
            errorMessage: expect.stringContaining('No storage efficiencies assessment data found')
        });
        expect(entry).not.toHaveProperty('status');
    });

    it('should skip unnamed volumes for storage-efficiencies even when sub-parameters violate', async () => {
        const drift = await runStorageDrift(
            minimalStorageAssessment({
                volumes: [
                    { compressionType: 'none', deduplication: 'none', compaction: 'none' },
                    { name: '', compressionType: 'none', deduplication: 'none', compaction: 'none' }
                ]
            })
        );
        const entry = drift.find(item => 'id' in item && item.id === OptimizeStorageConfigs.STORAGE_EFFICIENCIES);

        expect(entry).toMatchObject({
            status: AssessmentStatus.OPTIMIZED,
            objectsInViolation: [],
            violationDetails: [],
            totalObjectsInViolation: 0
        });
    });
});

describe('expandCombinedTargets', () => {
    const driftEntry = (rows: Array<{ name: string; type: 'lun' | 'volume'; violated: string[] }>) => ({
        id: 'block-device-space-management',
        name: 'block-device-space-management',
        violationDetails: rows.map(row => ({
            objectName: row.name,
            value: '',
            objectType: row.type === 'lun' ? ASSESSMENT_RESOURCE_TYPE.LUN : ASSESSMENT_RESOURCE_TYPE.VOLUME,
            violatedConfigs: row.violated.map(id => ({ id, current: 'false' }))
        }))
    });

    const findSynthetic = (targets: ReturnType<typeof expandCombinedTargets>, name: string) =>
        targets.find(target => target.configurationName === name);

    it('should fan a mixed LUN + Volume request into the correct per-sub-parameter synthetics', () => {
        const combined = [
            {
                configurationName: 'block-device-space-management',
                objectsToOptimize: ['/vol/v1/l1', '/vol/v2/l2', 'v3']
            }
        ];
        const drift = [
            driftEntry([
                { name: '/vol/v1/l1', type: 'lun', violated: ['space-reservation-enabled'] },
                { name: '/vol/v2/l2', type: 'lun', violated: ['space-allocation-allocated'] },
                { name: 'v3', type: 'volume', violated: ['fractional-reserve'] }
            ])
        ];

        const result = expandCombinedTargets(combined, drift);

        expect(result).toHaveLength(3);
        expect(findSynthetic(result, 'space-reservation-enabled')?.objectsToOptimize).toEqual(['/vol/v1/l1']);
        expect(findSynthetic(result, 'space-allocation-allocated')?.objectsToOptimize).toEqual(['/vol/v2/l2']);
        expect(findSynthetic(result, 'fractional-reserve')?.objectsToOptimize).toEqual(['v3']);
        expect(findSynthetic(result, 'block-device-space-management')).toBeUndefined();
    });

    it('should silently drop objects that the caller requested but the fresh drift no longer flags', () => {
        const combined = [
            {
                configurationName: 'block-device-space-management',
                objectsToOptimize: ['/vol/v1/l1', '/vol/healed/lun', 'v1', 'v-healed']
            }
        ];
        const drift = [
            driftEntry([
                { name: '/vol/v1/l1', type: 'lun', violated: ['space-reservation-enabled'] },
                { name: 'v1', type: 'volume', violated: ['fractional-reserve'] }
            ])
        ];

        const result = expandCombinedTargets(combined, drift);

        expect(findSynthetic(result, 'space-reservation-enabled')?.objectsToOptimize).toEqual(['/vol/v1/l1']);
        expect(findSynthetic(result, 'fractional-reserve')?.objectsToOptimize).toEqual(['v1']);
        expect(findSynthetic(result, 'space-allocation-allocated')).toBeUndefined();
        result.forEach(target => {
            expect(target.objectsToOptimize).not.toContain('/vol/healed/lun');
            expect(target.objectsToOptimize).not.toContain('v-healed');
        });
    });

    it('should return only non-combined pass-through targets when the combined drift entry is absent', () => {
        const combined = [
            {
                configurationName: 'block-device-space-management',
                objectsToOptimize: ['/vol/v1/l1', 'v1']
            },
            { configurationName: 'thin-provision', objectsToOptimize: ['v9'] }
        ];

        const result = expandCombinedTargets(combined, []);

        expect(result).toEqual([{ configurationName: 'thin-provision', objectsToOptimize: ['v9'] }]);
    });

    it('should fan tiering-tco-optimization into tiering-policy and tiering-min-cooling-days synthetics', () => {
        const combined = [
            {
                configurationName: 'tiering-tco-optimization',
                objectsToOptimize: ['v1', 'v2', 'v3']
            }
        ];
        const drift = [
            {
                id: 'tiering-tco-optimization',
                name: 'tiering-tco-optimization',
                violationDetails: [
                    {
                        objectName: 'v1',
                        value: '',
                        objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                        violatedConfigs: [{ id: 'tiering-policy', current: 'auto' }]
                    },
                    {
                        objectName: 'v2',
                        value: '',
                        objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                        violatedConfigs: [{ id: 'tiering-min-cooling-days', current: '30' }]
                    }
                ]
            }
        ];

        const result = expandCombinedTargets(combined, drift);

        expect(result).toHaveLength(2);
        expect(findSynthetic(result, 'tiering-policy')?.objectsToOptimize).toEqual(['v1']);
        expect(findSynthetic(result, 'tiering-min-cooling-days')?.objectsToOptimize).toEqual(['v2']);
        expect(findSynthetic(result, 'tiering-tco-optimization')).toBeUndefined();
        result.forEach(target => {
            expect(target.objectsToOptimize).not.toContain('v3');
        });
    });

    it('should fan storage-efficiencies into compression, deduplication and compaction synthetics', () => {
        const combined = [
            {
                configurationName: 'storage-efficiencies',
                objectsToOptimize: ['v1', 'v2', 'v3']
            }
        ];
        const drift = [
            {
                id: 'storage-efficiencies',
                name: 'storage-efficiencies',
                violationDetails: [
                    {
                        objectName: 'v1',
                        value: '',
                        objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                        violatedConfigs: [{ id: 'compression', current: 'none' }]
                    },
                    {
                        objectName: 'v2',
                        value: '',
                        objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                        violatedConfigs: [
                            { id: 'deduplication', current: 'background' },
                            { id: 'compaction', current: 'none' }
                        ]
                    }
                ]
            }
        ];

        const result = expandCombinedTargets(combined, drift);

        expect(findSynthetic(result, 'compression')?.objectsToOptimize).toEqual(['v1']);
        expect(findSynthetic(result, 'deduplication')?.objectsToOptimize).toEqual(['v2']);
        expect(findSynthetic(result, 'compaction')?.objectsToOptimize).toEqual(['v2']);
        expect(findSynthetic(result, 'storage-efficiencies')).toBeUndefined();
        result.forEach(target => {
            expect(target.objectsToOptimize).not.toContain('v3');
        });
    });
});
