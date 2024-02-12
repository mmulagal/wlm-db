import React, { useRef, useEffect } from 'react';
//@ts-ignore
import Popover from 'react-popover';
import { Popover as DesignPopover } from '@netapp/design-system';
import CustomContentInfo from '../CustomContentInfo/CustomContentInfo';
import { ReactComponent as ArrowRight } from '@netapp/icons/ic_arrow_right.svg';
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
    CustomMenu?: JSX.Element;
    disabledText?: string;
    prefferedLocation?: Popover.PopoverPlace;
    isSubmenu?: boolean;
    isBlackLayout?: boolean;
    customColor?: string;
};

function MenuPopover({
    isMenuOpen,
    menuItems,
    toggleMenu,
    isDisabled = false,
    CustomMenu,
    disabledText,
    prefferedLocation,
    isSubmenu,
    isBlackLayout = false,
    customColor
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

    const renderMenuItem = (item: MenuItemType, index: number): JSX.Element => {
        if (!item.subMenu) {
            const menuItem = (
                <li
                    key={`menu-item-${index}`}
                    className={item.disabled ? styles.menuDisabled : styles.menuEnabled}
                    onClick={() => {
                        if (!item.disabled) {
                            toggleMenu('selectedOption', item.id);
                        }
                    }}
                >
                    {item?.displayName}
                    {item.tagAdded && item.tag}
                    {item?.customComponent}
                </li>
            );

            if (item.disabled && item.infoText) {
                return (
                    <DesignPopover trigger={'hover'} placement="left" container={menuItem}>
                        {item.infoText}
                    </DesignPopover>
                );
            } else {
                return menuItem;
            }
        } else {
            return (
                <>
                    <li
                        key={`menu-item-${index}`}
                        className={`${styles.submenu} ${item.disabled ? styles.menuDisabled : ''}`}
                    >
                        <DesignPopover
                            containerClass={styles.subMenuContainerWithArrow}
                            popoverClass={styles.subMenuContainer}
                            placement="left"
                            trigger="click"
                            children={<div>{item.subMenu.map((subItem, index) => renderMenuItem(subItem, index))}</div>}
                            container={
                                <div className={styles.menuWithArrow}>
                                    {item.displayName}
                                    <ArrowRight />
                                </div>
                            }
                        />
                    </li>
                </>
            );
        }
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
        } else {
            return `${styles.content}`;
        }
    };

    return (
        <>
            <Popover
                className={styles.popover}
                isOpen={isMenuOpen}
                body={
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
                                                <>
                                                    {infoText ? (
                                                        <CustomContentInfo
                                                            tooltipText={infoText}
                                                            CustomContent={
                                                                <div className={styles.menuInfoHover}>
                                                                    {displayName}
                                                                </div>
                                                            }
                                                        ></CustomContentInfo>
                                                    ) : onlyInfoText ? (
                                                        <div
                                                            onClick={() => {
                                                                if (!disabled) {
                                                                    toggleMenu('selectedOption', id);
                                                                }
                                                            }}
                                                        >
                                                            <CustomContentInfo
                                                                tooltipText={onlyInfoText}
                                                                CustomContent={<li>{displayName}</li>}
                                                            ></CustomContentInfo>
                                                        </div>
                                                    ) : (
                                                        renderMenuItem(menuItem, index)
                                                    )}
                                                </>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )
                }
                preferPlace={prefferedLocation ?? 'below'}
            >
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
                    <div>
                        {!isSubmenu && (
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
                        )}
                    </div>
                )}
            </Popover>
        </>
    );
}

export default MenuPopover;
