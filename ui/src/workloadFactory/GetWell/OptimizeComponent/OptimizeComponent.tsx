import { DsTypography } from '@netapp/design-system';
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
    return (
        <div className={styles.optimizeComponent}>
            <div className={styles.svgContainer}>{image}</div>

            <div className={styles.rightSection}>
                <div className={styles.topSection}>
                    <DsTypography variant="Semibold_14">{text}</DsTypography>
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

                <div className={styles.bottomTextSection}>
                    <DsTypography variant="Regular_14">Optimized configuration:</DsTypography>
                    <DsTypography variant="Semibold_14">6 out of 11</DsTypography>
                </div>
            </div>
        </div>
    );
};

export default OptimizeComponent;
