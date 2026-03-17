import { describe, it, expect } from 'vitest';
import CustomContentInfo from './CustomContentInfo';

describe('CustomContentInfo', () => {
    it('should be a function component', () => {
        expect(typeof CustomContentInfo).toBe('function');
    });

    it('should render Popover when isToolTip=true (default)', () => {
        const element = CustomContentInfo({
            tooltipText: 'Tooltip text',
            CustomContent: <div>Content</div>,
            isToolTip: true
        }) as any;
        expect(element).toBeTruthy();
    });

    it('should render CustomContent when isToolTip=false and CustomContent is provided', () => {
        const content = <div>My Content</div>;
        const element = CustomContentInfo({
            isToolTip: false,
            CustomContent: content
        }) as any;
        expect(element).toBe(content);
    });

    it('should return null-ish when isToolTip=false and no CustomContent', () => {
        const element = CustomContentInfo({ isToolTip: false });
        // CustomContent is null by default, falsy && falsy = falsy
        expect(element).toBeFalsy();
    });

    it('should use default isToolTip=true', () => {
        const element = CustomContentInfo({ tooltipText: 'info' }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept customStyle prop', () => {
        const element = CustomContentInfo({
            tooltipText: 'tip',
            customStyle: { color: 'red' },
            isToolTip: true
        }) as any;
        expect(element.props.style).toEqual({ color: 'red' });
    });
});
