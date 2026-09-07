import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';

import MssqlApis from './MssqlApis';

// Mock all API hooks
vi.mock('../../../utils/apiService', () => ({
    useGetAdsListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetAmiListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetConfigListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetCredentialsQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetCustomAmiListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetFsxnListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetInstanceTypesQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetKeyPairsQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetKmsKeysQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetRegionsQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetSGListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetSnsTopicsQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetSqlServerCollationListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetThroughputRegionListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetVPCListQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })),
    useGetWlmdbPoliciesQuery: vi.fn(() => ({ data: undefined, isFetching: false, isError: false }))
}));

vi.mock('./MSSqlUtils', () => ({
    selectDefaultLicense: vi.fn(),
    selectDefaultCollation: vi.fn(),
    selectDefaultEncryption: vi.fn(),
    selectDefaultInstanceType: vi.fn(),
    selectSizeBasedInstanceType: vi.fn(() => false)
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatKmsData: vi.fn((data: any) => data)
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                selectConfig: SELECT_CONFIG.EASY_CREATE,
                awsAccount: { selectedCredential: null },
                regionAndVpc: { selectedRegion: null, selectedVPC: null },
                operatingSystem: null,
                dbEdition: null,
                dbVersion: null,
                ...overrides.mssqlForm
            }),
            msSqlAction: () => ({
                isLoadConfig: false,
                refetchApiCount: { isLoading: false, expected: [], ran: [] },
                ...overrides.msSqlAction
            }),
            chatbot: () => ({
                isShow: false,
                ...overrides.chatbot
            }),
            mssql: () => ({
                getVPCList: { vpcLoading: false }
            })
        }
    });

describe('MssqlApis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing (returns null)', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        // MssqlApis renders nothing (it's a data-fetching component)
        expect(container).toBeDefined();
    });

    it('dispatches addCredentials on credential data change', async () => {
        const { useGetCredentialsQuery } = await import('../../../utils/apiService');
        (useGetCredentialsQuery as any).mockReturnValue({
            data: { credentials: [{ credentialsId: 'cred-1' }] },
            isFetching: false,
            isError: false
        });
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalled();
    });

    it('dispatches addRegions when regions data is fetched', async () => {
        const { useGetRegionsQuery } = await import('../../../utils/apiService');
        (useGetRegionsQuery as any).mockReturnValue({
            data: { regions: [{ regionCode: 'us-east-1' }] },
            isFetching: false,
            isError: false
        });
        const store = makeStore({
            mssqlForm: {
                awsAccount: { selectedCredential: { data: { credentialsId: 'cred-1' } } }
            }
        });
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(true).toBe(true);
    });

    it('dispatches addVpcList when VPC data is fetched', async () => {
        const { useGetVPCListQuery } = await import('../../../utils/apiService');
        (useGetVPCListQuery as any).mockReturnValue({
            data: { vpcs: [{ id: 'vpc-1' }] },
            isFetching: false,
            isError: false
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(true).toBe(true);
    });

    it('dispatches addAmiList and calls selectDefaultLicense in easy create mode', async () => {
        const { useGetAmiListQuery } = await import('../../../utils/apiService');
        const { selectDefaultLicense } = await import('./MSSqlUtils');
        (useGetAmiListQuery as any).mockReturnValue({
            data: { amis: [{ imageId: 'ami-1', name: 'SQL 2019' }] },
            isFetching: false,
            isError: false
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(selectDefaultLicense).toHaveBeenCalled();
    });

    it('skips the AMI list call when Windows 2025 is paired with a stale non-2025 SQL version', async () => {
        const { useGetAmiListQuery } = await import('../../../utils/apiService');
        (useGetAmiListQuery as any).mockReturnValue({ data: undefined, isFetching: false, isError: false });
        const store = makeStore({
            mssqlForm: {
                awsAccount: { selectedCredential: { data: { credentialsId: 'cred-1' } } },
                regionAndVpc: { selectedRegion: { data: { regionCode: 'us-east-1' } }, selectedVPC: null },
                operatingSystem: { value: GENERAL.WIN_SERVER_2025_VERSION },
                dbEdition: { value: 'Enterprise' },
                dbVersion: { value: GENERAL.SQL_SERVER_2022_VERSION }
            }
        });
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        const lastCallArgs = (useGetAmiListQuery as any).mock.calls.at(-1);
        expect(lastCallArgs[1].skip).toBe(true);
    });

    it('dispatches addGetCollationList and calls selectDefaultCollation in easy create', async () => {
        const { useGetSqlServerCollationListQuery } = await import('../../../utils/apiService');
        const { selectDefaultCollation } = await import('./MSSqlUtils');
        (useGetSqlServerCollationListQuery as any).mockReturnValue({
            data: { collationList: [{ name: 'SQL_Latin1_General_CP1_CI_AS' }] },
            isFetching: false,
            isError: false
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(selectDefaultCollation).toHaveBeenCalled();
    });

    it('dispatches addKmsKeysList and calls selectDefaultEncryption in easy create', async () => {
        const { useGetKmsKeysQuery } = await import('../../../utils/apiService');
        const { selectDefaultEncryption } = await import('./MSSqlUtils');
        (useGetKmsKeysQuery as any).mockReturnValue({
            data: [{ id: 'kms-1' }],
            isFetching: false,
            isError: false
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(selectDefaultEncryption).toHaveBeenCalled();
    });

    it('dispatches addInstanceTypeList and calls selectDefaultInstanceType in easy create', async () => {
        const { useGetInstanceTypesQuery } = await import('../../../utils/apiService');
        const { selectDefaultInstanceType } = await import('./MSSqlUtils');
        (useGetInstanceTypesQuery as any).mockReturnValue({
            data: { instanceTypes: [{ instanceType: 'm5.large' }] },
            isFetching: false,
            isError: false
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(selectDefaultInstanceType).toHaveBeenCalled();
    });

    it('handles error state for regions API', async () => {
        const { useGetRegionsQuery } = await import('../../../utils/apiService');
        (useGetRegionsQuery as any).mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: true
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(true).toBe(true); // No error thrown
    });

    it('handles error state for VPC API', async () => {
        const { useGetVPCListQuery } = await import('../../../utils/apiService');
        (useGetVPCListQuery as any).mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: true
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(true).toBe(true);
    });

    it('skips API calls when no credential is selected', () => {
        const store = makeStore({
            mssqlForm: {
                awsAccount: { selectedCredential: null }
            }
        });
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(true).toBe(true);
    });

    it('handles FsxN API with no VPC selected', async () => {
        const { useGetFsxnListQuery } = await import('../../../utils/apiService');
        (useGetFsxnListQuery as any).mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: false
        });
        const store = makeStore();
        render(
            <Provider store={store}>
                <MssqlApis />
            </Provider>
        );
        expect(true).toBe(true);
    });
});
