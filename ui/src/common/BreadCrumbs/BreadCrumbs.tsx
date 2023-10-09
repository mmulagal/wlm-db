import React from 'react';
import styles from './BreadCrumbs.module.scss';
import { ReactComponent as Splitter } from '../../assets/selection-splitter.svg';
import { Typography } from '@netapp/design-system';

export type BreadCrumbItem = {
    title: string;
    onClick?: () => void;
};

type BreadCrumbsProps = {
    items: BreadCrumbItem[];
};

const BreadCrumbs = (props: BreadCrumbsProps) => {
    const getItems = () => {
        const length = props.items.length;
        return props.items.map((item, index) => {
            return (
                <div className={styles['bread-crumbs-item']}>
                    <Typography
                        className={`${styles.title} ${item.onClick ? styles.link : ''}`}
                        onClick={item.onClick}
                        variant="Semibold_14"
                        color={item.onClick ? '#0067C5' : undefined}
                    >
                        {item.title}
                    </Typography>
                    {index !== length - 1 && <Splitter />}
                </div>
            );
        });
    };

    return <div className={styles['bread-crumbs']}>{getItems()}</div>;
};

export default BreadCrumbs;
