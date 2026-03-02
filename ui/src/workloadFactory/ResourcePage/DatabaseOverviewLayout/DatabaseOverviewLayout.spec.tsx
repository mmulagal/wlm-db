import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DatabaseOverviewLayout from './DatabaseOverviewLayout';

vi.mock('../../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) =>
        selector({
            workloadFactoryResource: {
                resourceLoading: false,
                resourceDetails: {}
            }
        })
    )
}));

vi.mock('../DBDistributionSection/DBDistributionSection', () => ({
    default: () => <div data-testid="db-distribution-section">DBDistributionSection</div>
}));

vi.mock('../InformationSection/InformationSection', () => ({
    default: () => <div data-testid="information-section">InformationSection</div>
}));

vi.mock('../StoragePerformance/StoragePerformance', () => ({
    default: () => <div data-testid="storage-performance">StoragePerformance</div>
}));

vi.mock('../StorageSavingResource/StorageSavingResource', () => ({
    default: () => <div data-testid="storage-saving-resource">StorageSavingResource</div>
}));

vi.mock('./DBOverviewProtection/DBOverviewProtection', () => ({
    default: () => <div data-testid="db-overview-protection">DBOverviewProtection</div>
}));

vi.mock('./Diagram/Diagram', () => ({
    default: () => <div data-testid="diagram">Diagram</div>
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    getAggrStorageSavings: vi.fn(() => ({ storageSavingsPercent: 50, storageSavings: 100, storageConsumes: 200 }))
}));

vi.mock('./DatabaseOverviewLayout.module.scss', () => ({
    default: {
        databaseOverview: 'databaseOverview',
        leftSidePart: 'leftSidePart',
        secondLevel: 'secondLevel',
        fourthLevelContainer: 'fourthLevelContainer',
        barContainer: 'barContainer',
        commonContainer: 'commonContainer',
        storagePerformanceContainer: 'storagePerformanceContainer',
        rightSidePart: 'rightSidePart'
    }
}));

const createMockStore = () =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                resourceLoading: false,
                resourceDetails: {}
            })
        }
    });

describe('DatabaseOverviewLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render DBOverviewProtection', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseOverviewLayout />
            </Provider>
        );
        expect(screen.getByTestId('db-overview-protection')).toBeTruthy();
    });

    it('should render DBDistributionSection', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseOverviewLayout />
            </Provider>
        );
        expect(screen.getByTestId('db-distribution-section')).toBeTruthy();
    });

    it('should render StorageSavingResource', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseOverviewLayout />
            </Provider>
        );
        expect(screen.getByTestId('storage-saving-resource')).toBeTruthy();
    });

    it('should render StoragePerformance', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseOverviewLayout />
            </Provider>
        );
        expect(screen.getByTestId('storage-performance')).toBeTruthy();
    });

    it('should render InformationSection', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseOverviewLayout />
            </Provider>
        );
        expect(screen.getByTestId('information-section')).toBeTruthy();
    });
});
