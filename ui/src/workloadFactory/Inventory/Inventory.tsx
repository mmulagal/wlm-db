import { useAppSelector } from '../../store/storeHooks';
import { WLF_TABS } from '../../utils/consts';
import styles from './Inventory.module.scss';
import InventoryHeaderSection from './InventoryHeaderSection/InventoryHeaderSection';
import InventoryTable from './InventoryTable/InventoryTable';
import InventoryTabs from './InventoryTabs/InventoryTabs';
import ManagedHosts from './ManagedHosts/ManagedHosts';
import UndetectedHosts from './UndetectedHosts/UndetectedHosts';
import UnmanagedHosts from './UnmanagedHosts/UnmanagedHosts';

const Inventory = () => {
    const selectedInventoryTab = useAppSelector(state => state.inventory.selectedInventoryTab);

    return (
        <div className={styles.inventory}>
            <InventoryHeaderSection />
            <div className={styles.tabs}>
                <InventoryTabs />
            </div>
            {/* {selectedInventoryTab === WLF_TABS.MANAGED_HOSTS && <ManagedHosts />} */}
            {selectedInventoryTab === WLF_TABS.MANAGED_HOSTS && <InventoryTable />}
            {selectedInventoryTab === WLF_TABS.UNMANAGED_HOSTS && <UnmanagedHosts />}
            {selectedInventoryTab === WLF_TABS.UNDETECTED_HOSTS && <UndetectedHosts />}
        </div>
    );
};

export default Inventory;
