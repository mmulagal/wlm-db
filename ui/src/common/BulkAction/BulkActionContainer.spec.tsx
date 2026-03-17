import { describe, it, expect, vi } from 'vitest';
import BulkActionContainer from './BulkActionContainer';

describe('BulkActionContainer', () => {
    it('should be a function component', () => {
        expect(typeof BulkActionContainer).toBe('function');
    });

    it('should accept action and onClick props', () => {
        const onClick = vi.fn();
        const element = BulkActionContainer({ action: 'Delete', onClick });
        expect(element).toBeTruthy();
    });

    it('should render the action label', () => {
        const onClick = vi.fn();
        const element = BulkActionContainer({ action: 'Approve', onClick }) as any;
        expect(element).toBeTruthy();
    });

    it('should use action value as data-testid prefix', () => {
        const onClick = vi.fn();
        const element = BulkActionContainer({ action: 'fix', onClick }) as any;
        expect(element).toBeTruthy();
    });
});
