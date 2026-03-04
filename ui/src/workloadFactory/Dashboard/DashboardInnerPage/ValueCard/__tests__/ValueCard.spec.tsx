import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ValueCard from '../ValueCard';
import { DBType } from '../../../../../utils/consts';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, title }: any) => (
        <span data-testid={`typography-${variant}`} className={className} title={title}>
            {children}
        </span>
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('./ValueCard.module.scss', () => ({
    default: {
        valueCard: 'valueCard',
        cardContent: 'cardContent',
        column: 'column',
        titleText: 'titleText',
        label: 'label'
    }
}));

describe('ValueCard', () => {
    const fullData = {
        optimizedInstances: 10,
        notOptimizedInstances: 5,
        totalInstances: 20,
        dismissedInstances: 3,
        activatingInstances: 2,
        partialDismissInstances: 1,
        severity: 'Critical'
    };

    it('renders total instances count', () => {
        render(<ValueCard valueCardData={fullData} />);
        expect(screen.getByText('20')).toBeTruthy();
    });

    it('renders optimized instances count', () => {
        render(<ValueCard valueCardData={fullData} />);
        expect(screen.getByText('10')).toBeTruthy();
    });

    it('renders not optimized instances count', () => {
        render(<ValueCard valueCardData={fullData} />);
        expect(screen.getByText('5')).toBeTruthy();
    });

    it('renders dismissed instances when not 0', () => {
        render(<ValueCard valueCardData={fullData} />);
        expect(screen.getByText('3')).toBeTruthy();
    });

    it('does not render dismissed column when dismissedInstances is 0', () => {
        const data = { ...fullData, dismissedInstances: 0 };
        render(<ValueCard valueCardData={data} />);
        expect(screen.queryByText('0')).toBeNull();
    });

    it('renders activating instances when not 0', () => {
        render(<ValueCard valueCardData={fullData} />);
        expect(screen.getByText('2')).toBeTruthy();
    });

    it('does not render activating column when activatingInstances is 0', () => {
        const data = { ...fullData, activatingInstances: 0 };
        render(<ValueCard valueCardData={data} />);
        // '0' should not appear since both dismissed and activating columns hidden
        const els = screen.queryAllByText('0');
        // 0 means they should be hidden
        expect(els.length).toBe(0);
    });

    it('renders partialDismissInstances when not 0', () => {
        render(<ValueCard valueCardData={fullData} />);
        expect(screen.getByText('1')).toBeTruthy();
    });

    it('does not render partial column when partialDismissInstances is 0', () => {
        const data = { ...fullData, partialDismissInstances: 0, dismissedInstances: 0, activatingInstances: 0 };
        render(<ValueCard valueCardData={data} />);
        expect(screen.queryByText('0')).toBeNull();
    });

    it('renders with MSSQL engine type', () => {
        render(<ValueCard valueCardData={fullData} configEngineType={DBType.MSSQL} />);
        // engineTypeBasedResourceStr returns first param for non-oracle
        expect(screen.getAllByText('databases.well-architect.total-instances').length).toBeGreaterThan(0);
    });

    it('renders with Oracle engine type', () => {
        render(<ValueCard valueCardData={fullData} configEngineType={DBType.ORACLE} />);
        expect(screen.getAllByText('databases.well-architect.total-databases').length).toBeGreaterThan(0);
    });

    it('renders with empty valueCardData', () => {
        render(<ValueCard valueCardData={{}} />);
        // Just shouldn't crash
        expect(screen.getAllByTestId('typography-Regular_24').length).toBeGreaterThan(0);
    });
});
