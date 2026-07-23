import { vi, describe, it, expect, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';

import * as ssmOperations from '../../../src/operations/aws/ssm-operations';
import {
    getWindowsRegistryContent,
    getFileSystemContent
} from '../../../src/operations/aws/ssm-fleet-manager-operations';
import {
    SQL_INSTANCE_NAMES_PATH,
    mssqlInstanceRegistryPath
} from '../../../src/operations/continuous-optimization/mssql/ssm-doc-storage-assessment';
import { DEFAULT_AWS_REGION, TEST_STOPPED_EC2_INSTANCE_ID } from '../../utils/consts';

const credentialsId = `${faker.string.alpha(20)}`;

describe('ssm-fleet-manager-operations', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getWindowsRegistryContent', () => {
        it('should return mapped registry entries when the path is found', async () => {
            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                SQL_INSTANCE_NAMES_PATH
            );

            expect(result).toEqual({
                found: true,
                entries: [{ name: 'MSSQLSERVER', type: 'String', value: 'MSSQL13.MSSQLSERVER' }],
                error: undefined
            });
        });

        it('should follow nextToken and accumulate entries across pages', async () => {
            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                `${SQL_INSTANCE_NAMES_PATH}\\Paginated`
            );

            expect(result.found).toBe(true);
            expect(result.entries).toEqual([
                { name: 'ENTSQL', type: 'String', value: 'MSSQL16.ENTSQL' },
                { name: 'MSSQLSERVER', type: 'String', value: 'MSSQL16.MSSQLSERVER' }
            ]);
        });

        it('should read a registry key nested under an instance id', async () => {
            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                mssqlInstanceRegistryPath('MSSQL13.MSSQLSERVER')
            );

            expect(result.found).toBe(true);
            expect(result.entries).toContainEqual({ name: 'DefaultData', type: 'String', value: 'S:\\mssql\\data' });
        });

        it('should return found=false with the document error when the registry key does not exist', async () => {
            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                mssqlInstanceRegistryPath('MSSQL13.DOESNOTEXIST')
            );

            expect(result).toEqual({
                found: false,
                entries: [],
                error: 'The specified registry key does not exist.'
            });
        });

        it('should propagate a mid-stream pagination failure instead of reporting success', async () => {
            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                `${SQL_INSTANCE_NAMES_PATH}\\PaginatedFailure`
            );

            expect(result.found).toBe(false);
            expect(result.error).toBe('Simulated page failure');
            expect(result.entries).toEqual([{ name: 'ENTSQL', type: 'String', value: 'MSSQL16.ENTSQL' }]);
        });

        it('should return found=false with a cap error when the pagination cap is hit with more data remaining', async () => {
            let callCount = 0;
            vi.spyOn(ssmOperations, 'executeSSMDocument').mockImplementation(async () => {
                callCount += 1;
                return {
                    commandId: `cap-page-${callCount}`,
                    instanceId: TEST_STOPPED_EC2_INSTANCE_ID,
                    response: {
                        StandardOutputContent: JSON.stringify({
                            data: {
                                results: [
                                    { Name: `ENTSQL${callCount}`, Type: 'String', Value: `MSSQL16.ENTSQL${callCount}` }
                                ],
                                nextToken: `token-${callCount}`
                            }
                        }),
                        StandardErrorContent: ''
                    } as any
                };
            });

            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                SQL_INSTANCE_NAMES_PATH
            );

            expect(result.found).toBe(false);
            expect(result.error).toMatch(/pagination cap \(50 pages\) reached with more data remaining/);
            expect(result.entries).toHaveLength(50);
        });

        it('should return the thrown Error message (not a stringified object) when the SSM call throws', async () => {
            vi.spyOn(ssmOperations, 'executeSSMDocument').mockRejectedValueOnce(new Error('Throttling exceeded'));

            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                SQL_INSTANCE_NAMES_PATH
            );

            expect(result).toEqual({ found: false, entries: [], error: 'Throttling exceeded' });
        });

        it('should return found=false with a descriptive error when StandardOutputContent is empty', async () => {
            vi.spyOn(ssmOperations, 'executeSSMDocument').mockResolvedValueOnce({
                commandId: 'command-id',
                instanceId: TEST_STOPPED_EC2_INSTANCE_ID,
                response: { StandardOutputContent: '   ', StandardErrorContent: '' } as any
            });

            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                SQL_INSTANCE_NAMES_PATH
            );

            expect(result.found).toBe(false);
            expect(result.entries).toEqual([]);
            expect(result.error).toMatch(/No output returned from AWSFleetManager-GetWindowsRegistryContent/);
        });

        it('should return found=false when StandardOutputContent is not valid JSON', async () => {
            vi.spyOn(ssmOperations, 'executeSSMDocument').mockResolvedValueOnce({
                commandId: 'command-id',
                instanceId: TEST_STOPPED_EC2_INSTANCE_ID,
                response: { StandardOutputContent: '{not valid json', StandardErrorContent: '' } as any
            });

            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                SQL_INSTANCE_NAMES_PATH
            );

            expect(result).toEqual({
                found: false,
                entries: [],
                error: 'Output from AWSFleetManager-GetWindowsRegistryContent was truncated or malformed'
            });
        });

        it('should return found=false when the SSM command reports a standard error', async () => {
            vi.spyOn(ssmOperations, 'executeSSMDocument').mockResolvedValueOnce({
                commandId: 'command-id',
                instanceId: TEST_STOPPED_EC2_INSTANCE_ID,
                response: { StandardOutputContent: '', StandardErrorContent: 'Access is denied.' } as any
            });

            const result = await getWindowsRegistryContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                SQL_INSTANCE_NAMES_PATH
            );

            expect(result).toEqual({ found: false, entries: [], error: 'Access is denied.' });
        });
    });

    describe('getFileSystemContent', () => {
        it('should return mapped file entries when the path is found', async () => {
            const result = await getFileSystemContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'S:\\mssql\\data'
            );

            expect(result).toEqual({
                found: true,
                entries: [{ name: 'master.mdf', mode: '-a---', length: '8388608', lastWriteTimeUtc: '1731000000000' }],
                error: undefined
            });
        });

        it('should return found=false when the path does not exist', async () => {
            const result = await getFileSystemContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'Z:\\does-not-exist'
            );

            expect(result).toEqual({
                found: false,
                entries: [],
                error: 'The specified path does not exist.'
            });
        });

        it('should request the InvokeWindowsScript plugin output, since GetFileSystemContent has Windows/Linux/MacOS plugins', async () => {
            const executeSpy = vi.spyOn(ssmOperations, 'executeSSMDocument');

            await getFileSystemContent(
                credentialsId,
                DEFAULT_AWS_REGION,
                TEST_STOPPED_EC2_INSTANCE_ID,
                'S:\\mssql\\data'
            );

            expect(executeSpy).toHaveBeenCalledWith(
                credentialsId,
                DEFAULT_AWS_REGION,
                expect.objectContaining({ DocumentName: 'AWSFleetManager-GetFileSystemContent' }),
                undefined,
                undefined,
                'InvokeWindowsScript'
            );
        });
    });

    it('should not request a plugin name for GetWindowsRegistryContent, since it is Windows-only (single plugin)', async () => {
        const executeSpy = vi.spyOn(ssmOperations, 'executeSSMDocument');

        await getWindowsRegistryContent(
            credentialsId,
            DEFAULT_AWS_REGION,
            TEST_STOPPED_EC2_INSTANCE_ID,
            SQL_INSTANCE_NAMES_PATH
        );

        expect(executeSpy).toHaveBeenCalledWith(
            credentialsId,
            DEFAULT_AWS_REGION,
            expect.objectContaining({ DocumentName: 'AWSFleetManager-GetWindowsRegistryContent' }),
            undefined,
            undefined,
            undefined
        );
    });
});
