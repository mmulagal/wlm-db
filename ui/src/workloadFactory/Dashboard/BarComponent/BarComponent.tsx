import { DsTypography } from '@netapp/design-system';
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
};

const BarComponent = ({
    color,
    headingText,
    percentage,
    bottomText,
    beforeOutOf,
    afterOutOf,
    width,
    progressBarHeight
}: BarComponentType) => {
    return (
        <div className={styles.barComponent}>
            <div className={styles.rightSection} style={{ width: width }}>
                <div className={styles.topSection}>
                    <div className={styles.textWithLoading}>
                        <DsTypography variant="Semibold_14">{headingText}</DsTypography>
                    </div>

                    <div className={styles.optimizeText}>
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {percentage + '%'}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <div className={styles.getWellBar}>
                        <ProgressBar value={percentage} color={color} />
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
