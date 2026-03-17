import { describe, it, expect } from 'vitest';
import ComponentLoader from './ComponentLoader';

describe('ComponentLoader', () => {
    it('should be a function', () => {
        expect(typeof ComponentLoader).toBe('function');
    });

    it('should render without props', () => {
        const element = ComponentLoader({});
        expect(element).toBeTruthy();
    });

    it('should accept a style prop', () => {
        const element = ComponentLoader({ style: { width: '50px' } }) as any;
        expect(element.props.style).toEqual({ width: '50px' });
    });

    it('should render without style prop', () => {
        const element = ComponentLoader({}) as any;
        expect(element.props.style).toBeUndefined();
    });
});
