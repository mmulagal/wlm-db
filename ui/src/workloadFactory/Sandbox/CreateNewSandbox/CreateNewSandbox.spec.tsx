import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CreateNewSandbox from './CreateNewSandbox';

// Mock child components
vi.mock('./CreateNewSandboxHeader/CreateNewSandboxHeader', () => ({
    default: () => <div data-testid="create-new-sandbox-header" />
}));

vi.mock('./CreateNewSandboxFooter/CreateNewSandboxFooter', () => ({
    default: () => <div data-testid="create-new-sandbox-footer" />
}));

vi.mock('./CreateNewSandboxContent/CreateNewSandboxContent', () => ({
    default: () => <div data-testid="create-new-sandbox-content" />
}));

vi.mock('./CreateNewSandboxCodebox/CreateNewSandboxCodebox', () => ({
    default: () => <div data-testid="create-new-sandbox-codebox" />
}));

vi.mock('./CreateNewSandboxContent/CreateNewSandboxApis', () => ({
    default: vi.fn(() => null)
}));

vi.mock('@netapp/design-system', () => ({
    Spinner: ({ isLarge }: any) => <div data-testid="spinner" data-large={isLarge} />,
    StepLayout: ({ children, className }: any) => <div className={className}>{children}</div>,
    WizardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
    WizardFooter: ({ children }: any) => <div>{children}</div>
}));

vi.mock('./CreateNewSandbox.module.scss', () => ({
    default: {
        createNewSandbox: 'createNewSandbox',
        loaderOverlay: 'loaderOverlay',
        spinnerPlacement: 'spinnerPlacement',
        leftSide: 'leftSide',
        rightSide: 'rightSide',
        header: 'header',
        content: 'content'
    }
}));

vi.mock('../../../store/workloadFactory/createSandboxSlice', () => ({
    setShowError: vi.fn((val: boolean) => ({ type: 'createSandbox/setShowError', payload: val })),
    setSourceDatabase: vi.fn((val: any) => ({ type: 'createSandbox/setSourceDatabase', payload: val })),
    setSourceDbHost: vi.fn((val: any) => ({ type: 'createSandbox/setSourceDbHost', payload: val })),
    setTargetDatabase: vi.fn((val: any) => ({ type: 'createSandbox/setTargetDatabase', payload: val }))
}));

const createMockStore = (isLoading = false) =>
    configureStore({
        reducer: {
            msSqlAction: () => ({ isLoading }),
            createSandbox: () => ({
                source: {},
                target: {},
                getDatabaseHosts: {},
                getDatabaseList: {},
                getDriveInfo: {},
                getDbMountPoints: {}
            })
        }
    });

describe('CreateNewSandbox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the main layout with left and right sides', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewSandbox />
            </Provider>
        );

        expect(screen.getByTestId('create-new-sandbox-header')).toBeTruthy();
        expect(screen.getByTestId('create-new-sandbox-content')).toBeTruthy();
        expect(screen.getByTestId('create-new-sandbox-footer')).toBeTruthy();
        expect(screen.getByTestId('create-new-sandbox-codebox')).toBeTruthy();
    });

    it('should NOT show spinner overlay when loading is false', () => {
        const store = createMockStore(false);
        render(
            <Provider store={store}>
                <CreateNewSandbox />
            </Provider>
        );

        expect(screen.queryByTestId('spinner')).toBeNull();
    });

    it('should show spinner overlay when loading is true', () => {
        const store = createMockStore(true);
        render(
            <Provider store={store}>
                <CreateNewSandbox />
            </Provider>
        );

        expect(screen.getByTestId('spinner')).toBeTruthy();
        const spinner = screen.getByTestId('spinner');
        expect(spinner.getAttribute('data-large')).toBe('true');
    });

    it('should call CreateSandboxApis hook on render', async () => {
        const CreateSandboxApis = (await import('./CreateNewSandboxContent/CreateNewSandboxApis')).default;
        const store = createMockStore();

        render(
            <Provider store={store}>
                <CreateNewSandbox />
            </Provider>
        );

        expect(CreateSandboxApis).toHaveBeenCalled();
    });

    it('should dispatch initial actions on mount', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <CreateNewSandbox />
            </Provider>
        );

        // setTargetDatabase, setSourceDatabase, setSourceDbHost, setShowError
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setTargetDatabase') })
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setSourceDatabase') })
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setSourceDbHost') })
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setShowError') })
        );
    });
});
