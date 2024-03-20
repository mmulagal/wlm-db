import {
    BaseQueryFn,
    createApi,
    FetchArgs,
    fetchBaseQuery,
    FetchBaseQueryError,
    retry
} from '@reduxjs/toolkit/query/react';
import { BaseQueryApi } from '@reduxjs/toolkit/dist/query/baseQueryTypes';
import store, { RootState } from '../store/store';
import { API_MAX_RETRIES, PRODUCTION, WLMDB_POLICIES_PROD_LINK, WLMDB_POLICIES_STAGE_LINK } from './consts';
import { DatabaseTables, BatchEntry } from './types/resourceTypes';
import { setResourceTables } from '../store/resource/resourceSlice';
import { generateRandomDBName, sortListOfDict } from './utilityFunctions';
import { SELECT_CONFIG } from './appConstants';

//Place the relevant headers on all requests:
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
    if (!isWorkloadFactory) {
        headers.set('x-netapp-referer', 'BlueXP');
    }
    if (endpoint === 'deploySqlTemplate' || endpoint === 'getTemplates') {
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
    const apiHost = process.env.REACT_APP_CM_URL;
    return `${apiHost}/accounts/${accountId}/wlmdb/v1`;
};

const rawBaseQuery = fetchBaseQuery({
    baseUrl: '',
    prepareHeaders
});

export const buildBaseUrl = (api: BaseQueryApi): string => {
    const { auth } = api.getState() as RootState;
    const { accountId } = auth;
    const isDevMode = process.env.REACT_APP_USE_CM_FORWARDER !== 'true';
    const apiHost = isDevMode ? process.env.REACT_APP_LOCAL_SERVER : process.env.REACT_APP_CM_URL;
    return `${apiHost}/accounts/${accountId}/wlmdb/v1`;
};

export const getUrlFixedInArg = (arg: BatchEntry[], baseUrl: string): BatchEntry[] => {
    return arg.map((request: BatchEntry) => {
        const { url, inputs, key, ...rest } = request;
        return {
            ...rest,
            url: `${baseUrl}/${url}`
        };
    });
};

