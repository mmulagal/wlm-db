import { chunk, flatMap } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';

import { AWS_FSX_TYPE, HttpErrorCodes } from '../../utils/consts';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import getLogger from '../../utils/logger';
import { extractErrorMessage, sleep } from '../../utils/utils';

import { describeFSx } from '../aws/fsx';
import { callProxyForwarder, type ProxyHttpMethod } from '../cloud-manager/proxy-forwarder';

const logger = getLogger();

const ONTAP_JOB_POLL_DEFAULT_TIMEOUT_MS = 900_000;
const ONTAP_JOB_POLL_DEFAULT_INTERVAL_MS = 10_000;
const ONTAP_FILTER_BATCH_SIZE = 25;
const NFS_MANAGEMENT_INTERFACE_NAME = 'nfs_smb_management_1';
const MANAGEMENT_ENDPOINT_CACHE_TTL = '6h';

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

interface OntapJobPollOptions {
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
    create_time?: string;
    clone?: {
        is_flexclone?: boolean;
        parent_volume?: { name?: string };
    };
    svm?: { name?: string; uuid?: string };
    nas?: { path?: string };
    snapmirror?: { is_protected?: boolean };
    autosize?: { mode?: string };
    space?: {
        size?: number;
        used?: number;
        physical_used?: number;
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
        state?: string;
        compression?: string;
        compression_type?: string;
        compaction?: string;
        dedupe?: string;
        storage_efficiency_mode?: string;
    };
    is_svm_root?: boolean;
}

interface OntapLunRecord {
    name: string;
    uuid: string;
    os_type?: string;
    space?: { guarantee?: { requested?: boolean }; scsi_thin_provisioning_support_enabled?: boolean };
    location?: { volume?: { uuid?: string; name?: string } };
}

