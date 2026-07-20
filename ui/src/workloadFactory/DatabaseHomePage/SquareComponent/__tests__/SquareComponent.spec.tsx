import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SquareComponent from '../SquareComponent';

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    ),
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsFlashingDotsLoader: () => <div data-testid="ds-flashing-dots-loader" />
}));

vi.mock('../SquareComponent.module.scss', () => ({
    default: {
        container: 'container',
        headerArea: 'headerArea',
        valueText: 'valueText',
        loadingClass: 'loadingClass',
        loadingClassSmall: 'loadingClassSmall',
        bottomRow: 'bottomRow',
        square: 'square',
        labelText: 'labelText'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: { notAvailable: 'notAvailable' }
}));

vi.mock('../../../common/EllipsisTooltipText/EllipsisTooltipText', () => ({
    default: ({ text, className }: any) => (
        <span data-testid="ellipsis-tooltip-text" className={className}>
            {text}
        </span>
    )
}));

describe('SquareComponent', () => {
    it('renders value and text', () => {
        render(<SquareComponent value="$500" color="var(--chart-9)" text="Storage" />);
        expect(screen.getByText('$500')).toBeDefined();
        expect(screen.getByText('Storage')).toBeDefined();
    });

    it('renders without boldValue (default layout)', () => {
        const { container } = render(<SquareComponent value="100" color="red" text="Label" />);
        expect(container.querySelector('.headerArea')).not.toBeNull();
    });

    it('renders with boldValue=true', () => {
        const { container } = render(<SquareComponent value="100" color="red" text="Label" boldValue />);
        // The headerArea div should NOT be present when boldValue is true
        expect(container.querySelector('.headerArea')).toBeNull();
    });

    it('shows DsFlashingDotsLoader in header area when loadingInFirstRow=true and isSmall=false', () => {
        render(<SquareComponent value="100" color="red" text="Label" loadingInFirstRow isSmall={false} />);
        expect(screen.getAllByTestId('flashing-dots-loader').length).toBeGreaterThan(0);
    });

    it('shows DsFlashingDotsLoader with small class when loadingInFirstRow=true and isSmall=true', () => {
        render(<SquareComponent value="100" color="red" text="Label" loadingInFirstRow isSmall />);
        expect(screen.getAllByTestId('flashing-dots-loader').length).toBeGreaterThan(0);
    });

    it('shows isLoading DsFlashingDotsLoader in bottom row', () => {
        render(<SquareComponent value="100" color="red" text="Label" isLoading />);
        expect(screen.getAllByTestId('flashing-dots-loader').length).toBeGreaterThan(0);
    });

    it('applies notAvailable class when showNA=true', () => {
        const { container } = render(<SquareComponent value="N/A" color="red" text="Label" showNA />);
        expect(container.innerHTML).toContain('notAvailable');
    });

    it('applies color to square div style', () => {
        const { container } = render(<SquareComponent value="100" color="var(--chart-9)" text="Storage" />);
        const squareEl = container.querySelector('.square') as HTMLElement;
        expect(squareEl?.style.backgroundColor).toBe('var(--chart-9)');
    });

    it('applies disabled color to square when showNA=true', () => {
        const { container } = render(<SquareComponent value="N/A" color="var(--chart-9)" text="Storage" showNA />);
        const squareEl = container.querySelector('.square') as HTMLElement;
        expect(squareEl?.style.backgroundColor).toBe('var(--text-disabled)');
    });
});
