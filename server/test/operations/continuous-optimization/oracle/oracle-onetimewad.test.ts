import { describe, it, expect } from 'vitest';
import {
    oracleOneTimeWadPythonScript,
    ORACLE_ONETIMEWAD_SCRIPT_VERSION
} from '../../../../src/operations/continuous-optimization/oracle/ssm-scripts/one-time-wad/oracle-onetimewad';
import {
    uploadOfflineAssessment,
    downloadOfflineAssessmentScript
} from '../../../../src/operations/offline-assessment-operations';
import {
    OracleMappedOntapVolumesResponse,
    OracleVolumeRecord
} from '../../../../src/operations/workloads/oracle/common-types';
import { ACCOUNT_ID } from '../../../utils/consts';

// Sample valid Oracle assessment data
const createValidOracleAssessmentData = (ec2InstanceId: string = 'i-test-oracle') => ({
    metadata: {
        ec2InstanceId,
        hostname: 'test-oracle-host',
        storageEndpoint: 'fs-0123456789abcdef0',
        fsxId: 'fs-0123456789abcdef0',
        assessmentTimestamp: new Date().toISOString(),
        osVersion: 'Oracle Linux 8',
        databaseType: 'ORACLE',
        scriptVersion: '1.0.0',
        oracleSid: 'ORCL',
        oracleHome: '/u01/app/oracle/product/19.0.0/dbhome_1',
        deploymentType: 'Standalone',
        numberOfDatabaseInstances: 1,
        isCDB: false,
        pdbCount: 0
    } as any,
    rawdata: {
        hostLevelDetails: {
            headroom: {
                ssdStorageCapacityInBytes: 1099511627776,
                storageUsedInBytes: 549755813888,
                storageAvailableInBytes: 549755813888,
                headroomPercent: 50,
                aggregateCount: 1
            },
            errors: {}
        },
        instanceLevelDetails: {
            ORCL: {
                instanceDetails: {
                    databaseVersion: '19.0.0.0.0',
                    databaseName: 'ORCL',
                    oracleHome: '/u01/app/oracle/product/19.0.0/dbhome_1',
                    deploymentType: 'Standalone',
                    sid: 'ORCL',
                    isCDB: false
                } as {
                    databaseVersion: string;
                    databaseName: string;
                    oracleHome: string;
                    deploymentType: string;
                    sid: string;
                    isCDB: boolean;
                    isASMManaged?: boolean;
                    [key: string]: unknown;
                },
                mappedOntapVolumes: {
                    protocol: 'NFS',
                    volumeMappings: [
                        {
                            ORCL: {
                                isCDB: false,
                                ontapVolumes: {
                                    datafiles: [
                                        {
                                            volumeId: 'vol-uuid-1',
                                            volumeName: 'oracle_data',
                                            svmName: 'svm-1',
                                            svmId: 'svm-uuid-1'
                                        } as OracleVolumeRecord
                                    ]
                                }
                            }
                        }
                    ]
                } as OracleMappedOntapVolumesResponse,
                storage: {
                    volumes: {
                        error: '',
                        data: [],
                        filesystemId: 'fs-0123456789abcdef0'
                    },
                    luns: {
                        error: 'LUNs not applicable',
                        data: [] as Array<Record<string, unknown>>
                    },
                    binaryVolumes: {
                        error: '',
                        data: []
                    },
                    fraEnabled: 'no',
                    rmanCompressionEnabled: 'no',
                    errors: {}
                },
                os: {},
                pluggableDatabases: [] as Array<{ pdbName: string; pdbId?: string; pdbStatus?: string }>,
                isDataGuardDeployed: false,
                dataguardDetails: {}
            }
        },
        errors: []
    }
});