interface OntapIgroupRecord {
    name: string;
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

/** Shared `space.*` shape for ONTAP volume sizing (used by both MSSQL and Oracle storage assessments). */
interface OntapVolumeSpace {
    size?: number;
    used?: number;
    physical_used?: number;
    performance_tier_footprint?: number;
    capacity_tier_footprint?: number;
    snapshot?: { used?: number };
}

interface OntapSvmRecord {
    uuid?: string;
    name?: string;
    ip_interfaces?: Array<{ name?: string; ip?: { address?: string } }>;
}

interface ResolvedSvm {
    name?: string;
    uuid?: string;
}

interface OntapVolumeByJunctionRecord {
    uuid?: string;
    name?: string;
}

interface ResolvedVolume {
    uuid?: string;
    name?: string;
}

/**
 * Resolves the ONTAP management endpoint (IP address, falling back to the DNS name) for an FSx
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
    const cacheKey = `ontap-management-endpoint:${accountId}:${credentialsId}:${region}:${fsxId}`;
    if (hasCache(AWS_FSX_TYPE, cacheKey)) {
        const endpoint = readFromCacheByKey(AWS_FSX_TYPE, cacheKey);
        if (endpoint && typeof endpoint === 'string') {
            return endpoint;
        }
    }

    const { FileSystems: fileSystems = [] } = await describeFSx(
        credentialsId,
        region,
        { FileSystemIds: [fsxId] },
        accountId
    );
    const { DNSName: dnsName, IpAddresses: ipAddresses } =
        fileSystems[0]?.OntapConfiguration?.Endpoints?.Management ?? {};
    const managementEndpoint = ipAddresses?.[0] || dnsName;

    if (!managementEndpoint) {
        const errorMessage = `Unable to resolve ONTAP management endpoint for FSx file system ${fsxId}`;
        logger.error(errorMessage, { accountId, credentialsId, region, fsxId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    writeToCache(AWS_FSX_TYPE, cacheKey, managementEndpoint, MANAGEMENT_ENDPOINT_CACHE_TTL);

    return managementEndpoint;
}

/**
 * Resolves an {@link OntapGatewayTarget} into the `accountId`/`targetId`/`endpoint` base needed by
 * `collectAllOntapRecords`/`collectOntapRecordsBatched`, reusing the same endpoint lookup as
 * `callOntapApi`.
 */
async function toProxyBase(target: OntapGatewayTarget): Promise<ProxyOperationBaseOpts> {
    const { accountId, credentialsId, region, fsxId } = target;

    return buildOntapProxyBase(accountId, credentialsId, fsxId, region);
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

/** Shared poll loop backing both {@link getClusterJobStatus} and {@link getOntapJobStatusForBase}. */
async function pollOntapJob(
    fetchJob: () => Promise<OntapJob>,
    jobUuid: string,
    targetId: string,
    opts: OntapJobPollOptions = {}
): Promise<OntapJob> {
    const { timeoutMs = ONTAP_JOB_POLL_DEFAULT_TIMEOUT_MS, intervalMs = ONTAP_JOB_POLL_DEFAULT_INTERVAL_MS } = opts;
    const deadline = Date.now() + timeoutMs;
    let job: OntapJob;

    do {
        // eslint-disable-next-line no-await-in-loop
        job = await fetchJob();

        if (job.state === 'success') {
            return job;
        }
        if (job.state === 'failure') {
            const errorMessage = `ONTAP job ${jobUuid} failed: ${job.message ?? JSON.stringify(job)}`;
            logger.error(errorMessage, { targetId, jobUuid, job });
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        // eslint-disable-next-line no-await-in-loop
        await sleep(intervalMs);
    } while (Date.now() < deadline);

    const errorMessage = `Timed out waiting for ONTAP job ${jobUuid} to complete after ${timeoutMs}ms (last state: ${job.state})`;
    logger.error(errorMessage, { targetId, jobUuid });
    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
}

async function getClusterJobStatus(
    target: OntapGatewayTarget,
    jobUuid: string,
    pollOpts?: OntapJobPollOptions
): Promise<OntapJob> {
    const { accountId, credentialsId, region, fsxId } = target;
    const endpoint = await resolveFsxManagementEndpoint(credentialsId, region, fsxId, accountId);

    return pollOntapJob(
        () =>
            callProxyForwarder<OntapJob>({
                accountId,
                targetId: fsxId,
                ontapPath: `api/cluster/jobs/${jobUuid}`,
                endpoint
            }),
        jobUuid,
        fsxId,
        pollOpts
    );
}

async function callOntapAndPollJob<T = unknown>(opts: CallOntapApiOptions): Promise<T> {
    const { accountId, credentialsId, region, fsxId, path, method } = opts;
    const resolvedMethod = method ?? 'PATCH';
    logger.info('Calling ONTAP mutation', { accountId, fsxId, path, method: resolvedMethod });

    const response = await callOntapApi<T>({ ...opts, method: resolvedMethod });
    const jobUuid = (response as { job?: { uuid?: string } } | null | undefined)?.job?.uuid;
    if (jobUuid) {
        logger.info('Polling ONTAP cluster job', { accountId, fsxId, path, jobUuid });
        await getClusterJobStatus({ accountId, credentialsId, region, fsxId }, jobUuid);
    }
    return response;
}

async function getOntapJobStatusForBase(
    base: ProxyOperationBaseOpts,
    jobUuid: string,
    opts?: OntapJobPollOptions
): Promise<OntapJob> {
    return pollOntapJob(
        () => callProxyForwarder<OntapJob>({ ...base, ontapPath: `api/cluster/jobs/${jobUuid}` }),
        jobUuid,
        base.targetId,
        opts
    );
}

function isOntapPagedResponse<T>(value: unknown): value is OntapPage<T> {
    return typeof value === 'object' && value !== null && Array.isArray((value as OntapPage<T>).records);
}

/** Builds the `{ accountId, targetId, endpoint }` base shared by all proxy-forwarder ONTAP calls for an FSx file system. */
async function buildOntapProxyBase(
    accountId: string,
    credentialsId: string,
    targetId: string,
    region: string
): Promise<ProxyOperationBaseOpts> {
    const endpoint = await resolveFsxManagementEndpoint(credentialsId, region, targetId, accountId);

    return { accountId, targetId, endpoint };
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

function extractBaseIqn(iqn: string): string | undefined {
    const match = iqn.match(/(.*:.+?)\./);
    return match?.[1];
}

async function lookupIgroupByInitiators(base: ProxyOperationBaseOpts, svmName: string, iqnList: string) {
    logger.info('Starting lookupIgroupByInitiators', { targetId: base.targetId, svmName, iqnList });
    const records = await collectAllOntapRecords<OntapIgroupRecord>(
        base,
        'api/protocols/san/igroups',
        { 'svm.name': svmName, 'initiators.name': iqnList, protocol: 'iscsi' },
        1
    );
    const iGroup = records[0]?.name;
    logger.info('Completed lookupIgroupByInitiators', { targetId: base.targetId, svmName, iqnList, iGroup });
    return iGroup;
}

async function findIgroupForInitiators(
    base: ProxyOperationBaseOpts,
    svmName: string,
    nodeIqn: string,
    standbyIqn?: string
) {
    logger.info('Starting findIgroupForInitiators', { targetId: base.targetId, svmName, nodeIqn, standbyIqn });

    const iqnList = [nodeIqn, standbyIqn].filter(Boolean).join(',');
    let iGroup = await lookupIgroupByInitiators(base, svmName, iqnList);
    if (iGroup) {
        return iGroup;
    }

    const baseIqn = extractBaseIqn(nodeIqn);
    const baseStandbyIqn = standbyIqn ? extractBaseIqn(standbyIqn) : undefined;
    if (!baseIqn) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Unable to find initiator group allowing access to the node'
        );
    }

    const baseIqnList = [baseIqn, baseStandbyIqn].filter(Boolean).join(',');
    iGroup = await lookupIgroupByInitiators(base, svmName, baseIqnList);
    if (!iGroup) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Unable to find initiator group allowing access to the node'
        );
    }

