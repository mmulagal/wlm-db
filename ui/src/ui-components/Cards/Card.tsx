import React from 'react';
import styles from './Card.module.scss';
import classNames from 'classnames';

//@ts-ignore
import _ from 'lodash';

export const Card = ({
    children,
    className,
    style,
    hasHoverEffect,
    Component = 'div',
    flex,
    ...rest
}: {
    children: any;
    className?: string;
    hasHoverEffect?: boolean;
    Component?: any;
    style?: any;
    flex?: boolean;
}) => {
    return (
        <Component className={classNames(styles.base, className, { [styles.flex]: flex })} style={style} {...rest}>
            {children}
        </Component>
    );
};

export const CardHeader = ({ children, className, style }: { children: any; className?: string; style?: any }) => {
    return (
        <div className={classNames(styles.header, className)} style={style}>
            {children}
        </div>
    );
};

type CardContentSize = 'default' | 'small';

export const CardContent = ({
    children,
    className,
    style,
    size = 'default'
}: {
    children: any;
    className?: string;
    style?: any;
    size?: CardContentSize;
}) => {
    return (
        <div className={classNames(styles.content, styles[size], className)} style={style}>
            {children}
        </div>
    );
};

export const CardTitle = ({
    children,
    className,
    style,
    SubHeader
}: {
    children: any;
    className?: string;
    style?: any;
    SubHeader?: any;
}) => {
    const isString = _.isString(children);
    return (
        <div className={classNames(styles.title, className)} style={style} title={isString ? children : undefined}>
            {children}
            {SubHeader && <div className={styles['sub-header']}>{SubHeader}</div>}
        </div>
    );
};

type CardTableColumns =
    | 'lg-1'
    | 'lg-2'
    | 'lg-3'
    | 'lg-4'
    | 'lg-5'
    | 'lg-6'
    | 'md-1'
    | 'md-2'
    | 'md-3'
    | 'md-4'
    | 'md-5'
    | 'md-6'
    | 'sm-1'
    | 'sm-2'
    | 'sm-3'
    | 'sm-4'
    | 'sm-5'
    | 'sm-6';

export const CardTableContent = ({
    children,
    className,
    style,
    columns = 'lg-3'
}: {
    children: any;
    className?: string;
    style?: any;
    columns?: CardTableColumns;
}) => {
    return (
        <div className={classNames(styles['table-content'], styles[columns], className)} style={style}>
            {children}
        </div>
    );
};

export const CardTableItem = ({ children }: { children: any }) => {
    return <div className={styles['table-item']}>{children}</div>;
};

export const CardWidgets = ({ children }: { children: any }) => {
    return <div className={styles.cardWidgets}>{children}</div>;
};

export const CardMetricContent = ({ children }: { children: any }) => {
    return <div className={styles.cardMetricContent}>{children}</div>;
};
