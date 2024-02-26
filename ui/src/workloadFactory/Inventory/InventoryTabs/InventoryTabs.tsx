import { useEffect, useState } from 'react';
import { Typography } from '@netapp/design-system';
import styles from './InventoryTabs.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedInventoryTab } from '../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';

const InventoryTabs = () => {
    const dispatch = useDispatch();
    const selectedInventoryTab = useAppSelector(state => state.inventory.selectedInventoryTab);
    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { unManagedHosts, unIdentifiableHosts } = useAppSelector(state => state.inventory);
    const [selectedTab, setSelectedTab] = useState(WLF_TABS.MANAGED_HOSTS);

    useEffect(() => {
        setSelectedTab(selectedInventoryTab);
    }, [selectedInventoryTab]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedInventoryTab(value));
    };

    return (
        <div className={styles.inventoryTabs}>
            <div
                className={
                    selectedTab === WLF_TABS.MANAGED_HOSTS ? `${styles.headers} ${styles.active}` : `${styles.headers}`
                }
            >
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.MANAGED_HOSTS
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WLF_TABS.MANAGED_HOSTS)}
                >
                    {GENERAL.TAB_MANAGED_HOSTS} ({databaseHostsData?.length || 0})
                </Typography>
            </div>
            <div
                className={
                    selectedTab === WLF_TABS.UNMANAGED_HOSTS
                        ? `${styles.headers} ${styles.active}`
                        : `${styles.headers}`
                }
            >
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.UNMANAGED_HOSTS
                            ? `${styles.headerPart2} ${styles.activeText}`
                            : `${styles.headerPart2}`
                    }
                    onClick={() => handleClick(WLF_TABS.UNMANAGED_HOSTS)}
                >
                    {GENERAL.TAB_UNAMANGED_HOSTS} ({unManagedHosts.length})
                </Typography>
            </div>
            <div
                className={
                    selectedTab === WLF_TABS.UNDETECTED_HOSTS
                        ? `${styles.headers} ${styles.active}`
                        : `${styles.headers}`
                }
            >
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === WLF_TABS.UNDETECTED_HOSTS
                            ? `${styles.headerPart3} ${styles.activeText}`
                            : `${styles.headerPart3}`
                    }
                    onClick={() => handleClick(WLF_TABS.UNDETECTED_HOSTS)}
                >
                    {GENERAL.TAB_UNIDENTIFIABLE_HOSTS} ({unIdentifiableHosts.length})
                </Typography>
            </div>
        </div>
    );
};

export default InventoryTabs;
