import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
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
                    <OptimizeComponent value={'50%'} text={'Storage'} image={<Storage />} />
                    <OptimizeComponent value={'50%'} text={'Compute'} image={<Storage />} />
                    <OptimizeComponent value={'75%'} text={'Applications'} image={<Applications />} />
                </div>

                <div className={styles.rightSide}>
                    <OptimizeComponent value={'100%'} text={'Resiliency'} image={<Resiliency />} />
                    <OptimizeComponent value={'50%'} text={'Cloning'} image={<Storage />} />
                </div>
            </div>
        </div>
    );
};

export default OptimizationBreakdown;
