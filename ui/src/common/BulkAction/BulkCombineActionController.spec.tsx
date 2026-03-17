import { describe, it, expect, vi } from 'vitest';
import BulkCombineActionController from './BulkCombineActionController';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

describe('BulkCombineActionController', () => {
    it('should be a function component', () => {
        expect(typeof BulkCombineActionController).toBe('function');
    });

    it('should render with showDismissed=false', () => {
        const onClick = vi.fn();
        const handleStateOperation = vi.fn();
        const element = BulkCombineActionController({
            action: 'Fix',
            onClick,
            handleStateOperation,
            showDismissed: false
        });
        expect(element).toBeTruthy();
    });

    it('should render with showDismissed=true', () => {
        const onClick = vi.fn();
        const handleStateOperation = vi.fn();
        const element = BulkCombineActionController({
            action: 'Fix',
            onClick,
            handleStateOperation,
            showDismissed: true
        });
        expect(element).toBeTruthy();
    });

    it('should render with hideFixButton=true', () => {
        const onClick = vi.fn();
        const handleStateOperation = vi.fn();
        const element = BulkCombineActionController({
            action: 'Fix',
            onClick,
            handleStateOperation,
            hideFixButton: true
        });
        expect(element).toBeTruthy();
    });

    it('should render with isFixDisabled=true', () => {
        const onClick = vi.fn();
        const handleStateOperation = vi.fn();
        const element = BulkCombineActionController({
            action: 'Fix',
            onClick,
            handleStateOperation,
            isFixDisabled: true,
            fixDisableMsg: 'Cannot fix now'
        });
        expect(element).toBeTruthy();
    });

    it('should render with hideFixButton=false (default)', () => {
        const onClick = vi.fn();
        const handleStateOperation = vi.fn();
        const element = BulkCombineActionController({
            action: 'Apply',
            onClick,
            handleStateOperation
        });
        expect(element).toBeTruthy();
    });
});
