import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import styles from './OracleResourcePages.module.scss';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import OracleTabs from './OracleTabs/OracleTabs';
import OracleWellArchitectDashboard from './OracleWellArchitectDashboard/OracleWellArchitectDashboard';
import OracleOverview from './OracleOverview/OracleOverview';
import {
    resetOracleResourceVisitedTabs,
    setOracleResourceVisitedTabs
} from '../../../store/workloadFactory/oracleSlice';

const OracleResourcePages = () => {
    const dispatch = useDispatch();
    const { breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const { selectedOracleInnerPageTab, visitedTabs } = useAppSelector(state => state.oracleSlice);
    const { selectedHostname, selectedDatabaseInstanceName } = useAppSelector(state => state.getWellOptimize);

    // Reset visited tabs when leaving the dashboard
    useEffect(
        () => () => {
            dispatch(resetOracleResourceVisitedTabs());
        },
        [dispatch]
    );

    // Mark the current tab as visited when the component mounts
    useEffect(() => {
        if (!visitedTabs[selectedOracleInnerPageTab]) {
            dispatch(setOracleResourceVisitedTabs(selectedOracleInnerPageTab));
        }
    }, [selectedOracleInnerPageTab, visitedTabs, dispatch]);
    return (
        <div className={styles['oracle-inner-pages']}>
            <div className={`${commonStyles.commonBreadCrumb} ${styles.breadCrumb}`} style={{ left: '0%' }}>
                <BreadCrumbs
                    items={[
                        {
                            title: breadCrumbSelectedFrom === WLF_TABS.INVENTORY ? 'Inventory' : 'Dashboard',
                            onClick: () => {
                                if (breadCrumbSelectedFrom === WLF_TABS.INVENTORY) {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                } else {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                }
                            }
                        },
                        {
                            title: `${selectedHostname}/${selectedDatabaseInstanceName}` || 'Host name/instance name'
                        }
                    ]}
                />
            </div>

            <OracleTabs />

            {selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS && (
                <OracleWellArchitectDashboard />
            )}

            {selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.OVERVIEW && <OracleOverview />}
        </div>
    );
};

export default OracleResourcePages;
