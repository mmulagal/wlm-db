import { DsTypography } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByCategory.module.scss';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../assets/Compute.svg';
import CategoryComponent from './CategoryComponent/CategoryComponent';

const ManagedInstanceOptimizationBreakdownByCategory = () => {
    return (
        <div className={styles.managedByCategory}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by category
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            <div className={styles.mainSection}>
                <CategoryComponent
                    image={<Storage />}
                    firstBlockText="Storage"
                    optimizationScore={55}
                    optimizationInstances={65}
                    totalOptimizationInstances={120}
                    isComingSoon={false}
                    isBorderRequired={true}
                />

                <CategoryComponent
                    image={<Compute />}
                    firstBlockText="Compute"
                    optimizationScore={55}
                    optimizationInstances={65}
                    totalOptimizationInstances={120}
                    isComingSoon={false}
                    isBorderRequired={true}
                />

                <CategoryComponent
                    image={<Applications />}
                    firstBlockText="Application"
                    optimizationScore={55}
                    optimizationInstances={65}
                    totalOptimizationInstances={120}
                    isComingSoon={true}
                    isBorderRequired={true}
                />

                <CategoryComponent
                    image={<Resiliency />}
                    firstBlockText="Resiliency"
                    optimizationScore={55}
                    optimizationInstances={65}
                    totalOptimizationInstances={120}
                    isComingSoon={true}
                    isBorderRequired={true}
                />

                <CategoryComponent
                    image={<Cloning />}
                    firstBlockText="Cloning"
                    optimizationScore={55}
                    optimizationInstances={65}
                    totalOptimizationInstances={120}
                    isComingSoon={true}
                    isBorderRequired={false}
                />
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByCategory;
