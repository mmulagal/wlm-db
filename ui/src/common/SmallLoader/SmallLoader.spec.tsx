import { describe, it, expect } from 'vitest';
import SmallLoader from './SmallLoader';

describe('SmallLoader', () => {
    it('should be a function component', () => {
        expect(typeof SmallLoader).toBe('function');
    });

    it('should render without props', () => {
        const element = SmallLoader({});
        expect(element).toBeTruthy();
    });

    it('should render an element with id small-loader', () => {
        const element = SmallLoader({}) as any;
        expect(element.props.id).toBe('small-loader');
    });
});
