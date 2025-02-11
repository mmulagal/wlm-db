import { DsTypography } from '@netapp/design-system';
import { ReactComponent as DatabaseManagement } from '../../../assets/Database management.svg';
import { ReactComponent as DatabaseOperation } from '../../../assets/Database optimization.svg';
import styles from './InventoryCards.module.scss';

const InventoryCards = () => {
    return (
        <div className={styles['inventory-cards']}>
            <div className={styles['inventory-card']}>
                <DatabaseManagement />
                <div className={styles.contentArea}>
                    <DsTypography variant="Semibold_16">Database management</DsTypography>
                    <DsTypography variant="Regular_14">
                        Managing a database ensures data integrity and consistency, which is crucial for making accurate
                        decisions. It also enhances data security by implementing access controls and encryption,
                        protecting sensitive information.
                    </DsTypography>
                </div>
            </div>
            <div className={styles['inventory-card']}>
                <DatabaseOperation />
                <div className={styles.contentArea}>
                    <DsTypography variant="Semibold_16">Database optimization</DsTypography>
                    <DsTypography variant="Regular_14">
                        Optimizing a database enhances its performance, ensuring faster data retrieval and processing,
                        which boosts overall productivity. It also reduces resource consumption, leading to cost savings
                        and more efficient use of system resources.
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default InventoryCards;
