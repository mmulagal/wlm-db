import { Typography } from '@netapp/design-system';
import React from 'react';
import styles from './SquareComponent.module.scss';

type SC = {
    value: string;
    color: string;
    text: string;
    boldValue?: boolean;
};

const SquareComponent = ({ value, color, text, boldValue }: SC) => {
    return (
        <div className={styles.container}>
            {!boldValue && (
                <Typography className={styles.valueText} variant="Regular_14">
                    {value}
                </Typography>
            )}
            {boldValue && <Typography variant="Semibold_14">{value}</Typography>}
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
