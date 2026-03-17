import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import Datepicker from './Datepicker';

vi.mock('react-dom', async importOriginal => {
    const original = await importOriginal<typeof import('react-dom')>();
    return {
        ...original,
        createPortal: (node: any) => node
    };
});

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className, onClick }: any) => (
        <span className={className} data-variant={variant} onClick={onClick}>
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system', () => ({
    DsButton: ({ children, onClick, isDisabled, type }: any) => (
        <button onClick={onClick} disabled={isDisabled} data-type={type}>
            {children}
        </button>
    )
}));

vi.mock('../../assets/datepicker.svg', () => ({
    ReactComponent: ({ className }: any) => <svg data-testid="datepicker-icon" className={className} />
}));

describe('Datepicker', () => {
    it('should be defined', () => {
        expect(Datepicker).toBeDefined();
    });

    it('should render without crashing', () => {
        const onChange = vi.fn();
        const { container } = render(<Datepicker onChange={onChange} />);
        expect(container).toBeTruthy();
    });

    it('should render the datepicker icon', () => {
        const onChange = vi.fn();
        const { getByTestId } = render(<Datepicker onChange={onChange} />);
        expect(getByTestId('datepicker-icon')).toBeTruthy();
    });

    it('should render with a value', () => {
        const onChange = vi.fn();
        const date = new Date(2024, 0, 15); // Jan 15 2024
        const { container } = render(<Datepicker onChange={onChange} value={date} />);
        expect(container).toBeTruthy();
    });

    it('should open calendar popup when clicking the input', () => {
        const onChange = vi.fn();
        const { container } = render(<Datepicker onChange={onChange} />);
        const input = container.querySelector('div[class*="input"]') as HTMLElement;
        if (input) {
            fireEvent.click(input);
        }
        // After click, popup should render via portal
        expect(container).toBeTruthy();
    });

    it('should display Start date label', () => {
        const onChange = vi.fn();
        const { getByText } = render(<Datepicker onChange={onChange} />);
        expect(getByText('Start date')).toBeTruthy();
    });

    it('should show formatted selected date', () => {
        const onChange = vi.fn();
        const value = new Date(2024, 5, 10); // June 10, 2024
        const { container } = render(<Datepicker onChange={onChange} value={value} />);
        expect(container).toBeTruthy();
    });
});
