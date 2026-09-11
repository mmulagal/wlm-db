import {
    BaseQueryFn,
    createApi,
    FetchArgs,
    fetchBaseQuery,
    FetchBaseQueryError,
    retry
} from '@reduxjs/toolkit/query/react';
// @ts-ignore
import { BaseQueryApi } from '@reduxjs/toolkit/dist/query/baseQueryTypes';
import store, { RootState } from '../store/store';
import {
    API_ERRORS,
    API_MAX_RETRIES,
    DBType,
    MIN_RETRY_DELAY,
    PRODUCTION,
    WLMDB_POLICIES_PROD_LINK,
    WLMDB_POLICIES_STAGE_LINK
} from './consts';
import { DatabaseTables, BatchEntry } from './types/resourceTypes';
import { delay, generateRandomDBName, sortListOfDict } from './utilityFunctions';
import { SELECT_CONFIG } from './appConstants';

const unwrapItems = (response: any) => (Array.isArray(response) ? response : (response?.items ?? []));

// Place the relevant headers on all requests:
const prepareHeaders = (
    headers: Headers,
    api: Pick<BaseQueryApi, 'type' | 'getState' | 'extra' | 'endpoint' | 'forced'>
): Headers => {
    const { getState, endpoint } = api;
    const { accessToken, workspaceId, isDemoMode, isWorkloadFactory, isGovAccount } = (getState() as RootState).auth;
    const { selectConfig } = (getState() as RootState).mssqlForm;
    const isChatbot = (getState() as RootState).chatbot.isShow;
    if (accessToken) {
        headers.set('authorization', accessToken);
    }
    if (workspaceId) {
        headers.set('x-workspace-id', workspaceId);
    }
    if (isDemoMode) {
        headers.set('x-simulator', 'true');
    }
    if (isGovAccount) {
        headers.set('x-is-gov-account', 'true');
    }
    if (
        !isWorkloadFactory &&
        endpoint !== 'getWorkSpaceID' &&
        endpoint !== 'getRBACPrivileges' &&
        endpoint !== 'assignRBACPrivileges' &&
        endpoint !== 'addHostJobSc' &&
        endpoint !== 'getBackupRecoveryLicense'
    ) {
        headers.set('x-netapp-referer', 'BlueXP');
    }
    if (
        endpoint === 'deploySqlTemplate' ||
        endpoint === 'getTemplates' ||
        endpoint === 'deployPgsqlTemplate' ||
        endpoint === 'getPgsqlTemplates'
    ) {
        headers.set(
            'triggered-from',
            isChatbot ? 'chatbot' : selectConfig === SELECT_CONFIG.EASY_CREATE ? 'wizard-quick' : 'wizard-advanced'
        );
    }
    return headers;
};

export const getBaseUrl = () => {
    const state = store.getState();
    const accountId = state?.auth?.accountId;
    const apiHost = import.meta.env.VITE_APP_CM_URL;
    return `${apiHost}/accounts/${accountId}/wlmdb/v1`;
};

const isBluexpExternalApiCall = (endpoint: string): boolean => {
    const bluexpEndpoints = [
        'getConnectors',
        'getFsxDetails',
        'discoverExistingFsxN',
        'getWorkSpaceID',
        'getRBACPrivileges',
        'listExistingHosts',
        'assignRBACPrivileges',
        'addHostSc',
        'addHostJobSc',
        'deleteHostSc',
        'configureDirectory',
        'listAllDirectories',
        'getDiscoverHostResult',
        'getDiscoverInstanceResult',
        'getOrganizationIds',
        'getBackupRecoveryLicense',
        'assignBackupRecoveryLicense'
    ];

    return bluexpEndpoints.includes(endpoint);
};

const rawBaseQuery = fetchBaseQuery({
    baseUrl: '',
    prepareHeaders
});

export const buildBaseUrl = (api: BaseQueryApi): string => {
    const { auth } = api.getState() as RootState;
    const { accountId } = auth;
    const isDevMode = import.meta.env.VITE_APP_USE_CM_FORWARDER !== 'true';
    const apiHost = isDevMode ? import.meta.env.VITE_APP_LOCAL_SERVER : import.meta.env.VITE_APP_CM_URL;

    // Specifically case for bluexp external api calls
    if (isBluexpExternalApiCall(api.endpoint)) {
        if (api.endpoint === 'discoverExistingFsxN') {
            return isDevMode ? import.meta.env.VITE_APP_LOCAL_SERVER : import.meta.env.VITE_APP_CM_URL;
        }
        return isDevMode ? import.meta.env.VITE_APP_LOCAL_SERVER : import.meta.env.VITE_APP_BXP_URL;
    }
    // Skip wlmdb prefix for endpoints that target the BlueXP base path directly
    if (
        api.endpoint === 'getAssociatedLinks' ||
        api.endpoint === 'getExistingLinks' ||
        api.endpoint === 'checkExistingLink' ||
        api.endpoint === 'deleteExistingLink' ||
        api.endpoint === 'associateSelectedLink' ||
        api.endpoint === 'getFsxDetailsForLinkRedirect'
    ) {
        return `${apiHost}/accounts/${accountId}`;
    }
    return `${apiHost}/accounts/${accountId}/wlmdb`;
};

export const getUrlFixedInArg = (arg: BatchEntry[], baseUrl: string): BatchEntry[] =>
    arg.map((request: BatchEntry) => {
        const { url, inputs, key, ...rest } = request;
        return {
            ...rest,
            url: `${baseUrl}/${url}`
        };
    });

// Build the baseUrl based on the environment
const dynamicBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = retry(
    async (args, api, extraOptions) => {
        const baseUrl = buildBaseUrl(api);
        const url = typeof args === 'string' ? args : args.url;
        const adjustedUrl = `${baseUrl}/${url}`;
        const adjustedArgs = typeof args === 'string' ? adjustedUrl : { ...args, url: adjustedUrl };
        // Retry logic
        const MAX_503_RETRIES = 3;
        let attempt = 0;
        let result: any;
        do {
            result = await rawBaseQuery(adjustedArgs, api, extraOptions);
            if (result?.error?.status === 503 && attempt < MAX_503_RETRIES) {
                attempt += 1;
                await delay(MIN_RETRY_DELAY);
                continue;
            }
            break;
        } while (attempt <= MAX_503_RETRIES);
        // For deploy API and discover API if it gets rate exceeded than retry that API
        if (
            (api.endpoint === 'deploySqlTemplate' ||
                api.endpoint === 'discoverHosts' ||
                api.endpoint === 'deployPgsqlTemplate') &&
            result.error?.data &&
            result.error.data?.message.toLowerCase().includes(API_ERRORS.RATE_EXCEEDED)
        ) {
            await delay(MIN_RETRY_DELAY);
            return result;
        }
        if (result.error && result.error?.status !== 504) {
            retry.fail(result.error);
        }
        return result;
    },
    { maxRetries: API_MAX_RETRIES }
);

async function handleRemoveWE(path: string, baseQuery: any, queryApi: BaseQueryApi) {
    const result = await baseQuery({ url: path, method: 'DELETE' });
    if (result.error) {
        return { error: result.error as FetchBaseQueryError };
    }
    return { data: result };
}

