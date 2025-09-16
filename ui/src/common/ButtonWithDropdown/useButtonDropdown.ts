import React from 'react';
import _isFunction from 'lodash/isFunction';
import usePopover, { PopoverConfig } from '@netapp/design-system/dist/hooks/usePopover';
import classNames from 'classnames';
import { css } from '@emotion/css';
import styles from './ButtonWithDropdown.module.scss';

type PropsToOmit = 'offsetTop' | 'offsetLeft' | 'popperOptions' | 'interactive' | 'defaultVisible';

export type ButtonDropdownConfig = Omit<PopoverConfig, PropsToOmit> & {
    /** Button dropdown content class */
    className?: string;
    /** Button dropdown is active */
    isActive?: boolean;
    /** Button is in disabled state */
    isDisabled?: boolean;
};

const DEFAULT_STATIC_CONFIG = {
    interactive: true,
    offsetLeft: 0,
    offsetTop: 8
};

const useButtonDropdown = (config: ButtonDropdownConfig) => {
    const { className, isDisabled, isActive, delayHide, closeOnOutsideClick, onVisibleChange, visible, ...configRest } =
        config || {};
    const [controlledVisibility, setControlledVisibility] = React.useState(isActive);

    const { getPopoverProps, setPopoverRef, setContainerRef, containerRef, isVisible } = usePopover({
        ...configRest,
        delayHide: delayHide || (configRest.trigger === 'hover' && 250) || 0,
        closeOnOutsideClick: closeOnOutsideClick || configRest.trigger === 'click',
        visible: controlledVisibility,
        onVisibleChange: (...args) => {
            if (!isActive) {
                setControlledVisibility(args[0]);
            }
            _isFunction(onVisibleChange) && onVisibleChange(...args);
        },
        ...DEFAULT_STATIC_CONFIG
    });

    const dropdownMinWidthClass = React.useMemo(() => {
        if (containerRef?.offsetWidth && containerRef.offsetWidth > 152) {
            return css`
                --dropdown-min-width: ${containerRef?.offsetWidth}px;
            `;
        }
    }, [containerRef]);

    return {
        onItemClick: () => {
            if (!isActive) {
                setControlledVisibility(false);
            }
        },
        isDropdownActive: !isDisabled && isVisible,
        setButtonRef: setContainerRef,
        dropdownProps: getPopoverProps({
            ref: setPopoverRef,
            className: classNames(styles['dropdown-container'], className, dropdownMinWidthClass)
        })
    };
};

export default useButtonDropdown;
