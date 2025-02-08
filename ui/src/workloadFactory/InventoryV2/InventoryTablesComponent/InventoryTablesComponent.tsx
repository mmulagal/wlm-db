import { useAppSelector } from '../../../store/storeHooks';
import HostsTable from './HostsTable/HostsTable';
import styles from './InventoryTablesComponent.module.scss';

const InventoryTablesComponent = () => {
    const { selectedInventoryTab } = useAppSelector(state => state.inventoryV2);
    return (
        <div className={styles['inventory-tables-component']}>
            {selectedInventoryTab === 'Hosts' && <HostsTable />}
            {selectedInventoryTab === 'Instances' && <div>Render Instances table here </div>}
            {selectedInventoryTab === 'Databases' && <div>Render Databases table here </div>}
        </div>
    );
};

export default InventoryTablesComponent;
