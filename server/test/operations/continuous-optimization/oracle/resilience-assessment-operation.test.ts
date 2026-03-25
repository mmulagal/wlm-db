import { WorkloadInstance, CrrAssessment } from '../../../../src/utils/common-types';
import { ORACLE_CRR_ASSESSMENT_SCRIPT } from '../../../../src/operations/continuous-optimization/oracle/ssm-scripts/resiliency-assessment-scripts';
import { getCrrDriftData } from '../../../../src/operations/continuous-optimization/oracle/resilience-assessment-operation';
import {
    AssessmentStatus,
    ASSESSMENT_RESOURCE_TYPE,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../../../src/utils/continous-optimization-consts';

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

describe('ORACLE_CRR_ASSESSMENT_SCRIPT', () => {
    it('should generate a bash script with correct shebang and pipefail', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).toContain('#!/bin/bash');
        expect(script).toContain('set -euo pipefail');
    });

    it('should save original stdout before redirecting to log file', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        const fd3SaveIndex = script.indexOf('exec 3>&1');
        const execRedirectIndex = script.indexOf('exec >>');
        expect(fd3SaveIndex).toBeGreaterThan(-1);
        expect(execRedirectIndex).toBeGreaterThan(fd3SaveIndex);
    });

    it('should output final result to original stdout via fd 3', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).toContain('echo "$crrResults" >&3');
    });

    it('should use SVM names instead of UUIDs', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).toContain('"svm_oracle_prod"');
        expect(script).toContain('svm_names');
        expect(script).not.toContain('mappedSvmUuids');
    });

    it('should use svm.name in ONTAP API queries', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).toContain('svm/peers?svm.name={svm_name}');
        expect(script).toContain('source.svm.name={svm_name}');
        expect(script).not.toContain('svm.uuid={svm_uuid}');
        expect(script).not.toContain('source.svm.uuid={svm_uuid}');
    });

    it('should use shared Python helpers (getFsxCredentials + ontapRestApiRequest)', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).toContain('def getFsxCredentials(fileSystemId)');
        expect(script).toContain('def ontapRestApiRequest(fileSystemId, region, method, url');
        expect(script).toContain('PYTHON');
    });

    it('should exclude redo volumes from mapped volume names', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).toContain('"data_vol"');
        expect(script).toContain('"log_vol"');
        expect(script).not.toContain('"redo_vol"');
    });

    it('should include all volumes when no redo volumes specified', () => {
        const instanceWithoutRedo: WorkloadInstance = {
            ...BASE_INSTANCE_RECORD,
            redoVolumeNames: undefined
        };
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(instanceWithoutRedo);
        expect(script).toContain('"data_vol"');
        expect(script).toContain('"log_vol"');
        expect(script).toContain('"redo_vol"');
    });

    it('should use first FSx ID when comma-separated', () => {
        const instanceWithMultipleFsx: WorkloadInstance = {
            ...BASE_INSTANCE_RECORD,
            fsxFileSystem: 'fs-first,fs-second'
        };
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(instanceWithMultipleFsx);
        expect(script).toContain('fs-first');
        expect(script).not.toContain('fs-second');
    });

    it('should handle single SVM name (not array)', () => {
        const instanceSingleSvm: WorkloadInstance = {
            ...BASE_INSTANCE_RECORD,
            svmOntapName: 'single_svm'
        };
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(instanceSingleSvm);
        expect(script).toContain('"single_svm"');
    });

    it('should include cluster peers, vserver peers, and snapmirror API calls', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).toContain('cluster/peers?fields=name,status.state,remote.ip_addresses');
        expect(script).toContain('svm/peers?svm.name=');
        expect(script).toContain('snapmirror/relationships/?list_destinations_only=true');
    });

    it('should not contain inline ontap_request bash function or manual credential parsing', () => {
        const script = ORACLE_CRR_ASSESSMENT_SCRIPT(BASE_INSTANCE_RECORD);
        expect(script).not.toContain('ontap_request ()');
        expect(script).not.toContain('fsxusername=$(echo');
        expect(script).not.toContain('fsxpassword=$(echo');
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

        const result = getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, crrData);
        expect(result).not.toHaveProperty('errorMessage');
        expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(result.objectsInViolation).toEqual([]);
        expect(result.totalObjectsInViolation).toBe(0);
        expect(result.totalObjectsAssessed).toBe(2);
    });

    it('should return NOT_OPTIMIZED when some volumes lack CRR', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                { volumeName: 'data_vol', volumeUuid: 'uuid-data', isCRREnabled: true, isSnapMirrored: true },
                { volumeName: 'log_vol', volumeUuid: 'uuid-log', isCRREnabled: false, isSnapMirrored: false }
            ]
        };

        const result = getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, crrData);
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.objectsInViolation).toEqual([{ ontapVolumeName: 'log_vol', ontapVolumeUuid: 'uuid-log' }]);
        expect(result.totalObjectsInViolation).toBe(1);
        expect(result.totalObjectsAssessed).toBe(2);
    });

    it('should return NOT_OPTIMIZED when all volumes lack CRR', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                { volumeName: 'data_vol', volumeUuid: 'uuid-data', isCRREnabled: false, isSnapMirrored: false },
                { volumeName: 'log_vol', volumeUuid: 'uuid-log', isCRREnabled: false, isSnapMirrored: false }
            ]
        };

        const result = getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, crrData);
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.objectsInViolation).toEqual([
            { ontapVolumeName: 'data_vol', ontapVolumeUuid: 'uuid-data' },
            { ontapVolumeName: 'log_vol', ontapVolumeUuid: 'uuid-log' }
        ]);
        expect(result.totalObjectsInViolation).toBe(2);
    });

    it('should return correct metadata fields', () => {
        const crrData: CrrAssessment = {
            crrDetails: [{ volumeName: 'data_vol', isCRREnabled: true, isSnapMirrored: true }]
        };

        const result = getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, crrData);
        expect(result.name).toBe('crr');
        expect(result.severity).toBe(SEVERITY.WARNING);
        expect(result.tags).toEqual([AwsWellArchitecturedPillars.RELIABILITY]);
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
        );
        expect(result).toHaveProperty('errorMessage');
        expect((result as { errorMessage: string }).errorMessage).toContain('crr');
    });

    it('should handle single volume assessment', () => {
        const crrData: CrrAssessment = {
            crrDetails: [
                { volumeName: 'data_vol', volumeUuid: 'uuid-data', isCRREnabled: false, isSnapMirrored: false }
            ]
        };

        const result = getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, crrData);
        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.objectsInViolation).toEqual([{ ontapVolumeName: 'data_vol', ontapVolumeUuid: 'uuid-data' }]);
        expect(result.totalObjectsAssessed).toBe(1);
        expect(result.totalObjectsInViolation).toBe(1);
    });

    it('should include undefined volumeUuid when not provided in crrDetails', () => {
        const crrData: CrrAssessment = {
            crrDetails: [{ volumeName: 'data_vol', isCRREnabled: false, isSnapMirrored: false }]
        };

        const result = getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, crrData);
        expect(result.objectsInViolation).toEqual([{ ontapVolumeName: 'data_vol', ontapVolumeUuid: undefined }]);
    });

    it('should handle empty crrDetails array', () => {
        const crrData: CrrAssessment = { crrDetails: [] };

        const result = getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, crrData);
        expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(result.totalObjectsAssessed).toBe(0);
        expect(result.totalObjectsInViolation).toBe(0);
    });
});
