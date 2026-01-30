import { describe, it, expect } from 'vitest';
import { getBaseVolume } from '../../../../src/operations/continuous-optimization/oracle/storage-assessment-operations';

describe('getBaseVolume', () => {
    const exportsByServer: Record<string, string[]> = {
        '10.0.49.228': [
            '/data_270126141652',
            '/data_280126120450',
            '/log_270126141652',
            '/log_280126120450',
            '/data_270126141652/nest',
            '/orabase',
            '/oraredoctl_270126141652',
            '/oraredoctl_280126120450'
        ]
    };

    describe('exact match scenarios', () => {
        it('should return the exact path when it matches an export exactly', () => {
            const result = getBaseVolume('/data_270126141652', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652');
        });

        it('should return the exact nested export when path matches exactly', () => {
            const result = getBaseVolume('/data_270126141652/nest', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652/nest');
        });

        it('should return the base volume for a subdirectory path', () => {
            const result = getBaseVolume('/log_270126141652/test', '10.0.49.228', exportsByServer);
            expect(result).toBe('/log_270126141652');
        });

        it('should return the base volume for a deeply nested path', () => {
            const result = getBaseVolume('/data_270126141652/data', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652');
        });

        it('should return the longest matching export (nested export wins over parent)', () => {
            const result = getBaseVolume('/data_270126141652/nest/subdir', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652/nest');
        });

        it('should not match partial segment names', () => {
            const result = getBaseVolume('/log_280126120450/as/subdir', '10.0.49.228', exportsByServer);
            expect(result).toBe('/log_280126120450');
        });
    });
});