async function handleRootListItems<T extends DatabaseTables>(
    queryApi: BaseQueryApi,
    arg: BatchEntry[][],
    baseQuery: any,
    action: (arg0: T[]) => any,
    key: 'tables'
) {
    const results: any[] = [];
    for (const batchEntryArray of arg) {
        const { dispatch } = queryApi;
        const baseUrl = buildBaseUrl(queryApi);
        const urlFixedInArg = getUrlFixedInArg(batchEntryArray, baseUrl);
        const result = await baseQuery({ url: 'batches', method: 'POST', body: urlFixedInArg });
        if (result.error) {
            // error on the batch request itself - will be handled in the error middleware
            return { error: result.error as FetchBaseQueryError };
        }
        if (!Array.isArray(result.data)) throw new Error(`Response is not an array: ${result.data}`);

        const fixed: T[] = [];
        result.data.map((value: { data?: any; error?: any }, index: number) => {
            if (value.data) {
                if (key) {
                    const resultArray = value.data[`${key}`].map((resultInArray: T) => ({
                        ...resultInArray,
                        ...batchEntryArray[index].inputs
                    }));
                    fixed.push(...resultArray);
                } else {
                    fixed.push({ ...value.data, ...batchEntryArray[index].inputs });
                }
            } else if (value.error) {
                let message = '';
                if (value.error.message) {
                    message = value.error.message;
                } else if (value.error.error) {
                    message = value.error.error.message;
                } else {
                    message = value.error;
                }
            }
        });
        dispatch(action(fixed));
        results.push(...fixed);
    }
    return { data: results };
}

export const awsApi = createApi({
    reducerPath: 'aws',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true, // Will always refetch data and will not get from cache
    endpoints: builder => ({
        getThroughputRegionList: builder.query({
            query: () => ({ url: 'v1/fsx-4gbps-supported-regions' })
        }),
        getCredentials: builder.query({
            query: ({ credentialsType }) => ({ url: `v1/credentials/${credentialsType}` }),
            transformResponse: unwrapItems
        }),
        getRegions: builder.query({
            query: ({ credentialId }) => ({ url: `v1/credentials/${credentialId}/fsx/regions` })
        }),
        getRegionsWithoutCred: builder.query({
            query: () => ({ url: 'v1/fsx/regions' })
        }),
        getVPCList: builder.query({
            query: ({ credentialId, region, fields }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/vpcs?fields=${fields}`
            })
        }),
        getSGList: builder.query({
            query: ({ credentialId, region, vpcId }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/vpcs/${vpcId}/security-groups`
            })
        }),
        getAdsList: builder.query({
            query: ({ credentialId, region }) => ({ url: `v1/credentials/${credentialId}/regions/${region}/ads` })
        }),
        getAmiList: builder.query({
            query: ({
                credentialId,
                region,
                osType,
                osVersion,
                databaseType,
                databaseEdition,
                databaseVersion,
                filterAmis
            }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/amis?osType=${osType}&${
                    filterAmis ? `osVersion=${osVersion}&` : ''
                }databaseType=${databaseType}&${filterAmis ? `databaseEdition=${databaseEdition}&` : ''}${
                    filterAmis ? `databaseVersion=${databaseVersion}` : ''
                }`
            })
        }),
        getCustomAmiList: builder.query({
            query: ({ credentialId, region }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/amis?customAmi=true`
            })
        }),
        getSnsTopics: builder.query({
            query: ({ credentialId, region }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/sns-topics`
            })
        }),
        getKmsKeys: builder.query({
            query: ({ credentialId, region }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/kms-keys`
            })
        }),
        getKeyPairs: builder.query({
            query: ({ credentialId, region }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/key-pairs`
            })
        }),
        getInstanceTypes: builder.query({
            query: ({ credentialId, region }) => ({
                url: `v1/credentials/${credentialId}/regions/${region}/instance-types`
            })
        }),
        getInstanceTypesWithoutCred: builder.query({
            query: ({ region }) => ({
                url: `v1/regions/${region}/instance-types`
            })
        }),
        getFsxnList: builder.query({
            query: ({ credentialId, region, vpcId }) => ({
                url: `v1/credentials/${credentialId}/fsx/regions/${region}/vpcs/${vpcId}/file-systems`
            })
        }),
        createSqlTemplate: builder.mutation({
            query: ({ credentialId, region, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/cloudformation/deploy`,
                method: 'POST',
                body: payload
            })
        }),
        deploySqlTemplate: builder.mutation({
            query: ({ credentialId, region, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/cloudformation/deploy`,
                method: 'POST',
                body: payload
            })
        }),
        deployPgsqlTemplate: builder.mutation({
            query: ({ credentialId, region, payload }) => ({
                url: `v1/pgsql/credentials/${credentialId}/regions/${region}/cloudformation/deploy`,
                method: 'POST',
                body: payload
            })
        }),
        getEstimationCost: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/pricing',
                method: 'POST',
                body: payload
            })
        }),
        getSqlServerCollationList: builder.query({
            query: ({ databaseVersion }) => ({
                url: `v1/mssql/collations?version=${databaseVersion}`
            })
        })
    })
});

export const configApi = createApi({
    reducerPath: 'config',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => ({
        getConfigList: builder.query({
            query: () => ({ url: 'v1/configs' }),
            transformResponse: response => sortListOfDict(unwrapItems(response), 'creationTime', false)
        }),
        getConfigData: builder.query({
            query: ({ configId }) => ({ url: `v1/configs/${configId}` }),
            transformResponse: (response: any) => {
                // For load config generate random DB name as saved config name can't be repeated for deployment
                if (response && response?.data) {
                    response.data.dbName = generateRandomDBName();
                }
                return response;
            }
        }),
        saveConfigData: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/configs',
                method: 'POST',
                body: payload
            })
        }),
        deleteConfig: builder.mutation({
            query: ({ configId }) => ({
                url: `v1/configs/${configId}`,
                method: 'DELETE'
            })
        }),
        updateConfig: builder.mutation({
            query: ({ configId, payload }) => ({
                url: `v1/configs/${configId}`,
                method: 'PATCH',
                body: payload
            })
        })
    })
});

export const databaseHomeApi = createApi({
    reducerPath: 'databaseHomeApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getTemplates: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/cloudformation/template',
                method: 'POST',
                body: payload
            })
        }),
        getPgsqlTemplates: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/pgsql/cloudformation/template',
                method: 'POST',
                body: payload
            })
        }),
        getTerraformSetup: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/terraform/setup',
                method: 'POST',
                body: payload
            })
        }),
        getPGSQLTerraformSetup: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/pgsql/terraform/setup',
                method: 'POST',
                body: payload
            })
        })
    })
});

export const workloadFactoryResourceApiV2 = createApi({
    reducerPath: 'workloadFactoryResourceApiV2',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => ({
        getResourceDetailsV2: builder.query({
            query: ({ credentialId, region, id, sqlInstanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${sqlInstanceId}?fields=serverDetails,databaseInstanceTopology,storage,performance,resourceUtilization,dbCount,nodeTopology,aoag`
            })
        }),
        getOracleOverviewDetails: builder.mutation({
            query: ({ credentialId, region, id, sqlInstanceId }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${sqlInstanceId}?fields=serverDetails,databaseInstanceTopology,storage,performance,resourceUtilization,dbCount,nodeTopology,databasesWithProtection`
            })
        }),
        generateDiagram: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/generate-diagram`,
                method: 'POST',
                responseHandler: response => response.blob()
            })
        }),
        getDatabaseListV2: builder.query({
            query: ({ credentialId, region, id, sqlInstanceId, fields = false, includeAoag = false }) => {
                const queryFields: string[] = [];
                if (fields) queryFields.push('protection');
                if (includeAoag) queryFields.push('aoag');
                const queryString = queryFields.length ? `?fields=${queryFields.join(',')}` : '';
                return {
                    url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${sqlInstanceId}/databases${queryString}`
                };
            }
        })
    })
});

export const jobMonitoringApi = createApi({
    reducerPath: 'jobMonitoringApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        // getJobsList will just include first level jobs list info
        getJobsList: builder.query({
            query: ({ nextToken = null, startTime, endTime }) => {
                let url = `v1/jobs?startTime=${startTime}&endTime=${endTime}`;
                if (nextToken) {
                    url += `&nextToken=${nextToken}`;
                }
                return url;
            }
        }),
        // getFullJobsList will include subtasks and task level data also
        getFullJobsList: builder.query({
            query: ({ nextToken = null, startTime, endTime, includeSubJobs = false, type = null, status = null }) => {
                let url = `v1/jobs?startTime=${startTime}&endTime=${endTime}`;
                if (nextToken) {
                    url += `&nextToken=${nextToken}`;
                }
                if (includeSubJobs) {
                    url += `&includeSubJobs=${includeSubJobs}`;
                }
                if (type) {
                    url += `&type=${type}`;
                }
                if (status) {
                    url += `&status=${status}`;
                }
                return url;
            }
        }),
        getSubTaskList: builder.query({
            query: ({ id }) => ({
                url: `v1/jobs/${id}`
            })
        }),
        getJobsSummaryData: builder.query({
            query: ({ startTime, endTime }) => `v1/jobs/summary?startTime=${startTime}&endTime=${endTime}`
        }),
        getJobsSummaryTimelineData: builder.query({
            query: ({ startTime, endTime }) => `v1/jobs/summary/timeline?startTime=${startTime}&endTime=${endTime}`,
            transformResponse: unwrapItems
        })
    })
});

export const chatbotApi = createApi({
    reducerPath: 'chatbotApi',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => ({
        sendMsg: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/chatbot/prompt',
                method: 'POST',
                body: payload
            })
        })
    })
});

export const headersApi = createApi({
    reducerPath: 'headersApi',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => ({
        getHeadersCredentials: builder.query({
            query: ({ credentialsType }) => ({ url: `v1/credentials/${credentialsType}` }),
            transformResponse: unwrapItems
        }),
        getHeadersRegions: builder.query({
            query: ({ credentialId }) => ({ url: `v1/credentials/${credentialId}/fsx/regions` })
        }),
        getHeadersRegionsWithoutCred: builder.query({
            query: () => ({ url: 'v1/fsx/regions?includeBedrockStatus=true' })
        }),
        getStatus: builder.query({
            query: () => 'v1/status'
        }),
        getAccountInfo: builder.query({
            query: () => 'v1/account-info'
        })
    })
});

export const policiesApi = createApi({
    reducerPath: 'policiesApi',
    baseQuery: fetchBaseQuery({
        baseUrl:
            import.meta.env.VITE_APP_ENVIRONMENT === PRODUCTION ? WLMDB_POLICIES_PROD_LINK : WLMDB_POLICIES_STAGE_LINK
    }),
    endpoints: builder => ({
        getWlmdbPolicies: builder.query({
            query: () => ({ url: '/wlmdb/workload-policies.json' })
        })
    })
});

export const createUserDbApi = createApi({
    reducerPath: 'createUserDbApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getDriveInfoV2: builder.query({
            query: ({ credentialId, region, id, instanceId, forSandbox }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${instanceId}/drive-information${
                    forSandbox ? '?forSandbox=true' : ''
                }`
            })
        }),
        createUserDB: builder.mutation({
            query: ({ credentialId, region, id, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database`,
                method: 'POST',
                body: payload
            })
        }),
        getCollationListV2: builder.query({
            query: ({ credentialId, region, id, instanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${instanceId}/collation`
            })
        })
    })
});

