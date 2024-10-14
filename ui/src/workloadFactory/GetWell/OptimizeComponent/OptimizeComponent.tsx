import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as DevCircle } from '../../../assets/DevCircle.svg';
import styles from './OptimizeComponent.module.scss';
import GetWellBar from './GetWellBar/GetWellBar';

type OptimizeComponentType = {
    text: string;
    value: string | any;
    image: any;
    isComingSoon: boolean;
};

const OptimizeComponent = ({ text, value, image, isComingSoon }: OptimizeComponentType) => {
    const loading = false;
    return (
        <div className={styles.optimizeComponent}>
            <div className={styles.svgContainer}>{image}</div>

            <div className={styles.rightSection}>
                <div className={styles.topSection}>
                    <div className={styles.textWithLoading}>
                        <DsTypography variant="Semibold_14">{text}</DsTypography>
                        {loading && !isComingSoon && <DsFlashingDotsLoader />}
                    </div>

                    <div className={styles.optimizeText}>
                        <DsTypography variant="Regular_20" style={{ lineHeight: 'unset' }}>
                            {value}
                        </DsTypography>
                        {/* <DsTypography variant="Regular_14">Optimized</DsTypography> */}
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <GetWellBar barValue={value} isComingSoon={isComingSoon} />
                </div>

                {!isComingSoon && (
                    <div className={styles.bottomTextSection}>
                        <DsTypography variant="Regular_14">Optimized configurations:</DsTypography>
                        {!loading && <DsTypography variant="Semibold_14">6 out of 11</DsTypography>}
                        {loading && <DsTypography variant="Semibold_14">0 out of X</DsTypography>}
                    </div>
                )}
                {isComingSoon && <div style={{ height: '24px' }} />}
            </div>
        </div>
    );
};

export default OptimizeComponent;
