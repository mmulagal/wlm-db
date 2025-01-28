import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import React from 'react';
import styles from './SquareComponent.module.scss';

type SC = {
    value: string;
    color: string;
    text: string;
    boldValue?: boolean;
    isLoading?: boolean;
    loadingInFirstRow?: boolean;
};

const SquareComponent = ({ value, color, text, boldValue, loadingInFirstRow = false, isLoading = false }: SC) => {
    return (
        <div className={styles.container}>
            {!boldValue && (
                <div className={styles.headerArea}>
                    <Typography className={styles.valueText} variant="Semibold_14">
                        {value}
                    </Typography>

                    {loadingInFirstRow && (
                        <div className={styles.loadingClass}>
                            <DsFlashingDotsLoader />
                        </div>
                    )}
                </div>
            )}
            {boldValue && <Typography variant="Semibold_14">{value}</Typography>}
            <div className={styles.bottomRow}>
                <div className={styles.square} style={{ backgroundColor: color }} />
                <Typography
                    variant="Regular_14"
                    style={{ lineHeight: 'unset', width: 'max-content', whiteSpace: 'nowrap' }}
                >
                    {text}
                </Typography>
                {isLoading && <DsFlashingDotsLoader />}
            </div>
        </div>
    );
};

export default SquareComponent;
