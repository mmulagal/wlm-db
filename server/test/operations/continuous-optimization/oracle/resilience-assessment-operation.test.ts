import { WorkloadInstance, CrrAssessment, AWSBackupAssessment } from '../../../../src/utils/common-types';
import { ORACLE_CRR_ASSESSMENT_SCRIPT } from '../../../../src/operations/continuous-optimization/oracle/ssm-scripts/resiliency-assessment-scripts';
import {
    getCrrDriftData,
    fetchDirectOntapCrrData
} from '../../../../src/operations/continuous-optimization/oracle/resilience-assessment-operation';
import { getOracleAwsBackupDriftData } from '../../../../src/operations/continuous-optimization/oracle/resilience-awsBackup-assessment-operations';
import { OracleGenericParameterDriftResponseType } from '../../../../src/routes/types/oracle-continuous-optimization.types';
import {
    AssessmentStatus,
    ASSESSMENT_RESOURCE_TYPE,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../../../src/utils/continous-optimization-consts';
import {
    AssessmentErrorItemType,
    AssessmentItemType
} from '../../../../src/routes/types/continuous-optimization.types';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

const BASE_INSTANCE_RECORD: WorkloadInstance = {
    id: 'oracle-instance-1',
    name: 'testdb',
    type: 'ORACLE',
    region: 'us-east-1',
    sqlAuthEnabled: false,
    fsxFileSystem: 'fs-0abc123def456',
    activeNodeInstanceid: 'i-0abc123def456',
    cloudProviderAccountId: '123456789012',
    resourceName: 'oracle-host-1',
    svmOntapName: ['svm_oracle_prod'],
    mappedVolumeNames: ['data_vol', 'log_vol', 'redo_vol'],
    mappedVolumesUuids: ['uuid-data', 'uuid-log', 'uuid-redo'],
    redoVolumeNames: ['redo_vol']
};

const EMPTY_ONTAP_CRR_DATA = {
    clusterPeerDetailsJson: '[]',
    vserverPeerDetailsJson: '[]',
    snapMirrorDestinationDetailsJson: '[]'
};

describe('ORACLE_CRR_ASSESSMENT_SCRIPT', () => {
    it('should generate a bash script with correct shebang and pipefail', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        expect(script).toContain('#!/bin/bash');
        expect(script).toContain('set -euo pipefail');
    });

    it('should save original stdout before redirecting to log file', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        const fd3SaveIndex = script.indexOf('exec 3>&1');
        const execRedirectIndex = script.indexOf('exec >>');
        expect(fd3SaveIndex).toBeGreaterThan(-1);
        expect(execRedirectIndex).toBeGreaterThan(fd3SaveIndex);
    });

    it('should output final result to original stdout via fd 3', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        expect(script).toContain('echo "$crrResults" >&3');
    });

    it('should use SVM names instead of UUIDs', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        expect(script).toContain('"svm_oracle_prod"');
        expect(script).toContain('svm_names');
        expect(script).not.toContain('mappedSvmUuids');
    });

    it('should inject pre-fetched ONTAP cluster/svm-peer/snapmirror JSON instead of calling ONTAP directly', () => {
        const ontapCrrData = {
            clusterPeerDetailsJson: JSON.stringify([{ peerClusterName: 'remote-cluster', availability: 'available' }]),
            vserverPeerDetailsJson: JSON.stringify([{ svmname: 'svm_oracle_prod', state: 'peered' }]),
            snapMirrorDestinationDetailsJson: JSON.stringify([{ sourcePath: 'svm_oracle_prod:data_vol' }])
        };
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, ontapCrrData);
        expect(script).toContain(`cluster_peers_records = json.loads('${ontapCrrData.clusterPeerDetailsJson}')`);
        expect(script).toContain(`vserver_peers_records = json.loads('${ontapCrrData.vserverPeerDetailsJson}')`);
        expect(script).toContain(
            `snapmirror_dests_records = json.loads('${ontapCrrData.snapMirrorDestinationDetailsJson}')`
        );
    });

    it('should not make any ONTAP REST calls or use FSx credentials from the script', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        expect(script).not.toContain('ontapRestApiRequest');
        expect(script).not.toContain('def getFsxCredentials');
        expect(script).not.toContain('cluster/peers?fields=');
        expect(script).not.toContain('svm/peers?svm.name=');
        expect(script).not.toContain('snapmirror/relationships/?list_destinations_only=true');
    });

    it('should exclude redo volumes from mapped volume names', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        expect(script).toContain('"data_vol"');
        expect(script).toContain('"log_vol"');
        expect(script).not.toContain('"redo_vol"');
    });

    it('should include all volumes when no redo volumes specified', () => {
        const instanceWithoutRedo: WorkloadInstance = {
            ...BASE_INSTANCE_RECORD,
            redoVolumeNames: undefined
        };
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(instanceWithoutRedo, EMPTY_ONTAP_CRR_DATA);
        expect(script).toContain('"data_vol"');
        expect(script).toContain('"log_vol"');
        expect(script).toContain('"redo_vol"');
    });

    it('should include shared redo+control volumes that were not filtered by the caller', () => {
        const instanceWithSharedRedoCtrl: WorkloadInstance = {
            ...BASE_INSTANCE_RECORD,
            mappedVolumeNames: ['data_vol', 'log_vol', 'redo_vol', 'shared_redo_ctrl_vol'],
            mappedVolumesUuids: ['uuid-data', 'uuid-log', 'uuid-redo', 'uuid-shared-redo-ctrl'],
            redoVolumeNames: ['redo_vol']
        };
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(instanceWithSharedRedoCtrl, EMPTY_ONTAP_CRR_DATA);
        expect(script).toContain('"data_vol"');
        expect(script).toContain('"log_vol"');
        expect(script).toContain('"shared_redo_ctrl_vol"');
        expect(script).not.toContain('"redo_vol"');
    });

    it('should handle single SVM name (not array)', () => {
        const instanceSingleSvm: WorkloadInstance = {
            ...BASE_INSTANCE_RECORD,
            svmOntapName: 'single_svm'
        };
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(instanceSingleSvm, EMPTY_ONTAP_CRR_DATA);
        expect(script).toContain('"single_svm"');
    });

    it('should match peer info from SnapMirror destination SVM, not all peers', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        // prettier-ignore
        expect(script).toContain('dest_svm = dest.get(\'destinationVserverName\', \'\')');
        // prettier-ignore
        expect(script).toContain('if dest_svm in mapping[\'peerSvmNames\']');
    });

    it('should not contain inline ontap_request bash function or manual credential parsing', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD, EMPTY_ONTAP_CRR_DATA);
        expect(script).not.toContain('ontap_request ()');
        expect(script).not.toContain('fsxusername=$(echo');
        expect(script).not.toContain('fsxpassword=$(echo');
    });
});

