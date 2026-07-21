import { chunk, flatMap } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';

import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { sleep } from '../../utils/utils';

import { describeFSx } from '../aws/fsx';
import { getFSXDetails } from '../../operations/aws/fsx-operations';
import { callProxyForwarder, type ProxyHttpMethod } from '../cloud-manager/proxy-forwarder';

const logger = getLogger();

const ONTAP_JOB_POLL_DEFAULT_TIMEOUT_MS = 900_000;
const ONTAP_JOB_POLL_DEFAULT_INTERVAL_MS = 10_000;
const ONTAP_FILTER_BATCH_SIZE = 25;

interface OntapGatewayTarget {
    accountId: string;
    credentialsId: string;
    region: string;
    fsxId: string;
}

interface CallOntapApiOptions extends OntapGatewayTarget {
    path: string;
    method?: ProxyHttpMethod;
    query?: Record<string, string | number | boolean>;
    body?: unknown;
}

interface OntapClusterVersion {
    generation?: number;
    major?: number;
    minor?: number;
    full?: string;
}

interface OntapClusterInfo {
    name?: string;
    uuid?: string;
    version?: OntapClusterVersion;
}

interface OntapJob {
    uuid?: string;
    description?: string;
    state?: string;
    message?: string;
    code?: number;
}

interface GetClusterJobStatusOptions extends OntapGatewayTarget {
    jobUuid: string;
    /** Overall time budget for polling before giving up. Defaults to {@link ONTAP_JOB_POLL_DEFAULT_TIMEOUT_MS}. */
    timeoutMs?: number;
    /** Delay between polls. Defaults to {@link ONTAP_JOB_POLL_DEFAULT_INTERVAL_MS}. */
    intervalMs?: number;
}

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

/**
 * Resolves the ONTAP management endpoint (DNS name, falling back to an IP address) for an FSx
 * for ONTAP file system, reusing the same AWS SDK lookup as `getFSXDetails`.
 */
async function resolveFsxManagementEndpoint(
    credentialsId: string,
    region: string,
    fsxId: string,
    accountId: string
): Promise<string> {
    const { FileSystems: fileSystems = [] } = await describeFSx(
        credentialsId,
        region,
        { FileSystemIds: [fsxId] },
        accountId
    );
    const [fsxDetails] = await getFSXDetails(credentialsId, region, fileSystems);
    const { dnsName, ipAddresses } = fsxDetails?.ontapConfiguration?.endpoints?.management ?? {};
    const managementEndpoint = dnsName || ipAddresses?.[0];

    if (!managementEndpoint) {
        const errorMessage = `Unable to resolve ONTAP management endpoint for FSx file system ${fsxId}`;
        logger.error(errorMessage, { accountId, credentialsId, region, fsxId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    return managementEndpoint;
}

/**
 * Thin per-request wrapper around `callProxyForwarder` for ONTAP/FSx REST calls. Resolves the
 * management endpoint from `fsxId`/`region` and forwards the call through the proxy-forwarder.
 */
async function callOntapApi<T>(opts: CallOntapApiOptions): Promise<T> {
    const { accountId, credentialsId, region, fsxId, path, method, query, body } = opts;
    const endpoint = await resolveFsxManagementEndpoint(credentialsId, region, fsxId, accountId);

    return callProxyForwarder<T>({
        accountId,
        targetId: fsxId,
        ontapPath: path,
        endpoint,
        method,
        body,
        searchParams: query
    });
}

async function getClusterInfo(target: OntapGatewayTarget): Promise<OntapClusterInfo> {
    return callOntapApi<OntapClusterInfo>({
        ...target,
        path: 'api/cluster',
        query: { fields: 'version' }
    });
}

async function getClusterJobStatus(opts: GetClusterJobStatusOptions): Promise<OntapJob> {
    const {
        jobUuid,
        timeoutMs = ONTAP_JOB_POLL_DEFAULT_TIMEOUT_MS,
        intervalMs = ONTAP_JOB_POLL_DEFAULT_INTERVAL_MS,
        ...target
    } = opts;
    const deadline = Date.now() + timeoutMs;
    let job: OntapJob;

    do {
        // eslint-disable-next-line no-await-in-loop
        job = await callOntapApi<OntapJob>({ ...target, path: `api/cluster/jobs/${jobUuid}` });

        if (job.state === 'success') {
            return job;
        }
        if (job.state === 'failure') {
            const errorMessage = `ONTAP job ${jobUuid} failed: ${job.message ?? JSON.stringify(job)}`;
            logger.error(errorMessage, { fsxId: target.fsxId, jobUuid, job });
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        // eslint-disable-next-line no-await-in-loop
        await sleep(intervalMs);
    } while (Date.now() < deadline);

    const errorMessage = `Timed out waiting for ONTAP job ${jobUuid} to complete after ${timeoutMs}ms (last state: ${job.state})`;
    logger.error(errorMessage, { fsxId: target.fsxId, jobUuid });
    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
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

export { callOntapApi, getClusterInfo, getClusterJobStatus, collectAllOntapRecords, collectOntapRecordsBatched };
