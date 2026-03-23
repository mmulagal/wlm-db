import { describe, it, expect } from 'vitest';
import { findMissingPatches } from '../../../../src/operations/continuous-optimization/oracle/security-patch-assessment-operations';
import type { CPUCatalogEntry } from '../../../../src/operations/continuous-optimization/oracle/oracle-cpu-catalog-operations';
import type { AppliedPatch } from '../../../../src/operations/continuous-optimization/oracle/common-types';

function makeRuPatch(minor: number, yymmdd: string, patchId = '00000000'): AppliedPatch {
    return {
        patchId,
        description: `Database Release Update : 19.${minor}.0.0.${yymmdd} (${patchId})`
    };
}

const OCW_ONLY_PATCH: AppliedPatch = {
    patchId: '29585399',
    description: 'OCW RELEASE UPDATE 19.3.0.0.0 (29585399)'
};

function makeCve(
    cveId: string,
    affectedVersions: string[],
    releaseDate: string,
    additionalCvesAddressed: string[] = []
): CPUCatalogEntry {
    return {
        cveId,
        component: 'Test Component',
        description: 'Vulnerability in Test Component of Oracle Database Server.',
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

            const result = findMissingPatches('invalid', [makeRuPatch(23, '240416')], catalog);

            expect(result).toEqual([]);
        });

        it('returns [] when no catalog entries match this Oracle major version family', () => {
            const catalog = [
                makeCve('CVE-2024-21001', ['21.3-21.15'], '2024-07-16'),
                makeCve('CVE-2024-23001', ['23.4-23.7'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result).toEqual([]);
        });
    });

    describe('version-range filtering', () => {
        it('includes a CVE whose affected range upper bound equals the effective minor version', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('excludes a CVE whose affected range upper bound is below the effective minor version', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.22'], '2024-07-16')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result).toEqual([]);
        });

        it('includes a CVE whose affected range extends beyond the effective minor version', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.25'], '2025-01-21')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('excludes a single-version CVE that targets a minor version the server has not reached', () => {
            const catalog = [makeCve('CVE-2025-30751', ['19.27'], '2025-07-15')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result).toEqual([]);
        });

        it('includes a single-version CVE that exactly matches the effective minor version', () => {
            const catalog = [makeCve('CVE-2025-30751', ['19.27'], '2025-10-21')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(27, '250715')], catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2025-30751');
        });
    });

    describe('date-based filtering', () => {
        it('includes CVEs released after the last RU date', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10001');
        });

        it('excludes CVEs released on the same date as the last RU (already included in that RU)', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-04-16')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result).toEqual([]);
        });

        it('excludes CVEs released before the last RU date', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-01-16')];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result).toEqual([]);
        });
    });

    describe('base install (no RU patch applied)', () => {
        it('shows all matching CVEs when only an OCW patch is present', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.21'], '2024-01-16'),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16'),
                makeCve('CVE-2024-21001', ['21.3-21.15'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', [OCW_ONLY_PATCH], catalog);

            const cveIds = result.map(c => c.cveId);
            expect(cveIds).toContain('CVE-2024-10001');
            expect(cveIds).toContain('CVE-2024-10002');
            expect(cveIds).not.toContain('CVE-2024-21001');
        });

        it('shows all matching CVEs when no patches are applied at all', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.21'], '2024-01-16'),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', [], catalog);

            expect(result.map(c => c.cveId)).toEqual(['CVE-2024-10001', 'CVE-2024-10002']);
        });
    });

    describe('additionalCvesAddressed deduplication', () => {
        it('excludes a CVE that is bundled into another CVE patch', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16', ['CVE-2024-10002']),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            const cveIds = result.map(c => c.cveId);
            expect(cveIds).toContain('CVE-2024-10001');
            expect(cveIds).not.toContain('CVE-2024-10002');
        });

        it('still excludes a bundled CVE when the primary CVE is also applicable', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16', ['CVE-2024-10002']),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            const cveIds = result.map(c => c.cveId);
            expect(cveIds).toContain('CVE-2024-10001');
            expect(cveIds).not.toContain('CVE-2024-10002');
        });

        it('does NOT suppress a bundled CVE when the primary CVE is outside the applicable version range', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.21'], '2024-01-16', ['CVE-2024-10002']),
                makeCve('CVE-2024-10002', ['19.3-19.23'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(result.map(c => c.cveId)).toContain('CVE-2024-10002');
        });
    });

    describe('multiple RU patches', () => {
        it('uses the highest effective minor version when multiple RU patches are present', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.22'], '2024-07-16')];

            const result = findMissingPatches(
                '19.0.0.0.0',
                [makeRuPatch(21, '240116', '36233100'), makeRuPatch(23, '240416', '36233263')],
                catalog
            );

            expect(result).toEqual([]);
        });
    });

    describe('output shape', () => {
        it('returns only the projected fields (no affectedVersions or additionalCvesAddressed)', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16', ['CVE-2024-99999'])];

            const [entry] = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            expect(entry).toHaveProperty('cveId', 'CVE-2024-10001');
            expect(entry).toHaveProperty('component');
            expect(entry).toHaveProperty('description');
            expect(entry).toHaveProperty('releaseDate', '2024-07-16');
            expect(entry).toHaveProperty('releaseName');
            expect(entry).not.toHaveProperty('affectedVersions');
            expect(entry).not.toHaveProperty('additionalCvesAddressed');
        });

        it('returns multiple CVEs across different families when version matches', () => {
            const catalog = [
                makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16'),
                makeCve('CVE-2024-10002', ['19.3-19.25'], '2025-01-21'),
                makeCve('CVE-2024-21001', ['21.3-21.15'], '2024-07-16')
            ];

            const result = findMissingPatches('19.0.0.0.0', [makeRuPatch(23, '240416')], catalog);

            const cveIds = result.map(c => c.cveId);
            expect(cveIds).toContain('CVE-2024-10001');
            expect(cveIds).toContain('CVE-2024-10002');
            expect(cveIds).not.toContain('CVE-2024-21001');
        });
    });
});
