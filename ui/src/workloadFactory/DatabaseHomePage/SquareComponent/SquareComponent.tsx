import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import React from 'react';
import styles from './SquareComponent.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

type SC = {
    value: string;
    color: string;
    text: string;
    boldValue?: boolean;
    isLoading?: boolean;
    loadingInFirstRow?: boolean;
    isSmall?: boolean;
    isDisabled?: boolean;
};

const SquareComponent = ({
    value,
    color,
    text,
    boldValue,
    loadingInFirstRow = false,
    isLoading = false,
    isSmall = false,
    isDisabled = false
}: SC) => (
    <div className={styles.container}>
        {!boldValue && (
            <div className={styles.headerArea}>
                <Typography className={`${styles.valueText} ${isDisabled ? CommonStyles.notAvailable : ''}`} variant="Semibold_14">
                    {value}
                </Typography>

                {loadingInFirstRow && !isSmall && (
                    <div className={styles.loadingClass}>
                        <DsFlashingDotsLoader />
                    </div>
                )}

                {loadingInFirstRow && isSmall && (
                    <div className={styles.loadingClassSmall}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
            </div>
        )}
        {boldValue && <Typography variant="Semibold_14" className={isDisabled ? CommonStyles.notAvailable : ''}>{value}</Typography>}
        <div className={styles.bottomRow}>
            <div className={styles.square} style={{ backgroundColor: color }} />
            <Typography
                variant="Regular_14"
                style={{ lineHeight: 'unset', width: 'max-content', whiteSpace: 'nowrap' }}
                className={isDisabled ? CommonStyles.notAvailable : ''}
            >
                {text}
            </Typography>
            {isLoading && <DsFlashingDotsLoader />}
        </div>
    </div>
);

export default SquareComponent;