describe('fetchDirectOntapCrrData', () => {
    beforeEach(() => {
        resetProxyOverrides();
    });

    it('fetches cluster peers, svm peers and snapmirror relationships and shapes them for the SSM script', async () => {
        registerProxyGetResponse({
            targetId: 'fs-0abc123def456',
            ontapPath: 'api/cluster/peers',
            body: ontapPage([{ name: 'FsxIdfs-remote1', status: { state: 'available' } }])
        });
        registerProxyGetResponse({
            targetId: 'fs-0abc123def456',
            ontapPath: 'api/svm/peers',
            body: ontapPage([
                {
                    name: 'peer-relationship-1',
                    state: 'peered',
                    applications: ['snapmirror'],
                    peer: { cluster: { name: 'FsxIdfs-remote1' }, svm: { uuid: 'peer-svm-uuid', name: 'peer-svm' } },
                    svm: { name: 'svm_oracle_prod', uuid: 'svm-uuid-1' }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-0abc123def456',
            ontapPath: 'api/snapmirror/relationships',
            body: ontapPage([
                {
                    policy: { name: 'MirrorAllSnapshots', type: 'async_mirror' },
                    state: 'snapmirrored',
                    source: { path: 'svm_oracle_prod:data_vol', svm: { name: 'svm_oracle_prod', uuid: 'svm-uuid-1' } },
                    destination: { path: 'peer-svm:data_vol_dest', svm: { name: 'peer-svm', uuid: 'peer-svm-uuid' } }
                }
            ])
        });

        const result = await fetchDirectOntapCrrData('acct-1', BASE_INSTANCE_RECORD);

        expect(JSON.parse(result.clusterPeerDetailsJson)).toEqual([
            { peerClusterName: 'FsxIdfs-remote1', availability: 'available' }
        ]);
        expect(JSON.parse(result.vserverPeerDetailsJson)).toEqual([
            {
                name: 'peer-relationship-1',
                state: 'peered',
                applications: ['snapmirror'],
                peerClusterName: 'FsxIdfs-remote1',
                peerSvmUuid: 'peer-svm-uuid',
                peerSvmName: 'peer-svm',
                svmname: 'svm_oracle_prod',
                svmuuid: 'svm-uuid-1'
            }
        ]);
        expect(JSON.parse(result.snapMirrorDestinationDetailsJson)).toEqual([
            {
                policyName: 'MirrorAllSnapshots',
                policyType: 'async_mirror',
                state: 'snapmirrored',
                sourceVserverName: 'svm_oracle_prod',
                sourceVserverUuid: 'svm-uuid-1',
                sourcePath: 'svm_oracle_prod:data_vol',
                destinationVserverName: 'peer-svm',
                destinationVserverUuid: 'peer-svm-uuid',
                destinationPath: 'peer-svm:data_vol_dest'
            }
        ]);
    });

    it('skips svm peers and snapmirror relationships without failing cluster peers when the mapped SVM name is missing', async () => {
        registerProxyGetResponse({
            targetId: 'fs-0abc123def456',
            ontapPath: 'api/cluster/peers',
            body: ontapPage([{ name: 'FsxIdfs-remote1', status: { state: 'available' } }])
        });

        const result = await fetchDirectOntapCrrData('acct-1', { ...BASE_INSTANCE_RECORD, svmOntapName: undefined });

        expect(JSON.parse(result.clusterPeerDetailsJson)).toHaveLength(1);
        expect(result.vserverPeerDetailsJson).toBe('[]');
        expect(result.snapMirrorDestinationDetailsJson).toBe('[]');
    });

    it('batches svm peer/snapmirror lookups across multiple mapped SVM names', async () => {
        registerProxyGetResponse({
            targetId: 'fs-0abc123def456',
            ontapPath: 'api/svm/peers',
            body: ontapPage([{ name: 'peer-1', state: 'peered', svm: { name: 'svm_oracle_prod', uuid: 'svm-uuid-1' } }])
        });

        const result = await fetchDirectOntapCrrData('acct-1', {
            ...BASE_INSTANCE_RECORD,
            svmOntapName: ['svm_oracle_prod', 'svm_oracle_standby']
        });

        expect(JSON.parse(result.vserverPeerDetailsJson)).toHaveLength(1);
    });
});

describe('getCrrDriftData', () => {
    const accountId = 'test-account';
    const credentialsId = 'test-creds';
    const region = 'us-east-1';
    const databaseHostId = 'host-1';
    const databaseInstanceId = 'instance-1';

    it('should return OPTIMIZED when all volumes have CRR enabled', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                { volumeName: 'data_vol', isCRREnabled: true, isSnapMirrored: true },
                { volumeName: 'log_vol', isCRREnabled: true, isSnapMirrored: true }
            ]
        };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;

        expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(result.objectsInViolation).toEqual([]);
        expect(result.totalObjectsInViolation).toBe(0);
        expect(result.totalObjectsAssessed).toBe(2);
        expect(result.violationDetails).toEqual([]);
    });

    it('should return NOT_OPTIMIZED when some volumes lack CRR', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                {
                    volumeName: 'data_vol',
                    volumeUuid: 'uuid-data',
                    fsxVolumeId: 'fsvol-data',
                    isCRREnabled: true,
                    isSnapMirrored: true
                },
                {
                    volumeName: 'log_vol',
                    volumeUuid: 'uuid-log',
                    fsxVolumeId: 'fsvol-log',
                    isCRREnabled: false,
                    isSnapMirrored: false
                }
            ]
        };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.objectsInViolation).toEqual([
            { ontapVolumeName: 'log_vol', ontapVolumeUuid: 'uuid-log', fsxVolumeId: 'fsvol-log' }
        ]);
        expect(result.totalObjectsInViolation).toBe(1);
        expect(result.totalObjectsAssessed).toBe(2);
        expect(result.violationDetails).toEqual([
            { objectName: 'log_vol', objectType: 'Volume', value: 'Disabled', recommended: 'Enabled' }
        ]);
    });

    it('should return NOT_OPTIMIZED when all volumes lack CRR', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                {
                    volumeName: 'data_vol',
                    volumeUuid: 'uuid-data',
                    fsxVolumeId: 'fsvol-data',
                    isCRREnabled: false,
                    isSnapMirrored: false
                },
                {
                    volumeName: 'log_vol',
                    volumeUuid: 'uuid-log',
                    fsxVolumeId: 'fsvol-log',
                    isCRREnabled: false,
                    isSnapMirrored: false
                }
            ]
        };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.objectsInViolation).toEqual([
            { ontapVolumeName: 'data_vol', ontapVolumeUuid: 'uuid-data', fsxVolumeId: 'fsvol-data' },
            { ontapVolumeName: 'log_vol', ontapVolumeUuid: 'uuid-log', fsxVolumeId: 'fsvol-log' }
        ]);
        expect(result.totalObjectsInViolation).toBe(2);
    });

    it('should return correct metadata fields', () => {
        const crrData: CrrAssessment = {
            crrDetails: [{ volumeName: 'data_vol', isCRREnabled: true, isSnapMirrored: true }]
        };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;
        expect(result.id).toBe('crr');
        expect(result.severity).toBe(SEVERITY.WARNING);
        expect(result.categories).toEqual([AwsWellArchitecturedPillars.RELIABILITY]);
        expect(result.resourceType).toBe(ASSESSMENT_RESOURCE_TYPE.VOLUME);
        expect(result.recommended).toBe('crr-enabled');
    });

    it('should return error message when assessment data is empty', () => {
        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            {} as CrrAssessment
        ) as AssessmentErrorItemType;
        expect(result).toHaveProperty('errorMessage');
        expect((result as { errorMessage: string }).errorMessage).toContain('crr');
    });

    it('should handle single volume assessment', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                {
                    volumeName: 'data_vol',
                    volumeUuid: 'uuid-data',
                    fsxVolumeId: 'fsvol-data',
                    isCRREnabled: false,
                    isSnapMirrored: false
                }
            ]
        };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.objectsInViolation).toEqual([
            { ontapVolumeName: 'data_vol', ontapVolumeUuid: 'uuid-data', fsxVolumeId: 'fsvol-data' }
        ]);
        expect(result.totalObjectsAssessed).toBe(1);
        expect(result.totalObjectsInViolation).toBe(1);
    });

    it('should include undefined fields when volumeUuid and fsxVolumeId are not provided', () => {
        const crrData: CrrAssessment = {
            crrDetails: [{ volumeName: 'data_vol', isCRREnabled: false, isSnapMirrored: false }]
        };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;
        expect(result.objectsInViolation).toEqual([
            { ontapVolumeName: 'data_vol', ontapVolumeUuid: undefined, fsxVolumeId: undefined }
        ]);
    });

    it('should handle empty crrDetails array', () => {
        const crrData: CrrAssessment = { crrDetails: [] };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;
        expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(result.totalObjectsAssessed).toBe(0);
        expect(result.totalObjectsInViolation).toBe(0);
    });

    it('should return NOT_OPTIMIZED when volumes are SnapMirrored locally but not cross-region', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                {
                    volumeName: 'data_vol',
                    volumeUuid: 'uuid-data',
                    fsxVolumeId: 'fsvol-data',
                    isCRREnabled: false,
                    isSnapMirrored: true
                },
                {
                    volumeName: 'log_vol',
                    volumeUuid: 'uuid-log',
                    fsxVolumeId: 'fsvol-log',
                    isCRREnabled: false,
                    isSnapMirrored: true
                }
            ]
        };

        const result = getCrrDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            crrData
        ) as AssessmentItemType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.totalObjectsInViolation).toBe(2);
        expect(result.objectsInViolation).toEqual([
            { ontapVolumeName: 'data_vol', ontapVolumeUuid: 'uuid-data', fsxVolumeId: 'fsvol-data' },
            { ontapVolumeName: 'log_vol', ontapVolumeUuid: 'uuid-log', fsxVolumeId: 'fsvol-log' }
        ]);
    });

    describe('control-file multiplexing exemption', () => {
        it('should exempt control-file-only volumes when another control file volume has CRR', () => {
            const crrData: CrrAssessment = {
                crrDetails: [
                    {
                        volumeName: 'data_vol',
                        volumeUuid: 'uuid-data',
                        fsxVolumeId: 'fsvol-data',
                        isCRREnabled: true,
                        isSnapMirrored: true
                    },
                    {
                        volumeName: 'ctrl_vol_1',
                        volumeUuid: 'uuid-ctrl-1',
                        fsxVolumeId: 'fsvol-ctrl-1',
                        isCRREnabled: true,
                        isSnapMirrored: true
                    },
                    {
                        volumeName: 'ctrl_vol_2',
                        volumeUuid: 'uuid-ctrl-2',
                        fsxVolumeId: 'fsvol-ctrl-2',
                        isCRREnabled: false,
                        isSnapMirrored: false
                    }
                ]
            };

            const result = getCrrDriftData(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                crrData,
                ['uuid-ctrl-1', 'uuid-ctrl-2'],
                ['uuid-ctrl-1', 'uuid-ctrl-2']
            ) as AssessmentItemType;
            expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(result.objectsInViolation).toEqual([]);
            expect(result.totalObjectsInViolation).toBe(0);
            expect(result.totalObjectsAssessed).toBe(3);
        });

        it('should flag control-file-only volumes when no control file volume has CRR', () => {
            const crrData: CrrAssessment = {
                crrDetails: [
                    {
                        volumeName: 'data_vol',
                        volumeUuid: 'uuid-data',
                        fsxVolumeId: 'fsvol-data',
                        isCRREnabled: true,
                        isSnapMirrored: true
                    },
                    {
                        volumeName: 'ctrl_vol_1',
                        volumeUuid: 'uuid-ctrl-1',
                        fsxVolumeId: 'fsvol-ctrl-1',
                        isCRREnabled: false,
                        isSnapMirrored: false
                    },
                    {
                        volumeName: 'ctrl_vol_2',
                        volumeUuid: 'uuid-ctrl-2',
                        fsxVolumeId: 'fsvol-ctrl-2',
                        isCRREnabled: false,
                        isSnapMirrored: false
                    }
                ]
            };

            const result = getCrrDriftData(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                crrData,
                ['uuid-ctrl-1', 'uuid-ctrl-2'],
                ['uuid-ctrl-1', 'uuid-ctrl-2']
            ) as AssessmentItemType;
            expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(result.objectsInViolation).toEqual([
                { ontapVolumeName: 'ctrl_vol_1', ontapVolumeUuid: 'uuid-ctrl-1', fsxVolumeId: 'fsvol-ctrl-1' },
                { ontapVolumeName: 'ctrl_vol_2', ontapVolumeUuid: 'uuid-ctrl-2', fsxVolumeId: 'fsvol-ctrl-2' }
            ]);
            expect(result.totalObjectsInViolation).toBe(2);
        });

        it('should not exempt shared volumes that contain control files and other file types', () => {
            const crrData: CrrAssessment = {
                crrDetails: [
                    {
                        volumeName: 'shared_data_ctrl_vol',
                        volumeUuid: 'uuid-shared',
                        fsxVolumeId: 'fsvol-shared',
                        isCRREnabled: false,
                        isSnapMirrored: false
                    },
                    {
                        volumeName: 'ctrl_only_vol',
                        volumeUuid: 'uuid-ctrl-only',
                        fsxVolumeId: 'fsvol-ctrl-only',
                        isCRREnabled: true,
                        isSnapMirrored: true
                    }
                ]
            };

            const result = getCrrDriftData(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                crrData,
                ['uuid-shared', 'uuid-ctrl-only'],
                ['uuid-ctrl-only']
            ) as AssessmentItemType;
            expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(result.objectsInViolation).toEqual([
                { ontapVolumeName: 'shared_data_ctrl_vol', ontapVolumeUuid: 'uuid-shared', fsxVolumeId: 'fsvol-shared' }
            ]);
            expect(result.totalObjectsInViolation).toBe(1);
        });

        it('should exempt control-file-only volume when a shared control+data volume has CRR', () => {
            const crrData: CrrAssessment = {
                crrDetails: [
                    {
                        volumeName: 'shared_data_ctrl_vol',
                        volumeUuid: 'uuid-shared',
                        fsxVolumeId: 'fsvol-shared',
                        isCRREnabled: true,
                        isSnapMirrored: true
                    },
                    {
                        volumeName: 'ctrl_only_vol',
                        volumeUuid: 'uuid-ctrl-only',
                        fsxVolumeId: 'fsvol-ctrl-only',
                        isCRREnabled: false,
                        isSnapMirrored: false
                    }
                ]
            };

            const result = getCrrDriftData(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                crrData,
                ['uuid-shared', 'uuid-ctrl-only'],
                ['uuid-ctrl-only']
            ) as AssessmentItemType;
            expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(result.objectsInViolation).toEqual([]);
            expect(result.totalObjectsInViolation).toBe(0);
        });

        it('should behave as before when no control file volume IDs are provided', () => {
            const crrData: CrrAssessment = {
                crrDetails: [
                    {
                        volumeName: 'vol_a',
                        volumeUuid: 'uuid-a',
                        fsxVolumeId: 'fsvol-a',
                        isCRREnabled: true,
                        isSnapMirrored: true
                    },
                    {
                        volumeName: 'vol_b',
                        volumeUuid: 'uuid-b',
                        fsxVolumeId: 'fsvol-b',
                        isCRREnabled: false,
                        isSnapMirrored: false
                    }
                ]
            };

            const result = getCrrDriftData(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                crrData
            ) as AssessmentItemType;
            expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(result.objectsInViolation).toEqual([
                { ontapVolumeName: 'vol_b', ontapVolumeUuid: 'uuid-b', fsxVolumeId: 'fsvol-b' }
            ]);
            expect(result.totalObjectsInViolation).toBe(1);
        });

        it('should not exempt volumes with undefined volumeUuid even if in controlFileOnlyVolumeIds', () => {
            const crrData: CrrAssessment = {
                crrDetails: [
                    {
                        volumeName: 'ctrl_vol_1',
                        volumeUuid: 'uuid-ctrl-1',
                        fsxVolumeId: 'fsvol-ctrl-1',
                        isCRREnabled: true,
                        isSnapMirrored: true
                    },
                    {
                        volumeName: 'ctrl_vol_2',
                        isCRREnabled: false,
                        isSnapMirrored: false
                    }
                ]
            };

            const result = getCrrDriftData(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                crrData,
                ['uuid-ctrl-1', 'uuid-ctrl-2'],
                ['uuid-ctrl-1', 'uuid-ctrl-2']
            ) as AssessmentItemType;
            expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(result.objectsInViolation).toEqual([
                { ontapVolumeName: 'ctrl_vol_2', ontapVolumeUuid: undefined, fsxVolumeId: undefined }
            ]);
            expect(result.totalObjectsInViolation).toBe(1);
        });
    });
});