export const snapcenterAPI = createApi({
    reducerPath: 'snapcenterApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getOrganizationIds: builder.mutation({
            query: () => ({
                url: 'v1/management/organizations?limit=1000'
            })
        }),
        getSCCrendentials: builder.mutation({
            query: ({ credentialID, regionID, instanceId, sqlServerInstance }) => ({
                url: `v1/mssql/credentials/${credentialID}/regions/${regionID}/instances/${instanceId}/credentials/exists?resourceId=${sqlServerInstance}`
            })
        }),
        getConnectors: builder.mutation({
            query: ({ accountID }) => ({
                url: `agents-mgmt/list-connectors/${accountID}`
            })
        }),
        getFsxDetails: builder.mutation({
            query: ({ accountID }) => ({
                url: `fsx-ontap/working-environments/${accountID}?partial=true&capacity-details=false&object-store-details=false`
            })
        }),
        getWorkSpaceID: builder.mutation({
            query: ({ accountID }) => ({
                url: `v1/management/organizations/${accountID}/resources`
            })
        }),
        discoverExistingFsxN: builder.mutation({
            query: ({ accountID, workSpaceID, credentialID, regionID, payload }) => ({
                url: `accounts/${accountID}/fsx/v2/credentials/${credentialID}/regions/${regionID}/bluexp/register-file-systems?workspaceId=${workSpaceID}`,
                method: 'POST',
                body: payload
            })
        }),
        getRBACPrivileges: builder.mutation({
            query: ({ accountID }) => ({
                url: `v1/management/organizations/${accountID}/users`,
                headers: {
                    Accept: 'application/vnd.netapp.bxp.users.extended+json'
                }
            })
        }),
        assignRBACPrivileges: builder.mutation({
            query: ({ accountID, payload, role }) => ({
                url: `v1/management/organizations/${accountID}/roles/${role}/users`,
                method: 'POST',
                body: payload
            })
        }),
        listExistingHosts: builder.mutation({
            query: ({ accountID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts?limit=50&offset=0&order_by=name+asc&deploymentModel=`
            })
        }),
        getBackupRecoveryLicense: builder.mutation({
            query: ({ accountID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/licenses?workloadType=SQL`
            })
        }),
        assignBackupRecoveryLicense: builder.mutation({
            query: ({ accountID, payload }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/licenses`,
                method: 'POST',
                body: payload
            })
        }),
        listAllDirectories: builder.mutation({
            query: ({ accountID, hostID, agentID, workspaceID, actualAccountId }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts/${hostID}/drives`,
                headers: {
                    'x-account-id': actualAccountId || accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        getDiscoverHostResult: builder.mutation({
            query: ({ accountID, hostName, agentID, workspaceID, actualAccountId }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/databases?search=${hostName}`,
                headers: {
                    'x-account-id': actualAccountId || accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        configureDirectory: builder.mutation({
            query: ({ accountID, hostID, payload, agentID, workspaceID, actualAccountId }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts/${hostID}/configurelogdirectory`,
                method: 'POST',
                body: payload,
                headers: {
                    'x-account-id': actualAccountId || accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        generateCredentialID: builder.mutation({
            query: ({ credentialID, regionID, payload }) => ({
                url: `v1/ubr-protection/credentials/${credentialID}/regions/${regionID}/ubr-credentials`,
                method: 'POST',
                body: payload
            })
        }),
        addHostSc: builder.mutation({
            query: ({ accountID, payload, agentID, workspaceID, actualAccountID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts`,
                method: 'POST',
                body: payload,
                headers: {
                    'x-account-id': actualAccountID || accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        deleteHostSc: builder.mutation({
            query: ({ accountID, agentID, workspaceID, hostId, actualAccountId }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts/${hostId}`,
                method: 'DELETE',
                headers: {
                    'x-account-id': actualAccountId || accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        addHostJobSc: builder.mutation({
            query: ({ accountID, jobID }) => ({
                url: `cbs-backend/api/account/${accountID}/v1/jobs/${jobID}`
            })
        }),
        getDiscoverInstanceResult: builder.mutation({
            query: ({ accountID, name, agentID, workspaceID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/instances?search=${name}`,
                headers: {
                    'x-account-id': accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        })
    })
});

export const inventoryApi = createApi({
    reducerPath: 'inventoryApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getManagedHostData: builder.query({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/managed-hosts?credentialsIds=${credentialId}&regions=${regionId}&databaseTypes=MSSQL,PGSQL,ORACLE&nextToken=${nextToken}`;
                }
                return `v1/managed-hosts?credentialsIds=${credentialId}&regions=${regionId}&databaseTypes=MSSQL,PGSQL,ORACLE`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        discoverHosts: builder.query({
            query: ({ regionId, credentialsId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialsId}/regions/${regionId}/discover?pageSize=10&nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialsId}/regions/${regionId}/discover?pageSize=10`;
            },
            keepUnusedDataFor: 1,
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialsId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        discoverOracleHosts: builder.query({
            query: ({ regionId, credentialsId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/oracle/credentials/${credentialsId}/regions/${regionId}/discover?pageSize=10&nextToken=${nextToken}`;
                }
                return `v1/oracle/credentials/${credentialsId}/regions/${regionId}/discover?pageSize=10`;
            },
            keepUnusedDataFor: 1,
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialsId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        discoverPgsqlHosts: builder.query({
            query: ({ regionId, credentialsId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/pgsql/credentials/${credentialsId}/regions/${regionId}/discover?pageSize=10&nextToken=${nextToken}`;
                }
                return `v1/pgsql/credentials/${credentialsId}/regions/${regionId}/discover?pageSize=10`;
            },
            keepUnusedDataFor: 1,
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialsId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        getFsxCredentialStatus: builder.query({
            query: ({ regionId, credentialsId, fsxIds }) => ({
                url: `v1/credentials/${credentialsId}/regions/${regionId}/resources/file-systems/credentials-status?fsxids=${fsxIds}`
            }),
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialsId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        registerResourceCredentialsBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/register-credentials',
                method: 'POST',
                body: payload
            })
        }),
        getMssqlInstanceData: builder.mutation({
            query: ({ credentialId, regionId, instances, nextToken = null }) => ({
                url: nextToken
                    ? `v1/mssql/credentials/${credentialId}/regions/${regionId}/instances?instances=${instances}&nextToken=${nextToken}`
                    : `v1/mssql/credentials/${credentialId}/regions/${regionId}/instances?instances=${instances}`,
                method: 'GET'
            })
        }),
        prepareHost: builder.mutation({
            query: ({ credentialId, regionId, instanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/instances/${instanceId}/prepare`,
                method: 'POST'
            })
        })
    })
});

export const inventoryApiV2 = createApi({
    reducerPath: 'inventoryApiV2',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getOneTimeWADUploadScript: builder.mutation({
            query: ({ payload, type }) => ({
                url: `v1/${type}/offline-assessment/upload`,
                method: 'POST',
                body: payload
            })
        }),
        getOneTimeWADDownloadScript: builder.mutation({
            queryFn: async ({ type }, _queryApi, _extraOptions, baseQuery) => {
                const result: any = await baseQuery({
                    url: `v1/${type}/offline-assessment/collector`,
                    responseHandler: (response: Response) => response.blob()
                });

                if (result.error) {
                    return { error: result.error };
                }

                const blob: Blob = result.data;
                let fileName = 'NetApp_WF_MSSQL_Assessment.zip';

                // Try Content-Disposition header first
                const contentDisposition = result.meta?.response?.headers?.get('Content-Disposition');
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
                    if (match?.[1]) {
                        fileName = match[1].trim();
                    }
                } else {
                    // Fallback: read the script filename from the zip's local file header
                    // and replace its extension with .zip to derive the download filename
                    try {
                        const headerBytes = await blob.slice(0, 300).arrayBuffer();
                        const view = new DataView(headerBytes);
                        // Verify zip signature (PK\x03\x04)
                        if (view.getUint32(0, true) === 0x04034b50) {
                            const nameLength = view.getUint16(26, true);
                            const entryName = new TextDecoder().decode(new Uint8Array(headerBytes, 30, nameLength));
                            if (entryName) {
                                fileName = entryName.replace(/\.[^.]+$/, '.zip');
                            }
                        }
                    } catch {
                        fileName = 'NetApp_WF_MSSQL_Assessment_v1.0.0.zip';
                    }
                }

                return { data: { blob, fileName } };
            }
        }),
        getAllOfflineMssqlHostsAssessmentData: builder.query({
            query: ({ credentialId = null, regionId = null, nextToken = null }) => {
                const params = new URLSearchParams();
                if (credentialId) params.append('credentialsId', credentialId);
                if (regionId) params.append('region', regionId);
                if (nextToken) params.append('nextToken', nextToken);
                const queryString = params.toString();
                return queryString ? `v2/mssql/offline-assessment?${queryString}` : 'v2/mssql/offline-assessment';
            }
        }),
        getOfflineMssqlAssessmentDatabases: builder.query({
            query: ({ pageSize = 50, nextToken = null }) => {
                const params = new URLSearchParams();
                if (pageSize) params.append('pageSize', String(pageSize));
                if (nextToken) params.append('nextToken', nextToken);
                const queryString = params.toString();
                return queryString
                    ? `v1/mssql/offline-assessment/databases?${queryString}`
                    : 'v1/mssql/offline-assessment/databases';
            }
        }),
        getOfflineMssqlAssessmentDatabasesByInstance: builder.query({
            query: ({ hostId, instanceId }) =>
                `v1/mssql/database-hosts/${hostId}/database-instances/${instanceId}/offline-assessment/databases`
        }),
        getAllOfflineOracleHostsAssessmentData: builder.query({
            query: ({ credentialId = null, regionId = null, nextToken = null }) => {
                const params = new URLSearchParams();
                if (credentialId) params.append('credentialsId', credentialId);
                if (regionId) params.append('region', regionId);
                if (nextToken) params.append('nextToken', nextToken);
                const queryString = params.toString();
                return queryString ? `v2/oracle/offline-assessment?${queryString}` : 'v2/oracle/offline-assessment';
            }
        }),
        getDatabaseHostsFullDataV2: builder.query({
            query: ({ credentialId, regionId, nextToken = null, isDemoMode = false }) => {
                if (isDemoMode) {
                    if (nextToken) {
                        return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection,aoag&nextToken=${nextToken}`;
                    }
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection,aoag`;
                }
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection,aoag&pageSize=2&nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection,aoag&pageSize=2`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        getPgsqlDatabaseHostsFullDataV2: builder.query({
            query: ({ credentialId, regionId, nextToken = null, isDemoMode = false }) => {
                if (isDemoMode) {
                    if (nextToken) {
                        return `v1/pgsql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&nextToken=${nextToken}`;
                    }
                    return `v1/pgsql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection`;
                }
                if (nextToken) {
                    return `v1/pgsql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&pageSize=2&nextToken=${nextToken}`;
                }
                return `v1/pgsql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&pageSize=2`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        getOracleDatabaseHostsFullDataV2: builder.query({
            query: ({ credentialId, regionId, nextToken = null, isDemoMode = false }) => {
                if (isDemoMode) {
                    if (nextToken) {
                        return `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&nextToken=${nextToken}`;
                    }
                    return `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection`;
                }
                if (nextToken) {
                    return `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&pageSize=2&nextToken=${nextToken}`;
                }
                return `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&pageSize=2`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        getDatabaseHostsListV2: builder.query({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=nodeTopology&nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=nodeTopology`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        getPgSqlDatabaseHostsList: builder.query({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/pgsql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=nodeTopology&nextToken=${nextToken}`;
                }
                return `v1/pgsql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=nodeTopology`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        getOracleDatabaseHostsList: builder.query({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=nodeTopology&nextToken=${nextToken}`;
                }
                return `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=nodeTopology`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.regionId
                    };
                }
                return response;
            }
        }),
        getMssqlInstanceDataV2: builder.mutation({
            query: ({ credentialId, regionId, instances, fields, nextToken = null }) => ({
                url: nextToken
                    ? `v1/mssql/credentials/${credentialId}/regions/${regionId}/instances?instances=${instances}&fields=${fields}&nextToken=${nextToken}`
                    : `v1/mssql/credentials/${credentialId}/regions/${regionId}/instances?instances=${instances}&fields=${fields}`,
                method: 'GET'
            })
        }),
        getPgsqlInstanceData: builder.mutation({
            query: ({ credentialId, regionId, instances, fields, nextToken = null }) => ({
                url: nextToken
                    ? `v1/pgsql/credentials/${credentialId}/regions/${regionId}/resource-details?instances=${instances}&fields=${fields}&nextToken=${nextToken}`
                    : `v1/pgsql/credentials/${credentialId}/regions/${regionId}/resource-details?instances=${instances}&fields=${fields}`,
                method: 'GET'
            })
        }),
        getOracleInstanceData: builder.mutation({
            query: ({ credentialId, regionId, instances, fields, nextToken = null }) => ({
                url: nextToken
                    ? `v1/oracle/credentials/${credentialId}/regions/${regionId}/resource-details?instances=${instances}&fields=${fields}&nextToken=${nextToken}`
                    : `v1/oracle/credentials/${credentialId}/regions/${regionId}/resource-details?instances=${instances}&fields=${fields}`,
                method: 'GET'
            })
        }),
        unmanageMssqlInstance: builder.mutation({
            query: ({ credentialsId, resourceId, dbInstanceId }) => ({
                url: `v1/mssql/credentials/${credentialsId}/resources/${resourceId}/instances?databaseInstanceIds=${dbInstanceId}`,
                method: 'DELETE'
            })
        }),
        unmanagePgsqlInstance: builder.mutation({
            query: ({ credentialsId, resourceId, dbInstanceId }) => ({
                url: `v1/pgsql/credentials/${credentialsId}/resources/${resourceId}/instances?databaseInstanceIds=${dbInstanceId}`,
                method: 'DELETE'
            })
        }),
        unmanageOracleInstance: builder.mutation({
            query: ({ credentialsId, resourceId, dbInstanceId }) => ({
                url: `v1/oracle/credentials/${credentialsId}/resources/${resourceId}/instances?databaseInstanceIds=${dbInstanceId}`,
                method: 'DELETE'
            })
        }),
        manageBulkMssqlInstance: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/manage',
                method: 'POST',
                body: payload
            })
        }),
        createDemoResources: builder.mutation({
            query: ({ credentialsId, regionId }) => ({
                url: `v1/mssql/credentials/${credentialsId}/regions/${regionId}/resources/create-demo-resources`,
                method: 'POST',
                responseHandler: response => response.text()
            })
        }),
        getAllMssqlHostsAssessmentData: builder.query({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v2/mssql/credentials/${credentialId}/regions/${regionId}/assessment?nextToken=${nextToken}`;
                }
                return `v2/mssql/credentials/${credentialId}/regions/${regionId}/assessment`;
            }
        }),
        getAllOracleHostsAssessmentData: builder.query({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v2/oracle/credentials/${credentialId}/regions/${regionId}/assessment?nextToken=${nextToken}`;
                }
                return `v2/oracle/credentials/${credentialId}/regions/${regionId}/assessment`;
            }
        }),
        manageBulkV2MssqlInstance: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/register',
                method: 'POST',
                body: payload
            })
        }),
        manageBulkV2OracleInstance: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/oracle/register',
                method: 'POST',
                body: payload
            })
        })
    })
});