describe('OracleOnetimewad', () => {
    describe('Exports', () => {
        it('should export ORACLE_ONETIMEWAD_SCRIPT_VERSION', () => {
            expect(ORACLE_ONETIMEWAD_SCRIPT_VERSION).toBeDefined();
            expect(typeof ORACLE_ONETIMEWAD_SCRIPT_VERSION).toBe('string');
            expect(ORACLE_ONETIMEWAD_SCRIPT_VERSION).toBe('1.0.0');
        });

        it('should export oracleOneTimeWadPythonScript', () => {
            expect(oracleOneTimeWadPythonScript).toBeDefined();
            expect(typeof oracleOneTimeWadPythonScript).toBe('string');
            expect(oracleOneTimeWadPythonScript.length).toBeGreaterThan(0);
        });
    });

    describe('Script structure', () => {
        it('should have Python shebang and encoding', () => {
            expect(oracleOneTimeWadPythonScript).toContain('#!/usr/bin/env python');
            expect(oracleOneTimeWadPythonScript).toContain('# -*- coding: utf-8 -*-');
        });

        it('should define SCRIPT_VERSION', () => {
            expect(oracleOneTimeWadPythonScript).toContain('SCRIPT_VERSION = "1.0.0"');
        });

        it('should have argument parser with required arguments', () => {
            expect(oracleOneTimeWadPythonScript).toContain('argparse.ArgumentParser');
            expect(oracleOneTimeWadPythonScript).toContain('--StorageManagementAddress');
            expect(oracleOneTimeWadPythonScript).toContain('--OracleSid');
            expect(oracleOneTimeWadPythonScript).toContain('required=True');
        });

        it('should have main function and entry point', () => {
            expect(oracleOneTimeWadPythonScript).toContain('def main():');
            expect(oracleOneTimeWadPythonScript).toContain('if __name__ == "__main__":');
            expect(oracleOneTimeWadPythonScript).toContain('main()');
        });
    });

    describe('Pre-flight checks', () => {
        it('should validate Oracle SID', () => {
            expect(oracleOneTimeWadPythonScript).toContain('/etc/oratab');
            expect(oracleOneTimeWadPythonScript).toContain('parse_oratab()');
            expect(oracleOneTimeWadPythonScript).toContain('Oracle SID Validation Failed');
        });

        it('should validate Oracle credentials', () => {
            expect(oracleOneTimeWadPythonScript).toContain('Validating Oracle credentials...');
            expect(oracleOneTimeWadPythonScript).toContain('get_oracle_credentials');
        });

        it('should validate ONTAP credentials', () => {
            expect(oracleOneTimeWadPythonScript).toContain('Validating ONTAP credentials...');
            expect(oracleOneTimeWadPythonScript).toContain('get_fsx_credentials');
            expect(oracleOneTimeWadPythonScript).toContain('validate_ontap_connection');
        });
    });

    describe('Assessment flow', () => {
        it('should collect EC2 metadata', () => {
            expect(oracleOneTimeWadPythonScript).toContain('get_ec2_metadata()');
        });

        it('should collect Oracle instance details', () => {
            expect(oracleOneTimeWadPythonScript).toContain('Collecting Oracle instance details...');
            expect(oracleOneTimeWadPythonScript).toContain('get_instance_details');
        });

        it('should collect mapped ONTAP volumes', () => {
            expect(oracleOneTimeWadPythonScript).toContain('Collecting mapped ONTAP volumes...');
            expect(oracleOneTimeWadPythonScript).toContain('get_mapped_volumes');
        });

        it('should handle NFS and iSCSI protocols', () => {
            expect(oracleOneTimeWadPythonScript).toContain('if storage_protocol == "NFS":');
            expect(oracleOneTimeWadPythonScript).toContain('if storage_protocol == "iSCSI":');
        });
    });

    describe('Output structure', () => {
        it('should create result with metadata and rawdata', () => {
            expect(oracleOneTimeWadPythonScript).toContain('"metadata":');
            expect(oracleOneTimeWadPythonScript).toContain('"rawdata":');
            expect(oracleOneTimeWadPythonScript).toContain('"instanceLevelDetails":');
        });

        it('should write JSON output file', () => {
            expect(oracleOneTimeWadPythonScript).toContain('json.dump(result, f)');
            expect(oracleOneTimeWadPythonScript).toContain('Oracle_Assessment_v1_');
        });
    });

    describe('Error handling', () => {
        it('should handle errors gracefully', () => {
            expect(oracleOneTimeWadPythonScript).toContain('except Exception as e:');
            expect(oracleOneTimeWadPythonScript).toContain('ERROR: Assessment Failed');
            expect(oracleOneTimeWadPythonScript).toContain('sys.exit(1)');
        });
    });

    describe('Version consistency', () => {
        it('should have consistent version in script and constant', () => {
            const versionInScript = oracleOneTimeWadPythonScript.match(/SCRIPT_VERSION = "([^"]+)"/)?.[1];
            expect(versionInScript).toBe(ORACLE_ONETIMEWAD_SCRIPT_VERSION);
        });
    });

    describe('downloadOfflineAssessmentScript API', () => {
        it('should generate streaming ZIP for oracle database type', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID, 'oracle');

            expect(result).toBeDefined();
            expect(result.archive).toBeDefined();
            expect(result.filename).toBeDefined();
            expect(result.archive).toHaveProperty('readable');
            expect(result.archive).toHaveProperty('pipe');
            expect(result.filename).toContain('.zip');
            expect(result.filename.toLowerCase()).toContain('oracle');
        });

        it('should handle oracle database type (lowercase)', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID, 'oracle');

            expect(result).toBeDefined();
            expect(result.archive).toBeDefined();
            expect(result.filename).toBeDefined();
        });

        it('should produce valid zip stream data for Oracle', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID, 'oracle');

            // Collect stream data to verify it produces valid zip content
            const chunks: Buffer[] = [];
            for await (const chunk of result.archive) {
                chunks.push(chunk as Buffer);
            }

            const zipBuffer = Buffer.concat(chunks);

            // Verify zip file signature (PK\x03\x04)
            expect(zipBuffer.length).toBeGreaterThan(0);
            expect(zipBuffer[0]).toBe(0x50); // 'P'
            expect(zipBuffer[1]).toBe(0x4b); // 'K'
            expect(zipBuffer[2]).toBe(0x03);
            expect(zipBuffer[3]).toBe(0x04);
        });

        it('should include Oracle script in ZIP', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID, 'oracle');

            const chunks: Buffer[] = [];
            for await (const chunk of result.archive) {
                chunks.push(chunk as Buffer);
            }

            const zipBuffer = Buffer.concat(chunks);

            // Verify ZIP contains Oracle script filename
            const zipContent = zipBuffer.toString('utf-8', 0, Math.min(5000, zipBuffer.length));
            expect(zipContent).toContain('Oracle');
            expect(zipContent).toContain('.py');

            // Verify ZIP file is not empty
            expect(zipBuffer.length).toBeGreaterThan(100);
        });
    });

    describe('uploadOfflineAssessment API', () => {
        it('should successfully upload valid Oracle assessment data', async () => {
            const assessmentData = createValidOracleAssessmentData();
            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test-oracle-assessment.json',
                'oracle'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
            expect(typeof result.jobId).toBe('string');
        });

        it('should handle oracle database type (lowercase)', async () => {
            const assessmentData = createValidOracleAssessmentData('i-test-oracle-case');
            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test.json',
                'oracle'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should pass credentialsId and region to Oracle handler', async () => {
            const assessmentData = createValidOracleAssessmentData('i-test-oracle-with-params');
            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test.json',
                'oracle',
                'credentials-123',
                'us-west-2'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should handle Oracle assessment with CDB and PDBs', async () => {
            const assessmentData = createValidOracleAssessmentData('i-test-oracle-cdb');
            assessmentData.metadata.oracleSid = 'CDB1';
            assessmentData.metadata.isCDB = true;
            assessmentData.metadata.pdbCount = 2;
            assessmentData.rawdata.instanceLevelDetails.ORCL.instanceDetails.isCDB = true;
            assessmentData.rawdata.instanceLevelDetails.ORCL.pluggableDatabases = [
                { pdbName: 'PDB1', pdbId: '1', pdbStatus: 'NORMAL' },
                { pdbName: 'PDB2', pdbId: '2', pdbStatus: 'NORMAL' }
            ];

            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test-cdb.json',
                'oracle'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should handle Oracle assessment with DataGuard', async () => {
            const assessmentData = createValidOracleAssessmentData('i-test-oracle-dg');
            assessmentData.rawdata.instanceLevelDetails.ORCL.isDataGuardDeployed = true;
            assessmentData.rawdata.instanceLevelDetails.ORCL.dataguardDetails = {
                dbUniqueName: 'ORCL_DG',
                dbName: 'ORCL',
                isPrimaryNode: true,
                role: 'PRIMARY'
            };

            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test-dataguard.json',
                'oracle'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should handle Oracle assessment with iSCSI protocol', async () => {
            const assessmentData = createValidOracleAssessmentData('i-test-oracle-iscsi');
            assessmentData.rawdata.instanceLevelDetails.ORCL.mappedOntapVolumes.protocol = 'iSCSI';
            assessmentData.rawdata.instanceLevelDetails.ORCL.mappedOntapVolumes.volumeMappings![0].ORCL.ontapVolumes = {
                datafiles: [
                    {
                        volumeId: 'vol-uuid-1',
                        volumeName: 'oracle_data',
                        svmName: 'svm-1',
                        svmId: 'svm-uuid-1',
                        lunName: 'lun-1',
                        lunId: 'lun-uuid-1'
                    } satisfies OracleVolumeRecord
                ]
            };
            assessmentData.rawdata.instanceLevelDetails.ORCL.storage.luns = {
                error: '',
                data: [{ name: 'lun-1', uuid: 'lun-uuid-1' }]
            };

            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test-iscsi.json',
                'oracle'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should handle Oracle assessment with headroom data', async () => {
            const assessmentData = createValidOracleAssessmentData('i-test-oracle-headroom');
            assessmentData.rawdata.hostLevelDetails.headroom = {
                ssdStorageCapacityInBytes: 2199023255552,
                storageUsedInBytes: 1099511627776,
                storageAvailableInBytes: 1099511627776,
                headroomPercent: 50,
                aggregateCount: 2
            };

            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test-headroom.json',
                'oracle'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });
    });
});
