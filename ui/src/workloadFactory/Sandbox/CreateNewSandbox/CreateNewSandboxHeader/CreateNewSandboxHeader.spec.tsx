import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CreateNewSandboxHeader from './CreateNewSandboxHeader';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('@netapp/design-system', () => ({
    Header: ({ closeButtonProps, title }: any) => (
        <div data-testid="header">
            <div data-testid="header-title">{title}</div>
            <button data-testid="close-button" onClick={closeButtonProps?.onClick}>
                Close
            </button>
        </div>
    )
}));

vi.mock('./CreateNewSandboxHeader.module.scss', () => ({
    default: {
        sandboxHeader: 'sandboxHeader',
        leftSideStyle: 'leftSideStyle'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        CREATE_NEW_SANDBOX: 'Create New Sandbox'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES: '/bluexp/sandboxes',
    FORM_TO_WLF_NAVIGATE_SANDBOXES: '/sandboxes'
}));

vi.mock('../../../../store/authSlice', () => ({
    updateRefreshBlocked: vi.fn((val: boolean) => ({ type: 'auth/updateRefreshBlocked', payload: val }))
}));

vi.mock('../../../../store/workloadFactory/createSandboxSlice', () => ({
    resetSourceAndTarget: vi.fn(() => ({ type: 'createSandbox/resetSourceAndTarget' }))
}));

const createMockStore = (isWorkloadFactory = false) =>
    configureStore({
        reducer: {
            auth: () => ({ isWorkloadFactory })
        }
    });

describe('CreateNewSandboxHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the header with title', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewSandboxHeader />
            </Provider>
        );

        expect(screen.getByTestId('header')).toBeTruthy();
        expect(screen.getByText('Create New Sandbox')).toBeTruthy();
    });

    it('should render the close button', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewSandboxHeader />
            </Provider>
        );

        expect(screen.getByTestId('close-button')).toBeTruthy();
    });

    describe('when isWorkloadFactory is false (BlueXP mode)', () => {
        it('should navigate to BlueXP sandboxes path on close', () => {
            const store = createMockStore(false);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxHeader />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('close-button'));

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('updateRefreshBlocked') })
            );
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('resetSourceAndTarget') })
            );
            expect(mockNavigate).toHaveBeenCalledWith('/bluexp/sandboxes');
        });
    });

    describe('when isWorkloadFactory is true', () => {
        it('should navigate to WLF sandboxes path on close', () => {
            const store = createMockStore(true);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxHeader />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('close-button'));

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('updateRefreshBlocked') })
            );
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('resetSourceAndTarget') })
            );
            expect(mockNavigate).toHaveBeenCalledWith('/sandboxes');
        });
    });

    it('should dispatch updateRefreshBlocked(true) on close', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <CreateNewSandboxHeader />
            </Provider>
        );

        fireEvent.click(screen.getByTestId('close-button'));

        const calls = dispatchSpy.mock.calls.map((c: any) => c[0]);
        const refreshBlockedCall = calls.find((c: any) => c.type?.includes('updateRefreshBlocked'));
        expect(refreshBlockedCall?.payload).toBe(true);
    });
});
