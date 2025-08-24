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
    MIN_RETRY_DELAY,
    PRODUCTION,
    WLMDB_POLICIES_PROD_LINK,
    WLMDB_POLICIES_STAGE_LINK
} from './consts';
import { DatabaseTables, BatchEntry } from './types/resourceTypes';
import { delay, generateRandomDBName, sortListOfDict } from './utilityFunctions';
import { SELECT_CONFIG } from './appConstants';

// Place the relevant headers on all requests:
const prepareHeaders = (
    headers: Headers,
    api: Pick<BaseQueryApi, 'type' | 'getState' | 'extra' | 'endpoint' | 'forced'>
): Headers => {
    const { getState, endpoint } = api;
    const { accessToken, workspaceId, isDemoMode, isWorkloadFactory } = (getState() as RootState).auth;
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
    if (!isWorkloadFactory && endpoint !== 'getWorkSpaceID' && endpoint !== 'getRBACPrivileges') {
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
        'getOrganizationIds'
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
        // provide the amended url and other params to the raw base query
        const result: any = await rawBaseQuery(adjustedArgs, api, extraOptions);
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
            query: ({ credentialsType }) => ({ url: `v1/credentials/${credentialsType}` })
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
            transformResponse: response => (response ? sortListOfDict(response, 'creationTime', false) : [])
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
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${sqlInstanceId}?fields=serverDetails,databaseInstanceTopology,storage,performance,resourceUtilization,dbCount,nodeTopology`
            })
        }),
        getOracleOverviewDetails: builder.mutation({
            query: ({ credentialId, region, id, sqlInstanceId }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${sqlInstanceId}?fields=serverDetails,databaseInstanceTopology,storage,performance,resourceUtilization,dbCount,nodeTopology`
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
            query: ({ credentialId, region, id, sqlInstanceId, fields = false }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${id}/database-instances/${sqlInstanceId}/databases${
                    fields ? '?fields=protection' : ''
                }`
            })
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
            query: ({ startTime, endTime }) => `v1/jobs/summary/timeline?startTime=${startTime}&endTime=${endTime}`
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
            query: ({ credentialsType }) => ({ url: `v1/credentials/${credentialsType}` })
        }),
        getHeadersRegions: builder.query({
            query: ({ credentialId }) => ({ url: `v1/credentials/${credentialId}/fsx/regions` })
        }),
        getHeadersRegionsWithoutCred: builder.query({
            query: () => ({ url: 'v1/fsx/regions' })
        }),
        getStatus: builder.query({
            query: () => 'v1/status'
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
        listAllDirectories: builder.mutation({
            query: ({ accountID, hostID, agentID, workspaceID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts/${hostID}/drives`,
                headers: {
                    'x-account-id': accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        getDiscoverHostResult: builder.mutation({
            query: ({ accountID, hostName, agentID, workspaceID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/databases?search=${hostName}`,
                headers: {
                    'x-account-id': accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        configureDirectory: builder.mutation({
            query: ({ accountID, hostID, payload, agentID, workspaceID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts/${hostID}/configurelogdirectory`,
                method: 'POST',
                body: payload,
                headers: {
                    'x-account-id': accountID,
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
            query: ({ accountID, payload, agentID, workspaceID }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts`,
                method: 'POST',
                body: payload,
                headers: {
                    'x-account-id': accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        deleteHostSc: builder.mutation({
            query: ({ accountID, agentID, workspaceID, hostId }) => ({
                url: `backup-recovery/organizations/${accountID}/v1/workloads/sql/hosts/${hostId}`,
                method: 'DELETE',
                headers: {
                    'x-account-id': accountID,
                    'x-agent-id': agentID,
                    'x-netapp-workspace-id': workspaceID
                }
            })
        }),
        addHostJobSc: builder.mutation({
            query: ({ accountID, jobID }) => ({
                url: `cbs-backend/api/account/${accountID}/v1/jobs/${jobID}`
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
        getDatabaseHostsFullDataV2: builder.query({
            query: ({ credentialId, regionId, nextToken = null, isDemoMode = false }) => {
                if (isDemoMode) {
                    if (nextToken) {
                        return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&nextToken=${nextToken}`;
                    }
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection`;
                }
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&pageSize=2&nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts?fields=databaseInstanceTopology,dbCount,performance,storage,protection,usageEstimation,databasesWithProtection&pageSize=2`;
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
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/assessment?nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${regionId}/assessment`;
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
        getUploadScript: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/onprem-tco/upload',
                method: 'POST',
                body: payload
            })
        }),
        deleteOnPremTco: builder.mutation({
            query: ({ resourceId }) => ({
                url: `v1/mssql/onprem-tco/resources/${resourceId}`,
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
            query: () => ({
                url: 'v1/mssql/onprem-tco/resources'
            })
        }),
        getOnPremCalculations: builder.mutation({
            query: ({ databaseHostId, payload }) => ({
                url: `v1/mssql/onprem-tco/resources/${databaseHostId}/explore-savings`,
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
        })
    })
});

export const getWellApi = createApi({
    reducerPath: 'getWellApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => ({
        getMssqlAssessmentData: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/assessment`
            })
        }),
        getOracleAssessmentData: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId }) => ({
                url: `v1/oracle/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/assessment`
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
        optimizeMaxdopConfigForBulk: builder.mutation({
            query: ({ payload }) => ({
                url: 'v1/mssql/database-hosts/optimize/max-dop',
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
            query: ({ credentialId, regionId, databaseHostId, instanceId, id }) => {
                if (id) {
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis?id=${id}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis`;
            }
        }),
        getInvestigationDates: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis/reports`
            })
        }),
        scanErrorInvestigation: builder.mutation({
            query: ({ credentialId, regionId, databaseHostId, instanceId, payload }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/database-hosts/${databaseHostId}/database-instances/${instanceId}/logs-analysis`,
                method: 'POST',
                body: payload
            })
        }),
        getAccLogAnalysisLatest: builder.mutation({
            query: ({ credentialId, regionId, nextToken = null }) => {
                if (nextToken) {
                    return `v1/mssql/credentials/${credentialId}/regions/${regionId}/logs-analysis/summary?nextToken=${nextToken}`;
                }
                return `v1/mssql/credentials/${credentialId}/regions/${regionId}/logs-analysis/summary`;
            }
        }),
        getLogAnalyzerPreReq: builder.mutation({
            query: ({ credentialId, regionId, type, typeId }) => ({
                url: `v1/mssql/credentials/${credentialId}/regions/${regionId}/logs-analysis/pre-requisites?${type}=${typeId}`
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

export const { useSendMsgMutation } = chatbotApi;

export const {
    useGetHeadersCredentialsQuery,
    useGetHeadersRegionsQuery,
    useGetHeadersRegionsWithoutCredQuery,
    useGetStatusQuery
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
    useGetDiscoverHostResultMutation
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
    useManageBulkV2MssqlInstanceMutation,
    useManageBulkV2OracleInstanceMutation
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
    useGetUploadScriptMutation,
    useDeleteOnPremTcoMutation,
    useGetOnPremSavingsMutation,
    useGetOnPremCalculationsMutation,
    useGetStorageSavingsMutation,
    useGetViewCalculationsMutation,
    useGetManualStorageSavingsMutation,
    useGetManualViewCalculationsMutation
} = exploreSavingsApi;

export const {
    useGetMssqlAssessmentDataMutation,
    useGetOracleAssessmentDataMutation,
    useGetMssqlAssessmentDataForHostMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeComputeConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeOperatingSystemMutation,
    useOptimizeStorageTierMutation,
    useOptimizeStorageSizingForBulkMutation,
    useOptimizeStorageTierForBulkMutation,
    useTriggerInstanceAssessmentMutation,
    useOptimizeComputeConfigForBulkMutation,
    useOptimizeMaxdopConfigForBulkMutation,
    useLazyGetSnapshotPoliciesQuery,
    useOptimizeResiliencyMutation,
    useOptimizeAwsBackupMutation,
    useOptimizeCloneCleanupMutation,
    useDismissMssqlAssessmentMutation,
    useOptimizeHAMssqlMutation
} = getWellApi;

export const {
    useGetErrorInvestigationDataMutation,
    useGetInvestigationDatesMutation,
    useScanErrorInvestigationMutation,
    useGetAccLogAnalysisLatestMutation,
    useGetLogAnalyzerPreReqMutation,
    useGetLogAnalyzerPricingMutation
} = errorInvestigationApi;
