import { describe, it, expect } from 'vitest';
import CodeBoxHeading from './CodeBoxHeading';

describe('CodeBoxHeading', () => {
    it('should be a function component', () => {
        expect(typeof CodeBoxHeading).toBe('function');
    });

    it('should render without props', () => {
        const element = CodeBoxHeading({});
        expect(element).toBeTruthy();
    });
});
