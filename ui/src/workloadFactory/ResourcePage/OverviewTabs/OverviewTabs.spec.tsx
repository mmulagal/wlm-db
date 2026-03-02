import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import OverviewTabs from './OverviewTabs';

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className, onClick }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} onClick={onClick}>
            {children}
        </span>
    )
}));

vi.mock('./OverviewTabs.module.scss', () => ({
    default: {
        overviewTabs: 'overviewTabs',
        headers: 'headers',
        active: 'active',
        headerPart1: 'headerPart1',
        headerPart2: 'headerPart2',
        activeText: 'activeText'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        OVERVIEW: 'Overview',
        DATABASES: 'Databases'
    }
}));

vi.mock('../../../utils/consts', () => ({
    WLF_TABS: {
        OVERVIEW: 'overview',
        DATABASE_LIST: 'database_list'
    }
}));

vi.mock('../../../store/workloadFactory/databaseHomeSlice', () => ({
    selectedTabSelection: vi.fn((value: string) => ({ type: 'selectedTabSelection', payload: value }))
}));

const createMockStore = (selectedTab: string = 'overview') =>
    configureStore({
        reducer: {
            databaseHome: () => ({ selectedTab })
        }
    });

describe('OverviewTabs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render Overview tab', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        expect(screen.getByText('Overview')).toBeTruthy();
    });

    it('should render Databases tab', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        expect(screen.getByText('Databases')).toBeTruthy();
    });

    it('should apply active class to Overview tab when selectedTab is overview', () => {
        const store = createMockStore('overview');
        const { container } = render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        const activeHeaders = container.querySelectorAll('.active');
        expect(activeHeaders.length).toBe(1);
    });

    it('should apply active class to Databases tab when selectedTab is database_list', () => {
        const store = createMockStore('database_list');
        const { container } = render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        const activeHeaders = container.querySelectorAll('.active');
        expect(activeHeaders.length).toBe(1);
    });

    it('should apply activeText class to Overview when it is the active tab', () => {
        const store = createMockStore('overview');
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        const overviewText = screen.getByText('Overview');
        expect(overviewText.className).toContain('activeText');
    });

    it('should NOT apply activeText class to Overview when Databases tab is active', () => {
        const store = createMockStore('database_list');
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        const overviewText = screen.getByText('Overview');
        expect(overviewText.className).not.toContain('activeText');
    });

    it('should dispatch selectedTabSelection when Overview is clicked', () => {
        const store = createMockStore('database_list');
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        fireEvent.click(screen.getByText('Overview'));
        expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should dispatch selectedTabSelection when Databases is clicked', () => {
        const store = createMockStore('overview');
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        fireEvent.click(screen.getByText('Databases'));
        expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should update active tab when Overview is clicked', () => {
        const store = createMockStore('database_list');
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        fireEvent.click(screen.getByText('Overview'));
        // The component uses local state too, so after click activeText should be on Overview
        const overviewText = screen.getByText('Overview');
        expect(overviewText.className).toContain('activeText');
    });

    it('should update active tab when Databases is clicked', () => {
        const store = createMockStore('overview');
        render(
            <Provider store={store}>
                <OverviewTabs />
            </Provider>
        );
        fireEvent.click(screen.getByText('Databases'));
        const databasesText = screen.getByText('Databases');
        expect(databasesText.className).toContain('activeText');
    });
});
