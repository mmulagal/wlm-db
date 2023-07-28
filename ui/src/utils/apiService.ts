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
    return `${process.env.REACT_APP_API_URL}/accounts/${accountId}/api/v1`;
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
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/vpcs`})
            }),
            getAdsList: builder.query({
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/ads`})
            }),
            getAmiList: builder.query({
                query: ({credentialId, region}) => ({url: `credentials/${credentialId}/regions/${region}/amis`})
            }),
        }
    }
});

export const { useGetCredentialsQuery, useGetRegionsQuery, useGetVPCListQuery, 
    useGetAdsListQuery, useGetAmiListQuery } = awsApi;