describe('getOracleAwsBackupDriftData', () => {
    const accountId = 'test-account';
    const credentialsId = 'test-creds';
    const region = 'us-east-1';
    const databaseHostId = 'host-1';
    const databaseInstanceId = 'instance-1';

    it('should return OPTIMIZED when all volumes have AWS backup enabled', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: true,
            volumeBackupDetails: [
                { uuid: 'uuid-data', name: 'data_vol', isAWSBackupEnabled: true },
                { uuid: 'uuid-log', name: 'log_vol', isAWSBackupEnabled: true }
            ]
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        ) as OracleGenericParameterDriftResponseType;
        expect(result).not.toHaveProperty('errorMessage');
        expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(result.totalObjectsInViolation).toBe(0);
        expect(result.totalObjectsAssessed).toBe(2);
    });

    it('should set totalObjectsAssessed to mapped volume count when optimized (e.g. scheduled FSx backup)', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: true,
            volumeBackupDetails: [
                { uuid: 'uuid-a', name: 'vol_a', isAWSBackupEnabled: true },
                { uuid: 'uuid-b', name: 'vol_b', isAWSBackupEnabled: true },
                { uuid: 'uuid-c', name: 'vol_c', isAWSBackupEnabled: true }
            ]
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        ) as OracleGenericParameterDriftResponseType;
        expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(result.totalObjectsAssessed).toBe(3);
    });

    it('should return NOT_OPTIMIZED when some volumes lack backup', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: false,
            volumeBackupDetails: [
                { uuid: 'uuid-data', name: 'data_vol', isAWSBackupEnabled: true },
                { uuid: 'uuid-log', name: 'log_vol', isAWSBackupEnabled: false }
            ]
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        ) as OracleGenericParameterDriftResponseType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.totalObjectsInViolation).toBe(1);
        expect(result.totalObjectsAssessed).toBe(2);
        expect(result.violationDetails).toEqual([
            { objectName: 'log_vol', objectType: 'Volume', value: 'Disabled', recommended: 'Enabled' }
        ]);
    });

    it('should return NOT_OPTIMIZED when all volumes lack backup', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: false,
            volumeBackupDetails: [
                { uuid: 'uuid-data', name: 'data_vol', isAWSBackupEnabled: false },
                { uuid: 'uuid-log', name: 'log_vol', isAWSBackupEnabled: false }
            ]
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        ) as OracleGenericParameterDriftResponseType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.totalObjectsInViolation).toBe(2);
        expect(result.totalObjectsAssessed).toBe(2);
    });

    it('should return correct metadata fields from golden config', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: true,
            volumeBackupDetails: [{ uuid: 'uuid-data', name: 'data_vol', isAWSBackupEnabled: true }]
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        ) as OracleGenericParameterDriftResponseType;
        expect(result.id).toBe('backup-configuration');
        expect(result.severity).toBe(SEVERITY.WARNING);
        expect(result.categories).toEqual([AwsWellArchitecturedPillars.RELIABILITY]);
        expect(result.resourceType).toBe(ASSESSMENT_RESOURCE_TYPE.VOLUME);
        expect(result.recommended).toBe('aws-backup-enabled');
    });

    it('should return error message when assessment data is empty', () => {
        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            {} as AWSBackupAssessment
        );
        expect(result).toHaveProperty('errorMessage');
        expect((result as { errorMessage: string }).errorMessage).toContain('aws-backup');
    });

    it('should propagate error message from assessment data', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: false,
            errorMessage: 'Found no FSx for ONTAP volumes for the instance testdb.',
            volumeBackupDetails: []
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        );
        expect(result).toHaveProperty('errorMessage');
        expect((result as { errorMessage: string }).errorMessage).toBe(
            'Found no FSx for ONTAP volumes for the instance testdb.'
        );
    });

    it('should handle single volume assessment', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: false,
            volumeBackupDetails: [{ uuid: 'uuid-data', name: 'data_vol', isAWSBackupEnabled: false }]
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        ) as OracleGenericParameterDriftResponseType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.totalObjectsAssessed).toBe(1);
        expect(result.totalObjectsInViolation).toBe(1);
    });

    it('should return totalObjectsInViolation as 1 when backup is disabled and no volume details', () => {
        const assessmentData: AWSBackupAssessment = {
            fileSystemId: 'fs-0abc123',
            isAWSBackupEnabled: false,
            volumeBackupDetails: []
        };

        const result = getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            assessmentData
        ) as OracleGenericParameterDriftResponseType;
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.totalObjectsInViolation).toBe(1);
        expect(result.totalObjectsAssessed).toBe(1);
    });
});