export const sandboxApi = createApi({
    reducerPath: 'sandboxApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getDatabaseHostsForSandboxV2: builder.query({
            query: ({ credentialId, region, nextToken = null }) => {
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts?fields=nodeTopology,databaseInstanceTopology,storage&nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts?fields=nodeTopology,databaseInstanceTopology,storage`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.region
                    };
                }
                return response;
            }
        }),
        getSandboxList: builder.query({
            query: ({ credentialId, region, nextToken = null }) => {
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/sandboxes?nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/sandboxes`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.region
                    };
                }
                return response;
            }
        }),
        getSandboxInstanceList: builder.query({
            query: ({ credentialId, region, databaseHostId, databaseInstanceId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database-instances/${databaseInstanceId}/sandboxes?nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database-instances/${databaseInstanceId}/sandboxes`;
            },
            transformResponse: (response: any, meta, args) => {
                if (response) {
                    response = {
                        ...response,
                        credentialId: args?.credentialId,
                        regionId: args?.region
                    };
                }
                return response;
            }
        }),
        getSandboxSavings: builder.query({
            query: ({ credentialId, region }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/sandboxes/savings`
            })
        }),
        createSandbox: builder.mutation({
            query: ({ credentialId, region, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/sandboxes`,
                method: 'POST',
                body: payload
            })
        }),
        getConnectionInfo: builder.query({
            query: ({ regionId, credentialsId, databaseHostId, instanceId, sandboxName }) => ({
                url: `v1/mssql/credentials/${credentialsId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/sandboxes/${sandboxName}/connection-string`
            })
        }),
        getSplitEstimateInfo: builder.query({
            query: ({ regionId, credentialsId, databaseHostId, instanceId, sandboxName }) => ({
                url: `v1/mssql/credentials/${credentialsId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/sandboxes/${sandboxName}/split-estimate`
            })
        }),
        getDatabaseMountPoints: builder.query({
            query: ({ region, credentialId, databaseHostId, databaseName, instanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database-mount-points?databaseName=${databaseName}&databaseInstanceId=${instanceId}`
            })
        }),
        deleteSandbox: builder.mutation({
            query: ({ credentialsId, regionId, databaseHostId, instanceId, sandboxName }) => ({
                url: `v1/mssql/credentials/${credentialsId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/sandboxes/${sandboxName}`,
                method: 'DELETE'
            })
        }),
        updateSandbox: builder.mutation({
            query: ({ credentialsId, regionId, databaseHostId, instanceId, sandboxName, payload }) => ({
                url: `v1/mssql/credentials/${credentialsId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/sandboxes/${sandboxName}`,
                method: 'PATCH',
                body: payload
            })
        }),
        splitSandbox: builder.mutation({
            query: ({ credentialsId, regionId, databaseHostId, instanceId, sandboxName }) => ({
                url: `v1/mssql/credentials/${credentialsId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/sandboxes/${sandboxName}/split`,
                method: 'POST'
            })
        }),
        checkIntegrity: builder.mutation({
            query: ({ credentialsId, regionId, databaseHostId, instanceId, sandboxName }) => ({
                url: `v1/mssql/credentials/${credentialsId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/sandboxes/${sandboxName}/check-integrity`,
                method: 'POST'
            })
        }),
        getRollbackSnapshots: builder.query({
            query: ({ credentialId, region, databaseHostId, instanceId, sandboxName }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database-instances/${instanceId}/sandboxes/${sandboxName}/snapshots`
            })
        })
    })
});

export const exploreSavingsApi = createApi({
    reducerPath: 'exploreSavingsApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getOracleOnPremTCODownloadScript: builder.mutation({
            query: () => ({
                url: 'v1/oracle/onprem-tco/collector'
            })
        }),
        getUploadScript: builder.mutation({
            query: ({ payload, type }) => ({
                url: `v1/${type}/onprem-tco/upload`,
                method: 'POST',
                body: payload
            })
        }),
        deleteOnPremTco: builder.mutation({
            query: ({ resourceId, type = 'mssql' }) => ({
                url: `v1/${type}/onprem-tco/resources/${resourceId}`,
                method: 'DELETE'
            })
        }),
        getSendEmail: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/notification/email?emailType=savings-calculations',
                method: 'POST',
                body: payload
            })
        }),
        getOnPremSavings: builder.mutation({
            query: ({ type }) => ({
                url: `v1/${type}/onprem-tco/resources`
            })
        }),
        getOnPremCalculations: builder.mutation({
            query: ({ databaseHostId, payload }) => ({
                url: 'v1/mssql/onprem-tco/explore-savings',
                method: 'POST',
                body: payload
            })
        }),
        getStorageSavings: builder.mutation({
            query: ({ credentialId, regionId, instanceId, payload, type }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/instances/${instanceId}/storage-savings/${type}`,
                method: 'POST',
                body: payload
            })
        }),
        getManualStorageSavings: builder.mutation({
            query: ({ regionId, payload, type }) => ({
                url: `v1/mssql/regions/${regionId}/manual-storage-savings/${type}`,
                method: 'POST',
                body: payload
            })
        }),
        getManualViewCalculations: builder.mutation({
            query: ({ regionId, payload, type }) => ({
                url: `v1/mssql/regions/${regionId}/manual-storage-savings/${type}/calculations`,
                method: 'POST',
                body: payload
            })
        }),
        getViewCalculations: builder.mutation({
            query: ({ credentialId, regionId, instanceId, payload, type }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/instances/${instanceId}/storage-savings/${type}/calculations`,
                method: 'POST',
                body: payload
            })
        }),
        getBulkStorageSavings: builder.mutation({
            query: ({ credentialId, regionId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/storage-savings/ebs`,
                method: 'POST',
                body: payload
            })
        }),
        getBulkViewCalculations: builder.mutation({
            query: ({ credentialId, regionId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/storage-savings/ebs/calculations`,
                method: 'POST',
                body: payload
            })
        }),
        // Oracle On-Prem Savings Calculation (returns both storageSavings and calculations)
        getOracleOnPremCalculations: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/oracle/onprem-tco/explore-savings',
                method: 'POST',
                body: payload
            })
        }),
        // Oracle EBS Bulk (also used for single host with 1 element in hosts array)
        getOracleBulkStorageSavings: builder.mutation({
            query: ({ credentialId, regionId, payload }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${regionId}/storage-savings/ebs`,
                method: 'POST',
                body: payload
            })
        }),
        getOracleBulkViewCalculations: builder.mutation({
            query: ({ credentialId, regionId, payload }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${regionId}/storage-savings/ebs/calculations`,
                method: 'POST',
                body: payload
            })
        }),
        // Oracle Manual EBS
        getOracleManualStorageSavings: builder.mutation({
            query: ({ regionId, payload }) => ({
                url: `v1/oracle/regions/${regionId}/manual-storage-savings/ebs`,
                method: 'POST',
                body: payload
            })
        }),
        getOracleManualViewCalculations: builder.mutation({
            query: ({ regionId, payload }) => ({
                url: `v1/oracle/regions/${regionId}/manual-storage-savings/ebs/calculations`,
                method: 'POST',
                body: payload
            })
        })
    })
});

export const getWellApi = createApi({
    reducerPath: 'getWellApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getAssociatedLinks: builder.mutation({
            query: ({ fsxId }) => ({
                url: `links/v1/links?filter=associatedTarget eq '${fsxId}'&include=associatedTargets,state&onlyConnectedStatus=true`
            })
        }),
        getFsxDetailsForLinkRedirect: builder.mutation({
            query: ({ credentialId, region, fsxId }) => ({
                url: `fsx/v2/credentials/${credentialId}/regions/${region}/file-systems/${fsxId}?include=vpcInfo,securityGroups,subnets`
            })
        }),
        getExistingLinks: builder.mutation({
            query: ({}) => ({
                url: 'links/v1/links?include=associatedTarget,state,features'
            })
        }),
        checkExistingLink: builder.mutation({
            query: ({ fsxId }) => ({
                url: `links/v1/links?include=associatedTargets,state&filter=associatedTarget eq '${fsxId}'`
            })
        }),
        deleteExistingLink: builder.mutation({
            query: ({ credentialId, region, fsxId, linkId }) => ({
                url: `fsx/v2/credentials/${credentialId}/regions/${region}/file-systems/${fsxId}/links/${linkId}`,
                method: 'DELETE'
            })
        }),
        associateSelectedLink: builder.mutation({
            query: ({ credentialId, region, fsxId, payload }) => ({
                url: `fsx/v2/credentials/${credentialId}/regions/${region}/file-systems/${fsxId}/links`,
                method: 'POST',
                body: payload
            })
        }),
        getMssqlAssessmentData: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId }) => ({
                url: `v2/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/assessment`
            })
        }),
        getMissingPatchAssessmentData: builder.query({
            query: ({ dbType, credentialId, regionId, databaseHostId, instanceId, field }) => ({
                url: `v1/${dbType}/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/assessment/patch-scan?field=${field}`
            })
        }),
        getOfflineMssqlAssessmentData: builder.query({
            query: ({ databaseHostId, instanceId, credentialId = null, regionId = null }) => {
                const params = new URLSearchParams();
                if (credentialId) params.append('credentialsId', credentialId);
                if (regionId) params.append('region', regionId);
                const queryString = params.toString();
                return queryString
                    ? `v2/mssql/database-hosts/${databaseHostId}/database-instances/${instanceId}/offline-assessment?${queryString}`
                    : `v2/mssql/database-hosts/${databaseHostId}/database-instances/${instanceId}/offline-assessment`;
            }
        }),
        getOfflineOracleAssessmentData: builder.query({
            query: ({ databaseHostId, instanceId, credentialId = null, regionId = null }) => {
                const params = new URLSearchParams();
                if (credentialId) params.append('credentialsId', credentialId);
                if (regionId) params.append('region', regionId);
                const queryString = params.toString();
                return queryString
                    ? `v2/oracle/database-hosts/${databaseHostId}/database-instances/${instanceId}/offline-assessment?${queryString}`
                    : `v2/oracle/database-hosts/${databaseHostId}/database-instances/${instanceId}/offline-assessment`;
            }
        }),
        // Unregistered assessment APIs - use ec2InstanceId instead of databaseHostId
        triggerUnregisteredMssqlAssessment: builder.mutation({
            query: ({ credentialId, region, ec2InstanceId, instanceName }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/ec2-instances/${ec2InstanceId}/database-instances/${instanceName}/assessment`,
                method: 'POST'
            })
        }),
        triggerUnregisteredOracleAssessment: builder.mutation({
            query: ({ credentialId, region, ec2InstanceId, instanceName }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${region}/ec2-instances/${ec2InstanceId}/database-instances/${instanceName}/assessment`,
                method: 'POST'
            })
        }),
        getUnregisteredMssqlAssessment: builder.query({
            query: ({ accountId, ec2InstanceId, instanceName, region, credentialId = null }) => {
                const params = new URLSearchParams();
                if (accountId) params.append('accountId', accountId);
                if (region) params.append('region', region);
                if (credentialId) params.append('credentialsId', credentialId);
                const queryString = params.toString();
                return queryString
                    ? `v2/mssql/database-hosts/${ec2InstanceId}/database-instances/${instanceName}/offline-assessment?${queryString}`
                    : `v2/mssql/database-hosts/${ec2InstanceId}/database-instances/${instanceName}/offline-assessment`;
            }
        }),
        getUnregisteredOracleAssessment: builder.query({
            query: ({ accountId, ec2InstanceId, instanceName, region, credentialId = null }) => {
                const params = new URLSearchParams();
                if (accountId) params.append('accountId', accountId);
                if (region) params.append('region', region);
                if (credentialId) params.append('credentialsId', credentialId);
                const queryString = params.toString();
                return queryString
                    ? `v2/oracle/database-hosts/${ec2InstanceId}/database-instances/${instanceName}/offline-assessment?${queryString}`
                    : `v2/oracle/database-hosts/${ec2InstanceId}/database-instances/${instanceName}/offline-assessment`;
            }
        }),
        getOracleAssessmentData: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId }) => ({
                url: `v2/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/assessment`
            })
        }),
        triggerOracleInstanceAssessment: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/assessment`,
                method: 'POST'
            })
        }),
        getMssqlAssessmentDataForHost: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/assessment`
            })
        }),
        triggerInstanceAssessment: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/assessment`,
                method: 'POST'
            })
        }),
        dismissMssqlAssessment: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/assessment/dismiss',
                method: 'POST',
                body: payload
            })
        }),
        dismissOracleAssessment: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/oracle/assessment/dismiss',
                method: 'POST',
                body: payload
            })
        }),
        optimizeStorageSizing: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/storage-sizing`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeStorageSizingForBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/storage-sizing',
                method: 'POST',
                body: payload
            })
        }),
        optimizeStorageConfig: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/storage-configuration`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeOracleStorageConfig: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/storage-configuration`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeOracleStorageLayoutAsm: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/storage-layout`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeOracleOperatingSystem: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/oracle/database-hosts/optimize',
                method: 'POST',
                body: payload
            })
        }),
        optimizeOperatingSystem: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/storage-operating-system`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeComputeConfig: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/compute`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeStorageTier: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/storage-tier`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeStorageTierForBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/storage-tier',
                method: 'POST',
                body: payload
            })
        }),
        optimizeComputeConfigForBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/compute',
                method: 'POST',
                body: payload
            })
        }),
        optimizeMTUConfigForBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/mtu-alignment',
                method: 'POST',
                body: payload
            })
        }),
        optimizeMaxdopConfigForBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/max-dop',
                method: 'POST',
                body: payload
            })
        }),
        optimizeOperatingSystemForBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/storage-operating-system',
                method: 'POST',
                body: payload
            })
        }),
        getSnapshotPolicies: builder.query({
            query: ({ credentialId, region, databaseHostId, instanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database-instances/${instanceId}/snapshot-policies`
            })
        }),
        optimizeResiliency: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/optimize/resiliency`,
                method: 'POST',
                body: payload
            })
        }),
        optimizeAwsBackup: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/resiliency/aws-backup',
                method: 'POST',
                body: payload
            })
        }),
        optimizeCloneCleanup: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/clone',
                method: 'POST',
                body: payload
            })
        }),
        optimizeHAMssql: builder.mutation({
            query: ({ configName, payload }) => ({
                url: `v1/mssql/database-hosts/optimize/${configName}`,
                method: 'POST',
                body: payload
            })
        })
    })
});

export const errorInvestigationApi = createApi({
    reducerPath: 'errorInvestigationApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getErrorInvestigationData: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, id, dbType = DBType.MSSQL }) => {
                dbType = dbType === DBType.ORACLE || dbType === 'oracle' ? 'oracle' : 'mssql';
                if (id) {
                    return `v1/${dbType}/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis?id=${id}`;
                }
                return `v1/${dbType}/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis`;
            }
        }),
        getInvestigationDates: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, dbType = DBType.MSSQL }) => {
                dbType = dbType === DBType.ORACLE || dbType === 'oracle' ? 'oracle' : 'mssql';
                return `v1/${dbType}/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis/reports`;
            }
        }),
        scanErrorInvestigation: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload, dbType = DBType.MSSQL }) => {
                dbType = dbType === DBType.ORACLE || dbType === 'oracle' ? 'oracle' : 'mssql';
                return {
                    url: `v1/${dbType}/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis`,
                    method: 'POST',
                    body: payload
                };
            }
        }),
        getAccLogAnalysisLatest: builder.mutation({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/logs-analysis/summary?nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${regionId}/logs-analysis/summary`;
            }
        }),
        getAccLogAnalysisLatestOracle: builder.mutation({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/oracle/credentials/${credentialId}/regions/${regionId}/logs-analysis/summary?nextToken=${nextToken}`;
                }
                return `v1/oracle/credentials/${credentialId}/regions/${regionId}/logs-analysis/summary`;
            }
        }),
        getLogAnalyzerPreReq: builder.mutation({
            query: ({ credentialId, regionId, type, typeId }) =>
                `v1/mssql/credentials/${credentialId}/regions/${regionId}/logs-analysis/pre-requisites?${type}=${typeId}`
        }),
        getLogAnalyzerPreReqOracle: builder.mutation({
            query: ({ credentialId, regionId, payload }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${regionId}/logs-analysis/pre-requisites`,
                method: 'POST',
                body: payload
            })
        }),
        getLogAnalyzerPricing: builder.mutation({
            query: ({ regionId }) => ({
                url: `v1/pricing/region/${regionId}/logs-analysis`
            })
        })
    })
});

