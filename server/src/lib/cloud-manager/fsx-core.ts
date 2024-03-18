import { HEADERS, WORKLOAD_FACTORY_ENDPOINT, USER_TOKEN, ACCOUNT_ID } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

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

async function registerFsxOntapCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxId: string,
    fsxPassword: string
) {
    logger.info('Registering FSx for ONTAP credentials ', { accountId, credentialsId, region, fsxId, fsxPassword });

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

interface listCredentialsResponse {
    credentials: {
        ip: string;
        userName: string;
        password: string;
    };
}
async function listFsxOntapCredentials(accountId: string, fsxId: string) {
    logger.info('Listing FSx for ONTAP credentials ', { accountId, fsxId });

    // Since list credentials API doesn't support service token, we are using user token here.
    const token = getAsyncLocalStorageResource(USER_TOKEN) as string;

    const response = await gotInstanceForInternalRequest
        .get(`accounts/${accountId}/fsx/v2/file-systems/${fsxId}/ontap-credentials`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token
            }
        })
        .json<listCredentialsResponse>();
    return response;
}

async function listFSXFileSystem(credentialsId: string, region: string, isDemo?: boolean) {
    logger.info('Get FSX file systems list', { credentialsId, region, isDemo });

    const token = getAsyncLocalStorageResource(USER_TOKEN) as string;
    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);

    const { items } = await gotInstanceForInternalRequest
        .get(
            `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/fsx/v2/credentials/${credentialsId}/regions/${region}/file-systems`,
            {
                headers: {
                    [HEADERS.AUTHORIZATION]: token,
                    ...(isDemo && { [HEADERS.SIMULATOR]: 'true' })
                }
            }
        )
        .json<FSXRESPONSE>();
    return items;
}

async function createFSX(requestBody: FSXREQUESTBODY, isDemo?: boolean) {
    logger.info('Register fsx in fsx-core', { requestBody, isDemo });
    const token = getAsyncLocalStorageResource(USER_TOKEN) as string;
    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);

    return gotInstanceForInternalRequest.post(
        `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/fsx/v2/file-systems`,
        {
            headers: {
                [HEADERS.AUTHORIZATION]: token,
                ...(isDemo && { [HEADERS.SIMULATOR]: 'true' })
            },
            json: requestBody
        }
    );
}

export { registerFsxOntapCredentials, listFsxOntapCredentials, listFSXFileSystem, createFSX };
