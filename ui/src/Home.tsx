import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { Routes, Route, useNavigate } from 'react-router-dom';
import AppNotification from './common/AppNotification/AppNotification';
import MainComponent from './components/CreateMsSql/MainComponent/MainComponent';

import styles from './Home.module.scss';
import { clearNotifications, removeNotification } from './store/notificationSlice';

import JobMonitoring from './workloadFactory/JobMonitoring/JobMonitoring';
import HeaderComponent from './workloadFactory/DatabaseHomePage/HeaderComponent/HeaderComponent';
import WizardComponent from './workloadFactory/CreateNewDB/WizardComponent/WizardComponent';
import CreateNewSandbox from './workloadFactory/Sandbox/CreateNewSandbox/CreateNewSandbox';
import { BXP_MESSAGES, WLF_TABS } from './utils/consts';
import PostgressMainComponent from './components/Postgress/PostgressMainComponent';
import { useAppSelector } from './store/storeHooks';
import { useRunOnce } from './common/hooks/useRunOnce';
import {
    checkLeftNavBXPRoute,
    checkLeftNavRoute,
    clearEBSBulkSelections,
    setRoutePath,
    setSelectedTabInformation,
    setTabInfoFOrBXP
} from './utils/utilityFunctions';
import { setSelectedHeaderTab } from './store/workloadFactory/inventoryV2Slice';
import Marketing from './Marketing/Marketing';
import ErrorAnalysisDeepLink from './workloadFactory/ErrorAnalysisDeepLink/ErrorAnalysisDeepLink';
import WellArchitectedConfigDeepLink from './workloadFactory/WellArchitectedConfigDeepLink/WellArchitectedConfigDeepLink';
import InventoryFsxDeepLink from './workloadFactory/GetWell/OptimizeInnerPage/CRRRedirectionContent/InventoryFsxDeepLink';

