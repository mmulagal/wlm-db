import styles from './Inventory.module.scss';
import InventoryHeaderSection from './InventoryHeaderSection/InventoryHeaderSection';
import InventoryTable from './InventoryTable/InventoryTable';

const InventoryV2 = () => {

    return (
        <div className={styles.inventory}>
            <InventoryHeaderSection />
            <InventoryTable />
        </div>
    );
};

export default InventoryV2;
