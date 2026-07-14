import { chunk, flatMap } from 'lodash-es';
import throat from 'throat';
import { callProxyForwarder } from '../../lib/cloud-manager/proxy-forwarder';
import getLogger from '../../utils/logger.js';

const logger = getLogger();

// ONTAP filter values are joined with `|` and travel through the Cloud Manager proxy-forwarder,
// API Gateway, and any fronting WAF. The combined request line + headers must stay under ~8 KB
// or the forwarder returns 403/414. UUIDs are 36 chars; URL-encoded `|` is 3 bytes, so each
// UUID costs ~39 bytes on the wire. 25 keeps the encoded filter under ~1 KB with plenty of
// headroom for `fields`, the wrapper URL, and headers.
const ONTAP_FILTER_BATCH_SIZE = 25;

interface OntapPage<T> {
    num_records: number;
    records: T[];
    _links?: { next?: { href: string } };
}

interface ProxyOperationBaseOpts {
    accountId: string;
    targetId: string;
    endpoint: string;
    fields?: string;
    maxRecords?: number;
}

function isOntapPagedResponse<T>(value: unknown): value is OntapPage<T> {
    return typeof value === 'object' && value !== null && Array.isArray((value as OntapPage<T>).records);
}

async function collectAllOntapRecords<T>(
    base: ProxyOperationBaseOpts,
    ontapPath: string,
    searchParams?: Record<string, string | number | boolean>,
    maxRecords?: number
): Promise<T[]> {
    const records: T[] = [];
    let currentPath: string | undefined = ontapPath;
    let currentParams = searchParams;
    let pageCount = 0;
    const { targetId } = base;

    logger.info('Collecting ONTAP records', { targetId, ontapPath, maxRecords, searchParams });

    while (currentPath) {
        // eslint-disable-next-line no-await-in-loop
        const page: OntapPage<T> | T = await callProxyForwarder<OntapPage<T> | T>({
            ...base,
            ontapPath: currentPath,
            ...(currentParams ? { searchParams: currentParams } : {})
        });
        pageCount += 1;

        // Single-resource ONTAP endpoints (e.g. /storage/volumes/{uuid}) return the
        // object directly with no `records` array; treat as a one-item collection.
        if (!isOntapPagedResponse<T>(page)) {
            records.push(page);
            break;
        }

        records.push(...page.records);
        logger.debug('Fetched ONTAP page', {
            page: pageCount,
            pageRecords: page.records.length,
            total: records.length
        });

        if (maxRecords !== undefined && records.length >= maxRecords) {
            break;
        }

        const nextHref: string | undefined = page._links?.next?.href;
        if (!nextHref) {
            break;
        }

        // ONTAP returns hrefs like "/api/storage/volumes?start.uuid=xxx".
        // Strip the leading slash; the href already encodes query params so clear searchParams.
        currentPath = nextHref.replace(/^\//, '');
        currentParams = undefined;
    }

    logger.info('Collected ONTAP records', {
        targetId,
        ontapPath,
        pages: pageCount,
        total: records.length
    });

    return records;
}

async function collectOntapRecordsBatched<T>(
    base: ProxyOperationBaseOpts,
    ontapPath: string,
    filterKey: string,
    filterValues: string[],
    extraParams: Record<string, string | number | boolean>
): Promise<T[]> {
    const { targetId } = base;

    logger.info('Collecting batched ONTAP records', { targetId, ontapPath, filterKey, filterValues, extraParams });

    const batches = chunk(filterValues, ONTAP_FILTER_BATCH_SIZE);
    const results = await Promise.all(
        batches.map(
            throat(3, batch =>
                collectAllOntapRecords<T>(base, ontapPath, { ...extraParams, [filterKey]: batch.join('|') })
            )
        )
    );
    const responseRecords = flatMap(results, r => r);

    logger.info('Collected batched ONTAP records', {
        targetId,
        ontapPath,
        filterKey,
        filterValues,
        extraParams,
        totalRecords: responseRecords.length
    });

    return responseRecords;
}

export { collectAllOntapRecords, collectOntapRecordsBatched };
