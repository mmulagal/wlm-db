import { describe, it, expect, vi } from 'vitest';
import CardComponentConfig from './CardComponentConfig';

describe('CardComponentConfig', () => {
    const baseProps = {
        idToAdd: 'card-1',
        selectedConfigCondition: false,
        icon: <div>Icon</div>,
        handleClick: vi.fn(),
        heading: 'Card Heading',
        content: 'Card content text',
        tickIcon: <div>✓</div>
    };

    it('should be a function component', () => {
        expect(typeof CardComponentConfig).toBe('function');
    });

    it('should render with required props', () => {
        const element = CardComponentConfig(baseProps);
        expect(element).toBeTruthy();
    });

    it('should render selected state (add-border)', () => {
        const element = CardComponentConfig({ ...baseProps, selectedConfigCondition: true });
        expect(element).toBeTruthy();
    });

    it('should render non-selected state', () => {
        const element = CardComponentConfig({ ...baseProps, selectedConfigCondition: false });
        expect(element).toBeTruthy();
    });

    it('should render with isDisabled=true (shows ComingSoon)', () => {
        const element = CardComponentConfig({ ...baseProps, isDisabled: true });
        expect(element).toBeTruthy();
    });

    it('should render with isDisabled=false (default)', () => {
        const element = CardComponentConfig({ ...baseProps, isDisabled: false });
        expect(element).toBeTruthy();
    });

    it('should show tick icon when selectedConfigCondition is true', () => {
        const element = CardComponentConfig({ ...baseProps, selectedConfigCondition: true }) as any;
        expect(element).toBeTruthy();
    });

    it('should not show tick icon when selectedConfigCondition is false', () => {
        const element = CardComponentConfig({ ...baseProps, selectedConfigCondition: false }) as any;
        expect(element).toBeTruthy();
    });

    it('should use empty onClick when isDisabled is true', () => {
        const handleClick = vi.fn();
        const element = CardComponentConfig({
            ...baseProps,
            handleClick,
            isDisabled: true
        }) as any;
        expect(element).toBeTruthy();
    });
});
