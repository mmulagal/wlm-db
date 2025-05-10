import styles from './WellArchitectDashboard.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { resetGwData, resetVisitedTabs, setTabVisited } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import WellArchitectTabs from './WellArchitectTabs/WellArchitectTabs';
import GetWell from '../GetWell';
import DatabaseListTable from '../../ResourcePage/DatabaseListTable/DatabaseListTable';

import { useEffect } from 'react';
import ResourceMSSQLOverview from './ResourceMSSQLOverview/ResourceMSSQLOverview';
import { ReactComponent as MenuIcon } from '../../../assets/ic_actions_menu_circle.svg';
import { ButtonWithDropdown } from '@netapp/design-system';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../store/workloadFactory/createNewDBSlice';
import { updateResourceId } from '../../../store/authSlice';
import { useNavigate } from 'react-router-dom';

const WellArchitectDashboard = () => {
    const dispatch = useDispatch();
    const { breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const { selectedHostname, selectedDatabaseInstanceName, selectedWellArchitectTab, visitedTabs } = useAppSelector(
        state => state.getWellOptimize
    );
    const navigate = useNavigate();

    const {
        resourceLoading: resourceLoadingState,

        selectedDatabaseInstance,
        selectedResourceId,
        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);

    // Reset visited tabs when leaving the dashboard
    useEffect(() => {
        return () => {
            dispatch(resetVisitedTabs());
        };
    }, [dispatch]);

    // Mark the current tab as visited when the component mounts
    useEffect(() => {
        if (!visitedTabs[selectedWellArchitectTab]) {
            const tabValue =
                selectedWellArchitectTab === 'Overview' || selectedWellArchitectTab === 'Databases'
                    ? 'Overview'
                    : selectedWellArchitectTab;
            dispatch(setTabVisited(tabValue));
        }
    }, [selectedWellArchitectTab, visitedTabs, dispatch]);

    return (
        <div className={styles['well-architect-dashboard']}>
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
                                dispatch(resetGwData({}));
                            }
                        },
                        {
                            title: `${selectedHostname}/${selectedDatabaseInstanceName}` || 'Host name/instance name'
                        }
                    ]}
                />

                <div className={styles.rightSection}>
                    <div className={styles.refreshIcon}>
                        <RefreshIcon />
                    </div>

                    <div className={styles.buttonContainer}>
                        <ButtonWithDropdown
                            variant="icon"
                            items={[
                                {
                                    id: 'createUserDB',
                                    children: 'Create a user database',
                                    isDisabled: resourceLoadingState,
                                    onClick: () => {
                                        if (!resourceLoadingState) {
                                            dispatch(addInitialDBCreateData(initialCreateNewUserState));
                                            dispatch(
                                                setCdbPageData({
                                                    dbHostName: selectedHostname,
                                                    instanceId: selectedDatabaseInstance,
                                                    instanceName: selectedDatabaseInstanceName,
                                                    cdbCredId: selectedResourceCredId,
                                                    cdbRegionId: selectedResourceRegionId
                                                })
                                            );
                                            dispatch(updateResourceId(selectedResourceId));
                                            navigate('../create-new-user');
                                        }
                                    }
                                },
                                {
                                    id: 'resetSQLServerPassword',
                                    children: 'Reset SQL server password',

                                    onClick: () => {}
                                },
                                {
                                    id: 'resetFSxAdminPassword',
                                    children: 'Reset FSxadmin password',

                                    onClick: () => {}
                                }
                            ]}
                        >
                            <MenuIcon />
                        </ButtonWithDropdown>
                    </div>
                </div>
            </div>

            <WellArchitectTabs />

            <div className={styles['well-architect-tabs-content']}>
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.OVERVIEW && <ResourceMSSQLOverview />}
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS && <GetWell />}

                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.DATABASES && (
                    <div className={styles.databaseListTable}>
                        <DatabaseListTable />
                    </div>
                )}
            </div>
        </div>
    );
};

export default WellArchitectDashboard;
