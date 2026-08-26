import { describe, expect, it } from 'vitest';
import { mapDriftToWadScanRecords } from '../../../src/operations/continuous-optimization/wad-storage-scan-mapper';
import { AssessmentStatus } from '../../../src/utils/continous-optimization-consts';
import { AssessmentErrorItemType } from '../../../src/routes/types/continuous-optimization.types';
import { DriftAssessmentItem, WadScanContext } from '../../../src/utils/wad-consts';

function makeCtx(overrides: Partial<WadScanContext> = {}): WadScanContext {
    return {
        taskId: 'task-1',
        requestId: 'req-1',
        accountId: 'acct-1',
        serviceId: 'wlmdb',
        credentialsId: 'creds-1',
        region: 'us-east-1',
        filesystemId: 'fs-1',
        workload: 'mssql',
        ...overrides
    };
}

const tieringItem: DriftAssessmentItem = {
    id: 'storage-tiering',
    resourceType: 'VOLUME',
    assessmentDetails: [
        { id: 'vol-1', name: 'vol-1', status: AssessmentStatus.OPTIMIZED, metadata: { components: [] } }
    ]
};

const thinItem: DriftAssessmentItem = {
    id: 'thin-provision',
    resourceType: 'VOLUME',
    assessmentDetails: [
        { id: 'vol-2', name: 'vol-2', status: AssessmentStatus.NOT_OPTIMIZED, metadata: { components: [] } }
    ]
};

describe('mapDriftToWadScanRecords', () => {
    it('publishes every assessed config when configurationIds is omitted', async () => {
        const { configurations } = await mapDriftToWadScanRecords(makeCtx(), [tieringItem, thinItem]);
        expect(configurations.map(({ configurationId }) => configurationId)).toEqual([
            'wlmdb-storage-tiering',
            'wlmdb-thin-provision'
        ]);
    });

    it('publishes every assessed config when configurationIds is empty', async () => {
        const { configurations } = await mapDriftToWadScanRecords(makeCtx({ configurationIds: [] }), [
            tieringItem,
            thinItem
        ]);
        expect(configurations.map(({ configurationId }) => configurationId)).toEqual([
            'wlmdb-storage-tiering',
            'wlmdb-thin-provision'
        ]);
    });

    it('filters to the requested configuration ids when a list is provided', async () => {
        const { configurations } = await mapDriftToWadScanRecords(
            makeCtx({ configurationIds: ['wlmdb-storage-tiering'] }),
            [tieringItem, thinItem]
        );
        expect(configurations.map(({ configurationId }) => configurationId)).toEqual(['wlmdb-storage-tiering']);
    });

    it('drops error items even when configurationIds is omitted', async () => {
        const { configurations } = await mapDriftToWadScanRecords(makeCtx(), [
            { id: 'storage-tiering', errorMessage: 'failed' } as AssessmentErrorItemType,
            thinItem
        ]);
        expect(configurations.map(({ configurationId }) => configurationId)).toEqual(['wlmdb-thin-provision']);
    });
});
