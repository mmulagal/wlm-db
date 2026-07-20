import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import React from 'react';
import styles from './SquareComponent.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import EllipsisTooltipText from '../../../common/EllipsisTooltipText/EllipsisTooltipText';

type SC = {
    value: string;
    color: string;
    text: string;
    boldValue?: boolean;
    isLoading?: boolean;
    loadingInFirstRow?: boolean;
    isSmall?: boolean;
    showNA?: boolean;
};

const SquareComponent = ({
    value,
    color,
    text,
    boldValue,
    loadingInFirstRow = false,
    isLoading = false,
    isSmall = false,
    showNA = false
}: SC) => (
    <div className={styles.container}>
        {!boldValue && (
            <div className={styles.headerArea}>
                <Typography
                    className={`${showNA ? '' : styles.valueText} ${showNA ? CommonStyles.notAvailable : ''}`}
                    variant="Semibold_14"
                >
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
        {boldValue && (
            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                {value}
            </Typography>
        )}
        <div className={styles.bottomRow}>
            <div
                className={`${styles.square} ${showNA ? CommonStyles.notAvailable : ''}`}
                style={{ backgroundColor: showNA ? 'var(--text-disabled)' : color }}
            />
            <EllipsisTooltipText
                text={text}
                className={`${styles.labelText} ${showNA ? CommonStyles.notAvailable : ''}`}
            />
            {isLoading && <DsFlashingDotsLoader />}
        </div>
    </div>
);

export default SquareComponent;
