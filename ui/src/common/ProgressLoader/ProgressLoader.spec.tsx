import { describe, it, expect } from 'vitest';
import ProgressLoader from './ProgressLoader';

describe('ProgressLoader', () => {
    it('should be a function component', () => {
        expect(typeof ProgressLoader).toBe('function');
    });

    it('should accept percent prop', () => {
        const element = ProgressLoader({ percent: 50 }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept indeterminate prop', () => {
        const element = ProgressLoader({ indeterminate: true }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept size prop as large', () => {
        const element = ProgressLoader({ size: 'large' }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept size prop as small', () => {
        const element = ProgressLoader({ size: 'small' }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept className prop', () => {
        const element = ProgressLoader({ className: 'custom-class' }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept style prop', () => {
        const element = ProgressLoader({ style: { width: '100px' } }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept thumbClassName and thumbStyle props', () => {
        const element = ProgressLoader({
            thumbClassName: 'thumb',
            thumbStyle: { backgroundColor: 'red' }
        }) as any;
        expect(element).toBeTruthy();
    });

    it('should render with no props using defaults', () => {
        const element = ProgressLoader({}) as any;
        expect(element).toBeTruthy();
    });

    it('should set width to undefined when indeterminate is true', () => {
        const element = ProgressLoader({ indeterminate: true, percent: 50 }) as any;
        const thumb = element.props.children;
        expect(thumb.props.style.width).toBeUndefined();
    });

    it('should set width based on percent when not indeterminate', () => {
        const element = ProgressLoader({ percent: 75, indeterminate: false }) as any;
        const thumb = element.props.children;
        expect(thumb.props.style.width).toBe('75%');
    });
});