    logger.info('Completed findIgroupForInitiators', { targetId: base.targetId, svmName, iGroup });
    return iGroup;
}

async function createOntapVolume(base: ProxyOperationBaseOpts, body: Record<string, unknown>) {
    logger.info('Starting createOntapVolume', { targetId: base.targetId, body });

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/storage/volumes',
        method: 'POST',
        body
    });

    logger.info('Completed createOntapVolume', { targetId: base.targetId });
}

async function patchOntapVolumeByCliName(
    base: ProxyOperationBaseOpts,
    svmName: string,
    volumeName: string,
    body: Record<string, unknown>
) {
    logger.info('Starting patchOntapVolumeByCliName', { targetId: base.targetId, svmName, volumeName });

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/private/cli/volume',
        method: 'PATCH',
        searchParams: { vserver: svmName, volume: volumeName },
        body
    });

    logger.info('Completed patchOntapVolumeByCliName', { targetId: base.targetId, svmName, volumeName });
}

async function patchOntapVolumeSnapshotAutodelete(
    base: ProxyOperationBaseOpts,
    svmName: string,
    volumeName: string,
    body: Record<string, unknown>
) {
    logger.info('Starting patchOntapVolumeSnapshotAutodelete', { targetId: base.targetId, svmName, volumeName });

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/private/cli/volume/snapshot/autodelete',
        method: 'PATCH',
        searchParams: { vserver: svmName, volume: volumeName },
        body
    });

    logger.info('Completed patchOntapVolumeSnapshotAutodelete', { targetId: base.targetId, svmName, volumeName });
}

async function createOntapLun(base: ProxyOperationBaseOpts, lunPath: string, body: Record<string, unknown>) {
    logger.info('Starting createOntapLun', { targetId: base.targetId, lunPath });

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/storage/luns',
        method: 'POST',
        body
    });

    logger.info('Completed createOntapLun', { targetId: base.targetId, lunPath });
}

