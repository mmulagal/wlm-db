import styles from './Inventory.module.scss';
import InventoryCards from './InventoryCards/InventoryCards';
import InventoryTab from './InventoryTab/InventoryTab';
import InventoryTablesComponent from './InventoryTablesComponent/InventoryTablesComponent';

const InventoryV2 = () => {
    return (
        <div className={styles.inventory}>
            <InventoryCards />
            <InventoryTab />
            <InventoryTablesComponent />
        </div>
    );
};

export default InventoryV2;
