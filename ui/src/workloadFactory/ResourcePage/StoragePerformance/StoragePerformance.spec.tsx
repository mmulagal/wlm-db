import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StoragePerformance from './StoragePerformance';
import useResize from '../../../common/hooks/useResize';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style }: any) => (
        <span data-testid="ds-typography" data-variant={variant} style={style}>
            {children}
        </span>
    ),
    FlashingDotsLoader: ({ className }: any) => (
        <div data-testid="flashing-dots-loader" className={className}>
            Loading...
        </div>
    ),
    Typography: ({ children, variant, className, style }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1900, height: 800 }))
}));

vi.mock('../../../assets/Latency2.svg', () => ({
    ReactComponent: () => <svg data-testid="latency-icon" />
}));

vi.mock('../../../assets/IOPS.svg', () => ({
    ReactComponent: () => <svg data-testid="iops-icon" />
}));

vi.mock('../../../assets/Throughput.svg', () => ({
    ReactComponent: () => <svg data-testid="throughput-icon" />
}));

vi.mock('./StoragePerformance.module.scss', () => ({
    default: {
        storagePerformance: 'storagePerformance',
        headSection: 'headSection',
        title: 'title',
        mainSection: 'mainSection',
        tileSection: 'tileSection',
        textContent: 'textContent',
        commonContainer: 'commonContainer',
        loaderHeight: 'loaderHeight',
        valueText: 'valueText',
        smallSeparator: 'smallSeparator',
        dbHostSeparator: 'dbHostSeparator',
        smallMainContainer: 'smallMainContainer',
        cardSection: 'cardSection',
        leftSection: 'leftSection',
        rightSection: 'rightSection',
        separator: 'separator'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        STORAGE_PERFORMANCE: 'Storage Performance',
        LATENCY: 'Latency',
        IOPS: 'IOPS',
        THROUGHPUT: 'Throughput',
        READ: 'Read',
        WRITE: 'Write'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                resourceLoading: false,
                resourceDetails: {
                    performance: {
                        rwMetrics: {
                            latency: { read: '1.5', write: '2.0' },
                            iops: { read: '5000', write: '3000' },
                            throughput: { read: '200', write: '150' }
                        }
                    }
                },
                ...overrides
            })
        }
    });

describe('StoragePerformance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Large screen (width > 1800)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1900, height: 800 });
        });

        it('should render Storage Performance title', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(screen.getByText('Storage Performance')).toBeTruthy();
        });

        it('should render Latency icon', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(screen.getByTestId('latency-icon')).toBeTruthy();
        });

        it('should render IOPS icon', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(screen.getByTestId('iops-icon')).toBeTruthy();
        });

        it('should render Throughput icon', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(screen.getByTestId('throughput-icon')).toBeTruthy();
        });

        it('should render Latency read and write values', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(screen.getByText('Read 1.5 ms')).toBeTruthy();
            expect(screen.getByText('Write 2.0 ms')).toBeTruthy();
        });

        it('should render IOPS read and write values', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(screen.getByText('Read 5000')).toBeTruthy();
            expect(screen.getByText('Write 3000')).toBeTruthy();
        });

        it('should render Throughput read and write values', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(screen.getByText('Read 200 MBPS')).toBeTruthy();
            expect(screen.getByText('Write 150 MBPS')).toBeTruthy();
        });

        it('should show FlashingDotsLoader in tiles when resourceLoading is true', () => {
            const store = createMockStore({ resourceLoading: true });
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            const loaders = screen.getAllByTestId('flashing-dots-loader');
            expect(loaders.length).toBeGreaterThan(0);
        });

        it('should render Latency, IOPS, Throughput labels', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            const latency = screen.getAllByText('Latency');
            expect(latency.length).toBeGreaterThan(0);
        });

        it('should render mainSection container on large screen', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(container.querySelector('.mainSection')).toBeTruthy();
        });

        it('should NOT render smallMainContainer on large screen', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(container.querySelector('.smallMainContainer')).toBeNull();
        });
    });

    describe('Small screen (width <= 1800)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1400, height: 800 });
        });

        it('should render smallMainContainer on small screen', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(container.querySelector('.smallMainContainer')).toBeTruthy();
        });

        it('should NOT render mainSection on small screen', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            expect(container.querySelector('.mainSection')).toBeNull();
        });

        it('should render performance data in card format on small screen', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <StoragePerformance />
                </Provider>
            );
            const latency = screen.getAllByText('Latency');
            expect(latency.length).toBeGreaterThan(0);
        });
    });
});
