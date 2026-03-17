import nock from 'nock';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { refreshOracleCpuCatalog } from '../../../../src/operations/continuous-optimization/oracle/cpu-catalog-operations';

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockMkdir = vi.fn().mockResolvedValue(undefined);

vi.mock('fs/promises', () => ({
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args)
}));

vi.mock('../../../../src/utils/consts', async importOriginal => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        ORACLE_CPU_CATALOG_FILE_PATH: '/tmp/test-cpu-catalog.json',
        ORACLE_CPU_CATALOG_LOOKBACK_YEARS: 0
    };
});

// Mock Oracle CSAF data
const CSAF_BASE = 'https://www.oracle.com';

function buildCsafFixture(releaseDate: string) {
    return {
        document: { tracking: { initial_release_date: `${releaseDate}T13:00:00-07:00` } },
        product_tree: {
            branches: [
                {
                    name: 'Oracle',
                    branches: [
                        {
                            name: 'Oracle Database Server',
                            branches: [
                                {
                                    name: 'Oracle Database Server',
                                    branches: [
                                        { product: { product_id: 'P-5(Java VM)V-19.3-19.26' } },
                                        { product: { product_id: 'P-5(RDBMS)V-23.4-23.7' } },
                                        { product: { product_id: 'P-5(Oracle Database)V-23.4-23.7' } }
                                    ]
                                }
                            ]
                        },
                        {
                            name: 'Oracle MySQL',
                            branches: [
                                {
                                    name: 'MySQL Server',
                                    branches: [{ product: { product_id: 'P-999V-8.0' } }]
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        vulnerabilities: [
            {
                cve: 'CVE-2025-11111',
                ids: [{ system_name: 'Oracle Bug ID of Oracle Database Server', text: 'BUG-001' }],
                notes: [
                    {
                        category: 'description',
                        text: 'Vulnerability in the Java VM component of Oracle Database Server. Supported versions that are affected are 19.3-19.26.'
                    }
                ],
                product_status: { known_affected: ['P-5(Java VM)V-19.3-19.26'] },
                scores: [{ cvss_v3: { baseScore: 7.5 }, products: ['P-5(Java VM)V-19.3-19.26'] }]
            },
            {
                cve: 'CVE-2025-22222',
                ids: [{ system_name: 'Oracle Bug ID of Oracle Database Server', text: 'BUG-002' }],
                notes: [
                    {
                        category: 'description',
                        text: 'Vulnerability in the RDBMS component of Oracle Database Server. Supported versions that are affected are 23.4-23.7.'
                    }
                ],
                product_status: { known_affected: ['P-5(RDBMS)V-23.4-23.7'] },
                scores: [{ cvss_v3: { baseScore: 4.3 }, products: ['P-5(RDBMS)V-23.4-23.7'] }]
            },
            // Two CVEs sharing the same bug ID — should be grouped
            {
                cve: 'CVE-2025-33333',
                ids: [{ system_name: 'Oracle Bug ID of Oracle Database Server', text: 'BUG-003' }],
                notes: [
                    {
                        category: 'description',
                        text: 'Vulnerability in the Oracle Database (OpenSSL) component of Oracle Database Server. Versions 23.4-23.7.'
                    }
                ],
                product_status: { known_affected: ['P-5(Oracle Database)V-23.4-23.7'] },
                scores: [{ cvss_v3: { baseScore: 4.3 }, products: ['P-5(Oracle Database)V-23.4-23.7'] }]
            },
            {
                cve: 'CVE-2024-99999',
                ids: [{ system_name: 'Oracle Bug ID of Oracle Database Server', text: 'BUG-003' }],
                notes: [
                    {
                        category: 'description',
                        text: 'Vulnerability in the Oracle Database (OpenSSL) component of Oracle Database Server. Versions 23.4-23.7.'
                    }
                ],
                product_status: { known_affected: ['P-5(Oracle Database)V-23.4-23.7'] },
                scores: [{ cvss_v3: { baseScore: 4.3 }, products: ['P-5(Oracle Database)V-23.4-23.7'] }]
            },
            // Non-DB CVE — should be excluded
            {
                cve: 'CVE-2025-00000',
                ids: [{ system_name: 'Oracle Bug ID of MySQL Server', text: 'BUG-999' }],
                notes: [{ category: 'description', text: 'Vulnerability in MySQL Server.' }],
                product_status: { known_affected: ['P-999V-8.0'] },
                scores: [{ cvss_v3: { baseScore: 9.8 }, products: ['P-999V-8.0'] }]
            }
        ]
    };
}

// Tests
describe('refreshOracleCpuCatalog', () => {
    // Pin date to May 2025 so buildAllReleases with lookback=0 yields:
    // January 2025, April 2025
    beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-15T00:00:00Z'));
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        nock.cleanAll();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    function interceptCsaf(abbrev: string, year: number, releaseDate: string) {
        return nock(CSAF_BASE)
            .get(`/a/tech/docs/security-alerts/cpu${abbrev}${year}csaf.json`)
            .reply(200, buildCsafFixture(releaseDate));
    }

    function interceptCsafError(abbrev: string, year: number) {
        return nock(CSAF_BASE).get(`/a/tech/docs/security-alerts/cpu${abbrev}${year}csaf.json`).reply(404, 'Not Found');
    }

    it('full refresh — writes catalog when no existing file', async () => {
        mockReadFile.mockRejectedValue(new Error('ENOENT'));

        const janScope = interceptCsaf('jan', 2025, '2025-01-21');
        const aprScope = interceptCsaf('apr', 2025, '2025-04-15');

        await refreshOracleCpuCatalog();

        expect(janScope.isDone()).toBe(true);
        expect(aprScope.isDone()).toBe(true);
        expect(mockMkdir).toHaveBeenCalled();
        expect(mockWriteFile).toHaveBeenCalledOnce();

        const written = JSON.parse(mockWriteFile.mock.calls[0][1].replace('\n', ''));
        expect(written.lastMonthExtracted).toBe('April 2025');
        expect(written.patches.length).toBeGreaterThan(0);

        // Non-DB CVE excluded
        const cveIds = written.patches.map((p: { cveId: string }) => p.cveId);
        expect(cveIds).not.toContain('CVE-2025-00000');
    });

    it('full refresh — groups CVEs sharing a bug ID', async () => {
        mockReadFile.mockRejectedValue(new Error('ENOENT'));

        interceptCsaf('jan', 2025, '2025-01-21');
        interceptCsaf('apr', 2025, '2025-04-15');

        await refreshOracleCpuCatalog();

        const written = JSON.parse(mockWriteFile.mock.calls[0][1].replace('\n', ''));
        const grouped = written.patches.find(
            (p: { additionalCvesAddressed: string[] }) => p.additionalCvesAddressed.length > 0
        );

        expect(grouped).toBeDefined();
        // CVE-2025-33333 should be primary (higher CVE ID), CVE-2024-99999 additional
        expect(grouped.cveId).toBe('CVE-2025-33333');
        expect(grouped.additionalCvesAddressed).toContain('CVE-2024-99999');
    });

    it('delta refresh — appends to existing catalog', async () => {
        const existingCatalog = {
            lastMonthExtracted: 'January 2025',
            patches: [
                {
                    cveId: 'CVE-2025-00001',
                    component: 'Existing',
                    description: 'Old entry',
                    releaseDate: '2025-01-21',
                    releaseName: 'January 2025',
                    affectedVersions: ['19.3-19.26'],
                    additionalCvesAddressed: []
                }
            ]
        };
        mockReadFile.mockResolvedValue(JSON.stringify(existingCatalog));

        // Only April 2025 should be fetched (January already extracted)
        const aprScope = interceptCsaf('apr', 2025, '2025-04-15');

        await refreshOracleCpuCatalog();

        expect(aprScope.isDone()).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledOnce();

        const written = JSON.parse(mockWriteFile.mock.calls[0][1].replace('\n', ''));
        expect(written.lastMonthExtracted).toBe('April 2025');

        // Existing entry preserved
        const cveIds = written.patches.map((p: { cveId: string }) => p.cveId);
        expect(cveIds).toContain('CVE-2025-00001');
        // New entries added
        expect(cveIds).toContain('CVE-2025-11111');
        expect(written.patches.length).toBeGreaterThan(existingCatalog.patches.length);
    });

    it('no-op — does not write when catalog is up to date', async () => {
        const existingCatalog = {
            lastMonthExtracted: 'April 2025',
            patches: [{ cveId: 'CVE-2025-00001' }]
        };
        mockReadFile.mockResolvedValue(JSON.stringify(existingCatalog));

        await refreshOracleCpuCatalog();

        expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('partial failure — skips failed release and writes remaining', async () => {
        mockReadFile.mockRejectedValue(new Error('ENOENT'));

        interceptCsafError('jan', 2025);
        const aprScope = interceptCsaf('apr', 2025, '2025-04-15');

        await refreshOracleCpuCatalog();

        expect(aprScope.isDone()).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledOnce();

        const written = JSON.parse(mockWriteFile.mock.calls[0][1].replace('\n', ''));
        expect(written.lastMonthExtracted).toBe('April 2025');
        // Only April entries, no January
        const releaseNames = [...new Set(written.patches.map((p: { releaseName: string }) => p.releaseName))];
        expect(releaseNames).toEqual(['April 2025']);
    });

    it('all fetches fail — does not write catalog', async () => {
        mockReadFile.mockRejectedValue(new Error('ENOENT'));

        interceptCsafError('jan', 2025);
        interceptCsafError('apr', 2025);

        await refreshOracleCpuCatalog();

        expect(mockWriteFile).not.toHaveBeenCalled();
    });
});
