import {
    buildOntapProxyBase,
    collectAllOntapRecords,
    createOntapLun,
    createOntapLunMapping,
    createOntapVolume,
    getOntapLunSerialNumbers,
    type OntapGatewayTarget,
    type ProxyOperationBaseOpts
} from '../../../lib/ontap/ontap-gateway';
import { createOntapIgroup, getOntapIscsiInterfaceIp } from '../ontap-operations';
import getLogger from '../../../utils/logger';
import { sleep } from '../../../utils/utils';
import { UnOptimizedDiskGroups } from '../assessment-utils';

const logger = getLogger();
const MAX_LUN_CREATE_ATTEMPTS = 6;
const LUN_CREATE_RETRYABLE_SIGNATURES = ['409', 'still being created'];

interface DiskGroupProvisionResult {
    error: string;
    luns: string[];
    iscsi_ip?: string;
}

function isRetryableLunCreateError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return LUN_CREATE_RETRYABLE_SIGNATURES.some(signature => message.includes(signature));
}

async function createOntapLunWithRetry(
    base: ProxyOperationBaseOpts,
    lunPath: string,
    body: Record<string, unknown>,
    label: string
): Promise<void> {
    for (let attempt = 0; attempt < MAX_LUN_CREATE_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
            const waitSecs = 10 * attempt;
            logger.info(`Waiting ${waitSecs}s for ${label} to be ready`, { attempt: attempt + 1 });
            // eslint-disable-next-line no-await-in-loop
            await sleep(waitSecs * 1000);
        }
        try {
            // eslint-disable-next-line no-await-in-loop
            await createOntapLun(base, lunPath, body);
            return;
        } catch (err) {
            if (!isRetryableLunCreateError(err) || attempt === MAX_LUN_CREATE_ATTEMPTS - 1) {
                throw err;
            }
            logger.info(`Transient ONTAP error, will retry ${label}`, { err });
        }
    }
}

async function findOrCreateIgroup(
    base: ProxyOperationBaseOpts,
    svmName: string,
    initiatorIqn: string
): Promise<string> {
    const records = await collectAllOntapRecords<{ name: string }>(
        base,
        'api/protocols/san/igroups',
        { protocol: 'iscsi', 'svm.name': svmName, 'initiators.name': initiatorIqn },
        1
    );
    if (records[0]?.name) {
        return records[0].name;
    }

    await createOntapIgroup(base, {
        svm: { name: svmName },
        name: initiatorIqn,
        protocol: 'iscsi',
        initiators: [{ name: initiatorIqn }],
        os_type: 'linux'
    });
    return initiatorIqn;
}

async function createVolumeLunAndMap(
    base: ProxyOperationBaseOpts,
    volName: string,
    svmName: string,
    igroupName: string,
    volSize: number,
    lunSize: number,
    groupResult: DiskGroupProvisionResult
): Promise<void> {
    try {
        await createOntapVolume(base, {
            name: volName,
            size: `${volSize}b`,
            type: 'RW',
            svm: { name: svmName },
            nas: { security_style: 'UNIX' },
            style: 'flexvol',
            aggregates: [{ name: 'aggr1' }]
        });
    } catch (err) {
        groupResult.error += err instanceof Error ? err.message : String(err);
        return;
    }

    const lunPath = `/vol/${volName}/lun1`;
    try {
        await createOntapLunWithRetry(
            base,
            lunPath,
            {
                location: { volume: { name: volName }, logical_unit: 'lun1' },
                space: { size: `${lunSize}b`, guarantee: { requested: 'true' } },
                os_type: 'linux',
                svm: { name: svmName }
            },
            `volume ${volName} in SVM ${svmName}`
        );
    } catch (err) {
        groupResult.error += err instanceof Error ? err.message : String(err);
        return;
    }

    try {
        await createOntapLunMapping(base, {
            svm: { name: svmName },
            lun: { name: lunPath },
            igroup: { name: igroupName }
        });
    } catch (err) {
        groupResult.error += err instanceof Error ? err.message : String(err);
        return;
    }

    try {
        const serialsByPath = await getOntapLunSerialNumbers(base, [lunPath]);
        const serial = serialsByPath[lunPath];
        if (!serial) {
            groupResult.error += `Error fetching LUN serial for ${lunPath}`;
        } else {
            groupResult.luns.push(serial);
        }
    } catch (err) {
        groupResult.error += err instanceof Error ? err.message : String(err);
    }
}

async function provisionDiskGroup(
    base: ProxyOperationBaseOpts,
    diskGrp: UnOptimizedDiskGroups,
    initiatorIqn: string,
    volSize: number,
    lunSize: number
): Promise<DiskGroupProvisionResult> {
    const groupResult: DiskGroupProvisionResult = { error: '', luns: [] };
    const svmName = diskGrp.svmName as string;

    let igroupName: string;
    try {
        igroupName = await findOrCreateIgroup(base, svmName, initiatorIqn);
    } catch (err) {
        groupResult.error += err instanceof Error ? err.message : String(err);
        return groupResult;
    }

    const iscsiIp = await getOntapIscsiInterfaceIp(base, svmName);
    if (!iscsiIp) {
        groupResult.error += `Error fetching iSCSI session information for SVM ${svmName}`;
        return groupResult;
    }
    groupResult.iscsi_ip = iscsiIp;

    for (const volName of diskGrp.volumeNames ?? []) {
        // eslint-disable-next-line no-await-in-loop
        await createVolumeLunAndMap(base, volName, svmName, igroupName, volSize, lunSize, groupResult);
    }

    return groupResult;
}

async function createAndMapLunsForDiskGroups(
    target: OntapGatewayTarget,
    unOptimizedDiskGroups: UnOptimizedDiskGroups[],
    lunUuids: string[],
    initiatorIqn: string
): Promise<Record<string, DiskGroupProvisionResult>> {
    const { accountId, credentialsId, fsxId, region } = target;
    const base = await buildOntapProxyBase(accountId, credentialsId, fsxId, region);

    let lunSize: number;
    try {
        const lunRecords = await collectAllOntapRecords<{ space?: { size?: number } }>(base, 'api/storage/luns', {
            uuid: lunUuids.join(','),
            fields: 'space'
        });
        const sizes = lunRecords.map(record => record.space?.size).filter((size): size is number => Boolean(size));
        if (!sizes.length) {
            throw new Error(`No LUN size found for uuids ${lunUuids.join(',')}`);
        }
        lunSize = Math.min(...sizes);
    } catch (err) {
        logger.error('Error fetching LUN sizes', { lunUuids, err });
        throw err;
    }
    const volSize = lunSize * 1.1;

    const result: Record<string, DiskGroupProvisionResult> = {};
    for (const diskGrp of unOptimizedDiskGroups) {
        // eslint-disable-next-line no-await-in-loop
        result[diskGrp.diskGroupName] = await provisionDiskGroup(base, diskGrp, initiatorIqn, volSize, lunSize);
    }

    return result;
}

export { createAndMapLunsForDiskGroups };
