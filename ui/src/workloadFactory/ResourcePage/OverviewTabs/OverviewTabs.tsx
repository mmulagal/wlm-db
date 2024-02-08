import { useEffect, useState } from 'react';
import { Typography } from '@netapp/design-system';
import styles from './OverviewTabs.module.scss';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const OverviewTabs = () => {
    const dispatch = useDispatch();
    const selectedTabOverview = useAppSelector(state => state.databaseHome.selectedTab);
    const [selectedTab, setSelectedTab] = useState('Overview');

    useEffect(() => {
        setSelectedTab(selectedTabOverview);
    }, [selectedTabOverview]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(selectedTabSelection(value));
    };
    return (
        <div
            className={styles.overviewTabs}
        >
            <div className={selectedTab === 'Overview' ? `${styles.headers} ${styles.active}` : `${styles.headers}`}>
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Overview' ? `${styles.headerPart1} ${styles.activeText}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Overview')}
                >
                    {GENERAL.OVERVIEW}
                </Typography>
            </div>
            <div className={selectedTab === 'Database list' ? `${styles.headers} ${styles.active}` : `${styles.headers}`}>
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Database list' ? `${styles.headerPart2} ${styles.activeText}` : `${styles.headerPart2}`
                    }
                    onClick={() => handleClick('Database list')}
                >
                    {GENERAL.DATABASES}
                </Typography>
            </div>
        </div>
    );
};

export default OverviewTabs;
