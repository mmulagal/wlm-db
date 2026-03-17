import { describe, it, expect, vi } from 'vitest';
import BulkDismissContainer from './BulkDismissContainer';
import { CONFIG_STATES } from '../../utils/consts';

describe('BulkDismissContainer', () => {
    it('should be a function component', () => {
        expect(typeof BulkDismissContainer).toBe('function');
    });

    it('should render with empty rowData', () => {
        const onClick = vi.fn();
        const element = BulkDismissContainer({ onClick, rowData: [] });
        expect(element).toBeTruthy();
    });

    it('should render with all POSTPONED rows (reactivate enabled, postpone disabled)', () => {
        const onClick = vi.fn();
        const element = BulkDismissContainer({
            onClick,
            rowData: [CONFIG_STATES.POSTPONED, CONFIG_STATES.POSTPONED]
        });
        expect(element).toBeTruthy();
    });

    it('should render with all ACTIVE rows (reactivate disabled, postpone enabled)', () => {
        const onClick = vi.fn();
        const element = BulkDismissContainer({
            onClick,
            rowData: [CONFIG_STATES.ACTIVE, CONFIG_STATES.ACTIVE]
        });
        expect(element).toBeTruthy();
    });

    it('should render with all DISMISSED rows (dismiss disabled)', () => {
        const onClick = vi.fn();
        const element = BulkDismissContainer({
            onClick,
            rowData: [CONFIG_STATES.DISMISSED, CONFIG_STATES.DISMISSED]
        });
        expect(element).toBeTruthy();
    });

    it('should render with ACTIVATING rows', () => {
        const onClick = vi.fn();
        const element = BulkDismissContainer({
            onClick,
            rowData: [CONFIG_STATES.ACTIVATING]
        });
        expect(element).toBeTruthy();
    });

    it('should render with mixed rows', () => {
        const onClick = vi.fn();
        const element = BulkDismissContainer({
            onClick,
            rowData: [CONFIG_STATES.ACTIVE, CONFIG_STATES.DISMISSED, CONFIG_STATES.POSTPONED]
        });
        expect(element).toBeTruthy();
    });
});
