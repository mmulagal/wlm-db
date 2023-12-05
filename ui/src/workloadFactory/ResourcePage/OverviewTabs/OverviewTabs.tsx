import { useEffect, useState } from 'react';
import { Typography } from '@netapp/design-system';
import styles from './OverviewTabs.module.scss';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';

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
        <div className={styles.overviewTabs}>
            <Typography
                variant="Semibold_14"
                className={
                    selectedTab === 'Overview' ? `${styles.headerPart1} ${styles.active}` : `${styles.headerPart1}`
                }
                onClick={() => handleClick('Overview')}
            >
                Overview
            </Typography>
            <Typography
                variant="Semibold_14"
                className={
                    selectedTab === 'Database list' ? `${styles.headerPart2} ${styles.active}` : `${styles.headerPart2}`
                }
                onClick={() => handleClick('Database list')}
            >
                Database list
            </Typography>
        </div>
    );
};

export default OverviewTabs;
