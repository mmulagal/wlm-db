import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgreApis from './PostgreApis';

// ─── API Service mocks ───────────────────────────────────────────────────────

const mockGetWlmdbPoliciesQuery = vi.fn();
const mockGetThroughputRegionListQuery = vi.fn();
const mockGetCredentialsQuery = vi.fn();
const mockGetRegionsQuery = vi.fn();
const mockGetVPCListQuery = vi.fn();
const mockGetSGListQuery = vi.fn();
const mockGetSnsTopicsQuery = vi.fn();
const mockGetKmsKeysQuery = vi.fn();
const mockGetKeyPairsQuery = vi.fn();
const mockGetInstanceTypesQuery = vi.fn();
const mockGetFsxnListQuery = vi.fn();
const mockGetConfigListQuery = vi.fn();

vi.mock('../../../utils/apiService', () => ({
    useGetWlmdbPoliciesQuery: (...args: any[]) => mockGetWlmdbPoliciesQuery(...args),
    useGetThroughputRegionListQuery: (...args: any[]) => mockGetThroughputRegionListQuery(...args),
    useGetCredentialsQuery: (...args: any[]) => mockGetCredentialsQuery(...args),
    useGetRegionsQuery: (...args: any[]) => mockGetRegionsQuery(...args),
    useGetVPCListQuery: (...args: any[]) => mockGetVPCListQuery(...args),
    useGetSGListQuery: (...args: any[]) => mockGetSGListQuery(...args),
    useGetSnsTopicsQuery: (...args: any[]) => mockGetSnsTopicsQuery(...args),
    useGetKmsKeysQuery: (...args: any[]) => mockGetKmsKeysQuery(...args),
    useGetKeyPairsQuery: (...args: any[]) => mockGetKeyPairsQuery(...args),
    useGetInstanceTypesQuery: (...args: any[]) => mockGetInstanceTypesQuery(...args),
    useGetFsxnListQuery: (...args: any[]) => mockGetFsxnListQuery(...args),
    useGetConfigListQuery: (...args: any[]) => mockGetConfigListQuery(...args)
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatKmsData: (data: any) => data || []
}));

vi.mock('../../../utils/consts', () => ({
    AWS_ASSUME_ROLE: 'AssumeRole',
    VPC_API_FIELDS: 'id,cidrBlock',
    API_NAME: {
        REGION: 'region',
        VPC: 'vpc',
        SG: 'sg',
        SNS: 'sns',
        KMS: 'kms',
        KEYPAIR: 'keypair',
        INSTANCE: 'instance',
        FSXN: 'fsxn'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    SELECT_CONFIG: { EASY_CREATE: 'Quick create' }
}));

vi.mock('../../../store/mssql/mssqlSlice', () => ({
    addCredentials: (val: any) => ({ type: 'mssql/addCredentials', payload: val }),
    addFsxnList: (val: any) => ({ type: 'mssql/addFsxnList', payload: val }),
    addInstanceTypeList: (val: any) => ({ type: 'mssql/addInstanceTypeList', payload: val }),
    addKeyPairList: (val: any) => ({ type: 'mssql/addKeyPairList', payload: val }),
    addKmsKeysList: (val: any) => ({ type: 'mssql/addKmsKeysList', payload: val }),
    addPolicies: (val: any) => ({ type: 'mssql/addPolicies', payload: val }),
    addRegions: (val: any) => ({ type: 'mssql/addRegions', payload: val }),
    addSavedConfigList: (val: any) => ({ type: 'mssql/addSavedConfigList', payload: val }),
    addSGList: (val: any) => ({ type: 'mssql/addSGList', payload: val }),
    addSnsList: (val: any) => ({ type: 'mssql/addSnsList', payload: val }),
    addVpcList: (val: any) => ({ type: 'mssql/addVpcList', payload: val }),
    getThroughputRegionList: (val: any) => ({ type: 'mssql/getThroughputRegionList', payload: val })
}));

vi.mock('../../../store/mssql/msSqlActionSlice', () => ({
    setRefetchApiCountRan: (val: any) => ({ type: 'msSqlAction/setRefetchApiCountRan', payload: val })
}));

vi.mock('../../CreateMsSql/MSSqlServer/MSSqlUtils', () => ({
    selectDefaultEncryption: vi.fn(),
    selectDefaultInstanceType: vi.fn()
}));

// ─── Store factory ───────────────────────────────────────────────────────────

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                awsAccount: { selectedCredential: overrides.selectedCredential ?? null },
                regionAndVpc: {
                    selectedRegion: overrides.selectedRegion ?? null,
                    selectedVPC: overrides.selectedVPC ?? null
                },
                operatingSystem: {},
                dbEdition: {},
                dbVersion: {},
                selectConfig: overrides.selectConfig ?? 'Standard create',
                ...(overrides.mssqlForm || {})
            }),
            msSqlAction: () => ({
                isLoadConfig: overrides.isLoadConfig ?? false,
                refetchApiCount: overrides.refetchApiCount ?? { isLoading: false, expected: [], ran: [] },
                ...(overrides.msSqlAction || {})
            })
        }
    });