//Build the baseUrl based on the environment
const dynamicBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = retry(
    async (args, api, extraOptions) => {
        const baseUrl = buildBaseUrl(api);
        const url = typeof args === 'string' ? args : args.url;
        const adjustedUrl = `${baseUrl}/${url}`;
        const adjustedArgs = typeof args === 'string' ? adjustedUrl : { ...args, url: adjustedUrl };
        // provide the amended url and other params to the raw base query
        const result = await rawBaseQuery(adjustedArgs, api, extraOptions);
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
            //error on the batch request itself - will be handled in the error middleware
            return { error: result.error as FetchBaseQueryError };
        }
        if (!Array.isArray(result.data)) throw new Error(`Response is not an array: ${result.data}`);

        const fixed: T[] = [];
        result.data.map((value: { data?: any; error?: any }, index: number) => {
            if (value.data) {
                if (key) {
                    const resultArray = value.data[`${key}`].map((resultInArray: T) => {
                        return {
                            ...resultInArray,
                            ...batchEntryArray[index].inputs
                        };
                    });
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
    endpoints: builder => {
        return {
            getCredentials: builder.query({
                query: ({ credentialsType }) => ({ url: `credentials/${credentialsType}` })
            }),
            getRegions: builder.query({
                query: ({ credentialId }) => ({ url: `credentials/${credentialId}/fsx/regions` })
            }),
            getVPCList: builder.query({
                query: ({ credentialId, region, fields }) => ({
                    url: `credentials/${credentialId}/regions/${region}/vpcs?fields=${fields}`
                })
            }),
            getSGList: builder.query({
                query: ({ credentialId, region, vpcId }) => ({
                    url: `credentials/${credentialId}/regions/${region}/vpcs/${vpcId}/security-groups`
                })
            }),
            getAdsList: builder.query({
                query: ({ credentialId, region }) => ({ url: `credentials/${credentialId}/regions/${region}/ads` })
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
                    url: `credentials/${credentialId}/regions/${region}/amis?osType=${osType}&${
                        filterAmis ? `osVersion=${osVersion}&` : ''
                    }databaseType=${databaseType}&${filterAmis ? `databaseEdition=${databaseEdition}&` : ''}${
                        filterAmis ? `databaseVersion=${databaseVersion}` : ''
                    }`
                })
            }),
            getSnsTopics: builder.query({
                query: ({ credentialId, region }) => ({
                    url: `credentials/${credentialId}/regions/${region}/sns-topics`
                })
            }),
            getKmsKeys: builder.query({
                query: ({ credentialId, region }) => ({ url: `credentials/${credentialId}/regions/${region}/kms-keys` })
            }),
            getKeyPairs: builder.query({
                query: ({ credentialId, region }) => ({
                    url: `credentials/${credentialId}/regions/${region}/key-pairs`
                })
            }),
            getInstanceTypes: builder.query({
                query: ({ credentialId, region }) => ({
                    url: `credentials/${credentialId}/regions/${region}/instance-types`
                })
            }),
            getFsxnList: builder.query({
                query: ({ credentialId, region, vpcId }) => ({
                    url: `credentials/${credentialId}/fsx/regions/${region}/vpcs/${vpcId}/file-systems`
                })
            }),
            createSqlTemplate: builder.mutation({
                query: ({ credentialId, region, payload }) => ({
                    url: `credentials/${credentialId}/regions/${region}/cloudformation/deploy`,
                    method: 'POST',
                    body: payload
                })
            }),
            deploySqlTemplate: builder.mutation({
                query: ({ credentialId, region, payload }) => ({
                    url: `credentials/${credentialId}/regions/${region}/cloudformation/deploy`,
                    method: 'POST',
                    body: payload
                })
            }),
            getEstimationCost: builder.mutation({
                query: ({ payload }) => ({
                    url: `pricing`,
                    method: 'POST',
                    body: payload
                })
            })
        };
    }
});

export const resourceApi = createApi({
    reducerPath: 'resource',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => {
        return {
            removeMSSQL: builder.mutation({
                async queryFn(id, queryApi: BaseQueryApi, extraOptions: any, baseQuery: any) {
                    return await handleRemoveWE(`mssql/resources/${id}`, baseQuery, queryApi);
                }
            }),
            getMSSQLDatabases: builder.query({
                query: id => ({ url: `mssql/resources/${id}/databases` })
            }),
            getMSSQLSummary: builder.query({
                query: id => ({ url: `mssql/resources/${id}/summary` })
            }),
            getMSSQLCpuUtilization: builder.query({
                query: id => ({ url: `mssql/resources/${id}/utilization/cpu` })
            }),
            getMSSQLDiskUtilization: builder.query({
                query: id => ({ url: `mssql/resources/${id}/utilization/disk` })
            }),
            getMSSQLMemoryUtilization: builder.query({
                query: id => ({ url: `mssql/resources/${id}/utilization/memory` })
            }),
            batchTables: builder.mutation<DatabaseTables[], BatchEntry[][]>({
                async queryFn(arg, queryApi: BaseQueryApi, extraOptions: any, baseQuery: any) {
                    return await handleRootListItems<DatabaseTables>(
                        queryApi,
                        arg,
                        baseQuery,
                        setResourceTables,
                        'tables'
                    );
                }
            })
        };
    }
});

export const configApi = createApi({
    reducerPath: 'config',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => {
        return {
            getConfigList: builder.query({
                query: () => ({ url: `configs` }),
                transformResponse: response => {
                    return response ? sortListOfDict(response, 'creationTime', false) : [];
                }
            }),
            getConfigData: builder.query({
                query: ({ configId }) => ({ url: `configs/${configId}` }),
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
                    url: `configs`,
                    method: 'POST',
                    body: payload
                })
            }),
            deleteConfig: builder.mutation({
                query: ({ configId }) => ({
                    url: `configs/${configId}`,
                    method: 'DELETE'
                })
            }),
            updateConfig: builder.mutation({
                query: ({ configId, payload }) => ({
                    url: `configs/${configId}`,
                    method: 'PATCH',
                    body: payload
                })
            })
        };
    }
});