async function createOntapLunMapping(base: ProxyOperationBaseOpts, body: Record<string, unknown>) {
    logger.info('Starting createOntapLunMapping', { targetId: base.targetId, body });

    const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
        ...base,
        ontapPath: 'api/protocols/san/lun-maps',
        method: 'POST',
        body
    });
    if (job?.uuid) {
        await getOntapJobStatusForBase(base, job.uuid);
    }

    logger.info('Completed createOntapLunMapping', { targetId: base.targetId });
}

async function patchOntapLunByCliPath(
    base: ProxyOperationBaseOpts,
    svmName: string,
    lunPath: string,
    body: Record<string, unknown>
) {
    logger.info('Starting patchOntapLunByCliPath', { targetId: base.targetId, svmName, lunPath });

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/private/cli/lun',
        method: 'PATCH',
        searchParams: { vserver: svmName, path: lunPath },
        body
    });

    logger.info('Completed patchOntapLunByCliPath', { targetId: base.targetId, svmName, lunPath });
}

async function getOntapLunSerialNumbers(base: ProxyOperationBaseOpts, lunPaths: string[]) {
    logger.info('Starting getOntapLunSerialNumbers', { targetId: base.targetId, lunPaths });

    if (!lunPaths.length) {
        return {};
    }

    const records = await collectAllOntapRecords<{ name: string; serial_number?: string }>(
        base,
        'api/storage/luns',
        { name: lunPaths.join('|'), fields: 'name,serial_number' },
        lunPaths.length
    );
    const serialsByPath = Object.fromEntries(records.map(record => [record.name, record.serial_number]));

    logger.info('Completed getOntapLunSerialNumbers', { targetId: base.targetId, lunPaths, serialsByPath });
    return serialsByPath;
}

async function deleteOntapLunMappings(
    base: ProxyOperationBaseOpts,
    svmName: string,
    iGroup: string,
    lunPaths: string[]
) {
    logger.info('Starting deleteOntapLunMappings', { targetId: base.targetId, svmName, iGroup, lunPaths });

    if (!lunPaths.length) {
        return;
    }

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/private/cli/lun/mapping',
        method: 'DELETE',
        searchParams: { vserver: svmName, igroup: iGroup, path: lunPaths.join('|') }
    });

    logger.info('Completed deleteOntapLunMappings', { targetId: base.targetId, svmName, iGroup, lunPaths });
}

async function deleteOntapLuns(base: ProxyOperationBaseOpts, svmName: string, lunPaths: string[]) {
    logger.info('Starting deleteOntapLuns', { targetId: base.targetId, svmName, lunPaths });

    if (!lunPaths.length) {
        return;
    }

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/private/cli/lun',
        method: 'DELETE',
        searchParams: { vserver: svmName, path: lunPaths.join('|') }
    });

    logger.info('Completed deleteOntapLuns', { targetId: base.targetId, svmName, lunPaths });
}

async function deleteOntapVolumes(base: ProxyOperationBaseOpts, volumeNames: string[]): Promise<void> {
    logger.info('Starting deleteOntapVolumes', { targetId: base.targetId, volumeNames });

    if (!volumeNames.length) {
        return;
    }

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/storage/volumes',
        method: 'DELETE',
        searchParams: { name: volumeNames.join('|') }
    });

    logger.info('Completed deleteOntapVolumes', { targetId: base.targetId, volumeNames });
}

async function deleteOntapVolumeByUuid(base: ProxyOperationBaseOpts, volumeUuid: string): Promise<void> {
    logger.info('Starting deleteOntapVolumeByUuid', { targetId: base.targetId, volumeUuid });

    const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
        ...base,
        ontapPath: `api/storage/volumes/${volumeUuid}`,
        method: 'DELETE'
    });

    if (job?.uuid) {
        await getOntapJobStatusForBase(base, job.uuid);
    }

    logger.info('Completed deleteOntapVolumeByUuid', { targetId: base.targetId, volumeUuid });
}

async function patchOntapVolumeTags(base: ProxyOperationBaseOpts, volumeUuid: string, tags: string[]): Promise<void> {
    logger.info('Starting patchOntapVolumeTags', { targetId: base.targetId, volumeUuid, tags });

    const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
        ...base,
        ontapPath: `api/storage/volumes/${volumeUuid}`,
        method: 'PATCH',
        body: { 'tiering.object_tags': tags }
    });

    if (job?.uuid) {
        await getOntapJobStatusForBase(base, job.uuid);
    }

    logger.info('Completed patchOntapVolumeTags', { targetId: base.targetId, volumeUuid });
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

