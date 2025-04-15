import { useDispatch } from 'react-redux';
import styles from './OptimizeInnerPage.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography } from '@netapp/design-system';
import { setSelectedCloneTab } from '../../../store/workloadFactory/getWellOptimizeSlice';
import CloneInsideWF from './InnerTables/CloneInsideWF';
import CloneOutsideWF from './InnerTables/CloneOutsideWF';

const CloneTabs = () => {
    const dispatch = useDispatch();
    const { selectedCloneTab } = useAppSelector(state => state.getWellOptimize);
    //Function to change clone tabs
    const handleClick = (tab: string) => {
        dispatch(setSelectedCloneTab(tab));
    };

    const handleBulkActionForClone = (val: string, operation?: string, rowData?: any) => {
        //Perform APi call for bulk action
        console.log(val);
    };
    return (
        <>
            <div className={styles.cloneTabs}>
                <div
                    className={
                        selectedCloneTab === 'Clones created with Workload factory (AKA Sandboxes)'
                            ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthFirst}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedCloneTab === 'Clones created with Workload factory (AKA Sandboxes)'
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick('Clones created with Workload factory (AKA Sandboxes)')}
                    >
                        Clones created with Workload factory (AKA Sandboxes)
                    </DsTypography>
                </div>
                <div
                    className={
                        selectedCloneTab === 'Clones created outside of Workload factory'
                            ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthSecond}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedCloneTab === 'Clones created outside of Workload factory'
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick('Clones created outside of Workload factory')}
                    >
                        Clones created outside of Workload factory
                    </DsTypography>
                </div>
            </div>

            <div className={styles.tableSection}>
                {selectedCloneTab === 'Clones created with Workload factory (AKA Sandboxes)' && (
                    <CloneInsideWF handleBulkActionForClone={handleBulkActionForClone} />
                )}
                {selectedCloneTab === 'Clones created outside of Workload factory' && (
                    <CloneOutsideWF handleBulkActionForClone={handleBulkActionForClone} />
                )}
            </div>
        </>
    );
};

export default CloneTabs;
