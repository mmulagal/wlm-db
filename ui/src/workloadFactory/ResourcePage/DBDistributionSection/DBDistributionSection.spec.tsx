import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DBDistributionSection from './DBDistributionSection';

vi.mock('@netapp/design-system', () => ({
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatSize: vi.fn((val: number) => `${val} GB`)
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        RESOURCE_UTILIZATION: 'Resource Utilization',
        CPU: 'CPU',
        MEMORY: 'Memory',
        STORAGE: 'Storage',
        RESOURCES_DISTRIBUTION: 'Resources Distribution'
    }
}));

vi.mock('./DBDistributionSection.module.scss', () => ({
    default: {
        dbDistribution: 'dbDistribution',
        headSection: 'headSection',
        title: 'title',
        utilizationContainer: 'utilizationContainer',
        barContainer: 'barContainer',
        firstBar: 'firstBar',
        progressBar: 'progressBar',
        progress: 'progress',
        leftCurveBar: 'leftCurveBar',
        rightCurveBar: 'rightCurveBar',
        textContainer: 'textContainer',
        headerPart: 'headerPart',
        separatorProtection: 'separatorProtection',
        usedAllocatedSection: 'usedAllocatedSection',
        firstRow: 'firstRow',
        secondRow: 'secondRow',
        square: 'square',
        smallSeparator: 'smallSeparator'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                resourceLoading: false,
                resourceDetails: {
                    resourceUtilization: {
                        cpu: { percentUsed: '45', used: '2', total: '4' },
                        memory: { percentUsed: '60', used: '16384', total: '32768' },
                        disk: { percentUsed: '30', used: '512', total: '1024' }
                    }
                },
                ...overrides
            })
        }
    });

describe('DBDistributionSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the section title', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('Resource Utilization')).toBeTruthy();
    });

    it('should show loader when resourceLoading is true', () => {
        const store = createMockStore({ resourceLoading: true });
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('should NOT show loader when resourceLoading is false', () => {
        const store = createMockStore({ resourceLoading: false });
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('should render CPU utilization percentage', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('45%')).toBeTruthy();
    });

    it('should render Memory utilization percentage', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('60%')).toBeTruthy();
    });

    it('should render Disk utilization percentage', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('30%')).toBeTruthy();
    });

    it('should render CPU label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        const cpuTexts = screen.getAllByText('CPU');
        expect(cpuTexts.length).toBeGreaterThan(0);
    });

    it('should render Memory label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        const memTexts = screen.getAllByText('Memory');
        expect(memTexts.length).toBeGreaterThan(0);
    });

    it('should render Storage label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        const storageTexts = screen.getAllByText('Storage');
        expect(storageTexts.length).toBeGreaterThan(0);
    });

    it('should render Resources Distribution heading', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('Resources Distribution')).toBeTruthy();
    });

    it('should render CPU current usage text', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('Current usage 45%')).toBeTruthy();
    });

    it('should render 0% when resourceUtilization is absent', () => {
        const store = createMockStore({
            resourceDetails: {}
        });
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        const zeroTexts = screen.getAllByText('0%');
        expect(zeroTexts.length).toBeGreaterThanOrEqual(3);
    });

    it('should show memory used and allocated sizes', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('16384 GB used')).toBeTruthy();
        expect(screen.getByText('32768 GB allocated')).toBeTruthy();
    });

    it('should show disk used and allocated sizes', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DBDistributionSection />
            </Provider>
        );
        expect(screen.getByText('512 GB used')).toBeTruthy();
        expect(screen.getByText('1024 GB allocated')).toBeTruthy();
    });
});
