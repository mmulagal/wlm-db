import { describe, it, expect, vi } from 'vitest';
import ProgressBar from './ProgressBar';

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) => selector({ sandbox: { isNA: false } }))
}));

describe('ProgressBar', () => {
    it('should be a function component', () => {
        expect(typeof ProgressBar).toBe('function');
    });

    it('should accept value, color props', () => {
        const element = ProgressBar({ value: 50, color: 'green' });
        expect(element).toBeTruthy();
    });

    it('should accept value, color, max and className props', () => {
        const element = ProgressBar({ value: 30, color: 'blue', max: 200, className: 'custom' });
        expect(element).toBeTruthy();
    });

    it('should compute correct width percentage', () => {
        const element = ProgressBar({ value: 50, color: 'red', max: 100 }) as any;
        const filledDiv = element.props.children;
        expect(filledDiv.props.style.width).toBe('50%');
    });

    it('should compute width with custom max', () => {
        const element = ProgressBar({ value: 25, color: 'blue', max: 50 }) as any;
        const filledDiv = element.props.children;
        expect(filledDiv.props.style.width).toBe('50%');
    });

    it('should use default max=100 when not provided', () => {
        const element = ProgressBar({ value: 75, color: 'green' }) as any;
        const filledDiv = element.props.children;
        expect(filledDiv.props.style.width).toBe('75%');
    });
});
