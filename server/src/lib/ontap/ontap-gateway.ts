import { chunk, flatMap } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';

import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { sleep } from '../../utils/utils';

import { describeFSx } from '../aws/fsx';
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

interface ProxyCollectionEnvelope<T> {
    Count: number;
    value: T[];
}

interface OntapVolumeRecord {
    name: string;
    uuid: string;
    svm?: { name?: string; uuid?: string };
    nas?: { path?: string };
    autosize?: { mode?: string };
    space?: {
        fractional_reserve?: number;
        snapshot?: {
            reserve_percent?: number;
            autodelete?: { enabled?: boolean; delete_order?: string };
        };
    };
    snapshot_policy?: { name?: string };
    tiering?: { policy?: string; min_cooling_days?: number };
    guarantee?: { honored?: boolean; type?: string };
    efficiency?: {
        compression?: string;
        compression_type?: string;
        compaction?: string;
        dedupe?: string;
        storage_efficiency_mode?: string;
    };
}

interface OntapLunRecord {
    name: string;
    uuid: string;
    os_type?: string;
    space?: { guarantee?: { requested?: boolean }; scsi_thin_provisioning_support_enabled?: boolean };
}

function isProxyCollectionEnvelope<T>(value: unknown): value is ProxyCollectionEnvelope<T> {
    return typeof value === 'object' && value !== null && Array.isArray((value as ProxyCollectionEnvelope<T>).value);
}

interface OntapLunRecord {
    uuid: string;
    name: string;
    serial_number: string;
}

interface OntapVolumeRecord {
    uuid: string;
    name: string;
    [key: string]: unknown;
}

interface OntapCifsShareRecord {
    volume?: { uuid: string; name?: string };
}

/**
 * Resolves the ONTAP management endpoint (DNS name, falling back to an IP address) for an FSx
 * for ONTAP file system directly from the raw `DescribeFileSystems` response — deliberately not
 * routed through `getFSXDetails` (which enriches with SVMs/volumes/network interfaces this lookup
 * doesn't need) to avoid an import cycle between this module and `operations/aws/fsx-operations.ts`.
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
    const { DNSName: dnsName, IpAddresses: ipAddresses } =
        fileSystems[0]?.OntapConfiguration?.Endpoints?.Management ?? {};
    const managementEndpoint = dnsName || ipAddresses?.[0];

    if (!managementEndpoint) {
        const errorMessage = `Unable to resolve ONTAP management endpoint for FSx file system ${fsxId}`;
        logger.error(errorMessage, { accountId, credentialsId, region, fsxId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    return managementEndpoint;
}

/**
 * Resolves an {@link OntapGatewayTarget} into the `accountId`/`targetId`/`endpoint` base needed by
 * `collectAllOntapRecords`/`collectOntapRecordsBatched`, reusing the same endpoint lookup as
 * `callOntapApi`.
 */
async function toProxyBase(target: OntapGatewayTarget): Promise<ProxyOperationBaseOpts> {
    const { accountId, credentialsId, region, fsxId } = target;
    const endpoint = await resolveFsxManagementEndpoint(credentialsId, region, fsxId, accountId);

    return { accountId, targetId: fsxId, endpoint };
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

function extractErrorMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
}

/** Builds the `{ accountId, targetId, endpoint }` base shared by all proxy-forwarder ONTAP calls for an FSx file system. */
function buildOntapProxyBase(accountId: string, targetId: string, region: string): ProxyOperationBaseOpts {
    return { accountId, targetId, endpoint: `management.${targetId}.fsx.${region}.amazonaws.com` };
}

/** Unwraps a settled batched-fetch result, logging and recording an error string on rejection. */
function unwrapOntapSettled<T>(
    result: PromiseSettledResult<T[]>,
    label: string,
    targetId: string
): { data: T[]; error?: string } {
    if (result.status === 'fulfilled') {
        return { data: result.value };
    }
    logger.warn(`Failed to fetch ONTAP ${label}`, { targetId, err: result.reason });
    return { data: [], error: extractErrorMessage(result.reason) };
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
        const page: OntapPage<T> | ProxyCollectionEnvelope<T> | T = await callProxyForwarder<
            OntapPage<T> | ProxyCollectionEnvelope<T> | T
        >({
            ...base,
            ontapPath: currentPath,
            ...(currentParams ? { searchParams: currentParams } : {})
        });
        pageCount += 1;

        if (isProxyCollectionEnvelope<T>(page)) {
            records.push(...page.value);
            logger.debug('Fetched ONTAP page (proxy collection envelope)', {
                page: pageCount,
                pageRecords: page.value.length,
                total: records.length
            });
            break;
        }

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

/**
 * Looks up ONTAP LUNs by serial number, batching the `serial_number` filter across requests of up
 * to {@link ONTAP_FILTER_BATCH_SIZE} values. Returns `[]` without making a request when
 * `serialNumbers` is empty.
 */
async function getLunBySerialNumber(
    target: OntapGatewayTarget,
    serialNumbers: string[],
    opts?: { svmUuid?: string; fields?: string }
): Promise<OntapLunRecord[]> {
    if (serialNumbers.length === 0) {
        return [];
    }

    const base = await toProxyBase(target);
    return collectOntapRecordsBatched<OntapLunRecord>(base, 'api/storage/luns', 'serial_number', serialNumbers, {
        ...(opts?.fields ? { fields: opts.fields } : {}),
        ...(opts?.svmUuid ? { 'svm.uuid': opts.svmUuid } : {})
    });
}

/**
 * Looks up ONTAP volumes by name, batching the `name` filter across requests of up to
 * {@link ONTAP_FILTER_BATCH_SIZE} values. Always requests `snapshot_count` in addition to any
 * caller-supplied `fields`. Returns `[]` without making a request when `names` is empty.
 */
async function getVolumeByName(
    target: OntapGatewayTarget,
    names: string[],
    opts?: { svmUuid?: string; fields?: string }
): Promise<OntapVolumeRecord[]> {
    if (names.length === 0) {
        return [];
    }

    const base = await toProxyBase(target);
    return collectOntapRecordsBatched<OntapVolumeRecord>(base, 'api/storage/volumes', 'name', names, {
        fields: `snapshot_count${opts?.fields ? `,${opts.fields}` : ''}`,
        ...(opts?.svmUuid ? { 'svm.uuid': opts.svmUuid } : {})
    });
}

/**
 * Looks up the ONTAP volume backing each CIFS share name, batching the `name` filter across
 * requests of up to {@link ONTAP_FILTER_BATCH_SIZE} values. Returns `[]` without making a request
 * when `shareNames` is empty.
 */
async function getCifsShareVolumes(target: OntapGatewayTarget, shareNames: string[]): Promise<OntapCifsShareRecord[]> {
    if (shareNames.length === 0) {
        return [];
    }

    const base = await toProxyBase(target);
    return collectOntapRecordsBatched<OntapCifsShareRecord>(base, 'api/protocols/cifs/shares', 'name', shareNames, {
        fields: 'volume'
    });
}

export {
    callOntapApi,
    getClusterInfo,
    getClusterJobStatus,
    collectAllOntapRecords,
    collectOntapRecordsBatched,
    getLunBySerialNumber,
    getVolumeByName,
    getCifsShareVolumes,
    buildOntapProxyBase,
    extractErrorMessage,
    unwrapOntapSettled,
    type OntapGatewayTarget,
    type OntapLunRecord,
    type OntapVolumeRecord,
    type OntapCifsShareRecord
};
