import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsxCoreLib from '../../src/lib/cloud-manager/fsx-core';
import { createFileSystemForDemo } from '../../src/operations/demo-operations';

describe('demo operations', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('createFileSystemForDemo should disable security group generation for simulator demo flow', async () => {
        const createFSXSpy = vi.spyOn(fsxCoreLib, 'createFSX').mockResolvedValue({} as any);

        const createFsPromise = createFileSystemForDemo(
            'credentials-demo',
            'us-east-1',
            { fsxDeploymentMode: 'SINGLE_AZ_1' } as any,
            true
        );

        await vi.runAllTimersAsync();
        await createFsPromise;

        expect(createFSXSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                generateSecurityGroup: false
            })
        );
    });
});
