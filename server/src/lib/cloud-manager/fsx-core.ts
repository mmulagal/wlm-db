import createError from 'http-errors';
import { HEADERS, WORKLOAD_FACTORY_ENDPOINT, USER_TOKEN, ACCOUNT_ID, HttpErrorCodes } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';
import { IS_DEMO_FLOW } from '../../utils/utils';

const logger = getLogger();

interface registerCredentialsResponse {
    fileSystemId: string;
    ontapCredentialsId: string;
}

interface FSXRESPONSE {
    items: Array<FSXDATA>;
}

interface FSXDATA {
    id: string;
    name: string;
    status: { status: string };
    networkInterfaceIds: any;
    vpcId: string;
    subnetIds: any;
    region: string;
    awsAccountId: string;
    deploymentType: string;
}

interface FSXREQUESTBODY {
    name: string;
    credentialsId: string;
    region: string;
    storageCapacity: any;
    primarySubnetId: string;
    secondarySubnetId?: string;
    throughputCapacity: number;
    fsxAdminPassword: string;
    deploymentType: string;
    securityGroupIds: any;
    tags: any;
    svmAdminPassword: string;
    generateSecurityGroup: boolean;
    haPairs: number;
    automaticBackupRetentionDays: number;
}

interface listCredentialsResponse {
    credentials: {
        ip: string;
        userName: string;
        password: string;
        /** When `true`, `password` is actually a Secrets Manager ARN (GovCloud accounts). */
        isSecret?: boolean;
    };
}

async function registerFsxOntapCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxId: string,
    fsxPassword: string
) {
    logger.info('Registering FSx for ONTAP credentials ', { accountId, credentialsId, region, fsxId });

    const { token } = await getWfServiceToken();

    const response = await gotInstanceForInternalRequest
        .post(
            `accounts/${accountId}/fsx/v2/credentials/${credentialsId}/regions/${region}/file-systems/${fsxId}/ontap-credentials`,
            {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                },
                json: {
                    password: fsxPassword
                }
            }
        )
        .json<registerCredentialsResponse>();
    return response;
}

async function listFsxOntapCredentials(accountId: string, fsxId: string, isSimulated = false) {
    logger.info('Listing FSx for ONTAP credentials ', { accountId, fsxId, isSimulated });

    // Since list credentials API doesn't support service token, we are using user token here.
    const token = getAsyncLocalStorageResource(USER_TOKEN) as string;

    try {
        const response = await gotInstanceForInternalRequest
            .get(`accounts/${accountId}/fsx/v2/file-systems/${fsxId}/ontap-credentials`, {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token,
                    ...(isSimulated && { [HEADERS.SIMULATOR]: 'true' })
                }
            })
            .json<listCredentialsResponse>();
        return response;
    } catch (error: any) {
        const statusCode: number | undefined =
            (error && error.statusCode) || (error && error.response && error.response.statusCode);

        const errorMessage = `Error getting file system credentials status: ${error?.message}`;
        throw createError(statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function listFSXFileSystem(credentialsId: string, region: string) {
    logger.info('Get FSX file systems list', { credentialsId, region });
    const token = getAsyncLocalStorageResource(USER_TOKEN) as string;
    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);

    const { items } = await gotInstanceForInternalRequest
        .get(
            `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/fsx/v2/credentials/${credentialsId}/regions/${region}/file-systems`,
            {
                headers: {
                    [HEADERS.AUTHORIZATION]: token,
                    ...(IS_DEMO_FLOW && { [HEADERS.SIMULATOR]: 'true' })
                }
            }
        )
        .json<FSXRESPONSE>();
    return items;
}

async function getFsxFileSystemActiveLinks(credentialsId: string, region: string, fsId: string): Promise<unknown[]> {
    logger.info('Get FSx file system active links', { credentialsId, region, fsId });

    if (IS_DEMO_FLOW) {
        return [{ fsId, status: 'AVAILABLE' }];
    }

    const { token } = await getWfServiceToken();
    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);

    const { activeLinks } = await gotInstanceForInternalRequest
        .get(
            `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/fsx/v2/credentials/${credentialsId}/regions/${region}/file-systems/${fsId}`,
            {
                searchParams: { include: 'activeLinks' },
                headers: { [HEADERS.AUTHORIZATION]: token }
            }
        )
        .json<{ activeLinks?: unknown[] }>();
    return activeLinks ?? [];
}

async function checkFsxLinkExists(credentialsId: string, region: string, fsId: string) {
    logger.info('Checking FSx link exists', { credentialsId, region, fsId });
    try {
        const activeLinks = await getFsxFileSystemActiveLinks(credentialsId, region, fsId);
        return { exists: activeLinks.length > 0, count: activeLinks.length };
    } catch (error) {
        logger.error('Failed to check FSx active links', { fsId, error });
        return { exists: false, count: 0 };
    }
}

async function createFSX(requestBody: FSXREQUESTBODY) {
    logger.info('Register fsx in fsx-core', { requestBody });
    const token = getAsyncLocalStorageResource(USER_TOKEN) as string;
    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);

    return gotInstanceForInternalRequest.post(
        `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/fsx/v2/file-systems`,
        {
            headers: {
                [HEADERS.AUTHORIZATION]: token,
                ...(IS_DEMO_FLOW && { [HEADERS.SIMULATOR]: 'true' })
            },
            json: requestBody
        }
    );
}

export {
    registerFsxOntapCredentials,
    listFsxOntapCredentials,
    listFSXFileSystem,
    createFSX,
    getFsxFileSystemActiveLinks,
    checkFsxLinkExists
};