export const databaseHomeApi = createApi({
    reducerPath: 'databaseHomeApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => {
        return {
            getDatabaseHosts: builder.query({
                query: ({ credentialId, region, nextToken = null }) => {
                    if (nextToken) {
                        return `credentials/${credentialId}/regions/${region}/database-hosts?fields=topology,dbCount,performance,storage,protection,usageEstimation&nextToken=${nextToken}`;
                    } else {
                        return `credentials/${credentialId}/regions/${region}/database-hosts?fields=topology,dbCount,performance,storage,protection,usageEstimation`;
                    }
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
            getJobsSummary: builder.query({
                query: ({ credentialId, region, startTime, endTime }) =>
                    `credentials/${credentialId}/regions/${region}/jobs/summary?startTime=${startTime}&endTime=${endTime}`
            }),
            getTemplates: builder.mutation({
                query: ({ payload }) => ({
                    url: `cloudformation/template`,
                    method: 'POST',
                    body: payload
                })
            })
        };
    }
});

export const workloadFactoryResourceApi = createApi({
    reducerPath: 'workloadFactoryResourceApi',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => {
        return {
            getResourceDetails: builder.query({
                query: ({ credentialId, region, id }) => ({
                    url: `credentials/${credentialId}/regions/${region}/database-hosts/${id}?fields=topology,dbCount,storage,performance,usageEstimation,resourceUtilization`
                })
            }),
            getDatabaseList: builder.query({
                query: ({ credentialId, region, id }) => ({
                    url: `credentials/${credentialId}/regions/${region}/database-hosts/${id}/databases`
                })
            })
        };
    }
});

export const jobMonitoringApi = createApi({
    reducerPath: 'jobMonitoringApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => {
        return {
            // getJobsList will just include first level jobs list info
            getJobsList: builder.query({
                query: ({ credentialId, region, nextToken = null, startTime, endTime }) => {
                    let url = `credentials/${credentialId}/regions/${region}/jobs?startTime=${startTime}&endTime=${endTime}`;
                    if (nextToken) {
                        url += `&nextToken=${nextToken}`;
                    }
                    return url;
                }
            }),
            // getFullJobsList will include subtasks and task level data also
            getFullJobsList: builder.query({
                query: ({
                    credentialId,
                    region,
                    nextToken = null,
                    startTime,
                    endTime,
                    includeSubJobs = false,
                    type = null,
                    status = null
                }) => {
                    let url = `credentials/${credentialId}/regions/${region}/jobs?startTime=${startTime}&endTime=${endTime}`;
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
                query: ({ credentialId, region, id }) => ({
                    url: `credentials/${credentialId}/regions/${region}/jobs/${id}`
                })
            }),
            getJobsSummaryData: builder.query({
                query: ({ credentialId, region, startTime, endTime }) =>
                    `credentials/${credentialId}/regions/${region}/jobs/summary?startTime=${startTime}&endTime=${endTime}`
            }),
            getJobsSummaryTimelineData: builder.query({
                query: ({ credentialId, region, startTime, endTime }) =>
                    `credentials/${credentialId}/regions/${region}/jobs/summary/timeline?startTime=${startTime}&endTime=${endTime}`
            })
        };
    }
});

export const chatbotApi = createApi({
    reducerPath: 'chatbotApi',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => {
        return {
            sendMsg: builder.mutation({
                query: ({ payload }) => ({
                    url: `chatbot/prompt`,
                    method: 'POST',
                    body: payload
                })
            })
        };
    }
});

export const headersApi = createApi({
    reducerPath: 'headersApi',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => {
        return {
            getHeadersCredentials: builder.query({
                query: ({ credentialsType }) => ({ url: `credentials/${credentialsType}` })
            }),
            getHeadersRegions: builder.query({
                query: ({ credentialId }) => ({ url: `credentials/${credentialId}/fsx/regions` })
            }),
            getStatus: builder.query({
                query: () => `status`
            })
        };
    }
});

export const policiesApi = createApi({
    reducerPath: 'policiesApi',
    baseQuery: fetchBaseQuery({
        baseUrl: process.env.REACT_APP_ENVIRONMENT === PRODUCTION ? WLMDB_POLICIES_PROD_LINK : WLMDB_POLICIES_STAGE_LINK
    }),
    endpoints: builder => {
        return {
            getWlmdbPolicies: builder.query({
                query: () => ({ url: `/wlmdb/workload-policies.json` })
            })
        };
    }
});

export const createUserDbApi = createApi({
    reducerPath: 'createUserDbApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => {
        return {
            getDriveInfo: builder.query({
                query: ({ credentialId, region, id }) => ({
                    url: `credentials/${credentialId}/regions/${region}/database-hosts/${id}/drive-information`
                })
            }),
            createUserDB: builder.mutation({
                query: ({ credentialId, region, id, payload }) => ({
                    url: `credentials/${credentialId}/regions/${region}/database-hosts/${id}/database`,
                    method: 'POST',
                    body: payload
                })
            }),
            getCollationList: builder.query({
                query: ({ credentialId, region, id }) => ({
                    url: `credentials/${credentialId}/regions/${region}/database-hosts/${id}/collation`
                })
            })
        };
    }
});

export const inventoryApi = createApi({
    reducerPath: 'inventoryApi',
    baseQuery: dynamicBaseQuery,
    refetchOnMountOrArgChange: true,
    endpoints: builder => {
        return {
            discoverHosts: builder.query({
                query: ({ regionId, credentialsId, nextToken = null }) => {
                    if (nextToken) {
                        return `credentials/${credentialsId}/regions/${regionId}/mssql/discover?pageSize=10&nextToken=${nextToken}`;
                    } else {
                        return `credentials/${credentialsId}/regions/${regionId}/mssql/discover?pageSize=10`;
                    }
                },
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
                    url: `credentials/${credentialsId}/regions/${regionId}/resources/file-systems/credentials-status?fsxids=${fsxIds}`
                })
            }),
            getHostsDetails: builder.query({
                query: ({ regionId, credentialsId }) => ({
                    url: `credentials/${credentialsId}/regions/${regionId}/discover/summary`
                })
            }),
            manageHost: builder.mutation({
                query: ({ credentialId, regionId, instanceId }) => ({
                    url: `credentials/${credentialId}/regions/${regionId}/manage/${instanceId}`,
                    method: 'GET'
                })
            }),
            registerResourceCredentials: builder.mutation({
                query: ({ credentialId, regionId, instanceId, payload }) => ({
                    url: `credentials/${credentialId}/regions/${regionId}/instances/${instanceId}/mssql/discover/resource-credentials`,
                    method: 'POST',
                    body: payload
                })
            }),
            getMssqlInstanceData: builder.mutation({
                query: ({ credentialId, regionId, payload, nextToken = null }) => ({
                    url: nextToken
                        ? `credentials/${credentialId}/regions/${regionId}/mssql/instances&nextToken=${nextToken}`
                        : `credentials/${credentialId}/regions/${regionId}/mssql/instances`,
                    method: 'POST',
                    body: payload
                })
            })
        };
    }
});

