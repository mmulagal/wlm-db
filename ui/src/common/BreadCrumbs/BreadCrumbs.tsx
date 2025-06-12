import React from 'react';
import { DsTypography, Typography } from '@netapp/design-system';
import styles from './BreadCrumbs.module.scss';
import { ReactComponent as Splitter } from '../../assets/selection-splitter.svg';

export type BreadCrumbItem = {
    title: string;
    onClick?: () => void;
    dataTestId?: string;
};

type BreadCrumbsProps = {
    items: BreadCrumbItem[];
};

const BreadCrumbs = (props: BreadCrumbsProps) => {
    const getItems = () => {
        const { length } = props.items;
        return props.items.map((item, index) => (
            <div className={styles['bread-crumbs-item']} key={index}>
                {item?.dataTestId && (
                    <DsTypography
                        className={`${styles.title} ${item.onClick ? styles.link : ''}`}
                        onClick={item.onClick}
                        data-testid={item?.dataTestId || ''}
                        variant="Semibold_14"
                        color={item.onClick ? '#0067C5' : undefined}
                    >
                        {item.title}
                    </DsTypography>
                )}
                {!item?.dataTestId && (
                    <DsTypography
                        className={`${styles.title} ${item.onClick ? styles.link : ''}`}
                        onClick={item.onClick}
                        variant="Semibold_14"
                        color={item.onClick ? '#0067C5' : undefined}
                    >
                        {item.title}
                    </DsTypography>
                )}
                {index !== length - 1 && <Splitter />}
            </div>
        ));
    };

    return <div className={styles['bread-crumbs']}>{getItems()}</div>;
};

export default BreadCrumbs;
