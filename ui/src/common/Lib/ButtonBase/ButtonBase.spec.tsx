import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ButtonBase } from './ButtonBase';

describe('ButtonBase', () => {
    it('should be defined', () => {
        expect(ButtonBase).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(<ButtonBase />);
        expect(container).toBeTruthy();
    });

    it('should render children', () => {
        const { getByText } = render(<ButtonBase>Click me</ButtonBase>);
        expect(getByText('Click me')).toBeTruthy();
    });

    it('should apply custom className', () => {
        const { container } = render(<ButtonBase className="custom-class">Test</ButtonBase>);
        const button = container.querySelector('button');
        expect(button?.className).toContain('custom-class');
    });

    it('should be disabled when isDisabled is true', () => {
        const { container } = render(<ButtonBase isDisabled>Disabled</ButtonBase>);
        const button = container.querySelector('button');
        expect(button?.disabled).toBe(true);
    });

    it('should not be disabled when isDisabled is false', () => {
        const { container } = render(<ButtonBase isDisabled={false}>Enabled</ButtonBase>);
        const button = container.querySelector('button');
        expect(button?.disabled).toBe(false);
    });

    it('should call onClick when clicked', () => {
        const onClick = vi.fn();
        const { container } = render(<ButtonBase onClick={onClick}>Click</ButtonBase>);
        const button = container.querySelector('button');
        fireEvent.click(button!);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should have button type="button" by default', () => {
        const { container } = render(<ButtonBase>Button</ButtonBase>);
        const button = container.querySelector('button');
        expect(button?.type).toBe('button');
    });

    it('should pass additional HTML button attributes', () => {
        const { container } = render(<ButtonBase data-testid="my-btn">Button</ButtonBase>);
        const button = container.querySelector('[data-testid="my-btn"]');
        expect(button).toBeTruthy();
    });
});
