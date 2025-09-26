import { describe, it, expect } from 'vitest';
import { AWS_REGIONS } from '../../src/utils/consts';

describe('AWS_REGIONS map', () => {
    it('contains newly added ap-east-2 (Taipei) mapping (#4508)', () => {
        expect(AWS_REGIONS.has('ap-east-2')).toBe(true);
        const name = AWS_REGIONS.get('ap-east-2');
        expect(name).toBeDefined();
        expect(name).toMatch(/Taipei/i);
        expect(name && name.trim().length).toBeGreaterThan(0);
    });
});
