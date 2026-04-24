import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    fetchOracleSecurityPatchWithMissingPatches,
    findMissingPatches
} from '../../../../src/operations/continuous-optimization/oracle/security-patch-assessment-operations';
import type { CPUCatalogEntry } from '../../../../src/operations/continuous-optimization/oracle/oracle-cpu-catalog-operations';
import * as oracleCpuCatalogOps from '../../../../src/operations/continuous-optimization/oracle/oracle-cpu-catalog-operations';
import * as ssmOps from '../../../../src/operations/aws/ssm-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

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

            const result = findMissingPatches(
                '19.23.0.0.0',
                { database: '2024-01-16', 'java vm': '2024-07-16' },
                catalog
            );

            expect(result).toEqual([]);
        });

        it('includes a Java VM CVE whose releaseDate is after the java vm patch date', () => {
            const catalog = [makeCve('CVE-2025-10001', ['19.3-19.25'], '2025-01-21', [], 'Java VM')];

            const result = findMissingPatches(
                '19.25.0.0.0',
                { database: '2024-04-16', 'java vm': '2024-07-16' },
                catalog
            );

            expect(result.map(c => c.cveId)).toContain('CVE-2025-10001');
        });

        it('falls back to database RU date when CVE component has no match in the map', () => {
            const catalog = [makeCve('CVE-2024-10001', ['19.3-19.23'], '2024-07-16', [], 'XML Database')];

            const result = findMissingPatches(
                '19.23.0.0.0',
                { database: '2024-04-16', 'java vm': '2025-01-01' },
                catalog
            );

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

describe('fetchOracleSecurityPatchWithMissingPatches', () => {
    const ORACLE_HOST_ID = 'oracle-security-patch-host';
    const ORACLE_INSTANCE_ID = 'oracle-security-patch-instance';
    const ORACLE_INSTANCE_NAME = 'oradbsec';
    const ORACLE_EC2_INSTANCE_ID = 'i-03ed3dc17db570670';

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a NOT_OPTIMIZED response with missing patches when the simulator returns an out-of-date database', async () => {
        const result = await fetchOracleSecurityPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_HOST_ID,
            ORACLE_INSTANCE_ID,
            ORACLE_INSTANCE_NAME,
            ORACLE_EC2_INSTANCE_ID
        );

        expect('errorMessage' in result).toBe(false);
        if ('errorMessage' in result) {
            return;
        }

        expect([AssessmentStatus.OPTIMIZED, AssessmentStatus.NOT_OPTIMIZED]).toContain(result.status);
        expect(result.ec2InstancesToPatch).toHaveLength(1);
        const [patchInstance] = result.ec2InstancesToPatch;
        expect(patchInstance.ec2InstanceId).toEqual(ORACLE_EC2_INSTANCE_ID);
        expect(patchInstance.database).toEqual(ORACLE_INSTANCE_NAME);
        expect(Array.isArray(patchInstance.missingPatchDetails)).toBe(true);

        if (result.status === AssessmentStatus.NOT_OPTIMIZED) {
            expect(patchInstance.missingPatchDetails?.length).toBeGreaterThan(0);
            const [firstPatch] = patchInstance.missingPatchDetails ?? [];
            expect(firstPatch).toHaveProperty('cveId');
            expect(firstPatch).toHaveProperty('component');
            expect(firstPatch).toHaveProperty('releaseDate');
            expect(firstPatch).toHaveProperty('releaseName');
            expect(firstPatch).not.toHaveProperty('affectedVersions');
            expect(firstPatch).not.toHaveProperty('additionalCvesAddressed');
        }
    });

    it('returns an errorMessage when the Oracle Critical Patch Updates catalog is empty', async () => {
        vi.spyOn(oracleCpuCatalogOps, 'loadCpuCatalog').mockResolvedValueOnce([]);

        const result = await fetchOracleSecurityPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_HOST_ID,
            ORACLE_INSTANCE_ID,
            ORACLE_INSTANCE_NAME,
            ORACLE_EC2_INSTANCE_ID
        );

        expect(result).toMatchObject({
            errorMessage: expect.stringContaining(
                `Unable to run Oracle Critical Patch Updates scan for database instance ${ORACLE_INSTANCE_NAME}`
            )
        });
    });

    it('returns an errorMessage when the SSM response carries an error', async () => {
        vi.spyOn(ssmOps, 'callSsmExecution').mockResolvedValueOnce(
            JSON.stringify({ error: 'ORACLE_HOME could not be determined' })
        );

        const result = await fetchOracleSecurityPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_HOST_ID,
            ORACLE_INSTANCE_ID,
            ORACLE_INSTANCE_NAME,
            ORACLE_EC2_INSTANCE_ID
        );

        expect(result).toMatchObject({
            errorMessage: expect.stringContaining('ORACLE_HOME could not be determined')
        });
    });

    it('returns an errorMessage when the SSM response omits the Oracle version', async () => {
        vi.spyOn(ssmOps, 'callSsmExecution').mockResolvedValueOnce(JSON.stringify({ appliedPatches: {} }));

        const result = await fetchOracleSecurityPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_HOST_ID,
            ORACLE_INSTANCE_ID,
            ORACLE_INSTANCE_NAME,
            ORACLE_EC2_INSTANCE_ID
        );

        expect(result).toMatchObject({
            errorMessage: expect.stringContaining('Could not determine Oracle version')
        });
    });
});
