import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DescribeFileSystemsCommandOutput } from '@aws-sdk/client-fsx';
import * as fsxLib from '../../../src/lib/aws/fsx';
import { applyOntapStorageFix } from '../../../src/operations/continuous-optimization/ontap-storage-fix-operations';
import { OptimizeStorageConfigs } from '../../../src/utils/continous-optimization-consts';
import {
    getCapturedProxyGetUris,
    getCapturedProxyPatchUris,
    registerProxyGetResponse,
    registerProxyPatchResponse,
    resetProxyOverrides
} from '../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

const FIRST_FSX_ID = 'fs-aaaa1111bbbb2222';
const SECOND_FSX_ID = 'fs-cccc3333dddd4444';
const MANAGEMENT_DNS_NAME = `management.${FIRST_FSX_ID}.fsx.${DEFAULT_AWS_REGION}.amazonaws.com`;

function mockManagementEndpoint(fsxId = FIRST_FSX_ID): void {
    const resolvedValue: DescribeFileSystemsCommandOutput = {
        $metadata: {},
        FileSystems: [
            {
                FileSystemId: fsxId,
                Lifecycle: 'AVAILABLE',
                OntapConfiguration: {
                    Endpoints: {
                        Management: { DNSName: MANAGEMENT_DNS_NAME }
                    }
                }
            }
        ]
    };
    vi.spyOn(fsxLib, 'describeFSx').mockResolvedValue(resolvedValue);
}

describe('applyOntapStorageFix', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        resetProxyOverrides();
    });

    it('should use the first FSx id and poll when PATCH returns a job uuid', async () => {
        const JOB_UUID = 'c3d4e5f6-a7b8-9012-cdef-012345678901';
        const PATCH_PATH = 'api/storage/volumes';
        const JOB_PATH = `api/cluster/jobs/${JOB_UUID}`;
        const volumeUuid = 'vol-uuid-1';

        mockManagementEndpoint();
        registerProxyPatchResponse({
            targetId: FIRST_FSX_ID,
            ontapPath: PATCH_PATH,
            body: { job: { uuid: JOB_UUID }, num_records: 1 }
        });
        registerProxyGetResponse({
            targetId: FIRST_FSX_ID,
            ontapPath: JOB_PATH,
            body: { uuid: JOB_UUID, state: 'success' }
        });

        const results = await applyOntapStorageFix({
            accountId: ACCOUNT_ID,
            credentialsId: CREDENTIALS_ID,
            fsxId: `${FIRST_FSX_ID},${SECOND_FSX_ID}`,
            region: DEFAULT_AWS_REGION,
            svmName: 'svm1',
            configurationId: OptimizeStorageConfigs.THIN_PROVISIONING,
            resourceIds: [volumeUuid]
        });

        expect(results).toEqual([{ resourceId: volumeUuid, success: true }]);
        expect(getCapturedProxyPatchUris().some(uri => uri.includes(`/targets/${FIRST_FSX_ID}/`))).toBe(true);
        expect(getCapturedProxyPatchUris().some(uri => uri.includes(`/targets/${SECOND_FSX_ID}/`))).toBe(false);
        expect(getCapturedProxyGetUris().some(uri => uri.includes(JOB_PATH))).toBe(true);
    });
});
