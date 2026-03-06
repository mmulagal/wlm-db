import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import NoCredBanner from '../NoCredBanner';

const mockNavigate = vi.fn();
const mockPostBlueXPMessage = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('@netapp/design-system', () => ({
    BlueXPListeners: { navigate: 'navigate' },
    Button: ({ children, onClick, className, variant }: any) => (
        <button data-testid={`button-${variant}`} className={className} onClick={onClick}>{children}</button>
    ),
    postBlueXPMessage: (...args: any[]) => mockPostBlueXPMessage(...args)
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, type }: any) => (
        <button data-testid={`ds-button-${type}`} onClick={onClick}>{children}</button>
    ),
    DsTypography: ({ children, variant }: any) => (
        <span data-testid={`ds-typography-${variant}`}>{children}</span>
    )
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('../../../../../assets/warning.svg', () => ({
    ReactComponent: () => <svg data-testid="warning-icon" />
}));

vi.mock('../../../../../assets/close-icon.svg', () => ({
    ReactComponent: () => <svg data-testid="close-icon" />
}));

vi.mock('../NoCredBanner.module.scss', () => ({ default: {} }));

const makeStore = (isWorkloadFactory = false) =>
    configureStore({
        reducer: {
            auth: (state = { isWorkloadFactory }) => state
        }
    });

const renderComponent = (isWorkloadFactory = false, width?: any) =>
    render(
        <Provider store={makeStore(isWorkloadFactory)}>
            <NoCredBanner width={width} />
        </Provider>
    );

describe('NoCredBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders warning icon', () => {
        renderComponent();
        expect(screen.getByTestId('warning-icon')).toBeDefined();
    });

    it('renders no-credentials text', () => {
        renderComponent();
        expect(screen.getByText('databases.dashboard.no-credentials')).toBeDefined();
    });

    it('renders add-credentials button', () => {
        renderComponent();
        expect(screen.getByText('databases.dashboard.add-credentials')).toBeDefined();
    });

    it('renders learn-more button', () => {
        renderComponent();
        expect(screen.getByText('databases.dashboard.learn-more')).toBeDefined();
    });

    it('hides banner when close button is clicked', () => {
        renderComponent();
        const closeIcon = screen.getByTestId('close-icon').closest('div')!;
        fireEvent.click(closeIcon);
        expect(screen.queryByTestId('warning-icon')).toBeNull();
    });

    it('navigates to fsxadministration/credentials when not isWorkloadFactory', () => {
        renderComponent(false);
        fireEvent.click(screen.getByText('databases.dashboard.add-credentials'));
        expect(mockNavigate).toHaveBeenCalledWith('../../fsxadministration/credentials');
        expect(mockPostBlueXPMessage).toHaveBeenCalledWith({
            type: 'navigate',
            payload: { pathname: '../../fsxadministration/credentials', replace: true }
        });
    });

    it('navigates to administration/credentials when isWorkloadFactory is true', () => {
        renderComponent(true);
        fireEvent.click(screen.getByText('databases.dashboard.add-credentials'));
        expect(mockNavigate).toHaveBeenCalledWith('../../administration/credentials');
        expect(mockPostBlueXPMessage).toHaveBeenCalledWith({
            type: 'navigate',
            payload: { pathname: '../../administration/credentials', replace: true }
        });
    });

    it('opens learn more URL in new tab', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        renderComponent();
        fireEvent.click(screen.getByText('databases.dashboard.learn-more'));
        expect(openSpy).toHaveBeenCalledWith(
            'https://docs.netapp.com/us-en/workload-setup-admin/permissions-reference.html#why-use-permissions',
            '_blank',
            'noopener,noreferrer'
        );
        openSpy.mockRestore();
    });

    it('returns null when banner is closed', () => {
        const { container } = renderComponent();
        const closeIcon = screen.getByTestId('close-icon').closest('div')!;
        fireEvent.click(closeIcon);
        expect(container.firstChild).toBeNull();
    });
});