const Home = () => {
    const notificationsObj = useSelector((state: any) => state.notifications);
    const { isWorkloadFactory, pathname: navigationPath, initialPathName } = useAppSelector(state => state?.auth);

    const { statusData } = useAppSelector(state => state.headers.getStatus);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // This code is only for BlueXP
    useRunOnce(() => {
        if (!isWorkloadFactory) {
            window.onmessage = (msg: any) => {
                if (
                    msg &&
                    msg?.data &&
                    (msg?.data?.type === BXP_MESSAGES.SERVICE_LOCATION_CHANGE ||
                        msg?.data?.type === BXP_MESSAGES.SERVICE_ON_READY)
                ) {
                    if (msg?.data?.payload?.pathname === '/fsxdb/mssql-deploy-wizard') {
                        navigate('../fsxdb/mssql-deploy-wizard');
                    } else if (msg?.data?.payload?.pathname === '/fsxdb/postgreSQL-deploy-wizard') {
                        navigate('../fsxdb/postgreSQL-deploy-wizard');
                    } else if (msg?.data?.payload?.pathname === '/fsxdb/marketing') {
                        navigate('../fsxdb/marketing');
                    } else if (msg?.data?.payload?.pathname !== '/fsxdb/storage-saving-calculator') {
                        // To stop redirecting back to explore savings
                        const tabInfo = setTabInfoFOrBXP(msg?.data?.payload?.pathname, statusData);
                        const routePath = setRoutePath(tabInfo, msg?.data?.payload?.search);
                        if (routePath === 'redirect') {
                            console.log('Redirecting to fsxdb');
                            navigate('../fsxdb');
                        } else {
                            navigate(`../fsxdb/${routePath}`);
                        }

                        const tabInformation = setSelectedTabInformation(tabInfo, msg?.data?.payload?.pathname);

                        dispatch(setSelectedHeaderTab(tabInformation));
                    }
                }
            };
        }
    });

    useEffect(() => {
        if (isWorkloadFactory && navigationPath && checkLeftNavRoute(navigationPath)) {
            navigate(navigationPath);
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: navigationPath,
                    replace: true
                }
            });
            clearEBSBulkSelections(dispatch);
        } else if (!isWorkloadFactory && navigationPath && checkLeftNavBXPRoute(navigationPath)) {
            // Clear EBS bulk selections when navigating away from Explore Savings
            clearEBSBulkSelections(dispatch);
        }
    }, [navigationPath]);

    // only for BXP back button handling
    const isHandlingPopState = useRef(false);
    useEffect(() => {
        if (!isWorkloadFactory) {
            const handlePopState = () => {
                if (isHandlingPopState.current) {
                    isHandlingPopState.current = false;
                    return;
                }
                isHandlingPopState.current = true;
                window.history.go(-1);

                setTimeout(() => {
                    isHandlingPopState.current = false;
                }, 200);
            };
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [isWorkloadFactory]);

    // To set dashboard highlight
    useEffect(() => {
        if (isWorkloadFactory && initialPathName === '/databases') {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: '../databases/dashboard',
                    replace: true
                }
            });
        }
    }, [isWorkloadFactory, initialPathName]);

    // @ts-ignore
    const showNotifications = useMemo(
        () => notificationsObj && notificationsObj.messages && notificationsObj.messages.length > 0,
        [notificationsObj]
    );

    return (
        <div className={styles['app-layout']}>
            <div style={{ height: '100%' }}>
                {isWorkloadFactory && (
                    <Routes>
                        <Route path="mssql-deploy-wizard" element={<MainComponent />} />
                        <Route path="/databases/mssql-deploy-wizard" element={<MainComponent />} />
                        <Route path="/databases/marketing" element={<Marketing />} />
                        <Route path="postgreSQL-deploy-wizard" element={<PostgressMainComponent />} />
                        <Route path="/databases/postgreSQL-deploy-wizard" element={<PostgressMainComponent />} />

                        <Route path="/databases" element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} />
                        <Route path="/databases/dashboard" element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} />
                        <Route
                            path="/databases/inventory/cred/:credId/region/:regionId/databaseHost/:hostId/databaseInstance/:instanceId/logAnalyzerStatus/:status/engineType/:engineType/hostname/:hostname/dbInstanceName/:dbInstanceName"
                            element={<ErrorAnalysisDeepLink />}
                        />
                        <Route
                            path="/databases/inventory/:credId/:regionId/:fsxId/:tab"
                            element={<InventoryFsxDeepLink />}
                        />
                        <Route path="/databases/inventory" element={<HeaderComponent tab={WLF_TABS.INVENTORY} />} />
                        <Route path="/databases/sandboxes" element={<HeaderComponent tab={WLF_TABS.SANDBOXES} />} />
                        {/* Routes For Explore savings */}
                        <Route
                            path="/databases/explore-savings"
                            element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                        />
                        <Route
                            path="/databases/explore-savings/explore-savings-ebs"
                            element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                        />
                        <Route
                            path="/databases/storage-saving-calculator"
                            element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                        />
                        <Route
                            path="/databases/explore-savings/explore-savings-fsxw"
                            element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_FsxW} />}
                        />
                        <Route
                            path="/databases/explore-savings/explore-savings-on-premise"
                            element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_ONPREM} />}
                        />
                        {/* Routes For Oracle Explore savings */}
                        <Route
                            path="/databases/explore-savings/explore-savings-oracle-on-premise"
                            element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_ORACLE_ONPREM} />}
                        />
                        <Route
                            path="/databases/explore-savings/explore-savings-oracle-ebs"
                            element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_ORACLE_EBS} />}
                        />
                        <Route
                            path="/databases/saving-calculator"
                            element={<HeaderComponent tab={WLF_TABS.SAVINGS_CALCULATOR} />}
                        />
                        <Route
                            path="/databases/job-monitoring"
                            element={<HeaderComponent tab={WLF_TABS.JOB_MONITORING} />}
                        />
                        <Route
                            path="/databases/well-architected/configName/:configName/engineType/:engineType"
                            element={<WellArchitectedConfigDeepLink />}
                        />
                        <Route
                            path="/databases/well-architected"
                            element={<HeaderComponent tab={WLF_TABS.WELL_ARCHITECTED_TAB} />}
                        />
                        <Route path="/create-new-user" element={<WizardComponent />} />
                        <Route path="/job-monitor" element={<JobMonitoring />} />
                        <Route path="/databases/sandboxes/create-new-sandbox" element={<CreateNewSandbox />} />
                        {/* Testing code */}
                        {/* <Route path="*" element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} /> */}
                        <Route
                            path="/register-wizard"
                            element={<HeaderComponent tab={WLF_TABS.REGISTER_COMPONENT} />}
                        />
                        <Route
                            path="/register-bulk-wizard"
                            element={<HeaderComponent tab={WLF_TABS.REGISTER_COMPONENT} />}
                        />
                    </Routes>
                )}
                {!isWorkloadFactory && (
                    <Suspense fallback={<MainComponent />}>
                        <Routes>
                            <Route path="/mssql-deploy-wizard" element={<MainComponent />} />
                            <Route path="/fsxdb/mssql-deploy-wizard" element={<MainComponent />} />
                            <Route path="/fsxdb/marketing" element={<Marketing />} />
                            <Route path="/fsxdb/postgreSQL-deploy-wizard" element={<PostgressMainComponent />} />

                            <Route path="/fsxdb" element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} />
                            <Route path="/fsxdb/dashboard" element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} />
                            <Route
                                path="/databases/inventory/cred/:credId/region/:regionId/databaseHost/:hostId/databaseInstance/:instanceId/logAnalyzerStatus/:status/engineType/:engineType/hostname/:hostname/dbInstanceName/:dbInstanceName"
                                element={<ErrorAnalysisDeepLink />}
                            />
                            <Route
                                path="/fsxdb/inventory/cred/:credId/region/:regionId/databaseHost/:hostId/databaseInstance/:instanceId/logAnalyzerStatus/:status/engineType/:engineType/hostname/:hostname/dbInstanceName/:dbInstanceName"
                                element={<ErrorAnalysisDeepLink />}
                            />

                            <Route
                                path="/fsxdb/inventory/:credId/:regionId/:fsxId/:tab"
                                element={<InventoryFsxDeepLink />}
                            />
                            <Route path="/databases/inventory" element={<HeaderComponent tab={WLF_TABS.INVENTORY} />} />
                            <Route path="/fsxdb/inventory" element={<HeaderComponent tab={WLF_TABS.INVENTORY} />} />
                            <Route path="/fsxdb/sandboxes" element={<HeaderComponent tab={WLF_TABS.SANDBOXES} />} />
                            <Route
                                path="/fsxdb/explore-savings"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS} />}
                            />

                            <Route
                                path="/fsxdb/job-monitoring"
                                element={<HeaderComponent tab={WLF_TABS.JOB_MONITORING} />}
                            />
                            <Route
                                path="/fsxdb/well-architected/configName/:configName/engineType/:engineType"
                                element={<WellArchitectedConfigDeepLink />}
                            />
                            <Route
                                path="/fsxdb/well-architected"
                                element={<HeaderComponent tab={WLF_TABS.WELL_ARCHITECTED_TAB} />}
                            />
                            <Route
                                path="/databases/explore-savings/explore-savings-ebs"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                            />

                            <Route
                                path="/fsxdb/explore-savings-ebs"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                            />
                            <Route
                                path="/fsxdb/storage-saving-calculator"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                            />
                            <Route
                                path="/fsxdb/storage-saving-calculator-fsxw"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_FsxW} />}
                            />
                            <Route
                                path="/databases/explore-savings-fsxw"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_FsxW} />}
                            />
                            <Route
                                path="/fsxdb/explore-savings-fsxw"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_FsxW} />}
                            />
                            <Route
                                path="/fsxdb/explore-savings-on-premise"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_ONPREM} />}
                            />
                            <Route
                                path="/fsxdb/explore-savings-oracle-on-premise"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_ORACLE_ONPREM} />}
                            />
                            <Route
                                path="/fsxdb/explore-savings-oracle-ebs"
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_ORACLE_EBS} />}
                            />
                            <Route path="/create-new-user" element={<WizardComponent />} />
                            <Route path="/job-monitor" element={<JobMonitoring />} />
                            <Route path="/fsxdb/sandboxes/create-new-sandbox" element={<CreateNewSandbox />} />
                            {/* <Route path="*" element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} /> */}
                            <Route
                                path="/fsxdb/register-wizard"
                                element={<HeaderComponent tab={WLF_TABS.REGISTER_COMPONENT} />}
                            />
                            <Route
                                path="/fsxdb/register-bulk-wizard"
                                element={<HeaderComponent tab={WLF_TABS.REGISTER_COMPONENT} />}
                            />
                        </Routes>
                    </Suspense>
                )}
            </div>

            {/* To Display the notification */}
            {showNotifications && (
                <AppNotification
                    notifications={notificationsObj}
                    onClose={(index: number | undefined, totalCount: number | undefined) => {
                        if (typeof index !== 'undefined') {
                            dispatch(removeNotification(index));
                            if (totalCount === 1) {
                                dispatch(clearNotifications());
                            }
                        } else {
                            dispatch(clearNotifications());
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Home;
