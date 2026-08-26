import { describe, expect, it } from 'vitest';
import nock from 'nock';
import { collectSimulatedOntapAssessmentData } from '../../../src/operations/continuous-optimization/simulated-ontap-collector';
import { mapDriftToWadScanRecords } from '../../../src/operations/continuous-optimization/wad-storage-scan-mapper';
import { StorageAssessment as MssqlStorageAssessment } from '../../../src/utils/common-types';
import { AssessmentStatus } from '../../../src/utils/continous-optimization-consts';
import { SECRETS, WORKLOAD_FACTORY_ENDPOINT } from '../../../src/utils/consts';
import '../../simulator/scopes/cloud-manager/fsx-core-scope';
import {
    genericDecryptedCredentials,
    ontapPassword,
    ontapUserName
} from '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';

describe('collectSimulatedOntapAssessmentData', () => {
    it('uses FSx volumes + ONTAP simulator APIs and emits dual-workload results without EC2', async () => {
        SECRETS.SIMULATOR_AUTH = 'simulator-secret';
        const managementHost = 'management.fs-sim.fsx.us-east-1.amazonaws.com';
        const arnPath = genericDecryptedCredentials.metadata.arn.replace(/\//g, '-');
        const awsBase = `/simulator/v1/aws/arn/${arnPath}/region/us-east-1/FSX`;
        const scope = nock(WORKLOAD_FACTORY_ENDPOINT)
            .post(`${awsBase}/DescribeFileSystems`)
            .times(2)
            .reply(200, {
                FileSystems: [
                    {
                        FileSystemId: 'fs-sim',
                        Lifecycle: 'AVAILABLE',
                        OntapConfiguration: {
                            Endpoints: { Management: { DNSName: managementHost } }
                        }
                    }
                ]
            })
            .post(`${awsBase}/DescribeVolumes`)
            .reply(200, {
                Volumes: [
                    {
                        VolumeId: 'fsvol-sim',
                        Name: 'sim-volume',
                        OntapConfiguration: { UUID: 'volume-uuid-from-api' }
                    }
                ]
            })
            .get(`/simulator/v1/ontap/${managementHost}/api/storage/luns`)
            .query(true)
            .times(2)
            .reply(200, {
                records: [
                    {
                        name: 'sim-lun',
                        uuid: 'lun-uuid-from-api',
                        os_type: 'windows',
                        location: { volume: { uuid: 'volume-uuid-from-api', name: 'sim-volume' } },
                        space: { guarantee: { requested: false }, scsi_thin_provisioning_support_enabled: true }
                    }
                ],
                num_records: 1
            })
            .get(`/simulator/v1/ontap/${managementHost}/api/storage/volumes`)
            .query(true)
            .matchHeader(
                'authorization',
                `Basic ${Buffer.from(`${ontapUserName}:${ontapPassword}`).toString('base64')}`
            )
            .matchHeader('x-simulator-auth', 'simulator-secret')
            .matchHeader('x-target-id', 'fs-sim')
            .reply(200, {
                records: [{ name: 'sim-volume', uuid: 'volume-uuid-from-api' }],
                num_records: 1
            })
            .get(`/simulator/v1/ontap/${managementHost}/api/storage/aggregates`)
            .query(true)
            .reply(200, {
                records: [
                    {
                        space: {
                            block_storage: { size: 100, used: 60, available: 40 }
                        }
                    }
                ],
                num_records: 1
            })
            .get(`/simulator/v1/ontap/${managementHost}/api/storage/volumes/volume-uuid-from-api/snapshots`)
            .query(true)
            .reply(200, { records: [], num_records: 0 });

        const results = await collectSimulatedOntapAssessmentData('acct-1', 'creds-1', 'us-east-1');

        expect(scope.isDone()).toBe(true);
        expect(results).toHaveLength(2);
        expect(results.map(result => result.workloadType).sort()).toEqual(['mssql', 'oracle']);
        expect(results.every(result => result.instanceId === '')).toBe(true);
        expect(results[0].fileSystemId).toBe('fs-sim');
        expect((results[0].storageAssessment as MssqlStorageAssessment).volumes).toEqual([
            expect.objectContaining({ uuid: 'volume-uuid-from-api', name: 'sim-volume' })
        ]);
        expect(results[0].fsxVolumeIdByUuid).toEqual({ 'volume-uuid-from-api': 'fsvol-sim' });
        expect(results[0].headroomData?.headroomPercent).toBe(40);

        const { configurations } = await mapDriftToWadScanRecords(
            {
                taskId: 'task-1',
                requestId: 'req-1',
                accountId: 'acct-1',
                serviceId: 'wlmdb',
                configurationIds: ['wlmdb-storage-tiering'],
                credentialsId: 'creds-1',
                region: 'us-east-1',
                filesystemId: results[0].fileSystemId,
                workload: 'mssql',
                fsxVolumeIdByUuid: results[0].fsxVolumeIdByUuid
            },
            [
                {
                    id: 'storage-tiering',
                    resourceType: 'VOLUME',
                    assessmentDetails: [
                        {
                            id: 'volume-uuid-from-api',
                            name: 'sim-volume',
                            status: AssessmentStatus.OPTIMIZED,
                            metadata: { components: [] }
                        }
                    ]
                }
            ]
        );
        expect(configurations[0].resources[0].resource).toMatchObject({
            id: 'fsvol-sim'
        });
    });
});
