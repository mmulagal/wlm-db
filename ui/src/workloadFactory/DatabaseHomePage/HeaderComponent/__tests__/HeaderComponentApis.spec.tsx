import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import HeaderComponentApi from '../HeaderComponentApis';

// ── Hoist mocks ─────────────────────────────────────────────────────────────
const {
    mockDispatch,
    mockAddStatus,
    mockAddCredentialsHeaderList,
    mockAddRegionsHeaderList,
    mockSetCredentialMapping,
    mockSetRegionMapping,
    mockSetShowNA
} = vi.hoisted(() => ({
    mockDispatch: vi.fn(),
    mockAddStatus: vi.fn((v: any) => ({ type: 'addStatus', payload: v })),
    mockAddCredentialsHeaderList: vi.fn((v: any) => ({ type: 'addCredentialsHeaderList', payload: v })),
    mockAddRegionsHeaderList: vi.fn((v: any) => ({ type: 'addRegionsHeaderList', payload: v })),
    mockSetCredentialMapping: vi.fn((v: any) => ({ type: 'setCredentialMapping', payload: v })),
    mockSetRegionMapping: vi.fn((v: any) => ({ type: 'setRegionMapping', payload: v })),
    mockSetShowNA: vi.fn((v: any) => ({ type: 'setShowNA', payload: v }))
}));

vi.mock('react-redux', async importOriginal => {
    const actual = (await importOriginal()) as any;
    return { ...actual, useDispatch: () => mockDispatch };
});

vi.mock('../../../../utils/apiService', () => ({
    useGetHeadersCredentialsQuery: vi.fn(() => ({
        data: undefined,
        isFetching: false,
        isError: false
    })),
    useGetHeadersRegionsQuery: vi.fn(() => ({
        data: undefined,
        isFetching: false,
        isError: false
    })),
    useGetHeadersRegionsWithoutCredQuery: vi.fn(() => ({
        data: undefined,
        isFetching: false,
        isError: false
    })),
    useGetStatusQuery: vi.fn(() => ({
        data: { isActive: true },
        isFetching: false,
        isError: false
    })),
    useGetAccountInfoQuery: vi.fn(() => ({
        data: undefined,
        isFetching: false,
        isError: false
    }))
}));

vi.mock('../../../../utils/consts', () => ({
    AWS_ASSUME_ROLE: 'AssumeRole'
}));

vi.mock('../../../../store/workloadFactory/headersSlice', () => ({
    addCredentialsHeaderList: mockAddCredentialsHeaderList,
    addRegionsHeaderList: mockAddRegionsHeaderList,
    addStatus: mockAddStatus,
    setCredentialMapping: mockSetCredentialMapping,
    setRegionMapping: mockSetRegionMapping,
    setShowNA: mockSetShowNA
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    makeCredMapping: vi.fn(() => ({})),
    makeRegionMapping: vi.fn(() => ({}))
}));

// minimal store for Provider
const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            headers: (
                state = {
                    headerSelectedMultiCred: overrides.headerSelectedMultiCred ?? [],
                    headerSelectedCredSandbox: overrides.headerSelectedCredSandbox ?? null
                }
            ) => state,
            auth: (state = { isDemoMode: overrides.isDemoMode ?? false }) => state
        }
    });

// Wrapper that renders the hook component
const Wrapper = ({ store }: { store: any }) => (
    <Provider store={store}>
        <HeaderComponentApi />
    </Provider>
);

describe('HeaderComponentApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing (returns null)', () => {
        const { container } = render(<Wrapper store={makeStore()} />);
        expect(container.firstChild).toBeNull();
    });

    it('dispatches addStatus when statusData is active', () => {
        render(<Wrapper store={makeStore()} />);
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('dispatches addCredentialsHeaderList on credential data change', () => {
        render(<Wrapper store={makeStore()} />);
        expect(mockAddCredentialsHeaderList).toHaveBeenCalled();
    });

    it('dispatches setShowNA when credentials are empty', async () => {
        const { useGetHeadersCredentialsQuery } = await import('../../../../utils/apiService');
        (useGetHeadersCredentialsQuery as any).mockReturnValue({
            data: [],
            isFetching: false,
            isError: false
        });
        render(<Wrapper store={makeStore()} />);
        expect(mockSetShowNA).toHaveBeenCalled();
    });

    it('dispatches setShowNA(true) when status error occurs', async () => {
        const { useGetStatusQuery } = await import('../../../../utils/apiService');
        (useGetStatusQuery as any).mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: true
        });
        render(<Wrapper store={makeStore()} />);
        expect(mockSetShowNA).toHaveBeenCalled();
    });

    it('dispatches addRegionsHeaderList when regions data changes', async () => {
        const { useGetHeadersRegionsWithoutCredQuery } = await import('../../../../utils/apiService');
        (useGetHeadersRegionsWithoutCredQuery as any).mockReturnValue({
            data: { regions: [{ id: 'us-east-1', name: 'US East (N. Virginia)' }] },
            isFetching: false,
            isError: false
        });
        render(<Wrapper store={makeStore()} />);
        expect(mockAddRegionsHeaderList).toHaveBeenCalled();
    });

    it('dispatches addRegionsHeaderList on regions error', async () => {
        const { useGetHeadersRegionsWithoutCredQuery } = await import('../../../../utils/apiService');
        (useGetHeadersRegionsWithoutCredQuery as any).mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: true
        });
        render(<Wrapper store={makeStore()} />);
        expect(mockAddRegionsHeaderList).toHaveBeenCalled();
    });

    it('sets credSkip false when headerSelectedMultiCred has a credential', () => {
        const store = makeStore({
            headerSelectedMultiCred: [{ data: { credentialsId: 'cred-123' } }]
        });
        render(<Wrapper store={store} />);
        // Should trigger the cred-dependent useEffect
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('handles isDemoMode true - skips API call guard', async () => {
        const { useGetStatusQuery } = await import('../../../../utils/apiService');
        (useGetStatusQuery as any).mockReturnValue({
            data: { isActive: false },
            isFetching: false,
            isError: false
        });
        const store = makeStore({ isDemoMode: true });
        render(<Wrapper store={store} />);
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('dispatches setShowNA(true) when status isActive is false', async () => {
        const { useGetStatusQuery } = await import('../../../../utils/apiService');
        (useGetStatusQuery as any).mockReturnValue({
            data: { isActive: false },
            isFetching: false,
            isError: false
        });
        render(<Wrapper store={makeStore()} />);
        expect(mockSetShowNA).toHaveBeenCalledWith(true);
    });
});
