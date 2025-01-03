import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './BarComponent.module.scss';
import ProgressBar from '../../../common/ProgressBar/ProgressBar';

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
    loading
}: BarComponentType) => {
    const handleProgressBar = () => {
        if (percentage === 100) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: color
                        }}
                    ></div>
                </>
            );
        }
        if (optimizePercentage !== 0 && percentage !== 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `${percentage}%`,
                            backgroundColor: color
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${optimizePercentage}%`,
                            backgroundColor: 'var(--chart-6)'
                        }}
                    ></div>
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - (optimizePercentage + percentage)}%`,
                            backgroundColor: 'var(--border)'
                        }}
                    ></div>
                </>
            );
        }

        if (percentage === 0 && optimizePercentage === 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--border)'
                        }}
                    ></div>
                </>
            );
        }

        if (percentage !== 0 && optimizePercentage === 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${percentage}%`,
                            backgroundColor: color
                        }}
                    ></div>

                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - percentage}%`,
                            backgroundColor: 'var(--border)'
                        }}
                    ></div>
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
                            backgroundColor: 'var(--chart-6)'
                        }}
                    ></div>

                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - optimizePercentage}%`,
                            backgroundColor: 'var(--border)'
                        }}
                    ></div>
                </>
            );
        }
    };
    return (
        <div className={styles.barComponent}>
            <div className={styles.rightSection} style={{ width: width }}>
                <div className={styles.topSection}>
                    <div className={styles.textWithLoading}>
                        <DsTypography variant="Semibold_14">{headingText}</DsTypography>
                        {loading && <DsFlashingDotsLoader />}
                    </div>

                    <div className={styles.optimizeText}>
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {percentage + '%'}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <div className={styles.getWellBar}>
                        {from === 'dashboard' && <div className={styles.progressBar}>{handleProgressBar()}</div>}

                        {from !== 'dashboard' && <ProgressBar value={percentage} color={color} />}
                    </div>
                </div>

                <div className={styles.bottomTextSection}>
                    <DsTypography variant="Regular_14">{bottomText}</DsTypography>
                    <DsTypography variant="Semibold_14">
                        {beforeOutOf} out of {afterOutOf}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default BarComponent;
