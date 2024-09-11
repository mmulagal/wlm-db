import { DsTypography } from '@netapp/design-system';
import { ReactComponent as DevCircle } from '../../../assets/DevCircle.svg';
import styles from './OptimizeComponent.module.scss';
import GetWellBar from './GetWellBar/GetWellBar';

const OptimizeComponent = () => {
    return (
        <div className={styles.optimizeComponent}>
            <div className={styles.svgContainer}>
                <DevCircle />
            </div>

            <div className={styles.rightSection}>
                <div className={styles.topSection}>
                    <DsTypography variant="Semibold_14">Storage</DsTypography>
                    <div className={styles.optimizeText}>
                        <DsTypography variant="Regular_20" style={{ lineHeight: 'unset' }}>
                            50%
                        </DsTypography>
                        <DsTypography variant="Regular_14">Optimized</DsTypography>
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <GetWellBar />
                </div>
            </div>
        </div>
    );
};

export default OptimizeComponent;
