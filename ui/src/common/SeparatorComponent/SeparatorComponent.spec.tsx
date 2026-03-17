import { describe, it, expect } from 'vitest';
import SeparatorComponent from './SeparatorComponent';

describe('SeparatorComponent', () => {
    it('should be a function component', () => {
        expect(typeof SeparatorComponent).toBe('function');
    });

    it('should render without props', () => {
        const element = SeparatorComponent({});
        expect(element).toBeTruthy();
    });

    it('should render vertical variant', () => {
        const element = SeparatorComponent({ variant: 'vertical', height: '16px' }) as any;
        expect(element).toBeTruthy();
        // The inner div for vertical should have borderRight style
        const innerDiv = element.props.children;
        expect(innerDiv.props.style.borderRight).toBe('1px solid var(--border)');
    });

    it('should render horizontal variant by default', () => {
        const element = SeparatorComponent({ height: '8px' }) as any;
        expect(element).toBeTruthy();
        // The inner div for horizontal should have borderTop style
        const innerDiv = element.props.children;
        expect(innerDiv.props.style.borderTop).toBe('1px solid var(--border)');
    });

    it('should apply height prop to the inner div', () => {
        const element = SeparatorComponent({ variant: 'vertical', height: '24px' }) as any;
        const innerDiv = element.props.children;
        expect(innerDiv.props.style.height).toBe('24px');
    });
});
