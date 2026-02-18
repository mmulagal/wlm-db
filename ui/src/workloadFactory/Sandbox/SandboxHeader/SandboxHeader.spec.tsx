import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxHeader from './SandboxHeader';

import useResize from '../../../common/hooks/useResize';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1700, height: 800 }))
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    createSandboxNavigation: vi.fn()
}));

vi.mock('../../../assets/Illustration.svg', () => ({
    ReactComponent: () => <svg data-testid="illustration" />
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, isThin }: any) => (
        <button data-testid={`button-${variant}`} onClick={onClick}>
            {children}
        </button>
    ),
    DsTypography: ({ children, variant }: any) => (
        <div data-testid="ds-typography" data-variant={variant}>
            {children}
        </div>
    )
}));

vi.mock('./SandboxHeader.module.scss', () => ({
    default: {
        sandboxHeader: 'sandboxHeader',
        sandboxHeaderLowerResolution: 'sandboxHeaderLowerResolution',
        imageHolder: 'imageHolder',
        contentHolder: 'contentHolder',
        buttonHolder: 'buttonHolder',
        secondLevel: 'secondLevel'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        SANDBOXES: 'Sandboxes',
        SANDBOX_HEADER_CONTENT: 'Header Content',
        CREATE_SANDBOX: 'Create Sandbox',
        DONT_SHOW_AGAIN: "Don't show again"
    }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        headers: {
            headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
            headerSelectedRegionSandbox: { label2: 'us-east-1' },
            ...overrides.headers
        },
        sandbox: {
            ...overrides.sandbox
        }
    };

    return configureStore({
        reducer: {
            headers: () => defaultState.headers,
            sandbox: () => ({
                showBanner: true,
                ...overrides.sandbox
            })
        }
    });
};

describe('SandboxHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Wide screen (width > 1658)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1700, height: 800 });
        });

        it('should render full header when width > 1658', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            expect(screen.getByText('Sandboxes')).toBeTruthy();
            expect(screen.getByText('Header Content')).toBeTruthy();
            expect(screen.getByText('Create Sandbox')).toBeTruthy();
            expect(screen.getByText("Don't show again")).toBeTruthy();
        });

        it('should call handleBanner when "Don\'t show again" is clicked', () => {
            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            fireEvent.click(screen.getByText("Don't show again"));

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setShowBanner') })
            );
        });

        it('should call createSandboxNavigation when Create Sandbox is clicked', async () => {
            const { createSandboxNavigation } = await import('../../../utils/utilityFunctions');
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create Sandbox'));
            expect(createSandboxNavigation).toHaveBeenCalledWith(mockNavigate);
        });
    });

    describe('Medium screen (1429 < width < 1658)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1500, height: 800 });
        });

        it('should render lower-resolution header when width is between 1429 and 1658', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            expect(screen.getByText('Sandboxes')).toBeTruthy();
            expect(screen.getByText('Create Sandbox')).toBeTruthy();
        });

        it("should call handleBanner on Don't show again click at medium resolution", () => {
            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            fireEvent.click(screen.getByText("Don't show again"));
            expect(dispatchSpy).toHaveBeenCalled();
        });
    });

    describe('Small screen (width <= 1428)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1200, height: 800 });
        });

        it('should render lower-resolution header when width <= 1428', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            expect(screen.getByText('Sandboxes')).toBeTruthy();
            expect(screen.getByText('Create Sandbox')).toBeTruthy();
        });

        it('should dispatch setSelectedSandboxHeaderValue when create is clicked', () => {
            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create Sandbox'));
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSelectedSandboxHeaderValue') })
            );
        });
    });

    describe('localStorage', () => {
        it('should set hideBanner in localStorage when handleBanner is called', () => {
            (useResize as any).mockReturnValue({ width: 1700, height: 800 });
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxHeader />
                </Provider>
            );

            fireEvent.click(screen.getByText("Don't show again"));
            expect(setItemSpy).toHaveBeenCalledWith('hideBanner', 'true');
        });
    });
});
