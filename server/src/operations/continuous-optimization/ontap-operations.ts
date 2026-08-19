import {
    collectAllOntapRecords,
    getOntapJobStatusForBase,
    type OntapVolumeRecord,
    type ProxyOperationBaseOpts
} from '../../lib/ontap/ontap-gateway';
import { callProxyForwarder } from '../../lib/cloud-manager/proxy-forwarder';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface OntapExportPolicyRule {
    clients?: { match: string }[];
    superuser?: string[];
    allow_suid?: boolean;
    [key: string]: unknown;
}

async function promoteVolumeEfficiency(base: ProxyOperationBaseOpts, svmName: string, volumeName: string) {
    logger.info('Starting promoteVolumeEfficiency', { targetId: base.targetId, svmName, volumeName });

    const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
        ...base,
        ontapPath: 'api/private/cli/volume/efficiency/promote',
        method: 'POST',
        searchParams: { privilege_level: 'advanced' },
        body: { vserver: svmName, volume: volumeName }
    });
    if (job?.uuid) {
        await getOntapJobStatusForBase(base, job.uuid);
    }

    logger.info('Completed promoteVolumeEfficiency', { targetId: base.targetId, svmName, volumeName });
}

async function getOntapVolumeEfficiency(
    base: ProxyOperationBaseOpts,
    svmName: string,
    volumeName: string
): Promise<OntapVolumeRecord | undefined> {
    const records = await collectAllOntapRecords<OntapVolumeRecord>(
        base,
        'api/storage/volumes',
        { svm: svmName, name: volumeName, fields: 'efficiency' },
        1
    );
    return records[0];
}

async function getOntapExportPolicyRules(
    base: ProxyOperationBaseOpts,
    svmName: string,
    policyName: string
): Promise<OntapExportPolicyRule[]> {
    const records = await collectAllOntapRecords<{ rules?: OntapExportPolicyRule[] }>(
        base,
        'api/protocols/nfs/export-policies',
        { svm: svmName, name: policyName, fields: 'rules' },
        1
    );
    return records[0]?.rules ?? [];
}

async function createOntapExportPolicy(base: ProxyOperationBaseOpts, body: Record<string, unknown>) {
    logger.info('Starting createOntapExportPolicy', { targetId: base.targetId, body });

    const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
        ...base,
        ontapPath: 'api/protocols/nfs/export-policies',
        method: 'POST',
        body
    });
    if (job?.uuid) {
        await getOntapJobStatusForBase(base, job.uuid);
    }

    logger.info('Completed createOntapExportPolicy', { targetId: base.targetId });
}

async function createOntapIgroup(base: ProxyOperationBaseOpts, body: Record<string, unknown>) {
    logger.info('Starting createOntapIgroup', { targetId: base.targetId, body });

    await callProxyForwarder({
        ...base,
        ontapPath: 'api/protocols/san/igroups',
        method: 'POST',
        body
    });

    logger.info('Completed createOntapIgroup', { targetId: base.targetId });
}

async function getOntapIscsiInterfaceIp(base: ProxyOperationBaseOpts, svmName: string): Promise<string | undefined> {
    const records = await collectAllOntapRecords<{ ip?: { address?: string } }>(
        base,
        'api/network/ip/interfaces',
        { 'svm.name': svmName, services: '*iscsi*', fields: 'ip.address' },
        1
    );
    return records[0]?.ip?.address;
}

export {
    promoteVolumeEfficiency,
    getOntapVolumeEfficiency,
    getOntapExportPolicyRules,
    createOntapExportPolicy,
    createOntapIgroup,
    getOntapIscsiInterfaceIp,
    type OntapExportPolicyRule
};
