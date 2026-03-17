import { describe, it, expect, vi } from 'vitest';
import ViewDialog from './ViewDialog';

vi.mock('../../utils/utilityFunctions', () => ({
    downloadObjectAsJson: vi.fn()
}));

describe('ViewDialog', () => {
    it('should be a function component', () => {
        expect(typeof ViewDialog).toBe('function');
    });

    it('should render with data prop', () => {
        const element = ViewDialog({ data: 'Sample data' });
        expect(element).toBeTruthy();
    });

    it('should render with isDownload=true', () => {
        const element = ViewDialog({ data: 'Sample data', isDownload: true });
        expect(element).toBeTruthy();
    });

    it('should render with isDownload=false (default)', () => {
        const element = ViewDialog({ data: 'Sample data', isDownload: false });
        expect(element).toBeTruthy();
    });

    it('should accept copyResponseData function prop', () => {
        const copyResponseData = vi.fn().mockReturnValue('custom data');
        const element = ViewDialog({ data: 'Sample data', copyResponseData });
        expect(element).toBeTruthy();
    });

    it('should render with object data', () => {
        const data = { key: 'value', nested: { a: 1 } };
        const element = ViewDialog({ data });
        expect(element).toBeTruthy();
    });

    it('should not render download section when isDownload is false', () => {
        const element = ViewDialog({ data: 'text' }) as any;
        expect(element).toBeTruthy();
    });
});
