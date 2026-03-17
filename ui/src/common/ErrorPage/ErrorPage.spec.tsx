import { describe, it, expect } from 'vitest';
import ErrorPage from './ErrorPage';

describe('ErrorPage', () => {
    it('should be a function component', () => {
        expect(typeof ErrorPage).toBe('function');
    });

    it('should accept a message prop', () => {
        const component = ErrorPage({ message: 'Test error message' });
        expect(component).toBeTruthy();
    });

    it('should accept null message', () => {
        const component = ErrorPage({ message: null });
        expect(component).toBeTruthy();
    });

    it('should render with message prop', () => {
        const component = ErrorPage({ message: 'Custom error' }) as any;
        expect(component.props).toBeDefined();
    });
});
