import React from 'react';
import classNames from 'classnames';
import styles from './Layout.module.scss';

export const GridBreak = () => {
    return <GridItem lg={12} />;
};

export type GridVariant = 'flex' | 'grid';

export const Grid = ({
    children,
    className,
    style,
    centerContent = false,
    variant = 'flex'
}: {
    children: any;
    className?: string;
    style?: any;
    centerContent?: boolean;
    variant?: GridVariant;
}) => {
    return (
        <div
            className={classNames(className, variant === 'flex' ? styles.grid : styles.rigidGrid, {
                [styles['center-content']]: centerContent
            })}
            style={style}
        >
            {children}
        </div>
    );
};

export const GridItem = ({
    children,
    className,
    style,
    lg,
    md,
    sm
}: {
    children?: any;
    className?: string;
    style?: any;
    lg?: number | string | any;
    md?: number;
    sm?: number;
}) => {
    return (
        <div
            className={classNames(
                className,
                styles['grid-item'],
                lg && styles[`lg-${lg}`],
                md && styles[`md-${md}`],
                sm && styles[`sm-${sm}`]
            )}
            style={style}
        >
            {children}
        </div>
    );
};
