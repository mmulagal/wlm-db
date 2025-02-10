import { useAppSelector } from '../../../store/storeHooks';
import HostTable from '../HostTable/HostTable';
import InstancesTable from '../InstancesTable/InstancesTable';
// import HostsTable from './HostsTable/HostsTable';
import styles from './InventoryTablesComponent.module.scss';

const InventoryTablesComponent = () => {
    const { selectedInventoryTab } = useAppSelector(state => state.inventoryV2);
    return (
        <div className={styles['inventory-tables-component']}>
            {selectedInventoryTab === 'Hosts' && <HostTable />}
            {selectedInventoryTab === 'Instances' && <InstancesTable />}
            {selectedInventoryTab === 'Databases' && <div>Render Databases table here </div>}
        </div>
    );
};

export default InventoryTablesComponent;
