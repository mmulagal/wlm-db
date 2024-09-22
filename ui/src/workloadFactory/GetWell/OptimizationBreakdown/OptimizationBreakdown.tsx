import { DsTypography } from '@netapp/design-system';
import { ReactComponent as DevCircle } from '../../../assets/DevCircle.svg';
import styles from './OptimizationBreakdown.module.scss';
import OptimizeComponent from '../OptimizeComponent/OptimizeComponent';

const OptimizationBreakdown = () => {
    return (
        <div className={styles.optimizationBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Optimization Breakdown by category
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.leftSide}>
                    <OptimizeComponent value={'50%'} text={'Storage'} image={<DevCircle />} />
                    <OptimizeComponent value={'50%'} text={'Compute'} image={<DevCircle />} />
                    <OptimizeComponent value={'75%'} text={'Applications'} image={<DevCircle />} />
                </div>

                <div className={styles.rightSide}>
                    <OptimizeComponent value={'100%'} text={'Resiliency'} image={<DevCircle />} />
                    <OptimizeComponent value={'50%'} text={'Cloning'} image={<DevCircle />} />
                </div>
            </div>
        </div>
    );
};

export default OptimizationBreakdown;
