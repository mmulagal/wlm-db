import { DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import styles from './InventoryTab.module.scss';
import { DBType, INVENTORY_TAB_COMPONENTS, WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedInventoryTab } from '../../../store/workloadFactory/inventoryV2Slice';

const InventoryTab = () => {
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE);
    const { selectedInventoryTab, selectedHostType, instanceTableRows, hostTableRows, databaseTableRows } =
        useAppSelector(state => state.inventoryV2);

    useEffect(() => {
        setSelectedTab(selectedInventoryTab);
    }, [selectedInventoryTab]);
    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedInventoryTab(value));
    };
    const instanceTabLabel =
        selectedHostType === DBType.ORACLE ? INVENTORY_TAB_COMPONENTS.DATABASES : INVENTORY_TAB_COMPONENTS.INSTANCES;
    const databaseTabLabel =
        selectedHostType === DBType.ORACLE ? INVENTORY_TAB_COMPONENTS.PDB : INVENTORY_TAB_COMPONENTS.DATABASES;

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
                    selectedTab === INVENTORY_TAB_COMPONENTS.INSTANCES
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === INVENTORY_TAB_COMPONENTS.INSTANCES
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(INVENTORY_TAB_COMPONENTS.INSTANCES)}
                >
                    {instanceTabLabel} ({instanceTableRows.length})
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === INVENTORY_TAB_COMPONENTS.DATABASES
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === INVENTORY_TAB_COMPONENTS.DATABASES
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(INVENTORY_TAB_COMPONENTS.DATABASES)}
                >
                    {databaseTabLabel} ({databaseTableRows.length})
                </DsTypography>
            </div>
        </div>
    );
};

export default InventoryTab;
