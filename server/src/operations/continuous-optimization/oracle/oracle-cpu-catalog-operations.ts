/*
 * Oracle CPU Catalog Builder
 *
 * Fetches Oracle's quarterly Critical Patch Update (CPU) advisories in CSAF v2.0 JSON format
 * and extracts only the Oracle Database Server vulnerabilities into a local catalog file.
 *
 * Source:  https://www.oracle.com/a/tech/docs/security-alerts/cpu{jan|apr|jul|oct}{year}csaf.json
 *
 * CSAF structure (simplified):
 *   {
 *     "document": {
 *       "tracking": { "initial_release_date": "2025-04-15T13:00:00-07:00" }
 *     },
 *     "product_tree": {
 *       "branches": [{
 *         "name": "Oracle",
 *         "branches": [{
 *           "name": "Oracle Database Server",
 *           "branches": [{
 *             "name": "Oracle Database Server",
 *             "branches": [
 *               { "product": { "product_id": "P-5(Java VM)V-19.3-19.26" } },
 *               { "product": { "product_id": "P-5(Oracle Database)V-23.4-23.7" } }
 *             ]
 *           }]
 *         }],
 *        ...other oracle products
 *       }]
 *     },
 *     "vulnerabilities": [{
 *       "cve": "CVE-2024-13176",
 *       "ids": [{ "system_name": "Oracle Bug ID of Oracle Database Server", "text": "37618872" }],
 *       "notes": [{
 *         "category": "description",
 *         "text": "Vulnerability in the Oracle Database (OpenSSL) component of Oracle Database Server. Supported versions that are affected are 23.4-23.7. CVSS 3.1 Base Score 4.3."
 *       }],
 *       "product_status": { "known_affected": ["P-5(Oracle Database)V-23.4-23.7"] },
 *       "scores": [{ "cvss_v3": { "baseScore": 4.3 }, "products": ["P-5(Oracle Database)V-23.4-23.7"] }]
 *     }]
 *   }
 *
 * What we store (catalog file):
 *   {
 *     "lastMonthExtracted": "April 2025",
 *     "patches": [{
 *       "cveId": "CVE-2024-13176",
 *       "component": "Oracle Database",
 *       "description": "Vulnerability in the Oracle Database (OpenSSL) component of Oracle Database Server. Supported versions that are affected are 23.4-23.7. CVSS 3.1 Base Score 4.3.",
 *       "releaseDate": "2025-04-15",
 *       "releaseName": "April 2025",
 *       "affectedVersions": ["23.4-23.7"],
 *       "additionalCvesAddressed": ["CVE-2022-3786", "CVE-2024-9143"]
 *     }]
 *   }
 *
 * Key logic:
 *   - Filter vulnerabilities to only those with known_affected products in "Oracle Database Server"
 *   - Group CVEs sharing the same Oracle Bug ID (same patch fixes multiple CVEs)
 *   - Pick primary CVE per group (highest CVSS, then most recent CVE ID); rest go to additionalCvesAddressed
 *   - Delta-aware: reads lastMonthExtracted to only fetch new quarterly releases
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import throat from 'throat';
import { compact } from 'lodash-es';

import getLogger from '../../../utils/logger';
import { gotInstanceForExternalRequest } from '../../../utils/got';
import { ORACLE_CPU_CATALOG_FILE_PATH, ORACLE_CPU_CATALOG_LOOKBACK_YEARS } from '../../../utils/consts';
import { IS_DEMO_FLOW } from '../../../utils/utils';
import { DEMO_ORACLE_CPU_CATALOG } from '../../../utils/demo-utils/demoMockdata';

const logger = getLogger();

const CSAF_BASE_URL = 'https://www.oracle.com/a/tech/docs/security-alerts';
const DB_FAMILY = 'Oracle Database Server';
const ALLOWED_COMPONENTS = [
    'Oracle Database Core',
    'RDBMS',
    'Java VM',
    'OJVM',
    'XML DB',
    'XDB',
    'Database Security',
    'Oracle Text'
];
const MAX_CONCURRENT_FETCHES = 4;

const CPU_QUARTERS = [
    { month: 'January', monthNum: 1, abbrev: 'jan' },
    { month: 'April', monthNum: 4, abbrev: 'apr' },
    { month: 'July', monthNum: 7, abbrev: 'jul' },
    { month: 'October', monthNum: 10, abbrev: 'oct' }
] as const;

// CSAF types (subset relevant to our parsing)
interface CSAFDocument {
    document: { tracking: { initial_release_date: string } };
    product_tree: {
        branches: Array<{
            name: string;
            branches: Array<{
                name: string;
                branches?: Array<{
                    name?: string;
                    product?: { product_id: string };
                    branches?: Array<{ name?: string; product?: { product_id: string } }>;
                }>;
            }>;
        }>;
    };
    vulnerabilities: CSAFVulnerability[];
}

interface CSAFVulnerability {
    cve: string;
    ids: Array<{ system_name: string; text: string }>;
    notes: Array<{ category: string; text: string }>;
    product_status: { known_affected?: string[] };
    scores: Array<{ cvss_v3?: { baseScore: number }; products: string[] }>;
}

// Output type
interface CPUCatalogEntry {
    cveId: string;
    component: string;
    description: string;
    releaseDate: string;
    releaseName: string;
    affectedVersions: string[];
    additionalCvesAddressed: string[];
}

interface CPUCatalog {
    lastMonthExtracted: string;
    patches: CPUCatalogEntry[];
}

// Helpers
interface DbVulnEntry {
    cve: string;
    dbProducts: string[];
    maxScore: number;
    bugIds: string[];
    description: string;
}

function cveNumericKey(cve: string): [number, number] {
    const [, y, s] = cve.split('-');
    return [Number(y), Number(s)];
}

// Descending by Oracle CVSS, then by most-recent CVE ID.
function primaryFirst(a: DbVulnEntry, b: DbVulnEntry): number {
    if (b.maxScore !== a.maxScore) {
        return b.maxScore - a.maxScore;
    }
    const [aY, aS] = cveNumericKey(a.cve);
    const [bY, bS] = cveNumericKey(b.cve);
    return bY !== aY ? bY - aY : bS - aS;
}

function extractVersion(productId: string): string {
    return productId.match(/V-(.+)$/)?.[1] ?? '';
}

function componentNameFromBranch(name: string): string {
    // "Oracle Text Version 19.3-19.21" → "Oracle Text"
    return name.replace(/\s+Version\s+\S+$/i, '').trim();
}

function isAllowedComponent(name: string): boolean {
    const lower = name.toLowerCase();
    return ALLOWED_COMPONENTS.some(kw => lower.includes(kw.toLowerCase()));
}

// Product-tree: map product_ids → component names for allowed Oracle Database Server components
function buildDbProductMap(productTree: CSAFDocument['product_tree']): Map<string, string> {
    const dbFamily = productTree.branches[0]?.branches?.find(f => f.name === DB_FAMILY);
    return (dbFamily?.branches ?? []).reduce((map, product) => {
        const parentName = product.name ?? '';
        (product.branches ?? []).forEach(version => {
            if (version.product) {
                const id = version.product.product_id;
                const fromId = id.match(/\(([^)]+)\)/)?.[1];
                const fromVersionName = version.name ? componentNameFromBranch(version.name) : '';
                const fromParentName = parentName ? componentNameFromBranch(parentName) : '';
                const component = fromId || fromVersionName || fromParentName || 'Unknown';
                if (component !== 'Unknown' && isAllowedComponent(component)) {
                    map.set(id, component);
                }
            }
        });
        return map;
    }, new Map<string, string>());
}

// Release schedule — CPU quarters in the lookback window, starting after lastExtracted
function buildAllReleases(lastExtracted: string): Array<{ month: string; year: number; url: string }> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const startYear = currentYear - ORACLE_CPU_CATALOG_LOOKBACK_YEARS;
    const releases: Array<{ month: string; year: number; url: string }> = [];
    // When lastExtracted is empty (first run), collect from the start.
    // Otherwise skip quarters up to and including lastExtracted, then collect the rest.
    let shouldCollect = lastExtracted === '';

    for (let year = startYear; year <= currentYear; year++) {
        for (const q of CPU_QUARTERS) {
            if (year === currentYear && q.monthNum > currentMonth) {
                break;
            }
            if (shouldCollect) {
                releases.push({ month: q.month, year, url: `${CSAF_BASE_URL}/cpu${q.abbrev}${year}csaf.json` });
            }
            if (`${q.month} ${year}` === lastExtracted) {
                shouldCollect = true;
            }
        }
    }
    return releases;
}

// CSAF fetch
async function fetchCSAF(url: string): Promise<CSAFDocument | null> {
    try {
        return await gotInstanceForExternalRequest.get<CSAFDocument>(url);
    } catch (error) {
        logger.error('Failed to fetch CSAF JSON', { url, error });
        return null;
    }
}

// Parse a single CSAF → catalog entries for Oracle Database Server
function buildCatalogEntries(csaf: CSAFDocument, releaseName: string, releaseDate: string): CPUCatalogEntry[] {
    const dbProductMap = buildDbProductMap(csaf.product_tree);

    // Extract only vulnerabilities affecting Oracle Database Server
    const dbVulns = compact(
        csaf.vulnerabilities.map(vuln => {
            const dbProducts = (vuln.product_status?.known_affected ?? []).filter(pid => dbProductMap.has(pid));
            if (dbProducts.length === 0) {
                return null;
            }
            const bugIds = (vuln.ids ?? []).map(id => id.text);
            const maxScore = (vuln.scores ?? []).reduce((max, s) => {
                const relevant = s.products.some(pid => dbProductMap.has(pid));
                return relevant && (s.cvss_v3?.baseScore ?? 0) > max ? s.cvss_v3!.baseScore : max;
            }, 0);
            const note = (vuln.notes ?? []).find(
                n => n.category === 'description' && n.text.includes('Database Server')
            );
            return { cve: vuln.cve, dbProducts, maxScore, bugIds, description: note?.text ?? '' } as DbVulnEntry;
        })
    );

    // Build bug index — bug ID → set of CVE IDs sharing that patch
    const bugToCves = new Map<string, Set<string>>();
    dbVulns.forEach(entry =>
        entry.bugIds.forEach(bugId => {
            const cves = bugToCves.get(bugId) ?? new Set<string>();
            cves.add(entry.cve);
            bugToCves.set(bugId, cves);
        })
    );

    // Group CVEs that share any bug ID, sort each group so primary comes first
    const seen = new Set<string>();
    const groups: DbVulnEntry[][] = [];
    dbVulns.forEach(entry => {
        if (!seen.has(entry.cve)) {
            const patchGroup = new Set<string>([entry.cve]);
            entry.bugIds.forEach(bugId => bugToCves.get(bugId)?.forEach(cve => patchGroup.add(cve)));
            const group = dbVulns.filter(v => patchGroup.has(v.cve));
            group.forEach(m => seen.add(m.cve));
            group.sort(primaryFirst);
            groups.push(group);
        }
    });

    // Map each group → catalog entry (group[0] is primary after sort, rest are additional)
    return groups.map(group => {
        const primary = group[0];
        return {
            cveId: primary.cve,
            component: dbProductMap.get(primary.dbProducts[0]) ?? 'Unknown',
            description: primary.description,
            releaseDate,
            releaseName,
            affectedVersions: [...new Set(primary.dbProducts.map(extractVersion))].filter(Boolean),
            additionalCvesAddressed: group
                .slice(1)
                .map(e => e.cve)
                .sort()
        };
    });
}

/** Reads and parses the existing catalog. Returns undefined if missing, empty, or invalid. */
async function loadCatalog(): Promise<CPUCatalog | undefined> {
    try {
        const raw = await readFile(ORACLE_CPU_CATALOG_FILE_PATH, 'utf-8');
        const catalog = JSON.parse(raw) as CPUCatalog;
        if (catalog.lastMonthExtracted && Array.isArray(catalog.patches)) {
            return catalog;
        }
    } catch (error) {
        logger.error('Failed to load Oracle CPU catalog', { error });
    }
}

