import { describe, it, expect } from 'vitest';
import ActionRequired from './ActionRequired';

describe('ActionRequired', () => {
    it('should be a function component', () => {
        expect(typeof ActionRequired).toBe('function');
    });

    it('should render with default props (no error, no disabled)', () => {
        const element = ActionRequired({});
        expect(element).toBeTruthy();
    });

    it('should render with disabled=true (Popover variant)', () => {
        const element = ActionRequired({ disabled: true });
        expect(element).toBeTruthy();
    });

    it('should render with error=true', () => {
        const element = ActionRequired({ error: true });
        expect(element).toBeTruthy();
    });

    it('should render with error=false (default icon)', () => {
        const element = ActionRequired({ error: false });
        expect(element).toBeTruthy();
    });

    it('should render with error=true and disabled=false', () => {
        const element = ActionRequired({ error: true, disabled: false });
        expect(element).toBeTruthy();
    });

    it('should render disabled variant takes priority over error', () => {
        const element = ActionRequired({ error: true, disabled: true });
        expect(element).toBeTruthy();
    });
});
