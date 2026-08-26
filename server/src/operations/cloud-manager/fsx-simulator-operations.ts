import getLogger from '../../utils/logger';
import { getSimulatedOntapCredentialsForFileSystem } from '../../lib/cloud-manager/credentials';
import {
    describeFileSystems,
    describeVolumes,
    listOntapLuns,
    type AwsFileSystem,
    type AwsVolume,
    type OntapSimulatorLun
} from '../../lib/cloud-manager/fsx-simulator-client';

const logger = getLogger();

interface SimulatedFsxFileSystem {
    id: string;
    name?: string;
    status?: string | { status?: string };
    endpoints?: {
        management?: {
            dnsName?: string;
            DNSName?: string;
        };
    };
}

interface SimulatedFsxVolume {
    id?: string;
    uuid?: string;
    name?: string;
    lunMaps?: Array<{ lun?: { uuid?: string; name?: string; osType?: string } }>;
}

function mapAwsFileSystem(fileSystem: AwsFileSystem): SimulatedFsxFileSystem {
    const managementDnsName = fileSystem.OntapConfiguration?.Endpoints?.Management?.DNSName;
    return {
        id: fileSystem.FileSystemId ?? '',
        name: fileSystem.Tags?.find(tag => tag.Key === 'Name')?.Value,
        status: fileSystem.Lifecycle,
        endpoints: managementDnsName
            ? { management: { dnsName: managementDnsName, DNSName: managementDnsName } }
            : undefined
    };
}

function lunMapsForVolume(volumeUuid: string | undefined, luns: OntapSimulatorLun[]) {
    if (!volumeUuid) {
        return [];
    }
    return luns
        .filter(lun => lun.location?.volume?.uuid === volumeUuid)
        .map(lun => ({
            lun: {
                uuid: lun.uuid,
                name: lun.name,
                osType: lun.os_type
            }
        }));
}

function mapAwsVolume(volume: AwsVolume, luns: OntapSimulatorLun[]): SimulatedFsxVolume {
    const uuid = volume.OntapConfiguration?.UUID;
    return {
        id: volume.VolumeId,
        uuid,
        name: volume.Name,
        lunMaps: lunMapsForVolume(uuid, luns)
    };
}

async function listSimulatedFsxFileSystems(
    accountId: string,
    credentialsId: string,
    region: string
): Promise<SimulatedFsxFileSystem[]> {
    logger.info('Listing simulated FSx file systems', { accountId, credentialsId, region });
    const fileSystems: SimulatedFsxFileSystem[] = [];
    let nextToken: string | undefined;

    do {
        // eslint-disable-next-line no-await-in-loop
        const page = await describeFileSystems(
            accountId,
            credentialsId,
            region,
            nextToken ? { NextToken: nextToken } : {}
        );
        fileSystems.push(...(page.FileSystems ?? []).map(mapAwsFileSystem));
        nextToken = page.NextToken ?? undefined;
    } while (nextToken);

    logger.info('Listed simulated FSx file systems', { accountId, region, fileSystemCount: fileSystems.length });
    return fileSystems;
}

async function listSimulatedFsxOntapCredentials(
    accountId: string,
    fsxId: string
): Promise<{ credentials: { ip?: string; userName: string; password: string } } | undefined> {
    logger.info('Fetching simulated ONTAP credentials for FSx', { accountId, fsxId });
    try {
        const credentials = await getSimulatedOntapCredentialsForFileSystem(accountId, fsxId);
        if (credentials) {
            return { credentials };
        }
    } catch (error) {
        logger.warn('Failed to fetch registered ONTAP credentials for simulated FSx', { accountId, fsxId, error });
    }

    return undefined;
}

async function listSimulatedFsxLuns(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxId: string
): Promise<OntapSimulatorLun[]> {
    logger.info('Listing simulated FSx LUNs', { accountId, credentialsId, region, fsxId });
    const ontapCredentials = await listSimulatedFsxOntapCredentials(accountId, fsxId);
    if (!ontapCredentials) {
        return [];
    }
    try {
        const { ip, userName, password } = ontapCredentials.credentials;
        let managementHost = ip;
        if (!managementHost) {
            const { FileSystems } = await describeFileSystems(accountId, credentialsId, region, {
                FileSystemIds: [fsxId]
            });
            managementHost =
                FileSystems?.[0]?.OntapConfiguration?.Endpoints?.Management?.DNSName ??
                `management.${fsxId}.fsx.${region}.amazonaws.com`;
        }
        return await listOntapLuns(managementHost, fsxId, { userName, password });
    } catch (error) {
        logger.warn('Failed to list ONTAP LUNs for simulated volumes', { accountId, fsxId, error });
        return [];
    }
}

async function listSimulatedFsxVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxId: string
): Promise<SimulatedFsxVolume[]> {
    logger.info('Listing simulated FSx volumes', { accountId, credentialsId, region, fsxId });
    const awsVolumes: AwsVolume[] = [];
    let nextToken: string | undefined;

    do {
        // eslint-disable-next-line no-await-in-loop
        const page = await describeVolumes(accountId, credentialsId, region, {
            Filters: [{ Name: 'file-system-id', Values: [fsxId] }],
            ...(nextToken ? { NextToken: nextToken } : {})
        });
        awsVolumes.push(...(page.Volumes ?? []));
        nextToken = page.NextToken ?? undefined;
    } while (nextToken);

    const luns = await listSimulatedFsxLuns(accountId, credentialsId, region, fsxId);
    return awsVolumes.map(volume => mapAwsVolume(volume, luns));
}

export {
    listSimulatedFsxFileSystems,
    listSimulatedFsxVolumes,
    listSimulatedFsxOntapCredentials,
    type SimulatedFsxFileSystem,
    type SimulatedFsxVolume
};
