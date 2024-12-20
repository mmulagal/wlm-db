import { DsTypography, Popover } from '@netapp/design-system';
import styles from './ExploreSavingsTab.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedExploreSavingsTab } from '../../../store/workloadFactory/exploreSavingsSlice';
import { WLF_TABS } from '../../../utils/consts';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { handleExploreSavingsURL } from '../../../utils/utilityFunctions';

const ExploreSavingsTab = () => {
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE);
    const selectedExploreSavingsTab = useAppSelector(state => state.exploreSavings.selectedExploreSavingsTab);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    useEffect(() => {
        setSelectedTab(selectedExploreSavingsTab);
    }, [selectedExploreSavingsTab]);
    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedExploreSavingsTab(value));
        handleExploreSavingsURL(value, isWorkloadFactory);
    };
    return (
        <div className={styles.exploreSavingsTab}>
            <div
                className={
                    selectedTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE
                        ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthFirst}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE)}
                >
                    SQL Server on Elastic Block Store (EBS)
                </DsTypography>
            </div>
            <div
                className={
                    selectedTab === WLF_TABS.MSSQL_FSX_FOR_WINDOWS
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.MSSQL_FSX_FOR_WINDOWS
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WLF_TABS.MSSQL_FSX_FOR_WINDOWS)}
                >
                    SQL Server on FSx for Windows
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === WLF_TABS.MSSQL_ON_PREMISES
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <Popover
                    popoverClass={styles['copy-popover']}
                    children={GENERAL.COMING_SOON}
                    trigger="hover"
                    container={
                        <DsTypography
                            variant="Semibold_14"
                            // className={
                            //     selectedTab === WLF_TABS.MSSQL_ON_PREMISES
                            //         ? `${styles.headerPart1} ${styles.activeText}`
                            //         : `${styles.headerPart1}`
                            // }
                            className={styles.headerDisabled}
                            // onClick={() => handleClick(WLF_TABS.MSSQL_ON_PREMISES)}
                            onClick={() => {}}
                        >
                            SQL Server On-Premises
                        </DsTypography>
                    }
                />
            </div>
        </div>
    );
};

export default ExploreSavingsTab;
