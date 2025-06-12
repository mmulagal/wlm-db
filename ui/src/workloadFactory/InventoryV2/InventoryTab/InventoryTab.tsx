import { DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import styles from './InventoryTab.module.scss';
import { WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedInventoryTab } from '../../../store/workloadFactory/inventoryV2Slice';

const InventoryTab = () => {
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE);
    const { selectedInventoryTab, instanceTableRows, hostTableRows, databaseTableRows } = useAppSelector(
        state => state.inventoryV2
    );

    useEffect(() => {
        setSelectedTab(selectedInventoryTab);
    }, [selectedInventoryTab]);
    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedInventoryTab(value));
    };
    return (
        <div className={styles.inventoryTab}>
            <div
                className={
                    selectedTab === 'Hosts'
                        ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthFirst}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Hosts' ? `${styles.headerPart1} ${styles.activeText}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Hosts')}
                >
                    Hosts ({hostTableRows.length})
                </DsTypography>
            </div>
            <div
                className={
                    selectedTab === 'Instances'
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Instances'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Instances')}
                >
                    Instances ({instanceTableRows.length})
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === 'Databases'
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Databases'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Databases')}
                >
                    Databases ({databaseTableRows.length})
                </DsTypography>
            </div>
        </div>
    );
};

export default InventoryTab;
