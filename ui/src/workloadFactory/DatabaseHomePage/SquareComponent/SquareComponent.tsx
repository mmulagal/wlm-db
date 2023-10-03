import { Typography } from '@netapp/design-system';
import React from 'react';
import styles from './SquareComponent.module.scss';

type SC = {
    value: string;
    color: string;
    text: string;
};

const SquareComponent = ({ value, color, text }: SC) => {
    return (
        <div className={styles.container}>
            <Typography variant="Regular_14">{value}</Typography>
            <div className={styles.bottomRow}>
                <div className={styles.square} style={{ backgroundColor: color }} />
                <Typography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                    {text}
                </Typography>
            </div>
        </div>
    );
};

export default SquareComponent;
