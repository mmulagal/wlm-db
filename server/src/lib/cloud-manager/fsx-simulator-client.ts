import { HEADERS, SECRETS, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfCredentialDetails, type wfCredentials } from './credentials';

const logger = getLogger();

interface AwsFilter {
    Name?: string;
    Values?: string[];
}

interface DescribeFileSystemsInput {
    FileSystemIds?: string[];
    NextToken?: string;
}

interface DescribeVolumesInput {
    Filters?: AwsFilter[];
    NextToken?: string;
}

interface AwsFileSystem {
    FileSystemId?: string;
    Lifecycle?: string;
    Tags?: Array<{ Key?: string; Value?: string }>;
    OntapConfiguration?: {
        Endpoints?: {
            Management?: { DNSName?: string };
        };
    };
}

interface AwsVolume {
    VolumeId?: string;
    Name?: string;
    OntapConfiguration?: {
        UUID?: string;
    };
}

interface DescribeFileSystemsResponse {
    FileSystems?: AwsFileSystem[];
    NextToken?: string | null;
}

interface DescribeVolumesResponse {
    Volumes?: AwsVolume[];
    NextToken?: string | null;
}

interface OntapSimulatorLun {
    uuid?: string;
    name?: string;
    os_type?: string;
    location?: {
        volume?: {
            uuid?: string;
            name?: string;
        };
    };
}

interface OntapSimulatorCredentials {
    userName: string;
    password: string;
}

interface OntapSimulatorPage<T> {
    records?: T[];
    _links?: { next?: { href?: string } };
}

function simulatorAuthHeader(): { 'x-simulator-auth': string } {
    const simulatorAuth = SECRETS.SIMULATOR_AUTH;
    if (!simulatorAuth) {
        throw new Error('SIMULATOR_AUTH is required for FSx simulator calls');
    }
    return { 'x-simulator-auth': simulatorAuth };
}

async function resolveSimulatorArnPath(accountId: string, credentialsId: string): Promise<string> {
    const credential = (await getWfCredentialDetails(credentialsId, accountId, true)) as wfCredentials;
    const arn = credential?.metadata?.arn;
    if (!arn) {
        throw new Error(`Credential ${credentialsId} has no IAM role ARN in metadata`);
    }
    return arn.replace(/\//g, '-');
}

function awsActionPath(arnPath: string, region: string, action: string): string {
    return `simulator/v1/aws/arn/${arnPath}/region/${region}/FSX/${action}`;
}

async function postAwsAction<T>(
    accountId: string,
    credentialsId: string,
    region: string,
    action: string,
    body: unknown
): Promise<T> {
    logger.info('Calling FSx simulator AWS action', { accountId, credentialsId, region, action });
    const arnPath = await resolveSimulatorArnPath(accountId, credentialsId);
    return gotInstanceForInternalRequest
        .post(awsActionPath(arnPath, region, action), {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: simulatorAuthHeader(),
            json: body ?? {}
        })
        .json<T>();
}

async function describeFileSystems(
    accountId: string,
    credentialsId: string,
    region: string,
    input: DescribeFileSystemsInput = {}
): Promise<DescribeFileSystemsResponse> {
    return postAwsAction<DescribeFileSystemsResponse>(accountId, credentialsId, region, 'DescribeFileSystems', input);
}

async function describeVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    input: DescribeVolumesInput = {}
): Promise<DescribeVolumesResponse> {
    return postAwsAction<DescribeVolumesResponse>(accountId, credentialsId, region, 'DescribeVolumes', input);
}

async function fetchOntapSimulatorRecords<T>(
    managementHost: string,
    fileSystemId: string,
    credentials: OntapSimulatorCredentials,
    ontapPath: string,
    searchParams?: Record<string, string | number | boolean>
): Promise<T[]> {
    logger.info('Collecting ONTAP simulator records', { fileSystemId, managementHost, ontapPath, searchParams });
    const prefixUrl = `${WORKLOAD_FACTORY_ENDPOINT}/simulator/v1/ontap/${managementHost}/`;
    const headers = {
        [HEADERS.AUTHORIZATION]: `Basic ${Buffer.from(`${credentials.userName}:${credentials.password}`).toString(
            'base64'
        )}`,
        ...simulatorAuthHeader(),
        'x-target-id': fileSystemId
    };
    const records: T[] = [];
    let currentPath: string | undefined = ontapPath;
    let currentSearchParams = searchParams;

    while (currentPath) {
        // eslint-disable-next-line no-await-in-loop
        const page = await gotInstanceForInternalRequest
            .get(currentPath.replace(/^\//, ''), {
                prefixUrl,
                headers,
                ...(currentSearchParams ? { searchParams: currentSearchParams } : {})
            })
            .json<OntapSimulatorPage<T> | T>();

        const paged = page as OntapSimulatorPage<T>;
        if (!page || typeof page !== 'object' || !Array.isArray(paged.records)) {
            records.push(page as T);
            break;
        }

        records.push(...(paged.records ?? []));
        currentPath = paged._links?.next?.href?.replace(/^\//, '');
        currentSearchParams = undefined;
    }

    logger.info('Collected ONTAP simulator records', { fileSystemId, ontapPath, recordCount: records.length });
    return records;
}

async function listOntapLuns(
    managementHost: string,
    fileSystemId: string,
    credentials: OntapSimulatorCredentials
): Promise<OntapSimulatorLun[]> {
    logger.info('Listing ONTAP simulator LUNs', { fileSystemId, managementHost });
    return fetchOntapSimulatorRecords<OntapSimulatorLun>(
        managementHost,
        fileSystemId,
        credentials,
        'api/storage/luns',
        {
            fields: 'uuid,name,os_type,location.volume.uuid,location.volume.name'
        }
    );
}

export {
    describeFileSystems,
    describeVolumes,
    listOntapLuns,
    fetchOntapSimulatorRecords,
    type AwsFileSystem,
    type AwsVolume,
    type OntapSimulatorLun,
    type OntapSimulatorCredentials
};
