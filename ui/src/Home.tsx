import React, { Suspense, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route } from 'react-router-dom';
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

const Home = () => {
    const notificationsObj = useSelector((state: any) => state.notifications);
    const dispatch = useDispatch();

    //@ts-ignore
    const showNotifications = useMemo(() => {
        return notificationsObj && notificationsObj.messages && notificationsObj.messages.length > 0;
    }, [notificationsObj]);

    return (
        <div className={styles['app-layout']}>
            <div style={{ height: '100%' }}>
                <Suspense fallback={<MainComponent />}>
                    <Routes>
                        <Route
                            path={`add-working-environment/database-services/:storage/create`}
                            element={<MainComponent />}
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
                        <Route path={'databases'} element={<HeaderComponent />} />
                        <Route path={'create-new-user'} element={<WizardComponent />} />
                        <Route path={'job-monitor'} element={<JobMonitoring />} />
                        <Route path="*" element={<MainComponent />} />
                    </Routes>
                </Suspense>
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