export const {
    useGetCredentialsQuery,
    useGetRegionsQuery,
    useGetVPCListQuery,
    useGetSGListQuery,
    useGetAdsListQuery,
    useGetAmiListQuery,
    useGetSnsTopicsQuery,
    useGetKmsKeysQuery,
    useGetKeyPairsQuery,
    useGetInstanceTypesQuery,
    useGetFsxnListQuery,
    useCreateSqlTemplateMutation,
    useDeploySqlTemplateMutation,
    useGetEstimationCostMutation
} = awsApi;

export const {
    useRemoveMSSQLMutation,
    useGetMSSQLDatabasesQuery,
    useGetMSSQLSummaryQuery,
    useGetMSSQLCpuUtilizationQuery,
    useGetMSSQLDiskUtilizationQuery,
    useGetMSSQLMemoryUtilizationQuery,
    useBatchTablesMutation
} = resourceApi;

export const {
    useGetConfigListQuery,
    useLazyGetConfigDataQuery,
    useSaveConfigDataMutation,
    useDeleteConfigMutation,
    useUpdateConfigMutation
} = configApi;

export const { useGetDatabaseHostsQuery, useGetJobsSummaryQuery, useGetTemplatesMutation } = databaseHomeApi;

export const { useGetResourceDetailsQuery, useGetDatabaseListQuery } = workloadFactoryResourceApi;

export const {
    useGetJobsListQuery,
    useGetFullJobsListQuery,
    useLazyGetSubTaskListQuery,
    useGetJobsSummaryDataQuery,
    useGetJobsSummaryTimelineDataQuery
} = jobMonitoringApi;

export const { useSendMsgMutation } = chatbotApi;

export const { useGetHeadersCredentialsQuery, useGetHeadersRegionsQuery, useGetStatusQuery } = headersApi;

export const { useGetWlmdbPoliciesQuery } = policiesApi;

export const { useGetDriveInfoQuery, useCreateUserDBMutation, useGetCollationListQuery } = createUserDbApi;

export const {
    useDiscoverHostsQuery,
    useGetFsxCredentialStatusQuery,
    useGetHostsDetailsQuery,
    useManageHostMutation,
    useRegisterResourceCredentialsMutation,
    useGetMssqlInstanceDataMutation
} = inventoryApi;
