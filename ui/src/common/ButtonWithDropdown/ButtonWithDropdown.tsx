import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { PopoverConfig } from '@netapp/design-system/dist/hooks/usePopover';
import { Button } from '@netapp/design-system';
import { ButtonProps } from '@netapp/design-system/dist/components/Button';
import _map from 'lodash/map';
import _isFunction from 'lodash/isFunction';
import { ReactComponent as ArrowDownIcon } from '@netapp/icons/ic_dropdown_arrow_down.svg';
import useButtonDropdown, { ButtonDropdownConfig } from './useButtonDropdown';
import styles from './ButtonWithDropdown.module.scss';

type ItemProps = (ButtonProps<'button' | 'a'> & { items?: ItemProps })[];

export interface ButtonWithDropdownProps extends Omit<ButtonProps<'button'>, 'Component' | 'ref' | 'variant'> {
    /** Open dropdown by default */
    isActive?: boolean;
    /** Trigger that toggle dropdown */
    trigger?: PopoverConfig['trigger'];
    /** Position of dropdown */
    placement?: 'bottom' | 'bottom-start' | 'bottom-end';
    /** Button dropdown style variation */
    variant?: 'primary' | 'secondary' | 'icon' | 'text';
    /** Props for items (button|a) inside dropdown. Recommended to define them outside a component or to useMemo to memoize them. */
    items: ItemProps;
    /** Additional config for dropdown */
    dropdownConfig?: ButtonDropdownConfig;
}

export const ButtonWithDropdown: React.FC<ButtonWithDropdownProps> = ({
    children,
    className,
    items,
    trigger = 'click',
    placement,
    dropdownConfig,
    isActive,
    ...props
}) => {
    const _isDisabled = props?.isDisabled || props?.disabled || props?.isLoading;

    const { isDropdownActive, setButtonRef, dropdownProps, onItemClick } = useButtonDropdown({
        trigger,
        placement: placement || (props?.variant === 'icon' && 'bottom') || 'bottom-start',
        isDisabled: _isDisabled,
        isActive,
        ...(dropdownConfig || {})
    });

    const dropdownChildren = React.useMemo(
        () =>
            _map(items, ({ className, children, onClick, ...dropdownItemProps }, dropdownItemIndex) => {
                const subItems = dropdownItemProps.items;

                const secondLevelMenuProps = {
                    items: subItems,
                    dropdownConfig: {
                        placement: 'right-start',
                        trigger: 'hover'
                    }
                };
                const Component = subItems ? ButtonWithDropdown : Button;
                return (
                    <Component
                        key={dropdownItemIndex}
                        // @ts-ignore
                        variant="text"
                        className={classNames(styles['dropdown-container-item'], className, {
                            // @ts-ignore
                            [styles.disabled]: dropdownItemProps?.isDisabled || dropdownItemProps?.disabled,
                            [styles['has-icon']]: dropdownItemProps?.icon
                        })}
                        onClick={(e: React.SyntheticEvent) => {
                            onItemClick();
                            _isFunction(onClick) && onClick(e as any);
                        }}
                        {...dropdownItemProps}
                        {...(subItems ? secondLevelMenuProps : {})}
                    >
                        {children}
                    </Component>
                );
            }),
        [items, onItemClick]
    );
    return (
        <Button
            isHovered={isDropdownActive}
            className={classNames(styles.base, className, {
                [styles['is-icon-variant']]: props?.variant === 'icon',
                [styles['is-small']]: props?.variant !== 'icon' && props?.isThin,
                [styles['has-icon']]: props?.variant !== 'icon' && props?.icon,
                [styles['is-text-variant']]: props?.variant === 'text',
                [styles['has-cursor']]: !_isDisabled,
                [styles['is-active']]: isDropdownActive
            })}
            ref={setButtonRef}
            {...props}
        >
            {children}
            {props?.variant !== 'icon' && (
                <span className={styles['dropdown-icon-container']}>
                    <ArrowDownIcon className={styles['dropdown-icon']} />
                </span>
            )}
            {isDropdownActive && ReactDOM.createPortal(<div {...dropdownProps}>{dropdownChildren}</div>, document.body)}
        </Button>
    );
};
