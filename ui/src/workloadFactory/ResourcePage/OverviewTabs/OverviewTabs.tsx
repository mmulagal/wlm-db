import { useEffect, useState } from 'react';
import { Typography } from '@netapp/design-system';
import styles from './OverviewTabs.module.scss';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { WLF_TABS } from '../../../utils/consts';

const OverviewTabs = () => {
    const dispatch = useDispatch();
    const selectedTabOverview = useAppSelector(state => state.databaseHome.selectedTab);
    const [selectedTab, setSelectedTab] = useState(WLF_TABS.OVERVIEW);

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
            <div className={selectedTab === WLF_TABS.OVERVIEW ? `${styles.headers} ${styles.active}` : `${styles.headers}`}>
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.OVERVIEW ? `${styles.headerPart1} ${styles.activeText}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WLF_TABS.OVERVIEW)}
                >
                    {GENERAL.OVERVIEW}
                </Typography>
            </div>
            <div className={selectedTab === WLF_TABS.DATABASE_LIST ? `${styles.headers} ${styles.active}` : `${styles.headers}`}>
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.DATABASE_LIST ? `${styles.headerPart2} ${styles.activeText}` : `${styles.headerPart2}`
                    }
                    onClick={() => handleClick(WLF_TABS.DATABASE_LIST)}
                >
                    {GENERAL.DATABASES}
                </Typography>
            </div>
        </div>
    );
};

export default OverviewTabs;
