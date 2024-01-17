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
import { API_MAX_RETRIES } from './consts';
import { DatabaseTables, BatchEntry } from './types/resourceTypes';
import { setResourceTables } from '../store/resource/resourceSlice';
import { generateRandomDBName, sortListOfDict } from './utilityFunctions';
import JobMonitoringFullJobs from '../../src/workloadFactory/JobMonitoring/jobMonitoringDownload.json';
import JobMonitoringJobs from '../../src/workloadFactory/JobMonitoring/jobMonitoringJobs.json';
import JobMonitoringSubTask from '../../src/workloadFactory/JobMonitoring/JobMonitoringSubTask.json';

//Place the relevant headers on all requests:
const prepareHeaders = (
    headers: Headers,
    api: Pick<BaseQueryApi, 'type' | 'getState' | 'extra' | 'endpoint' | 'forced'>
): Headers => {
    const { getState } = api;
    const { accessToken, workspaceId, isDemoMode, isWorkloadFactory } = (getState() as RootState).auth;
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
                query: ({ credentialId, payload }) => ({
                    url: `credentials/${credentialId}/pricing`,
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
    endpoints: builder => {
        return {
            getDatabaseHosts: builder.query({
                query: ({ nextToken = null }) => {
                    if (nextToken) {
                        return `database-hosts?fields=performance,storage,protection,usageEstimation&nextToken=${nextToken}`;
                    } else {
                        return `database-hosts?fields=performance,storage,protection,usageEstimation`;
                    }
                }
            }),
            getDatabaseJobs: builder.query({
                query: ({ nextToken = null }) => {
                    if (nextToken) {
                        return `deployments?statuses=CREATE_IN_PROGRESS,UPDATE_IN_PROGRESS&nextToken=${nextToken}`;
                    } else {
                        return `deployments?statuses=CREATE_IN_PROGRESS,UPDATE_IN_PROGRESS`;
                    }
                }
            }),
            // getJobsSummary: builder.query({
            //     query: ({startTime, endTime}) => `jobs/summary?startTime=${startTime}&endTime=${endTime}`
            // }),
            getJobsSummary: builder.query({
                query: () => `jobs/summary`
            }),
            getTemplates: builder.mutation({
                query: ({ payload }) => ({
                    url: `cloudformation/template`,
                    method: 'POST',
                    body: payload
                })
            }),
            getStatus: builder.query({
                query: () => `status`
            }),
            removeDatabaseJobs: builder.mutation({
                async queryFn(id, queryApi: BaseQueryApi, extraOptions: any, baseQuery: any) {
                    return await handleRemoveWE(`jobs/jobId/${id}`, baseQuery, queryApi);
                }
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
                query: id => ({
                    url: `database-hosts/${id}?fields=storage,performance,usageEstimation,resourceUtilization`
                })
            }),
            getDatabaseList: builder.query({
                query: id => ({
                    url: `database-hosts/${id}/databases`
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
            // // getJobsList will just include first level jobs list info
            // getJobsList: builder.query({
            //     query: ({ nextToken = null, startTime, endTime }) => {
            //         let url = `jobs?startTime=${startTime}&endTime=${endTime}`;
            //         if (nextToken) {
            //             url +=`&nextToken=${nextToken}`;
            //         }
            //         return url;
            //     }
            // }),
            // // getFullJobsList will include subtasks and task level data also
            // getFullJobsList: builder.query({
            //     query: ({ nextToken = null, startTime, endTime, includeSubJobs = false, type = null, status = null }) => {
            //         let url = `jobs?startTime=${startTime}&endTime=${endTime}`;
            //         if (nextToken) {
            //             url +=`&nextToken=${nextToken}`;
            //         }
            //         if (includeSubJobs) {
            //             url +=`&includeSubJobs=${includeSubJobs}`;
            //         }
            //         if (type) {
            //             url +=`&type=${type}`;
            //         }
            //         if (status) {
            //             url +=`&status=${status}`;
            //         }
            //         return url;
            //     }
            // }),
            // getSubTaskList: builder.query({
            //     query: id => ({
            //         url: `jobs/${id}`
            //     })
            // })
            // getJobsSummaryData: builder.query({
            //     query: ({startTime, endTime}) => `jobs/summary?startTime=${startTime}&endTime=${endTime}`
            // }),

            // Will uncomment and use above code once APIs will get available
            getJobsList: builder.query({
                async queryFn(arg, queryApi: BaseQueryApi, extraOptions: any, baseQuery: any) {
                    return { data: JobMonitoringJobs };
                }
            }),
            getFullJobsList: builder.query({
                async queryFn(arg, queryApi: BaseQueryApi, extraOptions: any, baseQuery: any) {
                    return { data: JobMonitoringFullJobs };
                }
            }),
            getSubTaskList: builder.query({
                async queryFn(arg, queryApi: BaseQueryApi, extraOptions: any, baseQuery: any) {
                    return { data: JobMonitoringSubTask };
                }
            }),
            getJobsSummaryData: builder.query({
                async queryFn(arg, queryApi: BaseQueryApi, extraOptions: any, baseQuery: any) {
                    return { data: {'inProgress': 2,'completed': 3,'failed': 1} };
                }
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

export const {
    useGetCredentialsQuery,
    useGetRegionsQuery,
    useGetVPCListQuery,
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

export const {
    useGetDatabaseHostsQuery,
    useGetDatabaseJobsQuery,
    useGetJobsSummaryQuery,
    useGetTemplatesMutation,
    useGetStatusQuery,
    useRemoveDatabaseJobsMutation
} = databaseHomeApi;

export const { useGetResourceDetailsQuery, useGetDatabaseListQuery } = workloadFactoryResourceApi;

export const { useGetJobsListQuery, useGetFullJobsListQuery, useGetSubTaskListQuery, useGetJobsSummaryDataQuery } = jobMonitoringApi;

export const { useSendMsgMutation } = chatbotApi;
