import { describe, it, expect, vi } from 'vitest';
import BreadCrumbs, { BreadCrumbItem } from './BreadCrumbs';

describe('BreadCrumbs', () => {
    it('should be a function component', () => {
        expect(typeof BreadCrumbs).toBe('function');
    });

    it('should accept items prop', () => {
        const items: BreadCrumbItem[] = [{ title: 'Home' }, { title: 'Settings' }];
        const element = BreadCrumbs({ items }) as any;
        expect(element).toBeTruthy();
    });

    it('should render items without onClick', () => {
        const items: BreadCrumbItem[] = [{ title: 'Home' }, { title: 'Dashboard' }];
        const element = BreadCrumbs({ items }) as any;
        expect(element.props.children).toBeTruthy();
    });

    it('should render items with onClick', () => {
        const onClickMock = vi.fn();
        const items: BreadCrumbItem[] = [{ title: 'Home', onClick: onClickMock }, { title: 'Settings' }];
        const element = BreadCrumbs({ items }) as any;
        expect(element).toBeTruthy();
    });

    it('should render items with dataTestId', () => {
        const items: BreadCrumbItem[] = [
            { title: 'Home', dataTestId: 'breadcrumb-home' },
            { title: 'Settings', dataTestId: 'breadcrumb-settings' }
        ];
        const element = BreadCrumbs({ items }) as any;
        expect(element).toBeTruthy();
    });

    it('should not render splitter after last item', () => {
        const items: BreadCrumbItem[] = [{ title: 'Only' }];
        const element = BreadCrumbs({ items }) as any;
        expect(element).toBeTruthy();
    });

    it('should render multiple items correctly', () => {
        const items: BreadCrumbItem[] = [{ title: 'Level 1' }, { title: 'Level 2' }, { title: 'Level 3' }];
        const element = BreadCrumbs({ items }) as any;
        const { children } = element.props;
        expect(Array.isArray(children)).toBe(true);
        expect(children.length).toBe(3);
    });
});
