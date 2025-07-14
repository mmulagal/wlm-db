import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import styles from './BarComponent.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import ProgressBar from '../../../common/ProgressBar/ProgressBar';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { CONFIG_STATES, CONFIG_STATES_UI } from '../../../utils/consts';

type BarComponentType = {
    color: string;
    headingText?: string;
    percentage?: number | any;
    bottomText?: string;
    beforeOutOf?: string | number;
    afterOutOf?: string | number;
    width?: string;
    progressBarHeight?: string;
    from?: string;
    optimizePercentage?: number | any;
    loading?: boolean;
    textMessage?: string;
    textMessageVariant?: string | any;
    tooltipMessage?: string;
    isDisabled?: boolean;
};

const BarComponent = ({
    color,
    headingText,
    percentage,
    bottomText,
    beforeOutOf,
    afterOutOf,
    width,
    progressBarHeight,
    from,
    optimizePercentage,
    loading,
    textMessage,
    textMessageVariant,
    tooltipMessage,
    isDisabled = false
}: BarComponentType) => {
    const handleProgressBar = () => {
        const disabledColor = isDisabled ? 'var(--text-disabled)' : color;
        const borderColor = isDisabled ? 'var(--text-disabled)' : 'var(--border)';
        const chartColor = isDisabled ? 'var(--text-disabled)' : 'var(--chart-6)';
        
        if (percentage === 100 || isDisabled) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: disabledColor
                    }}
                />
            );
        }
        if (optimizePercentage !== 0 && percentage !== 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `${percentage}%`,
                            backgroundColor: disabledColor
                        }}
                    />
                    <div className={styles.separator} />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${optimizePercentage}%`,
                            backgroundColor: chartColor
                        }}
                    />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - (optimizePercentage + percentage)}%`,
                            backgroundColor: borderColor
                        }}
                    />
                </>
            );
        }

        if (percentage === 0 && optimizePercentage === 0) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: borderColor
                    }}
                />
            );
        }

        if (percentage !== 0 && optimizePercentage === 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${percentage}%`,
                            backgroundColor: disabledColor
                        }}
                    />

                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - percentage}%`,
                            backgroundColor: borderColor
                        }}
                    />
                </>
            );
        }

        if (percentage === 0 && optimizePercentage !== 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${optimizePercentage}%`,
                            backgroundColor: chartColor
                        }}
                    />

                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - optimizePercentage}%`,
                            backgroundColor: borderColor
                        }}
                    />
                </>
            );
        }
    };
    return (
        <div className={`${styles.barComponent} ${isDisabled ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.rightSection} style={{ width }}>
                <div className={styles.topSection}>
                    <div className={styles.textWithLoading}>
                        <DsTypography variant="Semibold_14" className={isDisabled ? CommonStyles.notAvailable : ''}>{headingText}</DsTypography>
                        {loading && <DsFlashingDotsLoader />}
                    </div>

                    <div className={styles.optimizeText}>
                        {!textMessage && (
                            <DsTypography variant={isDisabled ? "Regular_14" : "Regular_24"} style={{ lineHeight: 'unset' }} className={isDisabled ? CommonStyles.notAvailable : ''}>
                                {isDisabled ? percentage : `${percentage}%`}
                            </DsTypography>
                        )}

                        {textMessage && (
                            <DsTypography
                                variant={textMessageVariant || "Regular_24"}
                                style={{ lineHeight: 'unset', color: 'var(--text-disabled)' }}
                                className={isDisabled ? CommonStyles.notAvailable : ''}
                            >
                                {textMessage}
                            </DsTypography>
                        )}
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <div className={styles.getWellBar}>
                        {from === 'dashboard' && <div className={styles.progressBar}>{handleProgressBar()}</div>}

                        {from !== 'dashboard' && <ProgressBar value={percentage} color={isDisabled ? 'var(--text-disabled)' : color} />}
                    </div>
                </div>

                {!textMessage && (
                    <div className={styles.bottomTextSection}>
                        {tooltipMessage && <TooltipInfo>{tooltipMessage}</TooltipInfo>}
                        {bottomText && <DsTypography variant="Regular_14" className={isDisabled ? CommonStyles.notAvailable : ''}>{bottomText}</DsTypography>}
                        {(beforeOutOf !== undefined && afterOutOf !== undefined) && (
                            <DsTypography variant="Semibold_14" className={isDisabled ? CommonStyles.notAvailable : ''}>
                                {beforeOutOf} out of {afterOutOf}
                            </DsTypography>
                        )}
                    </div>
                )}

                {textMessage && (
                    <div className={styles.bottomTextSection}>
                        <Warning />
                        <DsTypography variant="Regular_14" className={isDisabled ? CommonStyles.notAvailable : ''}>
                            This configuration analysis is{' '}
                            {textMessage === CONFIG_STATES_UI.DISMISSED ? 'dismissed' : 'postponed'}.
                        </DsTypography>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BarComponent;
