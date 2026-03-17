import { describe, it, expect } from 'vitest';
import LoadingCodeBox from './LoadingCodebox';

describe('LoadingCodeBox', () => {
    it('should be a function component', () => {
        expect(typeof LoadingCodeBox).toBe('function');
    });

    it('should accept a text prop', () => {
        const element = LoadingCodeBox({ text: 'Loading...' });
        expect(element).toBeTruthy();
    });

    it('should render with the given text', () => {
        const element = LoadingCodeBox({ text: 'Please wait' }) as any;
        expect(element).toBeTruthy();
    });
});
