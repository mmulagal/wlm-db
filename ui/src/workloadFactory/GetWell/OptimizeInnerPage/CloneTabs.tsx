import { useDispatch } from 'react-redux';
import styles from './OptimizeInnerPage.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography } from '@netapp/design-system';
import { setSelectedCloneTab } from '../../../store/workloadFactory/getWellOptimizeSlice';
import CloneInsideWF from './InnerTables/CloneInsideWF';
import CloneOutsideWF from './InnerTables/CloneOutsideWF';
import { GENERAL } from '../../../utils/appConstants';
import { useEffect, useState } from 'react';

const CloneTabs = ({ data, fromPage = '' }: any) => {
    const dispatch = useDispatch();
    const { selectedCloneTab } = useAppSelector(state => state.getWellOptimize);
    const [wfDatabase, setWfDatabase] = useState<any>(null);
    const [otherDatabase, setOtherDatabase] = useState<any>(null);

    useEffect(() => {
        let wfDbItems: any = [];
        let otherDbItems: any = [];
        data?.map((item: any) => {
            const sourceVolumeNames = item?.clonedVolumeDetails?.map((detail: any) => detail?.sourceVolumeName) || [];
            if (item?.clonedBy === 'netapp_wf') {
                wfDbItems.push({
                    ...item,
                    sourceVolumeNamesList: sourceVolumeNames.join(',')
                });
            } else {
                otherDbItems.push({
                    ...item,
                    sourceVolumeNamesList: sourceVolumeNames.join(',')
                });
            }
        });
        setWfDatabase(wfDbItems);
        setOtherDatabase(otherDbItems);
    }, [data]);

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
                        selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB1
                            ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthFirst}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB1
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(GENERAL.CLONE_MANAGEMENT_TAB1)}
                    >
                        {GENERAL.CLONE_MANAGEMENT_TAB1} {'(' + wfDatabase?.length + ')'}
                    </DsTypography>
                </div>
                <div
                    className={
                        selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB2
                            ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthSecond}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB2
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(GENERAL.CLONE_MANAGEMENT_TAB2)}
                    >
                        {GENERAL.CLONE_MANAGEMENT_TAB2} {'(' + otherDatabase?.length + ')'}
                    </DsTypography>
                </div>
            </div>

            <div className={styles.tableSection}>
                {selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB1 && (
                    <CloneInsideWF
                        data={wfDatabase}
                        handleBulkActionForClone={handleBulkActionForClone}
                        fromPage={fromPage}
                    />
                )}
                {selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB2 && (
                    <CloneOutsideWF
                        data={otherDatabase}
                        handleBulkActionForClone={handleBulkActionForClone}
                        fromPage={fromPage}
                    />
                )}
            </div>
        </>
    );
};

export default CloneTabs;
