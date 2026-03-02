import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import StorageSavingResource from './StorageSavingResource';
import useResize from '../../../common/hooks/useResize';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid="ds-typography" data-variant={variant} className={className} style={style}>
            {children}
        </span>
    ),
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    Typography: ({ children, variant, className, style }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1900, height: 800 }))
}));

vi.mock('../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <svg data-testid="bullet-icon" />
}));

vi.mock('../../../assets/Savings.svg', () => ({
    ReactComponent: () => <svg data-testid="savings-icon" />
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatFractionalNumber: vi.fn((val: number, digits: number) => val?.toFixed(digits) ?? '0.00'),
    formatSize: vi.fn((val: number) => `${val} GB`)
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        DB_HOST_STORAGE_SAVINGS: 'Storage Savings',
        DB_SS_TT_1: 'Tooltip point 1',
        DB_SS_TT_2: 'Tooltip point 2',
        SANDBOX_STORAGE_SAVINGS: 'Storage Savings',
        SANDBOX_CONSUMED_STORAGE: 'Consumed Storage',
        SANDBOX_SAVINGS: 'Savings',
        SANDBOX_CONSUMED_SAVING: 'Consumed Saving'
    }
}));

vi.mock('./StorageSavingResource.module.scss', () => ({
    default: {
        storageSaving: 'storageSaving',
        headSection: 'headSection',
        storageSavingTooltipSection: 'storageSavingTooltipSection',
        title: 'title',
        list: 'list',
        listItem: 'listItem',
        textWidth: 'textWidth',
        largeContainer: 'largeContainer',
        firstSegment: 'firstSegment',
        leftSection: 'leftSection',
        rightSection: 'rightSection',
        loadingContainer: 'loadingContainer',
        secondSegment: 'secondSegment',
        progressBar: 'progressBar',
        progress: 'progress',
        leftCurveBar: 'leftCurveBar',
        rightCurveBar: 'rightCurveBar',
        separator: 'separator',
        secondRow: 'secondRow',
        bottomRow: 'bottomRow',
        square: 'square'
    }
}));

describe('StorageSavingResource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useResize as any).mockReturnValue({ width: 1900, height: 800 });
    });

    it('should render Storage Savings title', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        const titles = screen.getAllByText('Storage Savings');
        expect(titles.length).toBeGreaterThan(0);
    });

    it('should render Savings icon', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        expect(screen.getByTestId('savings-icon')).toBeTruthy();
    });

    it('should render tooltip info', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        expect(screen.getByTestId('tooltip-info')).toBeTruthy();
    });

    it('should render bullet icons in tooltip', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        const bullets = screen.getAllByTestId('bullet-icon');
        expect(bullets.length).toBe(2);
    });

    it('should render savings percentage', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        expect(screen.getByText('40.00%')).toBeTruthy();
    });

    it('should show FlashingDotsLoader when hostsLoading is true', () => {
        render(<StorageSavingResource hostData={null} hostsLoading />);
        const loaders = screen.getAllByTestId('flashing-dots-loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('should NOT show loader when hostsLoading is false', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
                hostsLoading={false}
            />
        );
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('should render progress bar with two segments when percent >= 1', () => {
        const { container } = render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        expect(container.querySelector('.progressBar')).toBeTruthy();
    });

    it('should render single-color progress bar when percent < 1 (but > 0)', () => {
        const { container } = render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 0.5, storageSavings: 10, storageConsumes: 200 }}
            />
        );
        expect(container.querySelector('.progressBar')).toBeTruthy();
    });

    it('should render disabled progress bar when percent is exactly 0', () => {
        const { container } = render(
            <StorageSavingResource hostData={{ storageSavingsPercent: 0, storageSavings: 0, storageConsumes: 200 }} />
        );
        expect(container.querySelector('.progressBar')).toBeTruthy();
    });

    it('should render formatted storage savings size', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        expect(screen.getByText('100 GB')).toBeTruthy();
    });

    it('should render formatted consumed storage size', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        expect(screen.getByText('200 GB')).toBeTruthy();
    });

    it('should render tooltip text items', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        expect(screen.getByText('Tooltip point 1')).toBeTruthy();
        expect(screen.getByText('Tooltip point 2')).toBeTruthy();
    });

    it('should render progress bar segment labels', () => {
        render(
            <StorageSavingResource
                hostData={{ storageSavingsPercent: 40, storageSavings: 100, storageConsumes: 200 }}
            />
        );
        const savingTexts = screen.getAllByText('Storage Savings');
        expect(savingTexts.length).toBeGreaterThan(0);
        expect(screen.getByText('Consumed Storage')).toBeTruthy();
    });

    it('should handle undefined hostData without crashing', () => {
        render(<StorageSavingResource hostData={undefined} />);
        const titles = screen.getAllByText('Storage Savings');
        expect(titles.length).toBeGreaterThan(0);
    });
});
