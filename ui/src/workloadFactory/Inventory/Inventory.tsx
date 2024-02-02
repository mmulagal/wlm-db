import { useAppSelector } from '../../store/storeHooks';
import styles from './Inventory.module.scss';
import InventoryTabs from './InventoryTabs/InventoryTabs';

const Inventory = () => {

    const selectedInventoryTab = useAppSelector(state => state.inventory.selectedInventoryTab);

    return (
        <div className={styles.inventory}>
            <div className={styles.tabs}>
                <InventoryTabs />
            </div>
            {selectedInventoryTab === 'Managed Hosts' && <div>Managed Hosts</div>}
            {selectedInventoryTab === 'Unmanaged Hosts' && <div>Unmanaged Hosts</div>}
            {selectedInventoryTab === 'Undetected Hosts' && <div>Undetected Hosts</div>}
        </div>
    );
};

export default Inventory;