const defaultApiReturn = { data: undefined, isFetching: false, isError: false };

const TestWrapper = ({ store }: any) => (
    <Provider store={store}>
        <PostgreApis />
    </Provider>
);

describe('PostgreApis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetWlmdbPoliciesQuery.mockReturnValue(defaultApiReturn);
        mockGetThroughputRegionListQuery.mockReturnValue(defaultApiReturn);
        mockGetCredentialsQuery.mockReturnValue(defaultApiReturn);
        mockGetRegionsQuery.mockReturnValue(defaultApiReturn);
        mockGetVPCListQuery.mockReturnValue(defaultApiReturn);
        mockGetSGListQuery.mockReturnValue(defaultApiReturn);
        mockGetSnsTopicsQuery.mockReturnValue(defaultApiReturn);
        mockGetKmsKeysQuery.mockReturnValue(defaultApiReturn);
        mockGetKeyPairsQuery.mockReturnValue(defaultApiReturn);
        mockGetInstanceTypesQuery.mockReturnValue(defaultApiReturn);
        mockGetFsxnListQuery.mockReturnValue(defaultApiReturn);
        mockGetConfigListQuery.mockReturnValue(defaultApiReturn);
    });

    describe('Rendering', () => {
        it('renders without crashing and returns null', () => {
            const store = makeStore();
            const { container } = render(<TestWrapper store={store} />);
            expect(container).toBeTruthy();
            expect(container.firstChild).toBeNull();
        });
    });

    describe('API skip logic — credential skip', () => {
        it('skips region/kms/etc queries when credentialId is null', () => {
            const store = makeStore({ selectedCredential: null });
            render(<TestWrapper store={store} />);
            expect(mockGetRegionsQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });

        it('does not skip region query when credentialId is set', () => {
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } }
            });
            render(<TestWrapper store={store} />);
            expect(mockGetRegionsQuery).toHaveBeenCalledWith(
                expect.objectContaining({ credentialId: 'cred-1' }),
                expect.objectContaining({ skip: false })
            );
        });
    });

    describe('API skip logic — cred+region skip', () => {
        it('skips vpc/kms/sns/etc when region is not set but cred is', () => {
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: null
            });
            render(<TestWrapper store={store} />);
            expect(mockGetVPCListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });

        it('does not skip vpc query when both cred and region are set', () => {
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            render(<TestWrapper store={store} />);
            expect(mockGetVPCListQuery).toHaveBeenCalledWith(
                expect.objectContaining({ credentialId: 'cred-1', region: 'us-east-1' }),
                expect.objectContaining({ skip: false })
            );
        });
    });

    describe('API skip logic — vpc-dependent skip', () => {
        it('skips fsxn/sg queries when vpcId is not set', () => {
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectedVPC: null
            });
            render(<TestWrapper store={store} />);
            expect(mockGetFsxnListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
            expect(mockGetSGListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });

        it('does not skip fsxn/sg when cred, region, and vpc are all set', () => {
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectedVPC: { data: { id: 'vpc-1' } }
            });
            render(<TestWrapper store={store} />);
            expect(mockGetFsxnListQuery).toHaveBeenCalledWith(
                expect.objectContaining({ credentialId: 'cred-1', region: 'us-east-1', vpcId: 'vpc-1' }),
                expect.objectContaining({ skip: false })
            );
        });
    });

    describe('State dispatches on data changes', () => {
        it('dispatches addPolicies when policies data changes', async () => {
            const mockData = [{ policyName: 'ReadOnly' }];
            mockGetWlmdbPoliciesQuery.mockReturnValue({ data: mockData, isFetching: false, isError: false });

            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addPolicies' }));
            });
        });

        it('dispatches getThroughputRegionList when throughput data changes', async () => {
            mockGetThroughputRegionListQuery.mockReturnValue({
                data: ['us-east-1', 'eu-west-1'],
                isFetching: false,
                isError: false
            });
            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'mssql/getThroughputRegionList' })
                );
            });
        });

        it('dispatches addCredentials when credential data changes', async () => {
            mockGetCredentialsQuery.mockReturnValue({
                data: [{ credentialsId: 'c1', name: 'MyAccount' }],
                isFetching: false,
                isError: false
            });
            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addCredentials' }));
            });
        });

        it('dispatches addRegions when regions data changes', async () => {
            mockGetRegionsQuery.mockReturnValue({
                data: [{ regionCode: 'us-east-1' }],
                isFetching: false,
                isError: false
            });
            const store = makeStore({ selectedCredential: { data: { credentialsId: 'cred-1' } } });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addRegions' }));
            });
        });

        it('dispatches addRegions with undefined when regionsError is set', async () => {
            mockGetRegionsQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({ selectedCredential: { data: { credentialsId: 'cred-1' } } });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addRegions' }));
            });
        });

        it('dispatches addVpcList when vpc data changes', async () => {
            mockGetVPCListQuery.mockReturnValue({
                data: [{ id: 'vpc-1' }],
                isFetching: false,
                isError: false
            });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addVpcList' }));
            });
        });

        it('dispatches addVpcList with undefined when vpcError is set', async () => {
            mockGetVPCListQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addVpcList' }));
            });
        });

        it('dispatches addSGList when sg data changes', async () => {
            mockGetSGListQuery.mockReturnValue({ data: [{ id: 'sg-1' }], isFetching: false, isError: false });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectedVPC: { data: { id: 'vpc-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addSGList' }));
            });
        });

        it('dispatches addSGList with undefined when sgError is set', async () => {
            mockGetSGListQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectedVPC: { data: { id: 'vpc-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addSGList' }));
            });
        });

        it('dispatches addSnsList when sns data changes', async () => {
            mockGetSnsTopicsQuery.mockReturnValue({
                data: [{ topicArn: 'arn:aws:sns:us-east-1:123:topic' }],
                isFetching: false,
                isError: false
            });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addSnsList' }));
            });
        });

        it('dispatches addSnsList with undefined when snsError is set', async () => {
            mockGetSnsTopicsQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addSnsList' }));
            });
        });

        it('dispatches addKmsKeysList when kms data changes', async () => {
            mockGetKmsKeysQuery.mockReturnValue({ data: [{ keyId: 'key-1' }], isFetching: false, isError: false });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addKmsKeysList' }));
            });
        });

        it('dispatches addKmsKeysList with undefined when kmsError is set', async () => {
            mockGetKmsKeysQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addKmsKeysList' }));
            });
        });

        it('dispatches addKeyPairList when keypair data changes', async () => {
            mockGetKeyPairsQuery.mockReturnValue({ data: [{ keyName: 'my-key' }], isFetching: false, isError: false });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addKeyPairList' }));
            });
        });

        it('dispatches addKeyPairList with undefined when keyPairError is set', async () => {
            mockGetKeyPairsQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addKeyPairList' }));
            });
        });

        it('dispatches addInstanceTypeList when instance types data changes', async () => {
            mockGetInstanceTypesQuery.mockReturnValue({
                data: [{ instanceType: 't3.medium' }],
                isFetching: false,
                isError: false
            });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'mssql/addInstanceTypeList' })
                );
            });
        });

        it('dispatches addInstanceTypeList with undefined when instanceTypeError is set', async () => {
            mockGetInstanceTypesQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'mssql/addInstanceTypeList' })
                );
            });
        });

        it('dispatches addFsxnList when fsxn data changes with valid vpc', async () => {
            mockGetFsxnListQuery.mockReturnValue({
                data: [{ fileSystemId: 'fs-1' }],
                isFetching: false,
                isError: false
            });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectedVPC: { data: { id: 'vpc-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addFsxnList' }));
            });
        });

        it('dispatches addFsxnList with undefined when no VPC is set', async () => {
            const store = makeStore({ selectedVPC: null });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addFsxnList' }));
            });
        });

        it('dispatches addFsxnList with undefined when fsxnError is set', async () => {
            mockGetFsxnListQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectedVPC: { data: { id: 'vpc-1' } }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addFsxnList' }));
            });
        });

        it('dispatches addSavedConfigList when config data changes', async () => {
            mockGetConfigListQuery.mockReturnValue({
                data: [{ configId: 'cfg-1' }],
                isFetching: false,
                isError: false
            });
            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addSavedConfigList' }));
            });
        });

        it('dispatches addSavedConfigList with undefined when configError is set', async () => {
            mockGetConfigListQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mssql/addSavedConfigList' }));
            });
        });
    });

    describe('refetchApiCount behavior', () => {
        it('dispatches setRefetchApiCountRan for region when refetch conditions are met', async () => {
            mockGetRegionsQuery.mockReturnValue({
                data: [{ regionCode: 'us-east-1' }],
                isFetching: false,
                isError: false
            });

            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                isLoadConfig: true,
                refetchApiCount: { isLoading: true, expected: ['region'], ran: [] }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'msSqlAction/setRefetchApiCountRan', payload: 'region' })
                );
            });
        });
    });

    describe('Easy create — selectDefaultEncryption and selectDefaultInstanceType', () => {
        it('calls selectDefaultEncryption when kms data arrives and selectConfig is Easy create', async () => {
            const { selectDefaultEncryption } = await import('../../CreateMsSql/MSSqlServer/MSSqlUtils');
            mockGetKmsKeysQuery.mockReturnValue({ data: [{ keyId: 'key-1' }], isFetching: false, isError: false });

            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectConfig: 'Quick create'
            });

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(selectDefaultEncryption).toHaveBeenCalled();
            });
        });

        it('calls selectDefaultInstanceType when instance type data arrives and selectConfig is Easy create', async () => {
            const { selectDefaultInstanceType } = await import('../../CreateMsSql/MSSqlServer/MSSqlUtils');
            mockGetInstanceTypesQuery.mockReturnValue({
                data: [{ instanceType: 't3.medium' }],
                isFetching: false,
                isError: false
            });

            const store = makeStore({
                selectedCredential: { data: { credentialsId: 'cred-1' } },
                selectedRegion: { data: { regionCode: 'us-east-1' } },
                selectConfig: 'Quick create'
            });

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(selectDefaultInstanceType).toHaveBeenCalled();
            });
        });
    });
});
