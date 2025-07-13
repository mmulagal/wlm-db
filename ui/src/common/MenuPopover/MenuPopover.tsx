import React, { useRef, useEffect } from 'react';
import { Popover as DesignPopover } from '@netapp/design-system';

import CustomContentInfo from '../CustomContentInfo/CustomContentInfo';
import { ReactComponent as MenuIcon } from '../../assets/menu-icon2.svg';
import { ReactComponent as ArrowIcon } from '../../assets/row_arrow.svg';
import styles from './MenuPopover.module.scss';

export type MenuItemType = {
    infoText?: string;
    displayName: string;
    disabled?: boolean;
    id: string;
    onlyInfoText?: string;
    subMenu?: MenuItemType[];
    tagAdded?: boolean;
    tag?: any;
    customComponent?: any;
};

type MenuPopoverType = {
    isMenuOpen: boolean;
    menuItems: MenuItemType[];
    toggleMenu: (toggleType: string, menuId: string) => void;
    isDisabled?: boolean;
    CustomMenu?: any;
    disabledText?: string | boolean | any;
    preferredLocation?: any;
    isSubmenu?: boolean;
    isBlackLayout?: boolean;
    customColor?: string;
    menuType?: string;
};

function MenuPopover({
    isMenuOpen,
    menuItems,
    toggleMenu,
    isDisabled = false,
    CustomMenu,
    disabledText,
    preferredLocation = 'left',
    isSubmenu,
    isBlackLayout = false,
    customColor,
    menuType = 'default'
}: MenuPopoverType) {
    const refMenuContent = useRef<HTMLDivElement>(null);
    const refParent = useRef<HTMLDivElement>(null);

    const handleClick = (e: any) => {
        if (
            isMenuOpen &&
            refMenuContent.current &&
            refParent &&
            !refMenuContent.current.contains(e.target) &&
            !refParent.current?.contains(e.target)
        ) {
            toggleMenu('close', '');
        }
    };

    const renderMenuItem = (item: MenuItemType, index: number): any => {
        if (!item.subMenu) {
            const menuItem = (
                <li
                    id={item?.id}
                    key={`menu-item-${index}`}
                    className={item.disabled ? styles.menuDisabled : styles.menuEnabled}
                    onClick={() => {
                        if (!item.disabled) {
                            toggleMenu('selectedOption', item.id);
                        }
                    }}
                >
                    {item?.displayName}
                    {item.tagAdded && <div style={{ marginLeft: '-8px' }}>{item.tag}</div>}
                    {item?.customComponent}
                </li>
            );

            if (item.disabled && item.infoText) {
                return (
                    <DesignPopover trigger="hover" placement="left" container={menuItem}>
                        {item.infoText}
                    </DesignPopover>
                );
            }
            return menuItem;
        }
        return (
            <li key={`menu-item-${index}`} className={`${styles.submenu} ${item.disabled ? styles.menuDisabled : ''}`}>
                <DesignPopover
                    containerClass={styles.subMenuContainerWithArrow}
                    popoverClass={styles.subMenuContainer}
                    placement="left"
                    trigger="click"
                    children={<div>{item.subMenu.map((subItem, index) => renderMenuItem(subItem, index))}</div>}
                    container={
                        <div className={styles.menuWithArrow}>
                            {item.displayName}
                            <ArrowIcon />
                        </div>
                    }
                />
            </li>
        );
    };

    useEffect(() => {
        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('click', handleClick);
        };
    });

    const ContentClass = () => {
        if (isBlackLayout) {
            return `${styles.content} ${styles.blackContent}`;
        }
        return `${styles.content}`;
    };

    const handleVisibleChange = (visible: boolean) => {
        if (!visible) {
            toggleMenu('close', '');
        }
    };

    // Function to display the Menu icon for popover
    const menuIconDisplay = () => {
        if (menuType === 'default') {
            return (
                <div
                    onClick={() => {
                        toggleMenu(isMenuOpen ? 'close' : 'open', '');
                    }}
                    ref={refParent}
                    className={isMenuOpen ? `${styles.menuIcon} ${styles.selected}` : styles.menuIcon}
                    style={{ color: customColor }}
                >
                    <span className={styles.menuPointer}>...</span>
                </div>
            );
        }
        if (menuType === 'downIcon') {
            return (
                <div
                    onClick={() => {
                        toggleMenu(isMenuOpen ? 'close' : 'open', '');
                    }}
                    className={styles.downMenuIcon}
                    ref={refParent}
                >
                    <MenuIcon />
                </div>
            );
        }
    };

    return (
        <DesignPopover
            containerClass={styles.popover}
            popoverClass={styles.subMenuContainer}
            placement={preferredLocation}
            isAppendedToBody
            trigger="click"
            onVisibleChange={handleVisibleChange}
            children={
                isMenuOpen && (
                    <div className={styles.menuPopoverContainer}>
                        <div className={`${styles.reactPopover} ${styles.infoTooltip}`}>
                            <div ref={refMenuContent} className={ContentClass()}>
                                <ul>
                                    {menuItems.map((menuItem, index) => {
                                        const {
                                            infoText = '',
                                            displayName = '',
                                            disabled = false,
                                            id,
                                            onlyInfoText
                                        } = menuItem;

                                        return (
                                            <div key={index}>
                                                {infoText ? (
                                                    <CustomContentInfo
                                                        tooltipText={infoText}
                                                        CustomContent={
                                                            <div
                                                                className={`${styles.menuInfoHover} ${styles.menuDisabled}`}
                                                            >
                                                                {displayName}
                                                            </div>
                                                        }
                                                    />
                                                ) : onlyInfoText ? (
                                                    <div
                                                        onClick={() => {
                                                            if (!disabled) {
                                                                toggleMenu('selectedOption', id);
                                                            }
                                                        }}
                                                        key={index}
                                                    >
                                                        <CustomContentInfo
                                                            tooltipText={onlyInfoText}
                                                            CustomContent={<li>{displayName}</li>}
                                                        />
                                                    </div>
                                                ) : (
                                                    renderMenuItem(menuItem, index)
                                                )}
                                            </div>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    </div>
                )
            }
            container={
                <>
                    {CustomMenu ? (
                        <div ref={refParent}>{CustomMenu}</div>
                    ) : isDisabled ? (
                        <CustomContentInfo
                            tooltipText={disabledText}
                            CustomContent={
                                <div className={styles.menuPointerDisabled}>
                                    <span className={styles.menuPointer}>...</span>
                                </div>
                            }
                        />
                    ) : (
                        <div>{!isSubmenu && menuIconDisplay()}</div>
                    )}
                </>
            }
        />
    );
}

export default MenuPopover;
