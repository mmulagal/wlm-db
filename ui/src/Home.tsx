import React, { Suspense, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, useNavigate } from 'react-router-dom';
import AppNotification from './common/AppNotification/AppNotification';
import MainComponent from './components/CreateMsSql/MainComponent/MainComponent';
import DiscoverPage from './components/Discover/DiscoverPage';
import Databases from './components/Resource/Databases/Databases';
import MsSqlOverview from './components/Resource/MsSqlOverview/MsSqlOverview';
import ResourcePage from './components/Resource/ResourcePage';
import Tables from './components/Resource/Tables/Tables';

import styles from './Home.module.scss';
import { clearNotifications, removeNotification } from './store/notificationSlice';

import JobMonitoring from './workloadFactory/JobMonitoring/JobMonitoring';
import HeaderComponent from './workloadFactory/DatabaseHomePage/HeaderComponent/HeaderComponent';
import WizardComponent from './workloadFactory/CreateNewDB/WizardComponent/WizardComponent';
import CreateNewSandbox from './workloadFactory/Sandbox/CreateNewSandbox/CreateNewSandbox';
import { BXP_MESSAGES, WLF_TABS } from './utils/consts';
import PostgressMainComponent from './components/Postgress/PostgressMainComponent';
import { useAppSelector } from './store/storeHooks';
import { setSelectedHeaderTab } from './store/workloadFactory/inventorySlice';
import { useRunOnce } from './common/hooks/useRunOnce';
import { setTabInfoFOrBXP } from './utils/utilityFunctions';

const Home = () => {
    const notificationsObj = useSelector((state: any) => state.notifications);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    useRunOnce(() => {
        if (!isWorkloadFactory) {
            window.onmessage = (msg: any) => {
                if (msg && msg?.data && msg?.data?.type === BXP_MESSAGES.SERVICE_LOCATION_CHANGE) {
                    const tabInfo = setTabInfoFOrBXP(msg?.data?.payload?.pathname);
                    navigate('../fsxdb');
                    dispatch(setSelectedHeaderTab(tabInfo));
                }
            };
        }
    });

    //@ts-ignore
    const showNotifications = useMemo(() => {
        return notificationsObj && notificationsObj.messages && notificationsObj.messages.length > 0;
    }, [notificationsObj]);

    return (
        <div className={styles['app-layout']}>
            <div style={{ height: '100%' }}>
                {isWorkloadFactory && (
                    <Suspense fallback={<MainComponent />}>
                        <Routes>
                            <Route
                                path={`add-working-environment/database-services/:storage/create`}
                                element={<MainComponent />}
                            />
                            <Route
                                path={`add-working-environment/database-services/:storage/postgress`}
                                element={<PostgressMainComponent />}
                            />
                            <Route
                                path={`add-working-environment/database-services/:storage/discover`}
                                element={<DiscoverPage />}
                            />

                            <Route path={`mssql/:resourceId/:resourceName/`} element={<ResourcePage />}>
                                <Route path={'overview'} element={<MsSqlOverview />} />
                                <Route path={'databases'} element={<Databases />} />
                                <Route path={'tables'} element={<Tables />} />
                            </Route>
                            <Route path={'databases'} element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} />
                            <Route
                                path={'databases/inventory'}
                                element={<HeaderComponent tab={WLF_TABS.INVENTORY} />}
                            />
                            <Route
                                path={'databases/exploreSavingsEBS'}
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                            />
                            <Route
                                path={'databases/exploreSavingsFsxW'}
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_FsxW} />}
                            />
                            <Route path={'create-new-user'} element={<WizardComponent />} />
                            <Route path={'job-monitor'} element={<JobMonitoring />} />
                            <Route path={'create-new-sandbox'} element={<CreateNewSandbox />} />
                            <Route path="*" element={<MainComponent />} />
                        </Routes>
                    </Suspense>
                )}
                {!isWorkloadFactory && (
                    <Suspense fallback={<MainComponent />}>
                        <Routes>
                            <Route
                                path={`add-working-environment/database-services/:storage/create`}
                                element={<MainComponent />}
                            />
                            <Route
                                path={`add-working-environment/database-services/:storage/postgress`}
                                element={<PostgressMainComponent />}
                            />
                            <Route
                                path={`add-working-environment/database-services/:storage/discover`}
                                element={<DiscoverPage />}
                            />

                            <Route path={`mssql/:resourceId/:resourceName/`} element={<ResourcePage />}>
                                <Route path={'overview'} element={<MsSqlOverview />} />
                                <Route path={'databases'} element={<Databases />} />
                                <Route path={'tables'} element={<Tables />} />
                            </Route>
                            <Route path={'fsxdb'} element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} />
                            <Route
                                path={'databases/inventory'}
                                element={<HeaderComponent tab={WLF_TABS.INVENTORY} />}
                            />
                            <Route
                                path={'databases/exploreSavingsEBS'}
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_EBS} />}
                            />
                            <Route
                                path={'databases/exploreSavingsFsxW'}
                                element={<HeaderComponent tab={WLF_TABS.EXPLORE_SAVINGS_FsxW} />}
                            />
                            <Route path={'create-new-user'} element={<WizardComponent />} />
                            <Route path={'job-monitor'} element={<JobMonitoring />} />
                            <Route path={'create-new-sandbox'} element={<CreateNewSandbox />} />
                            <Route path="*" element={<HeaderComponent tab={WLF_TABS.DASHBOARD} />} />
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
                ></AppNotification>
            )}
        </div>
    );
};

export default Home;
