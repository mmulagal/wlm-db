import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../assets/Compute.svg';
import { ReactComponent as ComingSoon } from '../../../assets/comingSoon2.svg';
import styles from './OptimizationBreakdown.module.scss';
import OptimizeComponent from '../OptimizeComponent/OptimizeComponent';
import { useAppSelector } from '../../../store/storeHooks';

const OptimizationBreakdown = () => {
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const optimizationBreakDown = useAppSelector(state => state.getWellOptimize.optimizationBreakDown);

    return (
        <div className={styles.optimizationBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Optimization Breakdown by category
                </DsTypography>
                {loading && <DsFlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <div className={styles.leftSide}>
                    <OptimizeComponent
                        value={optimizationBreakDown?.storage?.percent || 0}
                        data={optimizationBreakDown?.storage}
                        text={'Storage'}
                        image={<Storage />}
                        isComingSoon={false}
                    />
                    <OptimizeComponent
                        value={<ComingSoon />}
                        text={'Compute'}
                        image={<Compute />}
                        isComingSoon={true}
                    />
                    <OptimizeComponent
                        value={<ComingSoon />}
                        text={'Applications'}
                        image={<Applications />}
                        isComingSoon={true}
                    />
                </div>

                <div className={styles.rightSide}>
                    <OptimizeComponent
                        value={<ComingSoon />}
                        text={'Resiliency'}
                        image={<Resiliency />}
                        isComingSoon={true}
                    />
                    <OptimizeComponent
                        value={<ComingSoon />}
                        text={'Cloning'}
                        image={<Cloning />}
                        isComingSoon={true}
                    />
                </div>
            </div>
        </div>
    );
};

export default OptimizationBreakdown;
