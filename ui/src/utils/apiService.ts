import {BaseQueryFn, createApi, FetchArgs, fetchBaseQuery, FetchBaseQueryError} from '@reduxjs/toolkit/query/react';
import {BaseQueryApi} from '@reduxjs/toolkit/dist/query/baseQueryTypes';
import { RootState } from '../store/store';

//Place the relevant headers on all requests:
const prepareHeaders = (
    headers: Headers,
    api: Pick<BaseQueryApi, 'type' | 'getState' | 'extra' | 'endpoint' | 'forced'>
): Headers => {
    const {getState} = api;
    const {accessToken} = (getState() as RootState).auth;
    if (accessToken) {
        headers.set('authorization', accessToken);
    }
    return headers;
};

const rawBaseQuery = fetchBaseQuery({
    baseUrl: '',
    prepareHeaders
});

export const buildBaseUrl = (api: BaseQueryApi): string => {
    const {appContext} = api.getState() as RootState;
    const {accountId } = appContext;
    const isDevMode = process.env.REACT_APP_USE_CM_FORWARDER !== 'true';
    const apiHost = isDevMode ? process.env.REACT_APP_LOCAL_SERVER : process.env.REACT_APP_CM_URL;
    return `${apiHost}/wlmdb/accounts/${accountId}/api/v1`;
};

//Build the baseUrl based on the environment
const dynamicBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
    const baseUrl = buildBaseUrl(api);
    const url = typeof args === 'string' ? args : args.url;
    const adjustedUrl = `${baseUrl}/${url}`;
    const adjustedArgs =
        typeof args === 'string' ? adjustedUrl : {...args, url: adjustedUrl};
    // provide the amended url and other params to the raw base query
    return rawBaseQuery(adjustedArgs, api, extraOptions);
};

export const awsApi = createApi({
    reducerPath: 'aws',
    baseQuery: dynamicBaseQuery,
    endpoints: builder => {
        return {
            getCredentials: builder.query({
                query: ({credentialsType}) => ({url: `credentials/${credentialsType}`})
            }),
            getRegions: builder.query({
                query: ({credentialId}) => ({url: `credentials/${credentialId}/aws/fsx/regions`})
            }),
            getVPCList: builder.query({
                query: ({credentialId, region, fields}) => ({url: `credentials/${credentialId}/regions/${region}/vpcs?fields=${fields}`})
            }),
            getAdsList: builder.query({
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/ads`})
            }),
            getAmiList: builder.query({
                query: ({credentialId, region, osType, osVersion, databaseType, databaseEdition, databaseVersion}) => 
                ({url: `credentials/${credentialId}/regions/${region}/amis?osType=${osType}&osVersion=${osVersion}&databaseType=${databaseType}&databaseEdition=${databaseEdition}&databaseVersion=${databaseVersion}`})
            }),
            getSnsTopics: builder.query({
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/snsTopics`})
            }),
            getKmsKeys: builder.query({
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/kmsKeys`})
            }),
            getKeyPairs: builder.query({
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/keypairs`})
            }),
            getInstanceTypes: builder.query({
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/instanceTypes`})
            }),
            getFsxnList: builder.query({
                query: ({credentialId, region, vpcId}) => ({url: `credentials/${credentialId}/regions/${region}/vpcs/${vpcId}/fsxs`})
            })
        }
    }
});

export const { useGetCredentialsQuery, useGetRegionsQuery, useGetVPCListQuery, useGetAdsListQuery, 
    useGetAmiListQuery, useGetSnsTopicsQuery, useGetKmsKeysQuery, useGetKeyPairsQuery, useGetInstanceTypesQuery, 
    useGetFsxnListQuery } = awsApi;
