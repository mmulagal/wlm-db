import { useEffect, useState } from 'react';
import { Typography } from '@netapp/design-system';
import styles from './InventoryTabs.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedInventoryTab } from '../../../store/workloadFactory/inventorySlice';

const InventoryTabs = () => {
    const dispatch = useDispatch();
    const selectedInventoryTab = useAppSelector(state => state.inventory.selectedInventoryTab);
    const [selectedTab, setSelectedTab] = useState('Managed Hosts');

    useEffect(() => {
        setSelectedTab(selectedInventoryTab);
    }, [selectedInventoryTab]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedInventoryTab(value));
    };

    return (
        <div className={selectedTab === 'Managed Hosts' ? `${styles.inventoryTabs}` : `${styles.inventoryTabs} `}>
            <div
                className={selectedTab === 'Managed Hosts' ? `${styles.headers} ${styles.active}` : `${styles.headers}`}
            >
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Managed Hosts'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Managed Hosts')}
                >
                    Managed hosts (24)
                </Typography>
            </div>
            <div
                className={
                    selectedTab === 'Unmanaged Hosts' ? `${styles.headers} ${styles.active}` : `${styles.headers}`
                }
            >
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Unmanaged Hosts'
                            ? `${styles.headerPart2} ${styles.activeText}`
                            : `${styles.headerPart2}`
                    }
                    onClick={() => handleClick('Unmanaged Hosts')}
                >
                    Unmanaged hosts (8)
                </Typography>
            </div>
            <div
                className={
                    selectedTab === 'Undetected Hosts' ? `${styles.headers} ${styles.active}` : `${styles.headers}`
                }
            >
                <Typography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Undetected Hosts'
                            ? `${styles.headerPart3} ${styles.activeText}`
                            : `${styles.headerPart3}`
                    }
                    onClick={() => handleClick('Undetected Hosts')}
                >
                    Undetected hosts (8)
                </Typography>
            </div>
        </div>
    );
};

export default InventoryTabs;
