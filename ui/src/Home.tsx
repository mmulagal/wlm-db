import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, useLocation } from 'react-router-dom';
import AppNotification from './common/AppNotification/AppNotification';
import MainComponent from './components/CreateMsSql/MainComponent/MainComponent';
import DiscoverPage from './components/Discover/DiscoverPage';

import styles from './Home.module.scss';
import { clearNotifications, removeNotification } from './store/notificationSlice';

const Home = () => {
    const location = useLocation();
    const notificationsObj = useSelector((state: any) => state.notifications);
    const dispatch = useDispatch();
    const showNotifications = useMemo(() => {
        return notificationsObj && notificationsObj.messages && notificationsObj.messages.length > 0;
    }, [notificationsObj]);

    return (
        <div className={styles['app-layout']}>
            <Routes>
                <Route path={`add-working-environment/database-services/:storage/create`} element={<MainComponent />} />
                <Route
                    path={`add-working-environment/database-services/:storage/discover`}
                    element={<DiscoverPage />}
                />
                <Route path="*" element={<MainComponent />} />
            </Routes>

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