export const {
    useGetCredentialsQuery,
    useGetRegionsQuery,
    useLazyGetRegionsWithoutCredQuery,
    useGetThroughputRegionListQuery,
    useGetVPCListQuery,
    useGetSGListQuery,
    useGetAdsListQuery,
    useGetAmiListQuery,
    useGetCustomAmiListQuery,
    useGetSnsTopicsQuery,
    useGetKmsKeysQuery,
    useGetKeyPairsQuery,
    useGetInstanceTypesQuery,
    useLazyGetInstanceTypesQuery,
    useLazyGetInstanceTypesWithoutCredQuery,
    useGetFsxnListQuery,
    useCreateSqlTemplateMutation,
    useDeploySqlTemplateMutation,
    useDeployPgsqlTemplateMutation,
    useGetEstimationCostMutation,
    useGetSqlServerCollationListQuery
} = awsApi;

export const {
    useGetConfigListQuery,
    useLazyGetConfigDataQuery,
    useSaveConfigDataMutation,
    useDeleteConfigMutation,
    useUpdateConfigMutation
} = configApi;

export const {
    useGetTemplatesMutation,
    useGetTerraformSetupMutation,
    useGetPgsqlTemplatesMutation,
    useGetPGSQLTerraformSetupMutation
} = databaseHomeApi;

