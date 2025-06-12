import React from 'react';
import classNames from 'classnames';
import styles from './ProgressLoader.module.scss';

type ProgressLoaderSize = 'large' | 'small';

const ProgressLoader = ({
    percent,
    thumbClassName,
    thumbStyle,
    className,
    style,
    indeterminate,
    size = 'large'
}: {
    percent?: number;
    thumbClassName?: string;
    thumbStyle?: any;
    style?: any;
    indeterminate?: boolean;
    size?: ProgressLoaderSize;
    className?: string;
}) => (
    <div
        className={classNames(styles.track, className, {
            [styles.indeterminate]: indeterminate,
            [styles.small]: size === 'small'
        })}
        style={style}
    >
        <div
            className={classNames(styles.thumb, thumbClassName)}
            style={{ ...thumbStyle, width: indeterminate ? undefined : `${percent}%` }}
        />
    </div>
);

export default ProgressLoader;
