import styles from './InventoryHeaderSection.module.scss';
import NewInventoryHeaderSection from '../NewInventoryHeaderSection/NewInventoryHeaderSection';

const InventoryHeaderSection = () => {
    return (
        <div className={styles.inventoryHeader}>
            <NewInventoryHeaderSection />
        </div>
    );
};

export default InventoryHeaderSection;
