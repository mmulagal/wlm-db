import { useAppSelector } from '../../store/storeHooks';
import styles from './Inventory.module.scss';
import InventoryHeaderSection from './InventoryHeaderSection/InventoryHeaderSection';
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
            {selectedInventoryTab === 'Managed Hosts' && <ManagedHosts />}
            {selectedInventoryTab === 'Unmanaged Hosts' && <UnmanagedHosts />}
            {selectedInventoryTab === 'Undetected Hosts' && <UndetectedHosts />}
        </div>
    );
};

export default Inventory;
