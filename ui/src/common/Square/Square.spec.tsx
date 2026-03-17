import { describe, it, expect } from 'vitest';
import Square from './Square';

describe('Square', () => {
    it('should be a function component', () => {
        expect(typeof Square).toBe('function');
    });

    it('should accept width, height and background props', () => {
        const element = Square({ width: '100px', height: '100px', background: 'red' }) as any;
        expect(element.props.style.width).toBe('100px');
        expect(element.props.style.height).toBe('100px');
        expect(element.props.style.background).toBe('red');
    });

    it('should render with different dimensions', () => {
        const element = Square({ width: '200px', height: '50px', background: 'blue' }) as any;
        expect(element.props.style.width).toBe('200px');
        expect(element.props.style.height).toBe('50px');
        expect(element.props.style.background).toBe('blue');
    });
});
