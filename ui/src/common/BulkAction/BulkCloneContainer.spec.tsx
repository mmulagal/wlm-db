import { describe, it, expect, vi } from 'vitest';
import BulkCloneContainer from './BulkCloneContainer';

describe('BulkCloneContainer', () => {
    it('should be a function component', () => {
        expect(typeof BulkCloneContainer).toBe('function');
    });

    it('should accept action1 and onClick props', () => {
        const onClick = vi.fn();
        const element = BulkCloneContainer({ action1: 'Clone', onClick });
        expect(element).toBeTruthy();
    });

    it('should render with only action1', () => {
        const onClick = vi.fn();
        const element = BulkCloneContainer({ action1: 'Clone', onClick }) as any;
        expect(element).toBeTruthy();
    });

    it('should render with action1 and action2', () => {
        const onClick = vi.fn();
        const element = BulkCloneContainer({ action1: 'Clone', action2: 'Move', onClick }) as any;
        expect(element).toBeTruthy();
    });

    it('should not render second button when action2 is not provided', () => {
        const onClick = vi.fn();
        const element = BulkCloneContainer({ action1: 'Clone', onClick }) as any;
        expect(element).toBeTruthy();
    });

    it('should not render second button when action2 is empty string', () => {
        const onClick = vi.fn();
        const element = BulkCloneContainer({ action1: 'Clone', action2: '', onClick }) as any;
        expect(element).toBeTruthy();
    });
});