export const {
    useLazyGetResourceDetailsV2Query,
    useGetOracleOverviewDetailsMutation,
    useGenerateDiagramMutation,
    useGetDatabaseListV2Query,
    useLazyGetDatabaseListV2Query
} = workloadFactoryResourceApiV2;

export const {
    useGetJobsListQuery,
    useGetFullJobsListQuery,
    useLazyGetSubTaskListQuery,
    useGetJobsSummaryDataQuery,
    useGetJobsSummaryTimelineDataQuery
} = jobMonitoringApi;

export const {
    useGetHeadersCredentialsQuery,
    useGetHeadersRegionsQuery,
    useGetHeadersRegionsWithoutCredQuery,
    useGetStatusQuery,
    useGetAccountInfoQuery
} = headersApi;

export const { useGetWlmdbPoliciesQuery } = policiesApi;

export const { useCreateUserDBMutation, useGetDriveInfoV2Query, useGetCollationListV2Query } = createUserDbApi;

export const {
    useLazyGetManagedHostDataQuery,
    useLazyDiscoverHostsQuery,
    useLazyDiscoverOracleHostsQuery,
    useLazyDiscoverPgsqlHostsQuery,
    useLazyGetFsxCredentialStatusQuery,
    useRegisterResourceCredentialsBulkMutation,
    useGetMssqlInstanceDataMutation,
    usePrepareHostMutation
} = inventoryApi;

