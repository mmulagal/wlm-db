import { describe, it, expect } from 'vitest';
import { findMissingPatches } from '../../../../src/operations/continuous-optimization/oracle/security-patch-assessment-operations';
import type { CPUCatalogEntry } from '../../../../src/operations/continuous-optimization/oracle/oracle-cpu-catalog-operations';

function makeCve(
    cveId: string,
    affectedVersions: string[],
    releaseDate: string,
    additionalCvesAddressed: string[] = [],
    component = 'Test Component'
): CPUCatalogEntry {
    return {
        cveId,
        component,
        description: `Vulnerability in ${component} of Oracle Database Server.`,
        releaseDate,
        releaseName: 'Test Release',
        affectedVersions,
        additionalCvesAddressed
    };
}

describe('findMissingPatches', () => {
    describe('version parsing', () => {
        it('returns [] when the Oracle version string is unparseable', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16')];

            const result = findMissingPatches('invalid', { database: '2024-04-16' }, catalog);

            expect(result).toEqual([]);
        });

        it('returns [] when no catalog entries match this Oracle major version family', () => {
            const catalog = [
                makeCve('CVE-2024-21001', ['21.3-21.15'], '2024-07-16'),
                makeCve('CVE-2024-23001', ['23.4-23.7'], '2024-07-16')
            ];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result).toEqual([]);
        });
    });

    describe('version-range filtering', () => {
        it('includes a CVE whose affected range upper bound equals the effective minor version', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('excludes a CVE whose affected range upper bound is below the effective minor version', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.22'], '2024-07-16')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result).toEqual([]);
        });

        it('includes a CVE whose affected range extends beyond the effective minor version', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.25'], '2025-01-21')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('excludes a single-version CVE that targets a minor version the server has not reached', () => {
            const catalog = [makeCve('CVE-2025-30751', ['19.27'], '2025-07-15')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result).toEqual([]);
        });

        it('includes a single-version CVE that exactly matches the effective minor version', () => {
            const catalog = [makeCve('CVE-2025-30751', ['19.27'], '2025-10-21')];

            const result = findMissingPatches('19.27.0.0.0', { database: '2025-07-15' }, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2025-30751');
        });
    });

    describe('date-based filtering', () => {
        it('includes CVEs released after the database RU date', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('excludes CVEs released on the same date as the database RU', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-04-16')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result).toEqual([]);
        });

        it('excludes CVEs released before the database RU date', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-01-16')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result).toEqual([]);
        });
    });

    describe('base install (no patches applied)', () => {
        it('shows all matching CVEs when no patches exist', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.21'], '2024-01-16'),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16'),
                makeCve('CVE-2024-21001', ['21.3-21.15'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', {}, catalog);

            const cveIds = result.map(c => c.cveId);
            expect(cveIds).toContain('CVE-2024-10001');
            expect(cveIds).toContain('CVE-2024-10002');
            expect(cveIds).not.toContain('CVE-2024-21001');
        });
    });

    describe('version string minor fallback', () => {
        it('uses minor from version string — includes CVEs whose range starts at that minor', () => {
            const catalog = [makeCve('CVE-2024-10001', ['21.3-21.15'], '2024-07-16')];

            const result = findMissingPatches('21.3.0.0.0', {}, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('excludes CVEs whose range starts above the version string minor', () => {
            const catalog = [makeCve('CVE-2024-21211', ['21.4-21.16'], '2025-01-21')];

            const result = findMissingPatches('21.3.0.0.0', {}, catalog);

            expect(result).toEqual([]);
        });
    });

    describe('additionalCvesAddressed deduplication', () => {
        it('excludes a CVE that is bundled into another CVE patch', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16', ['CVE-2024-10002']),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16')
            ];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            const cveIds = result.map(c => c.cveId);
            expect(cveIds).toContain('CVE-2024-10001');
            expect(cveIds).not.toContain('CVE-2024-10002');
        });

        it('does NOT suppress a bundled CVE when the primary is outside version range', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.21'], '2024-01-16', ['CVE-2024-10002']),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16')
            ];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10002');
        });
    });

    describe('component-aware date filtering', () => {
        it('excludes a Java VM CVE whose releaseDate is before the java vm patch date', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-04-16', [], 'Java VM')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-01-16', 'java vm': '2024-07-16' }, catalog);

            expect(result).toEqual([]);
        });

        it('includes a Java VM CVE whose releaseDate is after the java vm patch date', () => {
            const catalog = [makeCve('CVE-2025-10001', ['19.3-19.25'], '2025-01-21', [], 'Java VM')];

            const result = findMissingPatches('19.25.0.0.0', { database: '2024-04-16', 'java vm': '2024-07-16' }, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2025-10001');
        });

        it('falls back to database RU date when CVE component has no match in the map', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16', [], 'XML Database')];

            const result = findMissingPatches('19.23.0.0.0', { database: '2024-04-16', 'java vm': '2025-01-01' }, catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('shows all CVEs when appliedPatches is empty (no dates to filter by)', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-01-16'),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', {}, catalog);

            expect(result.map(c => c.cveId)).toEqual(['CVE-2024-10001', 'CVE-2024-10002']);
        });
    });

    describe('output shape', () => {
        it('returns only the projected fields (no affectedVersions or additionalCvesAddressed)', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16', ['CVE-2024-99999'])];

            const [entry] = findMissingPatches('19.23.0.0.0', { database: '2024-04-16' }, catalog);

            expect(entry).toHaveProperty('cveId', 'CVE-2024-10001');
            expect(entry).toHaveProperty('component');
            expect(entry).toHaveProperty('description');
            expect(entry).toHaveProperty('releaseDate', '2024-07-16');
            expect(entry).toHaveProperty('releaseName');
            expect(entry).not.toHaveProperty('affectedVersions');
            expect(entry).not.toHaveProperty('additionalCvesAddressed');
        });
    });
});
