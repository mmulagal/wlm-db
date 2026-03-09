import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import EstimatedCostDialogContent from '../EstimatedCostDialogContent';

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>
            {children}
        </span>
    ),
    AccordionController: ({ children }: any) => <div data-testid="accordion-controller">{children}</div>,
    AccordionCard: ({ children, id, title }: any) => (
        <div data-testid={`accordion-card-${id}`}>
            <div data-testid={`accordion-title-${id}`}>{title}</div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTooltipInfo: ({ children }: any) => <div data-testid="ds-tooltip-info">{children}</div>,
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() }),
    Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
    Popover: ({ children, container }: any) => (
        <div>
            {container}
            {children}
        </div>
    )
}));

vi.mock('@netapp/design-system/dist/components/Popover', () => ({
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            {container}
            <span data-testid="popover-content">{children}</span>
        </div>
    )
}));

vi.mock('../../../../../assets/ic_copy.svg', () => ({
    ReactComponent: () => <svg data-testid="copy-icon" />
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: {
        EC_HEADER: 'EC Header',
        STEP1: 'Step 1:',
        STEP1TEXT: 'Create IAM policy',
        STEP1POINT1: 'Go to IAM Console',
        STEP1POINT2: 'Create policy with permissions below',
        STEP2: 'Step 2:',
        STEP2TEXT: 'Attach policy',
        STEP2POINT1: 'Open IAM console',
        STEP2POINT2: 'Select',
        STEP2POINT2CONTINUE: 'Cost Explorer',
        STEP2POINT4: 'Activate',
        STEP2POINT4ACTIVATE: 'Cost Allocation Tags'
    }
}));

vi.mock('../../../../../utils/permissions', () => ({
    COST_PERMISSION: { Version: '2012-10-17', Statement: [] }
}));

vi.mock('../../../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => (
        <button data-testid="copy-to-clipboard" data-value={value}>
            {iconProvided}
        </button>
    )
}));

vi.mock('../EstimatedCostDialogContent.module.scss', () => ({
    default: {}
}));

describe('EstimatedCostDialogContent', () => {
    it('renders the EC header text', () => {
        render(<EstimatedCostDialogContent />);
        expect(screen.getByText('EC Header')).toBeDefined();
    });

    it('renders AccordionController', () => {
        render(<EstimatedCostDialogContent />);
        expect(screen.getByTestId('accordion-controller')).toBeDefined();
    });

    it('renders accordion card 1 with Step 1 title', () => {
        render(<EstimatedCostDialogContent />);
        const title1 = screen.getByTestId('accordion-title-1');
        expect(title1.textContent).toContain('Step 1:');
        expect(title1.textContent).toContain('Create IAM policy');
    });

    it('renders accordion card 2 with Step 2 title', () => {
        render(<EstimatedCostDialogContent />);
        const title2 = screen.getByTestId('accordion-title-2');
        expect(title2.textContent).toContain('Step 2:');
        expect(title2.textContent).toContain('Attach policy');
    });

    it('renders copy to clipboard button', () => {
        render(<EstimatedCostDialogContent />);
        expect(screen.getByTestId('copy-to-clipboard')).toBeDefined();
    });

    it('renders the bottom note text', () => {
        render(<EstimatedCostDialogContent />);
        expect(screen.getByText('The changes take effect within 24-48 hours.')).toBeDefined();
    });

    it('renders step 1 content points', () => {
        render(<EstimatedCostDialogContent />);
        expect(screen.getByText('Go to IAM Console')).toBeDefined();
        expect(screen.getByText('Create policy with permissions below')).toBeDefined();
    });

    it('renders step 2 content points', () => {
        render(<EstimatedCostDialogContent />);
        expect(screen.getByText('Open IAM console')).toBeDefined();
        expect(screen.getByText('Select')).toBeDefined();
    });
});