export const {
    useGetBackupRecoveryLicenseMutation,
    useAssignBackupRecoveryLicenseMutation,
    useGetSCCrendentialsMutation,
    useGetOrganizationIdsMutation,
    useGetConnectorsMutation,
    useGetFsxDetailsMutation,
    useAssignRBACPrivilegesMutation,
    useDiscoverExistingFsxNMutation,
    useGetWorkSpaceIDMutation,
    useGetRBACPrivilegesMutation,
    useListExistingHostsMutation,
    useGenerateCredentialIDMutation,
    useAddHostScMutation,
    useDeleteHostScMutation,
    useAddHostJobScMutation,
    useConfigureDirectoryMutation,
    useListAllDirectoriesMutation,
    useGetDiscoverHostResultMutation,
    useGetDiscoverInstanceResultMutation
} = snapcenterAPI;

export const {
    useLazyGetDatabaseHostsFullDataV2Query,
    useLazyGetPgsqlDatabaseHostsFullDataV2Query,
    useLazyGetOracleDatabaseHostsFullDataV2Query,
    useLazyGetDatabaseHostsListV2Query,
    useLazyGetPgSqlDatabaseHostsListQuery,
    useLazyGetOracleDatabaseHostsListQuery,
    useGetMssqlInstanceDataV2Mutation,
    useGetPgsqlInstanceDataMutation,
    useGetOracleInstanceDataMutation,
    useUnmanageMssqlInstanceMutation,
    useUnmanagePgsqlInstanceMutation,
    useUnmanageOracleInstanceMutation,
    useManageBulkMssqlInstanceMutation,
    useCreateDemoResourcesMutation,
    useLazyGetAllMssqlHostsAssessmentDataQuery,
    useLazyGetAllOracleHostsAssessmentDataQuery,
    useLazyGetAllOfflineMssqlHostsAssessmentDataQuery,
    useLazyGetAllOfflineOracleHostsAssessmentDataQuery,
    useManageBulkV2MssqlInstanceMutation,
    useManageBulkV2OracleInstanceMutation,
    useGetOneTimeWADUploadScriptMutation,
    useGetOneTimeWADDownloadScriptMutation,
    useGetOfflineMssqlAssessmentDatabasesQuery,
    useLazyGetOfflineMssqlAssessmentDatabasesQuery,
    useGetOfflineMssqlAssessmentDatabasesByInstanceQuery,
    useLazyGetOfflineMssqlAssessmentDatabasesByInstanceQuery
} = inventoryApiV2;

