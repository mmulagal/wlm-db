import { vi } from 'vitest';
import { DATABASE_TYPE } from '@prisma/client';
import {
    buildBlockDeviceSpaceManagementEntry,
    buildVolumeCombinedEntry,
    enrichWithGoldenConfig,
    isCombinedViolationDetail,
    collectScopedOntapAssessment
} from '../../../src/operations/continuous-optimization/assessment-utils';
import { MSSQL_GOLDEN_CONFIG } from '../../../src/operations/continuous-optimization/mssql/golden-config';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    OptimizeStorageConfigs
} from '../../../src/utils/continous-optimization-consts';
import { DatabaseTypes } from '../../../src/utils/consts';
import { DismissConfig } from '../../../src/utils/common-types';
import * as taggingServiceOperations from '../../../src/operations/cloud-manager/tagging-service-operations';
import { Ec2FsxRelationship } from '../../../src/operations/cloud-manager/tagging-service-operations';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

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
                violatedConfigs: [{ id: 'tiering-policy', current: 'auto' }]
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
        expect(isCombinedViolationDetail({ objectName: '', violatedConfigs: [{ id: 'x', current: 'y' }] })).toBe(false);
        expect(
            isCombinedViolationDetail({
                objectName: 'v1',
                violatedConfigs: [{ id: '', current: 'y' }]
            })
        ).toBe(false);
    });

    it('should accept rows with non-empty objectName and violatedConfigs ids', () => {
        expect(
            isCombinedViolationDetail({
                objectName: 'v1',
                value: '',
                violatedConfigs: [{ id: 'thin-provision', current: 'false' }]
            })
        ).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// enrichWithGoldenConfig
// ---------------------------------------------------------------------------
describe('enrichWithGoldenConfig', () => {
    it('returns empty array for empty input', () => {
        expect(enrichWithGoldenConfig([], DatabaseTypes.MS_SQL_SERVER)).toEqual([]);
    });

    it('enriches entries with golden-config static fields', () => {
        const entries: DismissConfig[] = [
            { id: 'thin-provision', configState: 'DISMISSED', startTime: 1000 },
            { id: 'maxdop', configState: 'POSTPONED', startTime: 2000, endTime: 3000 }
        ];

        const result = enrichWithGoldenConfig(entries, DatabaseTypes.MS_SQL_SERVER);

        expect(result).toHaveLength(2);

        const thinProvision = result.find(r => r.id === 'thin-provision');
        expect(thinProvision).toBeDefined();
        expect(thinProvision?.configurationName).toBe('thin-provision');
        expect(thinProvision?.configState).toBe('DISMISSED');
        expect(thinProvision?.name).toBeTruthy();
        expect(thinProvision?.type).toBe('storage');
        expect(thinProvision?.severity).toBeTruthy();
        expect(Array.isArray(thinProvision?.categories)).toBe(true);

        const maxdop = result.find(r => r.id === 'maxdop');
        expect(maxdop?.configState).toBe('POSTPONED');
        expect(maxdop?.endTime).toBe(3000);
    });

    it('works for Oracle ids', () => {
        const entries: DismissConfig[] = [
            { id: 'archive-placement', configState: 'DISMISSED', startTime: 1000 },
            { id: 'crr', configState: 'POSTPONED', startTime: 2000 }
        ];

        const result = enrichWithGoldenConfig(entries, DatabaseTypes.ORACLE);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('archive-placement');
        expect(result[0].type).toBe('storage');
        expect(result[1].id).toBe('crr');
        expect(result[1].type).toBe('resiliency');
    });

    it('preserves startTime and endTime from input', () => {
        const entries: DismissConfig[] = [{ id: 'crr', configState: 'POSTPONED', startTime: 100, endTime: 200 }];

        const result = enrichWithGoldenConfig(entries, DatabaseTypes.MS_SQL_SERVER);

        expect(result[0].startTime).toBe(100);
        expect(result[0].endTime).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// collectScopedOntapAssessment
// ---------------------------------------------------------------------------
function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

function buildRelationship(ec2s: Ec2FsxRelationship['ec2s']): Ec2FsxRelationship {
    return { ec2s };
}

describe('collectScopedOntapAssessment', () => {
    beforeEach(() => {
        resetProxyOverrides();
    });

    it('scopes to the requested EC2 instance, filters by workload type, and throws with no relationship', async () => {
        registerProxyGetResponse({
            targetId: 'fs-scoped',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ name: 'oradata', uuid: 'uuid-scoped' }])
        });

        // Two EC2s share the FSx: the requested instance runs Oracle, the other runs MSSQL.
        const relationship = buildRelationship([
            {
                instanceId: 'i-scoped',
                workloadTypes: [DATABASE_TYPE.oracle],
                workloads: [],
                fsxs: [
                    {
                        id: 'fs-scoped',
                        fileSystemId: 'fs-scoped',
                        region: 'us-east-1',
                        volumes: [
                            {
                                id: 'v-scoped',
                                fsxVolumeId: 'fsvol-scoped',
                                volumeUuid: 'uuid-scoped',
                                volumeName: 'oradata',
                                luns: []
                            }
                        ]
                    }
                ]
            },
            {
                instanceId: 'i-other',
                workloadTypes: [DATABASE_TYPE.mssql],
                workloads: [],
                fsxs: [{ id: 'fs-scoped', fileSystemId: 'fs-scoped', region: 'us-east-1', volumes: [] }]
            }
        ]);
        vi.spyOn(taggingServiceOperations, 'buildEc2FsxRelationship').mockResolvedValueOnce(relationship);

        // Requesting the scoped instance's own workload type returns its result, ignoring i-other.
        const scoped = await collectScopedOntapAssessment('acct-1', 'cred-1', 'us-east-1', 'i-scoped', 'oracle');
        expect(scoped).toHaveLength(1);
        expect(scoped[0].instanceId).toBe('i-scoped');
        expect(scoped[0].workloadType).toBe('oracle');

        // Requesting a workload type that doesn't match the scoped instance filters it out.
        vi.spyOn(taggingServiceOperations, 'buildEc2FsxRelationship').mockResolvedValueOnce(relationship);
        const wrongWorkload = await collectScopedOntapAssessment('acct-1', 'cred-1', 'us-east-1', 'i-scoped', 'mssql');
        expect(wrongWorkload).toEqual([]);

        // No relationship at all for the requested EC2 instance.
        vi.spyOn(taggingServiceOperations, 'buildEc2FsxRelationship').mockResolvedValueOnce(buildRelationship([]));
        await expect(
            collectScopedOntapAssessment('acct-1', 'cred-1', 'us-east-1', 'i-missing', 'mssql')
        ).rejects.toThrow(
            'No ONTAP volumes found for this instance. Register the instance or verify that the FSx link is active.'
        );
    });
});
