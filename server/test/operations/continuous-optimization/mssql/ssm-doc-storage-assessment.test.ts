import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance } from 'vitest';
import { faker } from '@faker-js/faker';

import * as fleetManager from '../../../../src/operations/aws/ssm-fleet-manager-operations';
import {
    discoverSqlInstances,
    getSqlDefaultPaths,
    getMultipathConfig,
    getLayoutViolations,
    runLayoutAssessment
} from '../../../../src/operations/continuous-optimization/mssql/ssm-doc-storage-assessment';
import { DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID } from '../../../utils/consts';

const credentialsId = `${faker.string.alpha(20)}`;

function registryResult(found: boolean, entries: { name: string; type: string; value: string }[] = [], error?: string) {
    return { found, entries, error };
}

function fileSystemResult(found: boolean, names: string[] = [], error?: string) {
    return {
        found,
        entries: names.map(name => ({ name, mode: '-a---', length: '0', lastWriteTimeUtc: '0' })),
        error
    };
}

describe('ssm-doc-storage-assessment', () => {
    let registrySpy: MockInstance;
    let fileSystemSpy: MockInstance;

    beforeEach(() => {
        registrySpy = vi.spyOn(fleetManager, 'getWindowsRegistryContent');
        fileSystemSpy = vi.spyOn(fleetManager, 'getFileSystemContent');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('discoverSqlInstances', () => {
        it('should return discovered instances when the registry key is found', async () => {
            registrySpy.mockResolvedValueOnce(
                registryResult(true, [{ name: 'MSSQLSERVER', type: 'String', value: 'MSSQL13.MSSQLSERVER' }])
            );

            const result = await discoverSqlInstances(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID);

            expect(result).toEqual([{ instanceName: 'MSSQLSERVER', registryInstanceId: 'MSSQL13.MSSQLSERVER' }]);
        });

        it('should return an empty array when the registry key is not found', async () => {
            registrySpy.mockResolvedValueOnce(registryResult(false, [], 'The specified registry key does not exist.'));

            const result = await discoverSqlInstances(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID);

            expect(result).toEqual([]);
        });
    });

    describe('getSqlDefaultPaths', () => {
        it('should extract default paths and the install root from the Setup key', async () => {
            registrySpy
                .mockResolvedValueOnce(
                    registryResult(true, [
                        { name: 'DefaultData', type: 'String', value: 'S:\\mssql\\data' },
                        { name: 'DefaultLog', type: 'String', value: 'L:\\mssql\\log' },
                        { name: 'BackupDirectory', type: 'String', value: 'S:\\mssql\\backup' }
                    ])
                )
                .mockResolvedValueOnce(
                    registryResult(true, [
                        { name: 'SQLDataRoot', type: 'String', value: 'S:\\MSSQL16.MSSQLSERVER\\MSSQL' }
                    ])
                );

            const result = await getSqlDefaultPaths(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'MSSQL13.MSSQLSERVER'
            );

            expect(registrySpy).toHaveBeenCalledTimes(2);
            expect(result).toEqual({
                installRoot: 'S:\\MSSQL16.MSSQLSERVER\\MSSQL',
                defaultData: 'S:\\mssql\\data',
                defaultLog: 'L:\\mssql\\log',
                backupDirectory: 'S:\\mssql\\backup'
            });
        });

        it('should leave installRoot undefined when the Setup key is not found', async () => {
            registrySpy
                .mockResolvedValueOnce(
                    registryResult(true, [{ name: 'DefaultData', type: 'String', value: 'S:\\mssql\\data' }])
                )
                .mockResolvedValueOnce(registryResult(false, [], 'The specified registry key does not exist.'));

            const result = await getSqlDefaultPaths(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'MSSQL13.MSSQLSERVER'
            );

            expect(result.installRoot).toBeUndefined();
            expect(result.defaultData).toBe('S:\\mssql\\data');
        });

        it('should return an error when the instance registry key is not found', async () => {
            registrySpy
                .mockResolvedValueOnce(registryResult(false, [], 'The specified registry key does not exist.'))
                .mockResolvedValueOnce(registryResult(false, []));

            const result = await getSqlDefaultPaths(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'MSSQL13.MSSQLSERVER'
            );

            expect(result).toEqual({ error: 'The specified registry key does not exist.' });
        });
    });

    describe('getMultipathConfig', () => {
        it('should return mpioEnabled=true with diagnostics and diskTimeoutValue when both registry keys are found', async () => {
            registrySpy
                .mockResolvedValueOnce(
                    registryResult(true, [
                        { name: 'PathVerifyEnabled', type: 'DWord', value: '1' },
                        { name: 'PathVerificationPeriod', type: 'DWord', value: '30' }
                    ])
                )
                .mockResolvedValueOnce(registryResult(true, [{ name: 'TimeOutValue', type: 'DWord', value: '60' }]));

            const result = await getMultipathConfig(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID);

            expect(result).toEqual({
                mpioEnabled: true,
                pathVerifyEnabled: '1',
                pathVerificationPeriod: '30',
                diskTimeoutValue: '60'
            });
        });

        it('should leave diskTimeoutValue undefined when the Disk registry key is not found', async () => {
            registrySpy
                .mockResolvedValueOnce(registryResult(true, [{ name: 'PathVerifyEnabled', type: 'DWord', value: '1' }]))
                .mockResolvedValueOnce(registryResult(false, [], 'The specified registry key does not exist.'));

            const result = await getMultipathConfig(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID);

            expect(result.diskTimeoutValue).toBeUndefined();
        });

        it('should return mpioEnabled=false when the MPIO key does not exist', async () => {
            registrySpy
                .mockResolvedValueOnce(registryResult(false, [], 'The specified registry key does not exist.'))
                .mockResolvedValueOnce(registryResult(true, [{ name: 'TimeOutValue', type: 'DWord', value: '60' }]));

            const result = await getMultipathConfig(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID);

            expect(result).toEqual({ mpioEnabled: false });
        });
    });

    describe('getLayoutViolations', () => {
        it('should classify data/log directory contents and exclude system database files', async () => {
            fileSystemSpy
                .mockResolvedValueOnce(
                    fileSystemResult(true, ['master.mdf', 'mastlog.ldf', 'model.mdf', 'MSDBData.mdf', 'user1.mdf'])
                )
                .mockResolvedValueOnce(
                    fileSystemResult(true, ['mastlog.ldf', 'model.ldf', 'MSDBLog.ldf', 'user1.ldf'])
                );

            const result = await getLayoutViolations(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID, {
                defaultData: 'S:\\mssql\\data',
                defaultLog: 'L:\\mssql\\log'
            });

            expect(fileSystemSpy).toHaveBeenCalledTimes(2);
            expect(result).toEqual({
                'default-data-files-location': {
                    path: 'S:\\mssql\\data',
                    mdfCount: 1,
                    ldfCount: 0,
                    ndfCount: 0,
                    otherFileNames: [],
                    systemFileNames: ['master.mdf', 'mastlog.ldf', 'model.mdf', 'MSDBData.mdf']
                },
                'default-log-files-location': {
                    path: 'L:\\mssql\\log',
                    mdfCount: 0,
                    ldfCount: 1,
                    ndfCount: 0,
                    otherFileNames: [],
                    systemFileNames: ['mastlog.ldf', 'model.ldf', 'MSDBLog.ldf']
                }
            });
        });

        it('should mark a path as unavailable without calling GetFileSystemContent when it is missing', async () => {
            const result = await getLayoutViolations(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                {}
            );

            expect(fileSystemSpy).not.toHaveBeenCalled();
            expect(result['default-data-files-location'].error).toBe('Path not available');
            expect(result['default-log-files-location'].error).toBe('Path not available');
        });

        it('should use DefaultData and DefaultLog directly regardless of installRoot', async () => {
            fileSystemSpy
                .mockResolvedValueOnce(fileSystemResult(true, ['user1.mdf']))
                .mockResolvedValueOnce(fileSystemResult(true, ['user1.ldf']));

            const result = await getLayoutViolations(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID, {
                installRoot: 'S:\\MSSQL16.MSSQLSERVER\\MSSQL',
                defaultData: 'S:\\mssql\\data',
                defaultLog: 'L:\\mssql\\log'
            });

            expect(fileSystemSpy).toHaveBeenCalledTimes(2);
            expect(fileSystemSpy).toHaveBeenCalledWith(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'S:\\mssql\\data',
                undefined
            );
            expect(fileSystemSpy).toHaveBeenCalledWith(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'L:\\mssql\\log',
                undefined
            );
            expect(result['default-data-files-location']).toEqual({
                path: 'S:\\mssql\\data',
                mdfCount: 1,
                ldfCount: 0,
                ndfCount: 0,
                otherFileNames: [],
                systemFileNames: []
            });
            expect(result['default-log-files-location']).toEqual({
                path: 'L:\\mssql\\log',
                mdfCount: 0,
                ldfCount: 1,
                ndfCount: 0,
                otherFileNames: [],
                systemFileNames: []
            });
        });
    });

    describe('runLayoutAssessment', () => {
        it('should return the matched instance object', async () => {
            registrySpy
                .mockResolvedValueOnce(
                    registryResult(true, [{ name: 'MSSQLSERVER', type: 'String', value: 'MSSQL13.MSSQLSERVER' }])
                )
                .mockResolvedValueOnce(registryResult(false, [], 'The specified registry key does not exist.'))
                .mockResolvedValueOnce(registryResult(false, []));

            const result = await runLayoutAssessment(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'MSSQLSERVER'
            );

            expect(fileSystemSpy).not.toHaveBeenCalled();
            expect(result.instanceName).toBe('MSSQLSERVER');
            expect(result.registryInstanceId).toBe('MSSQL13.MSSQLSERVER');
            expect(result.paths).toEqual({ error: 'The specified registry key does not exist.' });
        });

        it('should reject when the requested instanceName is not found on the host', async () => {
            registrySpy
                .mockResolvedValueOnce(
                    registryResult(true, [{ name: 'MSSQLSERVER', type: 'String', value: 'MSSQL13.MSSQLSERVER' }])
                )
                .mockResolvedValueOnce(registryResult(false, []))
                .mockResolvedValueOnce(registryResult(false, []));

            await expect(
                runLayoutAssessment(credentialsId, DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID, 'DOESNOTEXIST')
            ).rejects.toThrow('SQL instance DOESNOTEXIST not found');
        });
    });
});