export const {
    useGetSandboxListQuery,
    useLazyGetSandboxInstanceListQuery,
    useLazyGetSandboxListQuery,
    useGetSandboxSavingsQuery,
    useLazyGetSandboxSavingsQuery,
    useCreateSandboxMutation,
    useLazyGetConnectionInfoQuery,
    useLazyGetSplitEstimateInfoQuery,
    useGetDatabaseMountPointsQuery,
    useDeleteSandboxMutation,
    useUpdateSandboxMutation,
    useSplitSandboxMutation,
    useCheckIntegrityMutation,
    useGetDatabaseHostsForSandboxV2Query,
    useLazyGetRollbackSnapshotsQuery
} = sandboxApi;

export const {
    useGetSendEmailMutation,
    useGetOracleOnPremTCODownloadScriptMutation,
    useGetUploadScriptMutation,
    useDeleteOnPremTcoMutation,
    useGetOnPremSavingsMutation,
    useGetOnPremCalculationsMutation,
    useGetStorageSavingsMutation,
    useGetViewCalculationsMutation,
    useGetManualStorageSavingsMutation,
    useGetManualViewCalculationsMutation,
    useGetBulkStorageSavingsMutation,
    useGetBulkViewCalculationsMutation,
    useGetOracleOnPremCalculationsMutation,
    useGetOracleBulkStorageSavingsMutation,
    useGetOracleBulkViewCalculationsMutation,
    useGetOracleManualStorageSavingsMutation,
    useGetOracleManualViewCalculationsMutation
} = exploreSavingsApi;

export const {
    useGetMssqlAssessmentDataMutation,
    useGetMissingPatchAssessmentDataQuery,
    useGetOracleAssessmentDataMutation,
    useTriggerOracleInstanceAssessmentMutation,
    useGetMssqlAssessmentDataForHostMutation,
    useGetAssociatedLinksMutation,
    useGetFsxDetailsForLinkRedirectMutation,
    useCheckExistingLinkMutation,
    useGetExistingLinksMutation,
    useDeleteExistingLinkMutation,
    useAssociateSelectedLinkMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeOracleStorageConfigMutation,
    useOptimizeOracleStorageLayoutAsmMutation,
    useOptimizeOracleOperatingSystemMutation,
    useOptimizeComputeConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeOperatingSystemMutation,
    useOptimizeStorageTierMutation,
    useOptimizeStorageSizingForBulkMutation,
    useOptimizeStorageTierForBulkMutation,
    useTriggerInstanceAssessmentMutation,
    useOptimizeComputeConfigForBulkMutation,
    useOptimizeMTUConfigForBulkMutation,
    useOptimizeMaxdopConfigForBulkMutation,
    useOptimizeOperatingSystemForBulkMutation,
    useLazyGetSnapshotPoliciesQuery,
    useLazyGetOfflineMssqlAssessmentDataQuery,
    useLazyGetOfflineOracleAssessmentDataQuery,
    useTriggerUnregisteredMssqlAssessmentMutation,
    useTriggerUnregisteredOracleAssessmentMutation,
    useLazyGetUnregisteredMssqlAssessmentQuery,
    useLazyGetUnregisteredOracleAssessmentQuery,
    useOptimizeResiliencyMutation,
    useOptimizeAwsBackupMutation,
    useOptimizeCloneCleanupMutation,
    useDismissMssqlAssessmentMutation,
    useDismissOracleAssessmentMutation,
    useOptimizeHAMssqlMutation
} = getWellApi;

export const {
    useGetErrorInvestigationDataMutation,
    useGetInvestigationDatesMutation,
    useScanErrorInvestigationMutation,
    useGetAccLogAnalysisLatestMutation,
    useGetAccLogAnalysisLatestOracleMutation,
    useGetLogAnalyzerPreReqMutation,
    useGetLogAnalyzerPreReqOracleMutation,
    useGetLogAnalyzerPricingMutation
} = errorInvestigationApi;
