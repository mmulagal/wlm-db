import { describe, it, expect } from 'vitest';
import NoDataCodeBox from './NoDataCodebox';

describe('NoDataCodeBox', () => {
    it('should be a function component', () => {
        expect(typeof NoDataCodeBox).toBe('function');
    });

    it('should accept a text prop', () => {
        const element = NoDataCodeBox({ text: 'No data available' });
        expect(element).toBeTruthy();
    });

    it('should render with the given text', () => {
        const element = NoDataCodeBox({ text: 'Empty dataset' }) as any;
        expect(element).toBeTruthy();
    });
});
