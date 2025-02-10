import React, { ButtonHTMLAttributes, DetailedHTMLProps, ReactNode } from 'react';

import styles from './ButtonBase.module.scss';
import classNames from 'classnames';

export interface ButtonBaseProps extends DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
    /** Button content  */
    children?: ReactNode;
    /** Custom classname  */
    className?: string;
    /** Is the button Disabled?  */
    isDisabled?: boolean;
}
/** button base used for any clickable element which doesnt look like a button  */
export const ButtonBase = ({ children, className, isDisabled, ...rest }: ButtonBaseProps) => {
    return (
        <button
            className={classNames(styles[`button-base`], className)}
            type={'button'}
            disabled={isDisabled}
            {...rest}
        >
            {children}
        </button>
    );
};