// Public API — refresh the Oracle CPU catalog (delta-aware)
async function refreshOracleCpuCatalog(caller?: string): Promise<void> {
    logger.info('Refreshing Oracle CPU catalog', { caller });
    try {
        const existing = await loadCatalog();
        const releasesToFetch = buildAllReleases(existing?.lastMonthExtracted ?? '');

        if (releasesToFetch.length === 0) {
            logger.info('Oracle CPU catalog is up to date, no new releases to fetch');
            return;
        }

        logger.info('Fetching Oracle CPU CSAF files', {
            mode: existing ? 'delta' : 'full',
            releasesToFetch: releasesToFetch.map(r => `${r.month} ${r.year}`)
        });

        const csafResults = await Promise.all(
            releasesToFetch.map(
                throat(MAX_CONCURRENT_FETCHES, async release => {
                    const csaf = await fetchCSAF(release.url);
                    logger.info('Fetched CSAF', { release: `${release.month} ${release.year}` });
                    return { release, csaf };
                })
            )
        );

        const failedReleases: string[] = [];
        const newEntries: CPUCatalogEntry[] = [];

        csafResults.forEach(({ release, csaf }) => {
            if (!csaf) {
                failedReleases.push(`${release.month} ${release.year}`);
            } else {
                const releaseName = `${release.month} ${release.year}`;
                const releaseDate = csaf.document.tracking.initial_release_date?.split('T')?.[0];
                newEntries.push(...buildCatalogEntries(csaf, releaseName, releaseDate));
            }
        });

        if (failedReleases.length > 0) {
            logger.error('Some CSAF fetches failed, skipping those releases', { failed: failedReleases });
        }

        if (newEntries.length === 0) {
            logger.info('No new CVE entries found from fetched releases, catalog unchanged');
            return;
        }

        // Append new entries to existing patches (or start fresh) and write
        const newestRelease = newEntries[newEntries.length - 1].releaseName;
        const catalog: CPUCatalog = {
            lastMonthExtracted: newestRelease,
            patches: [...(existing?.patches ?? []), ...newEntries]
        };

        await mkdir(dirname(ORACLE_CPU_CATALOG_FILE_PATH), { recursive: true });
        await writeFile(ORACLE_CPU_CATALOG_FILE_PATH, `${JSON.stringify(catalog)}\n`);

        logger.info('Oracle CPU catalog refreshed', {
            mode: existing ? 'delta' : 'full',
            newEntries: newEntries.length,
            totalPatches: catalog.patches.length
        });
    } catch (error) {
        logger.error('Failed to refresh Oracle CPU catalog, existing catalog unchanged', { error });
        throw error;
    }
}

async function loadCpuCatalog(): Promise<CPUCatalogEntry[]> {
    if (IS_DEMO_FLOW) {
        return DEMO_ORACLE_CPU_CATALOG as CPUCatalogEntry[];
    }

    const existing = await loadCatalog();
    if (existing && existing.patches.length > 0) {
        return existing.patches;
    }

    logger.info('CPU catalog is empty or missing, triggering refresh');
    try {
        await refreshOracleCpuCatalog('loadCpuCatalog');
        return (await loadCatalog())?.patches ?? [];
    } catch (error) {
        logger.error('Failed to refresh Oracle CPU catalog on demand', { error });
    }

    return [];
}

export { refreshOracleCpuCatalog, loadCpuCatalog };
export type { CPUCatalogEntry, CPUCatalog };
