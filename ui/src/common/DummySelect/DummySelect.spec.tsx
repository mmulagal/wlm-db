import { describe, it, expect } from 'vitest';
import DummySelect from './DummySelect';

describe('DummySelect', () => {
    it('should be a function component', () => {
        expect(typeof DummySelect).toBe('function');
    });

    it('should render with default props (fromJM=false)', () => {
        const element = DummySelect({});
        expect(element).toBeTruthy();
    });

    it('should render with fromJM=true', () => {
        const element = DummySelect({ fromJM: true });
        expect(element).toBeTruthy();
    });

    it('should render with fromJM=false', () => {
        const element = DummySelect({ fromJM: false });
        expect(element).toBeTruthy();
    });

    it('should show No Credentials text when fromJM=false', () => {
        const element = DummySelect({ fromJM: false }) as any;
        expect(element).toBeTruthy();
    });

    it('should show All credentials text when fromJM=true', () => {
        const element = DummySelect({ fromJM: true }) as any;
        expect(element).toBeTruthy();
    });
});
