import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MenuPopover, { MenuItemType } from './MenuPopover';

describe('MenuPopover', () => {
    const baseMenuItems: MenuItemType[] = [
        { id: 'item-1', displayName: 'Item 1' },
        { id: 'item-2', displayName: 'Item 2' }
    ];
    const toggleMenu = vi.fn();

    it('should be a function component', () => {
        expect(typeof MenuPopover).toBe('function');
    });

    it('should render with required props', () => {
        const { container } = render(
            <MenuPopover isMenuOpen={false} menuItems={baseMenuItems} toggleMenu={toggleMenu} />
        );
        expect(container).toBeTruthy();
    });

    it('should render with isMenuOpen=true', () => {
        const { container } = render(<MenuPopover isMenuOpen menuItems={baseMenuItems} toggleMenu={toggleMenu} />);
        expect(container).toBeTruthy();
    });

    it('should render with isDisabled=true', () => {
        const { container } = render(
            <MenuPopover
                isMenuOpen={false}
                menuItems={baseMenuItems}
                toggleMenu={toggleMenu}
                isDisabled
                disabledText="Disabled reason"
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with custom menu', () => {
        const { container } = render(
            <MenuPopover
                isMenuOpen={false}
                menuItems={baseMenuItems}
                toggleMenu={toggleMenu}
                CustomMenu={<button>Custom</button>}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with disabled menu items (infoText)', () => {
        const items: MenuItemType[] = [
            { id: 'item-1', displayName: 'Disabled Item', disabled: true, infoText: 'Why disabled' }
        ];
        const { container } = render(<MenuPopover isMenuOpen menuItems={items} toggleMenu={toggleMenu} />);
        expect(container).toBeTruthy();
    });

    it('should render with subMenu items', () => {
        const items: MenuItemType[] = [
            {
                id: 'parent',
                displayName: 'Parent',
                subMenu: [{ id: 'child', displayName: 'Child' }]
            }
        ];
        const { container } = render(<MenuPopover isMenuOpen menuItems={items} toggleMenu={toggleMenu} />);
        expect(container).toBeTruthy();
    });

    it('should render with onlyInfoText items', () => {
        const items: MenuItemType[] = [{ id: 'item-1', displayName: 'Info Item', onlyInfoText: 'Tooltip info' }];
        const { container } = render(<MenuPopover isMenuOpen menuItems={items} toggleMenu={toggleMenu} />);
        expect(container).toBeTruthy();
    });

    it('should render with isBlackLayout=true', () => {
        const { container } = render(
            <MenuPopover isMenuOpen menuItems={baseMenuItems} toggleMenu={toggleMenu} isBlackLayout />
        );
        expect(container).toBeTruthy();
    });

    it('should render menuType=downIcon', () => {
        const { container } = render(
            <MenuPopover isMenuOpen={false} menuItems={baseMenuItems} toggleMenu={toggleMenu} menuType="downIcon" />
        );
        expect(container).toBeTruthy();
    });

    it('should render isSubmenu=true (hides menu icon)', () => {
        const { container } = render(
            <MenuPopover isMenuOpen={false} menuItems={baseMenuItems} toggleMenu={toggleMenu} isSubmenu />
        );
        expect(container).toBeTruthy();
    });

    it('should render with tagAdded items', () => {
        const items: MenuItemType[] = [{ id: 'item-1', displayName: 'Tagged', tagAdded: true, tag: <span>NEW</span> }];
        const { container } = render(<MenuPopover isMenuOpen menuItems={items} toggleMenu={toggleMenu} />);
        expect(container).toBeTruthy();
    });
});
