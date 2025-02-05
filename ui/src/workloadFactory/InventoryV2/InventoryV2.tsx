import styles from './Inventory.module.scss';
import InventoryHeaderSection from './InventoryHeaderSection/InventoryHeaderSection';
import InventoryTab from './InventoryTab/InventoryTab';
import InventoryTable from './InventoryTable/InventoryTable';
import InventoryTablesComponent from './InventoryTablesComponent/InventoryTablesComponent';

const InventoryV2 = () => {
    return (
        <div className={styles.inventory}>
            <InventoryHeaderSection />
            <InventoryTab />
            <InventoryTablesComponent />
            <InventoryTable />
        </div>
    );
};

export default InventoryV2;
