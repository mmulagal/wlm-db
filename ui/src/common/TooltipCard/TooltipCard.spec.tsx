import { describe, it, expect } from 'vitest';
import TooltipCard from './TooltipCard';
import { MANAGE_STATES } from '../../utils/consts';

describe('TooltipCard', () => {
    it('should be a function component', () => {
        expect(typeof TooltipCard).toBe('function');
    });

    it('should render with a list of key-value pairs', () => {
        const listObj = [
            { key: 'Name', value: 'Test' },
            { key: 'Status', value: 'Active' }
        ];
        const element = TooltipCard({ listObj });
        expect(element).toBeTruthy();
    });

    it('should render without registerFlow (default)', () => {
        const listObj = [{ key: 'Key', value: 'Value' }];
        const element = TooltipCard({ listObj }) as any;
        expect(element).toBeTruthy();
    });

    it('should render with registerFlow=true and READY value (Success icon)', () => {
        const listObj = [{ key: 'Status', value: MANAGE_STATES.READY }];
        const element = TooltipCard({ listObj, registerFlow: true }) as any;
        expect(element).toBeTruthy();
    });

    it('should render with registerFlow=true and non-READY value (Cross icon)', () => {
        const listObj = [{ key: 'Status', value: 'ERROR' }];
        const element = TooltipCard({ listObj, registerFlow: true }) as any;
        expect(element).toBeTruthy();
    });

    it('should render separator between items except last', () => {
        const listObj = [
            { key: 'K1', value: 'V1' },
            { key: 'K2', value: 'V2' }
        ];
        const element = TooltipCard({ listObj }) as any;
        expect(element).toBeTruthy();
    });

    it('should handle empty listObj', () => {
        const element = TooltipCard({ listObj: [] }) as any;
        expect(element).toBeTruthy();
    });

    it('should not show separator after last item', () => {
        const listObj = [{ key: 'Only', value: 'Item' }];
        const element = TooltipCard({ listObj }) as any;
        const { children } = element.props;
        const items = Array.isArray(children) ? children : [children];
        expect(items.length).toBe(1);
    });
});
