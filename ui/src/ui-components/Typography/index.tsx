import React from 'react';
import classNames from 'classnames';
import styles from './../typography.module.scss';

type TypographyColors =
    | 'text-title'
    | 'text-disabled'
    | 'text-secondary'
    | 'error'
    | 'success'
    | 'info'
    | 'warning'
    | 'on-color';

type HeadingLevels = '40' | '32' | '24' | '20' | '16' | 40 | 32 | 24 | 20 | 16;

type TextLevels = '12' | '13' | '14' | 12 | 13 | 14;

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
        <Component className={classNames(styles.baseCard, className, { [styles.flex]: flex })} style={style} {...rest}>
            {children}
        </Component>
    );
};

export const Content = ({
    className,
    style,
    children,
    white
}: {
    className?: string;
    style?: any;
    children: any;
    white?: boolean;
}) => {
    return (
        <section className={classNames(styles.content, className, { [styles['white']]: white })} style={style}>
            {children}
        </section>
    );
};

export const Heading = ({
    children,
    level = '24',
    color,
    bold,
    italic,
    underline,
    center,
    ellipsis,
    nowrap,
    className,
    thin,
    ...rest
}: {
    children: any;
    level?: HeadingLevels;
    color?: TypographyColors;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    center?: boolean;
    ellipsis?: boolean;
    nowrap?: boolean;
    className?: string;
    thin?: boolean;
    style?: any;
    title?: string;
    rest?: any;
}) => {
    const _className = classNames(
        styles[`h0${level}`],
        {
            [styles.b]: bold,
            [styles.u]: underline,
            [styles.thin]: thin,
            [styles.i]: italic,
            [styles.c]: center,
            [styles.ellipsis]: ellipsis,
            //@ts-ignore
            [styles[color]]: color
        },
        className
    );

    return (
        <div role="heading" className={_className} {...rest}>
            {children}
        </div>
    );
};

export const Page = ({ className, style, children }: { className?: string; style?: any; children: any }) => {
    return (
        <div className={classNames(styles.page, className)} style={style}>
            {children}
        </div>
    );
};

export const TabHeader = ({ logo, Icon, label, children }: any) => {
    return (
        <header className={styles.base}>
            <div className={styles['service']}>
                {/* {logo && <SVG src={logo}/>}
            {Icon && <Icon/>} */}
                <Heading level={20} style={{ color: 'var(--text-primary' }}>
                    {label}
                </Heading>
            </div>
            {children}
        </header>
    );
};

export const Text = ({
    children,
    level = '14',
    color,
    bold,
    italic,
    center,
    ellipsis,
    nowrap,
    className,
    ...rest
}: {
    children: any;
    level?: TextLevels;
    color?: TypographyColors | any;
    bold?: boolean;
    italic?: boolean;
    center?: boolean;
    ellipsis?: boolean;
    nowrap?: boolean;
    style?: any;
    className?: string;
    title?: string;
}) => {
    const _className = classNames(
        styles[`body${level}`],
        {
            [styles.b]: bold,
            [styles.i]: italic,
            [styles.c]: center,
            [styles.ellipsis]: ellipsis,
            //@ts-ignore
            [styles[color]]: color,
            [styles['no-wrap']]: nowrap
        },
        className
    );

    return (
        <p className={_className} {...rest}>
            {children}
        </p>
    );
};

export const Span = ({
    children,
    level = '14',
    color,
    bold,
    italic,
    ellipsis,
    nowrap,
    className,
    ...rest
}: {
    children: any;
    level?: TextLevels;
    color?: TypographyColors;
    bold?: boolean;
    italic?: boolean;
    ellipsis?: boolean;
    nowrap?: boolean;
    style?: any;
    className?: string;
    title?: string;
}) => {
    const _className = classNames(
        styles[`body${level}`],
        {
            [styles.b]: bold,
            [styles.i]: italic,
            [styles.ellipsis]: ellipsis,
            //@ts-ignore
            [styles[color]]: color,
            [styles['no-wrap']]: nowrap
        },
        className
    );

    return (
        <span className={_className} {...rest}>
            {children}
        </span>
    );
};

export const Notice = ({
    children,
    noticeLabel = 'Notice',
    level = '14',
    className,
    style,
    bold,
    color = 'warning'
}: {
    children: any;
    noticeLabel: string;
    level: TextLevels;
    color?: TypographyColors;
    bold?: boolean;
    style?: any;
    className?: string;
}) => {
    return (
        <div className={className} style={style}>
            <Span bold={bold} color={color} level={level} className={styles.notice}>
                {noticeLabel}:
            </Span>
            <Span bold={bold} level={level}>
                {children}
            </Span>
        </div>
    );
};
