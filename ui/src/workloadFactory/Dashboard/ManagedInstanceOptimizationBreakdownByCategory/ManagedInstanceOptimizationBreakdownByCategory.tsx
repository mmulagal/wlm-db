import { DsAccordion } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByCategory.module.scss';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../assets/Compute.svg';
import CategoryComponent from './CategoryComponent/CategoryComponent';
import { useMemo } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { getAssessmentGroupedByCategory } from '../../DatabaseHomePage/DatabaseHomeUtils';

const ManagedInstanceOptimizationBreakdownByCategory = ({ setOpenAccordion }: any) => {
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const categoryData = useMemo(() => {
        return getAssessmentGroupedByCategory(allmssqlHostAssessmentData);
    }, [allmssqlHostAssessmentData]);
    return (
        <div className={styles.managedByCategory}>
            <DsAccordion
                id="1"
                title={'Breakdown by category'}
                variant="Default"
                value=""
                onClick={() => setOpenAccordion((prev: any) => !prev)}
                children={
                    <div className={styles.mainSection}>
                        <CategoryComponent
                            image={<Storage />}
                            firstBlockText="Storage"
                            optimizationScore={Math.round(
                                ((categoryData.storage || 0) / (categoryData.total || 1)) * 100
                            )}
                            optimizationInstances={categoryData.storage || 0}
                            totalOptimizationInstances={categoryData.total || 0}
                            isComingSoon={false}
                            isBorderRequired={true}
                        />

                        <CategoryComponent
                            image={<Compute />}
                            firstBlockText="Compute"
                            optimizationScore={Math.round(
                                ((categoryData.compute || 0) / (categoryData.total || 1)) * 100
                            )}
                            optimizationInstances={categoryData.compute || 0}
                            totalOptimizationInstances={categoryData.total || 0}
                            isComingSoon={false}
                            isBorderRequired={true}
                        />

                        <CategoryComponent
                            image={<Applications />}
                            firstBlockText="Application"
                            optimizationScore={Math.round(
                                ((categoryData.application || 0) / (categoryData.total || 1)) * 100
                            )}
                            optimizationInstances={categoryData.application || 0}
                            totalOptimizationInstances={categoryData.total || 0}
                            isComingSoon={false}
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
                }
            />
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByCategory;
