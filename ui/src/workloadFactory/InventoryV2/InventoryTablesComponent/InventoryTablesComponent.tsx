import { useAppSelector } from '../../../store/storeHooks';
import DatabasesTable from './DatabasesTable/DatabasesTable';
import HostTable from './HostTable/HostTable';
import InstancesTable from './InstancesTable/InstancesTable';
import styles from './InventoryTablesComponent.module.scss';

const InventoryTablesComponent = () => {
    const { selectedInventoryTab } = useAppSelector(state => state.inventoryV2);
    return (
        <div className={styles['inventory-tables-component']}>
            {selectedInventoryTab === 'Hosts' && <HostTable />}
            {selectedInventoryTab === 'Instances' && <InstancesTable />}
            {selectedInventoryTab === 'Databases' && <DatabasesTable />}
        </div>
    );
};

export default InventoryTablesComponent;
