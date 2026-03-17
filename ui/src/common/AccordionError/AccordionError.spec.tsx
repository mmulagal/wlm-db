import { describe, it, expect } from 'vitest';
import AccordionError from './AccordionError';

describe('AccordionError', () => {
    it('should be a function component', () => {
        expect(typeof AccordionError).toBe('function');
    });

    it('should render without props', () => {
        const element = AccordionError({});
        expect(element).toBeTruthy();
    });
});