function junctionKey(svmName: string, junctionPath: string): string {
    return `${svmName}::${junctionPath}`;
}

async function resolveVolumesByJunction(
    base: ProxyOperationBaseOpts,
    pairs: Array<{ svmName: string; junctionPath: string }>
): Promise<Map<string, ResolvedVolume>> {
    logger.info('Resolving volumes by junction', { pairs });
    if (pairs.length === 0) {
        return new Map();
    }

    const resolved = await Promise.all(
        pairs.map(
            throat(3, async ({ svmName, junctionPath }) => {
                const records = await collectAllOntapRecords<OntapVolumeByJunctionRecord>(
                    base,
                    'api/storage/volumes',
                    { 'svm.name': svmName, 'nas.path': junctionPath },
                    1
                );
                return { key: junctionKey(svmName, junctionPath), volume: records[0] };
            })
        )
    );
    return new Map(resolved.map(({ key, volume }) => [key, { uuid: volume?.uuid, name: volume?.name }]));
}

async function resolveSvmsByIp(base: ProxyOperationBaseOpts, ips: string[]): Promise<Map<string, ResolvedSvm>> {
    logger.debug('Resolving SVMs by IP', { ips: ips?.length });
    if (ips.length === 0) {
        return new Map();
    }

    const svmRecords = await collectAllOntapRecords<OntapSvmRecord>(base, 'api/svm/svms', { fields: 'ip_interfaces' });
    const lookup = new Map<string, ResolvedSvm>();
    ips.forEach(ip => {
        const svm = svmRecords.find(({ ip_interfaces: ipInterfaces }) =>
            ipInterfaces?.some(
                ({ name, ip: ipInfo }) => name === NFS_MANAGEMENT_INTERFACE_NAME && ipInfo?.address === ip
            )
        );
        if (svm) {
            lookup.set(ip, { name: svm.name, uuid: svm.uuid });
        }
    });
    return lookup;
}

/**
 * Batch-add initiators to a SAN igroup. ONTAP returns 409 Conflict when an initiator is already present.
 */
async function addInitiatorsToIgroup(target: OntapGatewayTarget, igroupUuid: string, initiatorNames: string[]) {
    if (initiatorNames.length === 0) {
        return;
    }
    await callOntapApi({
        ...target,
        path: `api/protocols/san/igroups/${igroupUuid}/initiators`,
        method: 'POST',
        body: { records: initiatorNames.map(name => ({ name })) }
    });
}

export {
    callOntapApi,
    getClusterInfo,
    getClusterJobStatus,
    callOntapAndPollJob,
    getOntapJobStatusForBase,
    collectAllOntapRecords,
    collectOntapRecordsBatched,
    getLunBySerialNumber,
    getVolumeByName,
    getCifsShareVolumes,
    resolveSvmsByIp,
    junctionKey,
    resolveVolumesByJunction,
    addInitiatorsToIgroup,
    buildOntapProxyBase,
    unwrapOntapSettled,
    extractBaseIqn,
    findIgroupForInitiators,
    createOntapVolume,
    patchOntapVolumeByCliName,
    patchOntapVolumeSnapshotAutodelete,
    createOntapLun,
    createOntapLunMapping,
    patchOntapLunByCliPath,
    getOntapLunSerialNumbers,
    deleteOntapLunMappings,
    deleteOntapLuns,
    deleteOntapVolumes,
    deleteOntapVolumeByUuid,
    patchOntapVolumeTags,
    type OntapGatewayTarget,
    type OntapLunRecord,
    type OntapVolumeRecord,
    type OntapCifsShareRecord,
    type OntapVolumeSpace,
    type ResolvedSvm,
    type ResolvedVolume,
    type ProxyOperationBaseOpts
};
